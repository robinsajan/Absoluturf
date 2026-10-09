from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from models import db, Penalty, GroupMember, User, Notification, Group

penalties_bp = Blueprint('penalties', __name__)

def check_group_admin(group_id, user_id):
    membership = GroupMember.query.filter_by(group_id=group_id, user_id=user_id, status='Approved').first()
    return membership is not None and membership.role == 'Admin'

@penalties_bp.route('', methods=['POST'])
@jwt_required()
def create_penalty():
    admin_id = int(get_jwt_identity())
    data = request.get_json() or {}
    
    user_id = data.get('user_id')
    group_id = data.get('group_id')
    penalty_type = data.get('penalty_type')  # 'Match Ban', 'Mandatory Payment Fine', 'Voting Restriction'
    remaining_matches = data.get('remaining_matches', 3)
    reason = data.get('reason', '')
    
    if not user_id or not group_id or not penalty_type:
        return jsonify({'error': 'Missing required fields'}), 400
        
    if not check_group_admin(group_id, admin_id):
        return jsonify({'error': 'Admin permissions required'}), 403
        
    # Verify target user is member of group
    membership = GroupMember.query.filter_by(group_id=group_id, user_id=user_id, status='Approved').first()
    if not membership:
        return jsonify({'error': 'Target user is not a member of this group'}), 400
        
    penalty = Penalty(
        user_id=user_id,
        group_id=group_id,
        penalty_type=penalty_type,
        remaining_matches=remaining_matches,
        reason=reason,
        created_by=admin_id
    )
    db.session.add(penalty)
    
    # Notify target user
    group = Group.query.get(group_id)
    notif = Notification(
        user_id=user_id,
        message=f"A penalty '{penalty_type}' has been applied to you in group '{group.name}'. Matches remaining: {remaining_matches}. Reason: {reason}"
    )
    db.session.add(notif)
    
    db.session.commit()
    return jsonify({'message': 'Penalty applied successfully', 'penalty': penalty.to_dict()}), 201

@penalties_bp.route('', methods=['GET'])
@jwt_required()
def get_penalties():
    user_id = int(get_jwt_identity())
    group_id = request.args.get('group_id', type=int)
    target_user_id = request.args.get('user_id', type=int)
    
    query = Penalty.query
    if group_id:
        # Check membership
        membership = GroupMember.query.filter_by(group_id=group_id, user_id=user_id, status='Approved').first()
        if not membership:
            return jsonify({'error': 'Not a member of this group'}), 403
        query = query.filter_by(group_id=group_id)
        
    if target_user_id:
        query = query.filter_by(user_id=target_user_id)
        
    # If no filters, return user's own penalties
    if not group_id and not target_user_id:
        query = query.filter_by(user_id=user_id)
        
    penalties = query.order_by(Penalty.created_at.desc()).all()
    
    res = []
    for p in penalties:
        d = p.to_dict()
        u = User.query.get(p.user_id)
        g = Group.query.get(p.group_id)
        admin = User.query.get(p.created_by)
        d['user_name'] = u.name if u else 'Unknown'
        d['group_name'] = g.name if g else 'Unknown'
        d['creator_name'] = admin.name if admin else 'System'
        res.append(d)
        
    return jsonify(res), 200

@penalties_bp.route('/<int:penalty_id>', methods=['PUT'])
@jwt_required()
def edit_penalty(penalty_id):
    admin_id = int(get_jwt_identity())
    penalty = Penalty.query.get(penalty_id)
    if not penalty:
        return jsonify({'error': 'Penalty not found'}), 404

    if not check_group_admin(penalty.group_id, admin_id):
        return jsonify({'error': 'Admin permissions required'}), 403

    data = request.get_json() or {}
    if 'penalty_type' in data:
        penalty.penalty_type = data['penalty_type']
    if 'remaining_matches' in data:
        penalty.remaining_matches = int(data['remaining_matches'])
    if 'reason' in data:
        penalty.reason = data['reason']

    db.session.commit()
    return jsonify({'message': 'Penalty updated successfully', 'penalty': penalty.to_dict()}), 200


@penalties_bp.route('/<int:penalty_id>', methods=['DELETE'])
@jwt_required()
def delete_penalty(penalty_id):
    admin_id = int(get_jwt_identity())
    penalty = Penalty.query.get(penalty_id)
    if not penalty:
        return jsonify({'error': 'Penalty not found'}), 404
        
    if not check_group_admin(penalty.group_id, admin_id):
        return jsonify({'error': 'Admin permissions required'}), 403
        
    db.session.delete(penalty)
    
    # Notify user
    group = Group.query.get(penalty.group_id)
    notif = Notification(
        user_id=penalty.user_id,
        message=f"Your penalty '{penalty.penalty_type}' in group '{group.name}' has been removed by admin."
    )
    db.session.add(notif)
    
    db.session.commit()
    return jsonify({'message': 'Penalty removed successfully'}), 200
