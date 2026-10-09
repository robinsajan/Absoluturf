import unittest
from datetime import datetime
from unittest.mock import patch
import os
from flask_jwt_extended import create_access_token
from app import create_app
from models import db, User, Group, GroupMember, Match, MatchVote, GuestPlayer, Notification
from match_utils import parse_match_datetime


class OverviewTestCase(unittest.TestCase):
    def setUp(self):
        self.app = create_app({'TESTING': True, 'SQLALCHEMY_DATABASE_URI': 'sqlite:///:memory:',
                               'RATELIMIT_ENABLED': False})
        self.client = self.app.test_client()
        with self.app.app_context():
            users = [User(name=name, email=f'{name}@test.example', phone='9999999999')
                     for name in ('organizer', 'player', 'outsider', 'coadmin')]
            for user in users:
                user.set_password('password123')
                db.session.add(user)
            db.session.flush()
            group = Group(name='Weekly Football', created_by=users[0].id)
            db.session.add(group)
            db.session.flush()
            for index, role in ((0, 'Admin'), (1, 'Member'), (3, 'Admin')):
                db.session.add(GroupMember(group_id=group.id, user_id=users[index].id, role=role))
            match = Match(group_id=group.id, created_by=users[0].id, turf_name='Test Pitch',
                          location='Test Ground', match_date='2099-10-10', match_time='19:00',
                          max_players=10, cost=2000, status='Turf Confirmed')
            db.session.add(match)
            db.session.flush()
            db.session.add(MatchVote(match_id=match.id, user_id=users[1].id, vote='Yes'))
            db.session.add(GuestPlayer(match_id=match.id, added_by_user_id=users[1].id,
                                       name='Guest', status='confirmed'))
            db.session.commit()
            self.match_id = match.id
            self.player_id = users[1].id
            self.group_id = group.id
            self.headers = [{'Authorization': f'Bearer {create_access_token(identity=str(u.id))}'} for u in users]

    def tearDown(self):
        with self.app.app_context():
            db.session.remove()
            db.drop_all()

    def test_payment_lifecycle_includes_guest_and_requires_admin(self):
        result = self.client.get('/api/payments', headers=self.headers[1]).get_json()
        self.assertEqual(result['payments'][0]['total_due'], 400)
        self.assertEqual(result['payments'][0]['splits'], 2)
        response = self.client.post(f'/api/matches/{self.match_id}/pay', headers=self.headers[1])
        self.assertEqual(response.status_code, 200)
        managed = self.client.get('/api/payments?scope=managed', headers=self.headers[0]).get_json()
        self.assertEqual(managed['summary']['verification_pending'], 1)
        self.assertEqual(managed['summary']['verified'], 0)
        unauthorized = self.client.post(f'/api/matches/{self.match_id}/verify_payment/{self.player_id}', headers=self.headers[1])
        self.assertEqual(unauthorized.status_code, 403)
        # A second approved admin can verify; authorization is group-based.
        verified = self.client.post(f'/api/matches/{self.match_id}/verify_payment/{self.player_id}', headers=self.headers[3])
        self.assertEqual(verified.status_code, 200)
        result = self.client.get('/api/payments', headers=self.headers[1]).get_json()
        self.assertEqual(result['summary']['outstanding'], 0)
        self.assertEqual(result['summary']['verified'], 400)
        with self.app.app_context():
            self.assertEqual(Notification.query.filter_by(user_id=self.player_id, type='payment_verified').count(), 1)

    def test_ledger_and_dashboard_do_not_leak_other_groups(self):
        self.assertEqual(self.client.get('/api/payments', headers=self.headers[2]).get_json()['payments'], [])
        self.assertEqual(self.client.get('/api/payments?scope=managed', headers=self.headers[1]).get_json()['payments'], [])
        self.assertEqual(self.client.get('/api/dashboard', headers=self.headers[2]).get_json()['active_groups'], 0)
        self.assertEqual(self.client.get('/api/payments').status_code, 401)
        self.assertEqual(self.client.get('/api/payments?scope=invalid', headers=self.headers[1]).status_code, 400)

    def test_dashboard_and_match_capacity_are_real(self):
        result = self.client.get('/api/dashboard', headers=self.headers[1]).get_json()
        self.assertEqual(result['confirmed_matches'], 1)
        self.assertEqual(result['completed_matches'], 0)
        self.assertEqual(result['outstanding'], 400)
        matches = self.client.get('/api/matches', headers=self.headers[1]).get_json()
        self.assertEqual(matches[0]['yes_votes'], 2)

    def test_deactivated_account_cannot_reuse_token(self):
        response = self.client.delete('/api/auth/account', headers=self.headers[1])
        self.assertEqual(response.status_code, 200)
        self.assertEqual(self.client.get('/api/payments', headers=self.headers[1]).status_code, 401)

    def test_invalid_match_input_returns_validation_error(self):
        for cost, players in ((-1, 10), ('invalid', 10), (1000, 0), (1000, 'invalid')):
            result = self.client.post('/api/matches', headers=self.headers[0], json={
                'group_id': self.group_id, 'turf_name': 'New Pitch', 'location': 'Ground',
                'match_date': '2099-10-11', 'match_time': '19:00', 'cost': cost, 'max_players': players})
            self.assertEqual(result.status_code, 400)

    def test_guest_added_after_verification_requires_new_submission(self):
        self.client.post(f'/api/matches/{self.match_id}/pay', headers=self.headers[1])
        self.client.post(f'/api/matches/{self.match_id}/verify_payment/{self.player_id}', headers=self.headers[0])
        with self.app.app_context():
            db.session.add(GuestPlayer(match_id=self.match_id, added_by_user_id=self.player_id, name='Second guest', status='confirmed'))
            db.session.commit()
        result = self.client.get('/api/payments', headers=self.headers[1]).get_json()
        self.assertEqual(result['payments'][0]['status'], 'pending')
        self.assertEqual(result['payments'][0]['total_due'], 600)
        self.assertEqual(result['payments'][0]['transfer_due'], 200)
        self.assertEqual(result['summary']['outstanding'], 200)
        self.assertEqual(self.client.post(f'/api/matches/{self.match_id}/pay', headers=self.headers[1]).status_code, 200)

    def test_profile_updates_are_validated_and_persisted(self):
        result = self.client.put('/api/auth/profile', headers=self.headers[1], json={
            'name': 'Updated Player', 'phone': '8888888888', 'upi_id': 'player@bank'})
        self.assertEqual(result.status_code, 200)
        self.assertEqual(result.get_json()['user']['name'], 'Updated Player')
        self.assertEqual(self.client.put('/api/auth/profile', headers=self.headers[1], json={'upi_id': 'invalid'}).status_code, 400)

    def test_edit_does_not_reset_guest_or_payment_records(self):
        response = self.client.put(f'/api/matches/{self.match_id}', headers=self.headers[0], json={'cost': 3000})
        self.assertEqual(response.status_code, 400)
        with self.app.app_context():
            self.assertEqual(db.session.get(Match, self.match_id).cost, 2000)
            self.assertEqual(MatchVote.query.filter_by(match_id=self.match_id).count(), 1)

    def test_indian_kickoff_is_compared_in_utc(self):
        with patch.dict(os.environ, {'MATCH_UTC_OFFSET_MINUTES': '330'}):
            self.assertEqual(parse_match_datetime('2099-10-10', '19:00'), datetime(2099, 10, 10, 13, 30))


if __name__ == '__main__':
    unittest.main()
