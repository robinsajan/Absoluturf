"""Disposable browser QA server: an in-memory database, never the app database."""
import os
import sys
from pathlib import Path
from datetime import datetime, timedelta
sys.path.insert(0, str(Path(__file__).resolve().parents[2] / 'backend'))
os.environ['DATABASE_URL'] = 'sqlite:///:memory:'
from app import create_app
from models import db, User, Group, GroupMember, Match, MatchVote, GuestPlayer, Notification

app = create_app({'SQLALCHEMY_DATABASE_URI': 'sqlite:///:memory:', 'RATELIMIT_ENABLED': False,
                  'CORS_ORIGINS': ['http://localhost:3001']})
with app.app_context():
    user = User(name='Robin Mathew', email='qa@absoluturf.example', phone='9999999999', upi_id='robin@bank')
    user.set_password('qa-password-123')
    db.session.add(user)
    db.session.flush()
    group = Group(name='Weekend Football Club', description='Our weekly game.', created_by=user.id)
    db.session.add(group)
    db.session.flush()
    db.session.add(GroupMember(group_id=group.id, user_id=user.id, role='Admin'))
    for i, status in enumerate(('Turf Confirmed', 'Proposed', 'Completed')):
        match = Match(group_id=group.id, created_by=user.id, turf_name=('Central Sports Arena', 'Eastside Turf', 'Riverside Pitch')[i],
                      location='Bengaluru, Karnataka', match_date=(datetime.utcnow() + timedelta(days=i+1)).strftime('%Y-%m-%d'),
                      match_time='19:00', end_time='20:00', max_players=10, cost=2000, status=status)
        db.session.add(match)
        db.session.flush()
        db.session.add(MatchVote(match_id=match.id, user_id=user.id, vote='Yes'))
        if i == 0:
            db.session.add(GuestPlayer(match_id=match.id, added_by_user_id=user.id, name='Aarav', status='confirmed'))
    db.session.add(Notification(user_id=user.id, message='Your match at Central Sports Arena is confirmed.', match_id=1, type='match_confirmed'))
    db.session.commit()
app.run(host='127.0.0.1', port=5001, debug=False)
