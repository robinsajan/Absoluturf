from flask import Blueprint, jsonify, request
from flask_jwt_extended import jwt_required, get_jwt_identity
from models import db, Notification

notifications_bp = Blueprint('notifications', __name__)

@notifications_bp.route('', methods=['GET'])
@jwt_required()
def get_notifications():
    user_id = int(get_jwt_identity())
    notifications = Notification.query.filter_by(user_id=user_id).order_by(Notification.created_at.desc()).all()
    return jsonify([n.to_dict() for n in notifications]), 200

@notifications_bp.route('/read', methods=['POST'])
@jwt_required()
def mark_read():
    user_id = int(get_jwt_identity())
    data = request.get_json() or {}
    notification_id = data.get('notification_id')
    
    if notification_id:
        notif = Notification.query.filter_by(id=notification_id, user_id=user_id).first()
        if notif:
            notif.read = True
    else:
        # Mark all as read
        Notification.query.filter_by(user_id=user_id).update({Notification.read: True})
        
    db.session.commit()
    return jsonify({'message': 'Notifications updated successfully'}), 200
