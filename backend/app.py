import os
from flask import Flask, jsonify
from flask_cors import CORS
from flask_jwt_extended import JWTManager
from models import db, User, Group, GroupMember, Match, MatchVote, Substitute, Penalty, PenaltyRule, Notification, GuestPlayer, Payment, PromotionLog
from config import Config
from datetime import datetime

from extensions import limiter
# Import Blueprints
from routes.auth import auth_bp
from routes.groups import groups_bp
from routes.matches import matches_bp
from routes.penalties import penalties_bp
from routes.notifications import notifications_bp
from routes.guests import guests_bp
from routes.overview import overview_bp

def create_app(test_config=None):
    app = Flask(__name__)
    app.config.from_object(Config)
    if test_config:
        app.config.update(test_config)
    
    # Configure CORS — only allow explicitly listed origins
    CORS(
        app,
        supports_credentials=True,
        resources={r"/api/*": {"origins": app.config["CORS_ORIGINS"]}},
    )
    
    # Initialize DB, JWT & rate limiter
    db.init_app(app)
    jwt = JWTManager(app)
    @jwt.user_lookup_loader
    def load_active_user(_header, payload):
        try:
            user = db.session.get(User, int(payload['sub']))
        except (ValueError, TypeError, KeyError):
            return None
        return user if user and user.is_active else None
    limiter.init_app(app)
    
    # Register Blueprints
    app.register_blueprint(auth_bp, url_prefix='/api/auth')
    app.register_blueprint(groups_bp, url_prefix='/api/groups')
    app.register_blueprint(matches_bp, url_prefix='/api/matches')
    app.register_blueprint(penalties_bp, url_prefix='/api/penalties')
    app.register_blueprint(notifications_bp, url_prefix='/api/notifications')
    app.register_blueprint(guests_bp, url_prefix='/api')
    app.register_blueprint(overview_bp, url_prefix='/api')
    
    # Ensure upload folder exists
    if not os.path.exists(app.config['UPLOAD_FOLDER']):
        os.makedirs(app.config['UPLOAD_FOLDER'])
        
    @app.route('/health', methods=['GET'])
    def health():
        return jsonify({'status': 'healthy', 'timestamp': datetime.utcnow().isoformat()}), 200

    # Seed Database function
    with app.app_context():
        db.create_all()
        migrate_database()
    return app

