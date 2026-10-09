from flask_sqlalchemy import SQLAlchemy
from datetime import datetime
from werkzeug.security import generate_password_hash, check_password_hash

db = SQLAlchemy()

class User(db.Model):
    __tablename__ = 'users'
    
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    email = db.Column(db.String(120), unique=True, nullable=False)
    phone = db.Column(db.String(20), nullable=False)
    password_hash = db.Column(db.String(256), nullable=False)
    profile_image = db.Column(db.String(255), nullable=True)
    upi_id = db.Column(db.String(100), nullable=True)
    is_active = db.Column(db.Boolean, default=True, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    # Relationships
    group_memberships = db.relationship('GroupMember', backref='user', lazy=True, cascade="all, delete-orphan")
    votes = db.relationship('MatchVote', backref='user', lazy=True, cascade="all, delete-orphan")
    substitutes = db.relationship('Substitute', backref='user', lazy=True, cascade="all, delete-orphan")
    penalties = db.relationship('Penalty', foreign_keys='Penalty.user_id', backref='user', lazy=True, cascade="all, delete-orphan")
    notifications = db.relationship('Notification', backref='user', lazy=True, cascade="all, delete-orphan")
    guests_added = db.relationship('GuestPlayer', foreign_keys='GuestPlayer.added_by_user_id', backref='spoc_user', lazy=True, cascade="all, delete-orphan")

    def set_password(self, password):
        self.password_hash = generate_password_hash(password)
        
    def check_password(self, password):
        return check_password_hash(self.password_hash, password)
        
    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'email': self.email,
            'phone': self.phone,
            'profile_image': self.profile_image,
            'upi_id': self.upi_id,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }

class Group(db.Model):
    __tablename__ = 'groups'
    
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    description = db.Column(db.Text, nullable=True)
    sport_type = db.Column(db.String(50), nullable=False, default='Football')  # e.g., Football, Cricket, Badminton
    visibility = db.Column(db.String(20), nullable=False, default='Public')  # Public, Private
    image = db.Column(db.String(255), nullable=True)
    created_by = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    # Penalty auto-apply rules
    backout_penalty_enabled = db.Column(db.Boolean, default=False)
    backout_penalty_type = db.Column(db.String(30), default='Match Ban')
    backout_penalty_matches = db.Column(db.Integer, default=3)
    backout_hours_threshold = db.Column(db.Integer, default=12)
    
    invite_code = db.Column(db.String(100), unique=True, nullable=True)
    
    # Relationships
    members = db.relationship('GroupMember', backref='group', lazy=True, cascade="all, delete-orphan")
    matches = db.relationship('Match', backref='group', lazy=True, cascade="all, delete-orphan")
    penalties = db.relationship('Penalty', backref='group', lazy=True, cascade="all, delete-orphan")

    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'description': self.description,
            'sport_type': self.sport_type,
            'visibility': self.visibility,
            'image': self.image,
            'created_by': self.created_by,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'backout_penalty_enabled': self.backout_penalty_enabled,
            'backout_penalty_type': self.backout_penalty_type,
            'backout_penalty_matches': self.backout_penalty_matches,
            'backout_hours_threshold': self.backout_hours_threshold,
            'invite_code': self.invite_code,
        }

class GroupMember(db.Model):
    __tablename__ = 'group_members'
    
    id = db.Column(db.Integer, primary_key=True)
    group_id = db.Column(db.Integer, db.ForeignKey('groups.id'), nullable=False)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    role = db.Column(db.String(20), nullable=False, default='Member')  # Admin, Member
    joined_at = db.Column(db.DateTime, default=datetime.utcnow)
    status = db.Column(db.String(20), nullable=False, default='Approved')  # Pending, Approved, Rejected

    def to_dict(self):
        return {
            'id': self.id,
            'group_id': self.group_id,
            'user_id': self.user_id,
            'role': self.role,
            'status': self.status,
            'joined_at': self.joined_at.isoformat() if self.joined_at else None
        }

