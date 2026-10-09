import unittest
import json
import os
import tempfile
from app import create_app
from models import db, User, Group, GroupMember, Match

class AbsoluTurfTestCase(unittest.TestCase):
    def setUp(self):
        # Configure app for testing
        self.app = create_app({'TESTING': True, 'JWT_COOKIE_CSRF_PROTECT': False,
                               'SQLALCHEMY_DATABASE_URI': 'sqlite:///:memory:',
                               'RATELIMIT_ENABLED': False})
        
        self.client = self.app.test_client()
        
        with self.app.app_context():
            db.create_all()
            # Register a test admin
            admin = User(name="Test Admin", email="admin_test@test.com", phone="+1112223333")
            admin.set_password("password123")
            db.session.add(admin)
            
            # Register a test player
            player = User(name="Test Player", email="player_test@test.com", phone="+4445556666")
            player.set_password("password123")
            db.session.add(player)
            db.session.commit()

    def tearDown(self):
        with self.app.app_context():
            db.session.remove()
            db.drop_all()

    def login(self, email, password):
        return self.client.post('/api/auth/login', 
                                data=json.dumps({'email': email, 'password': password}),
                                content_type='application/json')

    def test_signup(self):
        # Test valid signup
        response = self.client.post('/api/auth/signup',
                                    data=json.dumps({
                                        'name': 'New User',
                                        'email': 'new_user@test.com',
                                        'phone': '+9998887777',
                                        'password': 'password123'
                                    }),
                                    content_type='application/json')
        self.assertEqual(response.status_code, 201)
        data = json.loads(response.data)
        self.assertIn('access_token', data)
        self.assertEqual(data['user']['email'], 'new_user@test.com')

    def test_login(self):
        # Test valid login
        response = self.login('admin_test@test.com', 'password123')
        self.assertEqual(response.status_code, 200)
        data = json.loads(response.data)
        self.assertIn('access_token', data)

        # Test invalid login credentials
        response = self.login('admin_test@test.com', 'wrongpassword')
        self.assertEqual(response.status_code, 401)

    def test_group_match_operations(self):
        # 1. Login to get token
        login_res = self.login('admin_test@test.com', 'password123')
        token = json.loads(login_res.data)['access_token']
        headers = {'Authorization': f'Bearer {token}'}

        # 2. Create Group
        grp_res = self.client.post('/api/groups',
                                   data=json.dumps({
                                       'name': 'Test Football Club',
                                       'description': 'Friendly weekly football',
                                       'sport_type': 'Football',
                                       'visibility': 'Public'
                                   }),
                                   headers=headers,
                                   content_type='application/json')
        self.assertEqual(grp_res.status_code, 201)
        group_data = json.loads(grp_res.data)['group']
        group_id = group_data['id']

        # 3. Propose Match
        match_res = self.client.post('/api/matches',
                                     data=json.dumps({
                                         'group_id': group_id,
                                         'turf_name': 'Turf Field A',
                                         'location': 'Central Sports Complex',
                                         'match_date': '2026-06-15',
                                         'match_time': '09:00',
                                         'max_players': 10
                                     }),
                                     headers=headers,
                                     content_type='application/json')
        self.assertEqual(match_res.status_code, 201)
        match_data = json.loads(match_res.data)['match']
        self.assertEqual(match_data['turf_name'], 'Turf Field A')
        self.assertEqual(match_data['status'], 'Proposed')

if __name__ == '__main__':
    unittest.main()