def migrate_database():
    """Add new columns to existing SQLite databases."""
    if db.engine.dialect.name != 'sqlite':
        return
    from sqlalchemy import inspect, text
    inspector = inspect(db.engine)
    if 'users' in inspector.get_table_names():
        user_columns = {c['name'] for c in inspector.get_columns('users')}
        with db.engine.begin() as conn:
            if 'is_active' not in user_columns:
                conn.execute(text('ALTER TABLE users ADD COLUMN is_active BOOLEAN DEFAULT 1'))
            if 'upi_id' not in user_columns:
                conn.execute(text('ALTER TABLE users ADD COLUMN upi_id VARCHAR(100) DEFAULT NULL'))
    if 'groups' in inspector.get_table_names():
        group_columns = {c['name'] for c in inspector.get_columns('groups')}
        with db.engine.begin() as conn:
            if 'backout_penalty_enabled' not in group_columns:
                conn.execute(text('ALTER TABLE groups ADD COLUMN backout_penalty_enabled BOOLEAN DEFAULT 0'))
            if 'backout_penalty_type' not in group_columns:
                conn.execute(text("ALTER TABLE groups ADD COLUMN backout_penalty_type VARCHAR(30) DEFAULT 'Match Ban'"))
            if 'backout_penalty_matches' not in group_columns:
                conn.execute(text('ALTER TABLE groups ADD COLUMN backout_penalty_matches INTEGER DEFAULT 3'))
            if 'backout_hours_threshold' not in group_columns:
                conn.execute(text('ALTER TABLE groups ADD COLUMN backout_hours_threshold INTEGER DEFAULT 12'))
            if 'invite_code' not in group_columns:
                conn.execute(text('ALTER TABLE groups ADD COLUMN invite_code VARCHAR(100) DEFAULT NULL'))
    if 'matches' in inspector.get_table_names():
        columns = {c['name'] for c in inspector.get_columns('matches')}
        with db.engine.begin() as conn:
            if 'cost' not in columns:
                conn.execute(text('ALTER TABLE matches ADD COLUMN cost FLOAT DEFAULT 0.0'))
    if 'matches' not in inspector.get_table_names():
        return
    columns = {c['name'] for c in inspector.get_columns('matches')}
    with db.engine.begin() as conn:
        if 'auto_booked' not in columns:
            conn.execute(text('ALTER TABLE matches ADD COLUMN auto_booked BOOLEAN DEFAULT 0'))
        if 'end_time' not in columns:
            conn.execute(text('ALTER TABLE matches ADD COLUMN end_time VARCHAR(20) DEFAULT NULL'))
    if 'match_votes' in inspector.get_table_names():
        vote_columns = {c['name'] for c in inspector.get_columns('match_votes')}
        with db.engine.begin() as conn:
            if 'backout_reason' not in vote_columns:
                conn.execute(text('ALTER TABLE match_votes ADD COLUMN backout_reason TEXT DEFAULT NULL'))
            if 'backout_at' not in vote_columns:
                conn.execute(text('ALTER TABLE match_votes ADD COLUMN backout_at DATETIME DEFAULT NULL'))
            if 'has_paid' not in vote_columns:
                conn.execute(text('ALTER TABLE match_votes ADD COLUMN has_paid BOOLEAN DEFAULT 0'))
            if 'payment_verified' not in vote_columns:
                conn.execute(text('ALTER TABLE match_votes ADD COLUMN payment_verified BOOLEAN DEFAULT 0'))
            if 'paid_amount' not in vote_columns:
                conn.execute(text('ALTER TABLE match_votes ADD COLUMN paid_amount FLOAT DEFAULT 0.0'))
    if 'substitutes' in inspector.get_table_names():
        sub_columns = {c['name'] for c in inspector.get_columns('substitutes')}
        with db.engine.begin() as conn:
            if 'invited_at' not in sub_columns:
                conn.execute(text('ALTER TABLE substitutes ADD COLUMN invited_at DATETIME DEFAULT NULL'))
    if 'substitutes' in inspector.get_table_names():
        sub_columns = {c['name'] for c in inspector.get_columns('substitutes')}
        with db.engine.begin() as conn:
            if 'status' not in sub_columns:
                conn.execute(text("ALTER TABLE substitutes ADD COLUMN status VARCHAR(20) DEFAULT 'waiting'"))
    if 'guest_players' in inspector.get_table_names():
        gp_columns = {c['name'] for c in inspector.get_columns('guest_players')}
        with db.engine.begin() as conn:
            if 'queue_position' not in gp_columns:
                conn.execute(text('ALTER TABLE guest_players ADD COLUMN queue_position INTEGER DEFAULT NULL'))
            if 'invited_at' not in gp_columns:
                conn.execute(text('ALTER TABLE guest_players ADD COLUMN invited_at DATETIME DEFAULT NULL'))
    if 'notifications' in inspector.get_table_names():
        notif_columns = {c['name'] for c in inspector.get_columns('notifications')}
        with db.engine.begin() as conn:
            if 'type' not in notif_columns:
                conn.execute(text("ALTER TABLE notifications ADD COLUMN type VARCHAR(30) DEFAULT NULL"))
            if 'match_id' not in notif_columns:
                conn.execute(text('ALTER TABLE notifications ADD COLUMN match_id INTEGER DEFAULT NULL'))
    if 'promotion_logs' not in inspector.get_table_names():
        with db.engine.begin() as conn:
            conn.execute(text('''
                CREATE TABLE promotion_logs (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    match_id INTEGER NOT NULL,
                    slot_opened_at DATETIME NOT NULL,
                    entry_type VARCHAR(20) NOT NULL,
                    entry_id INTEGER NOT NULL,
                    entry_name VARCHAR(100) DEFAULT NULL,
                    notification_sent_at DATETIME DEFAULT NULL,
                    response_received_at DATETIME DEFAULT NULL,
                    response VARCHAR(20) DEFAULT NULL,
                    promoted_to_playing BOOLEAN DEFAULT 0,
                    notes TEXT DEFAULT NULL,
                    FOREIGN KEY (match_id) REFERENCES matches(id)
                )
            '''))
    if 'guest_players' not in inspector.get_table_names():
        with db.engine.begin() as conn:
            conn.execute(text('''
                CREATE TABLE guest_players (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    match_id INTEGER NOT NULL,
                    added_by_user_id INTEGER NOT NULL,
                    name VARCHAR(100) NOT NULL,
                    status VARCHAR(20) NOT NULL DEFAULT 'confirmed',
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (match_id) REFERENCES matches(id),
                    FOREIGN KEY (added_by_user_id) REFERENCES users(id)
                )
            '''))
    if 'payments' not in inspector.get_table_names():
        with db.engine.begin() as conn:
            conn.execute(text('''
                CREATE TABLE payments (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    match_id INTEGER NOT NULL,
                    user_id INTEGER NOT NULL,
                    splits INTEGER NOT NULL DEFAULT 1,
                    total_due FLOAT NOT NULL DEFAULT 0.0,
                    amount_paid FLOAT NOT NULL DEFAULT 0.0,
                    status VARCHAR(20) NOT NULL DEFAULT 'pending',
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (match_id) REFERENCES matches(id),
                    FOREIGN KEY (user_id) REFERENCES users(id)
                )
            '''))
    db.session.commit()


if __name__ == '__main__':
    app = create_app()
    port = int(os.environ.get("PORT", 5000))
    app.run(host='0.0.0.0', port=port, debug=False)