class Match(db.Model):
    __tablename__ = 'matches'
    
    id = db.Column(db.Integer, primary_key=True)
    group_id = db.Column(db.Integer, db.ForeignKey('groups.id'), nullable=False)
    created_by = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    turf_name = db.Column(db.String(100), nullable=False)
    location = db.Column(db.String(200), nullable=False)
    match_date = db.Column(db.String(20), nullable=False)  # YYYY-MM-DD
    match_time = db.Column(db.String(20), nullable=False)  # HH:MM
    end_time = db.Column(db.String(20), nullable=True)  # HH:MM
    max_players = db.Column(db.Integer, nullable=False, default=10)
    auto_booked = db.Column(db.Boolean, nullable=False, default=False)  # True when turf auto-confirmed
    cost = db.Column(db.Float, nullable=False, default=0.0)  # Total turf booking cost in INR
    status = db.Column(db.String(30), nullable=False, default='Proposed')  # Proposed, Voting Open, Minimum Players Reached, Turf Confirmed, Completed, Cancelled
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    # Relationships
    votes = db.relationship('MatchVote', backref='match', lazy=True, cascade="all, delete-orphan")
    substitutes = db.relationship('Substitute', backref='match', lazy=True, cascade="all, delete-orphan")
    guest_players = db.relationship('GuestPlayer', backref='match_ref', lazy=True, cascade="all, delete-orphan")
    creator = db.relationship('User', foreign_keys=[created_by], lazy=True)

    def to_dict(self):
        return {
            'id': self.id,
            'group_id': self.group_id,
            'created_by': self.created_by,
            'creator_name': self.creator.name if self.creator else 'Admin',
            'creator_upi': self.creator.upi_id if self.creator else None,
            'turf_name': self.turf_name,
            'location': self.location,
            'match_date': self.match_date,
            'match_time': self.match_time,
            'end_time': self.end_time,
            'max_players': self.max_players,
            'auto_booked': self.auto_booked,
            'cost': self.cost,
            'status': self.status,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }

class MatchVote(db.Model):
    __tablename__ = 'match_votes'
    
    id = db.Column(db.Integer, primary_key=True)
    match_id = db.Column(db.Integer, db.ForeignKey('matches.id'), nullable=False)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    vote = db.Column(db.String(10), nullable=False)  # Yes, No, BackedOut
    has_paid = db.Column(db.Boolean, default=False, nullable=False)
    paid_amount = db.Column(db.Float, default=0.0, nullable=False)
    payment_verified = db.Column(db.Boolean, default=False, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    backout_reason = db.Column(db.Text, nullable=True)
    backout_at = db.Column(db.DateTime, nullable=True)

    def to_dict(self):
        return {
            'id': self.id,
            'match_id': self.match_id,
            'user_id': self.user_id,
            'vote': self.vote,
            'has_paid': self.has_paid,
            'paid_amount': self.paid_amount,
            'payment_verified': self.payment_verified,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'backout_reason': self.backout_reason,
            'backout_at': self.backout_at.isoformat() if self.backout_at else None
        }



class Substitute(db.Model):
    __tablename__ = 'substitutes'
    
    id = db.Column(db.Integer, primary_key=True)
    match_id = db.Column(db.Integer, db.ForeignKey('matches.id'), nullable=False)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    queue_position = db.Column(db.Integer, nullable=False)
    promoted = db.Column(db.Boolean, default=False, nullable=False)
    invited_at = db.Column(db.DateTime, nullable=True)
    status = db.Column(db.String(20), default='waiting')
    # status values: 'waiting' (in queue), 'invited' (pending response),
    #                'accepted' (promoted), 'declined' (refused), 'timed_out' (expired)

    def to_dict(self):
        return {
            'id': self.id,
            'match_id': self.match_id,
            'user_id': self.user_id,
            'queue_position': self.queue_position,
            'promoted': self.promoted,
            'invited_at': self.invited_at.isoformat() if self.invited_at else None,
            'status': self.status
        }

class Penalty(db.Model):
    __tablename__ = 'penalties'
    
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    group_id = db.Column(db.Integer, db.ForeignKey('groups.id'), nullable=False)
    penalty_type = db.Column(db.String(30), nullable=False)  # Match Ban, Mandatory Payment Fine, Voting Restriction
    remaining_matches = db.Column(db.Integer, nullable=False, default=0)  # For ban/restrictions
    reason = db.Column(db.Text, nullable=True)
    created_by = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    def to_dict(self):
        return {
            'id': self.id,
            'user_id': self.user_id,
            'group_id': self.group_id,
            'penalty_type': self.penalty_type,
            'remaining_matches': self.remaining_matches,
            'reason': self.reason,
            'created_by': self.created_by,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }

class PenaltyRule(db.Model):
    __tablename__ = 'penalty_rules'
    
    id = db.Column(db.Integer, primary_key=True)
    group_id = db.Column(db.Integer, db.ForeignKey('groups.id'), nullable=False)
    trigger_event = db.Column(db.String(50), nullable=False)  # 'backout_no_sub', 'no_show'
    penalty_type = db.Column(db.String(30), nullable=False, default='Match Ban')
    penalty_value = db.Column(db.Integer, default=1)  # number of match bans
    fee_multiplier = db.Column(db.Float, default=1.0)  # e.g. 2.0 = double fee
    description = db.Column(db.Text, nullable=True)
    is_active = db.Column(db.Boolean, default=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    group = db.relationship('Group', backref='penalty_rules')

    def to_dict(self):
        return {
            'id': self.id,
            'group_id': self.group_id,
            'trigger_event': self.trigger_event,
            'penalty_type': self.penalty_type,
            'penalty_value': self.penalty_value,
            'fee_multiplier': self.fee_multiplier,
            'description': self.description,
            'is_active': self.is_active,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }


class Payment(db.Model):
    __tablename__ = 'payments'

    id = db.Column(db.Integer, primary_key=True)
    match_id = db.Column(db.Integer, db.ForeignKey('matches.id'), nullable=False)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    splits = db.Column(db.Integer, nullable=False, default=1)
    total_due = db.Column(db.Float, nullable=False, default=0.0)
    amount_paid = db.Column(db.Float, nullable=False, default=0.0)
    status = db.Column(db.String(20), nullable=False, default='pending')
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    match = db.relationship('Match', backref='payments')
    user = db.relationship('User', backref='payments')

    def to_dict(self):
        return {
            'id': self.id,
            'match_id': self.match_id,
            'user_id': self.user_id,
            'splits': self.splits,
            'total_due': self.total_due,
            'amount_paid': self.amount_paid,
            'pending': round(max(0, self.total_due - self.amount_paid), 2),
            'status': self.status,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None
        }


class GuestPlayer(db.Model):
    __tablename__ = 'guest_players'

    id = db.Column(db.Integer, primary_key=True)
    match_id = db.Column(db.Integer, db.ForeignKey('matches.id'), nullable=False)
    added_by_user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    name = db.Column(db.String(100), nullable=False)
    status = db.Column(db.String(20), nullable=False, default='confirmed')
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    queue_position = db.Column(db.Integer, nullable=True)
    invited_at = db.Column(db.DateTime, nullable=True)

    added_by = db.relationship('User', foreign_keys=[added_by_user_id], lazy=True, overlaps="guests_added,spoc_user")

    def to_dict(self):
        return {
            'id': self.id,
            'match_id': self.match_id,
            'added_by_user_id': self.added_by_user_id,
            'added_by_name': self.added_by.name if self.added_by else 'Unknown',
            'name': self.name,
            'status': self.status,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'queue_position': self.queue_position,
            'invited_at': self.invited_at.isoformat() if self.invited_at else None
        }


class PromotionLog(db.Model):
    __tablename__ = 'promotion_logs'

    id = db.Column(db.Integer, primary_key=True)
    match_id = db.Column(db.Integer, db.ForeignKey('matches.id'), nullable=False)
    slot_opened_at = db.Column(db.DateTime, nullable=False)
    entry_type = db.Column(db.String(20), nullable=False)
    entry_id = db.Column(db.Integer, nullable=False)
    entry_name = db.Column(db.String(100), nullable=True)
    notification_sent_at = db.Column(db.DateTime, nullable=True)
    response_received_at = db.Column(db.DateTime, nullable=True)
    response = db.Column(db.String(20), nullable=True)
    promoted_to_playing = db.Column(db.Boolean, default=False)
    notes = db.Column(db.Text, nullable=True)

    def to_dict(self):
        return {
            'id': self.id,
            'match_id': self.match_id,
            'slot_opened_at': self.slot_opened_at.isoformat() if self.slot_opened_at else None,
            'entry_type': self.entry_type,
            'entry_id': self.entry_id,
            'entry_name': self.entry_name,
            'notification_sent_at': self.notification_sent_at.isoformat() if self.notification_sent_at else None,
            'response_received_at': self.response_received_at.isoformat() if self.response_received_at else None,
            'response': self.response,
            'promoted_to_playing': self.promoted_to_playing,
            'notes': self.notes
        }


class Notification(db.Model):
    __tablename__ = 'notifications'
    
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    message = db.Column(db.Text, nullable=False)
    read = db.Column(db.Boolean, default=False, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    type = db.Column(db.String(30), nullable=True)
    match_id = db.Column(db.Integer, db.ForeignKey('matches.id'), nullable=True)

    def to_dict(self):
        return {
            'id': self.id,
            'user_id': self.user_id,
            'message': self.message,
            'read': self.read,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'type': self.type,
            'match_id': self.match_id
        }


