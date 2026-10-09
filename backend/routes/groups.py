from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from models import db, Group, GroupMember, User, Notification, PenaltyRule

groups_bp = Blueprint('groups', __name__)

@groups_bp.route('', methods=['POST'])
@jwt_required()
def create_group():
    user_id = int(get_jwt_identity())
    data = request.get_json() or {}
    name = data.get('name')
    description = data.get('description')
    sport_type = data.get('sport_type', 'Football')
    visibility = data.get('visibility', 'Public')
    image = data.get('image')
    city = data.get('city')
    
    if not name:
        return jsonify({'error': 'Group name is required'}), 400
        
    group = Group(
        name=name, 
        description=description, 
        sport_type=sport_type, 
        visibility=visibility, 
        image=image, 
        created_by=user_id
    )
    db.session.add(group)
    db.session.commit()
    
    # Creator is automatically an Admin
    membership = GroupMember(group_id=group.id, user_id=user_id, role='Admin', status='Approved')
    db.session.add(membership)
    db.session.commit()
    
    return jsonify({
        'message': 'Group created successfully',
        'group': group.to_dict()
    }), 201

@groups_bp.route('', methods=['GET'])
@jwt_required()
def get_groups():
    user_id = int(get_jwt_identity())
    # Retrieve all public groups + private groups user is a member of
    user_memberships = GroupMember.query.filter_by(user_id=user_id, status='Approved').all()
    joined_group_ids = [m.group_id for m in user_memberships]
    
    groups = Group.query.filter(
        (Group.visibility == 'Public') | (Group.id.in_(joined_group_ids))
    ).all()
    
    res = []
    for g in groups:
        d = g.to_dict()
        # Add joined status
        membership = GroupMember.query.filter_by(group_id=g.id, user_id=user_id).first()
        d['is_member'] = membership.status == 'Approved' if membership else False
        d['role'] = membership.role if membership and membership.status == 'Approved' else None
        d['membership_status'] = membership.status if membership else 'None'

        member_count = GroupMember.query.filter_by(group_id=g.id, status='Approved').count()
        d['member_count'] = member_count

        res.append(d)
        
    return jsonify(res), 200

@groups_bp.route('/<int:group_id>', methods=['GET'])
@jwt_required()
def get_group(group_id):
    user_id = int(get_jwt_identity())
    group = Group.query.get(group_id)
    if not group:
        return jsonify({'error': 'Group not found'}), 404
        
    # Check if private and user is not a member
    membership = GroupMember.query.filter_by(group_id=group_id, user_id=user_id).first()
    if group.visibility == 'Private' and (not membership or membership.status != 'Approved'):
        return jsonify({'error': 'Private group. Access denied.'}), 403
        
    # Gather members details
    members = []
    memberships = GroupMember.query.filter_by(group_id=group_id).all()
    for m in memberships:
        u = User.query.get(m.user_id)
        if u:
            m_dict = u.to_dict()
            m_dict['role'] = m.role
            m_dict['status'] = m.status
            m_dict['joined_at'] = m.joined_at.isoformat() if m.joined_at else None
            members.append(m_dict)
            
    res = group.to_dict()
    res['members'] = members
    res['current_user_role'] = membership.role if membership and membership.status == 'Approved' else None
    res['current_user_status'] = membership.status if membership else 'None'
    return jsonify(res), 200

@groups_bp.route('/<int:group_id>/join-request', methods=['POST'])
@jwt_required()
def join_request(group_id):
    user_id = int(get_jwt_identity())
    group = Group.query.get(group_id)
    if not group:
        return jsonify({'error': 'Group not found'}), 404
        
    existing = GroupMember.query.filter_by(group_id=group_id, user_id=user_id).first()
    if existing:
        return jsonify({'error': f'Already requested or joined. Status: {existing.status}'}), 400
        
    # Default join requests to Pending, requiring Admin approval
    membership = GroupMember(group_id=group_id, user_id=user_id, role='Member', status='Pending')
    db.session.add(membership)
    db.session.commit()
    
    # Notify group admins
    admins = GroupMember.query.filter_by(group_id=group_id, role='Admin').all()
    user = User.query.get(user_id)
    for admin in admins:
        notif = Notification(
            user_id=admin.user_id,
            message=f"{user.name} has requested to join your group: {group.name}"
        )
        db.session.add(notif)
    db.session.commit()
    
    return jsonify({'message': 'Join request submitted', 'status': 'Pending'}), 200

@groups_bp.route('/<int:group_id>/approve-member', methods=['POST'])
@jwt_required()
def approve_member(group_id):
    current_user_id = int(get_jwt_identity())
    
    # Check if current user is admin of group
    admin_check = GroupMember.query.filter_by(group_id=group_id, user_id=current_user_id, role='Admin', status='Approved').first()
    if not admin_check:
        return jsonify({'error': 'Admin permissions required'}), 403
        
    data = request.get_json() or {}
    target_user_id = data.get('user_id')
    approve = data.get('approve', True)  # True to approve, False to reject
    
    if not target_user_id:
        return jsonify({'error': 'user_id is required'}), 400
        
    membership = GroupMember.query.filter_by(group_id=group_id, user_id=target_user_id, status='Pending').first()
    if not membership:
        return jsonify({'error': 'No pending join request found for this user'}), 404
        
    if approve:
        membership.status = 'Approved'
        msg = f"Your request to join group {Group.query.get(group_id).name} has been approved!"
    else:
        membership.status = 'Rejected'
        msg = f"Your request to join group {Group.query.get(group_id).name} has been rejected."
        
    db.session.commit()
    
    # Notify the user
    notif = Notification(user_id=target_user_id, message=msg)
    db.session.add(notif)
    db.session.commit()
    
    return jsonify({'message': f"Request {'approved' if approve else 'rejected'} successfully"}), 200


@groups_bp.route('/<int:group_id>/remove-member', methods=['POST'])
@jwt_required()
def remove_member(group_id):
    current_user_id = int(get_jwt_identity())
    data = request.get_json() or {}
    target_user_id = data.get('user_id')
    
    if not target_user_id:
        return jsonify({'error': 'user_id is required'}), 400
        
    # Check permissions: either admin removing member, or user leaving group
    is_admin = GroupMember.query.filter_by(group_id=group_id, user_id=current_user_id, role='Admin', status='Approved').first() is not None
    is_self = current_user_id == target_user_id
    
    if not is_admin and not is_self:
        return jsonify({'error': 'Unauthorized to remove this member'}), 403
        
    membership = GroupMember.query.filter_by(group_id=group_id, user_id=target_user_id).first()
    if not membership:
        return jsonify({'error': 'Membership not found'}), 404
        
    # If leaving admin check: cannot leave if they are the last admin of the group
    if membership.role == 'Admin' and is_self:
        admin_count = GroupMember.query.filter_by(group_id=group_id, role='Admin', status='Approved').count()
        if admin_count <= 1:
            return jsonify({'error': 'Cannot leave group. You are the sole Admin. Please promote another member first.'}), 400
            
    db.session.delete(membership)
    db.session.commit()
    
    # Notify target user if removed by admin
    if not is_self:
        group = Group.query.get(group_id)
        notif = Notification(user_id=target_user_id, message=f"You have been removed from group: {group.name}")
        db.session.add(notif)
        db.session.commit()
        
    return jsonify({'message': 'Member removed successfully'}), 200

@groups_bp.route('/<int:group_id>/promote-admin', methods=['POST'])
@jwt_required()
def promote_admin(group_id):
    current_user_id = int(get_jwt_identity())
    
    # Check if admin
    admin_check = GroupMember.query.filter_by(group_id=group_id, user_id=current_user_id, role='Admin', status='Approved').first()
    if not admin_check:
        return jsonify({'error': 'Admin permissions required'}), 403
        
    data = request.get_json() or {}
    target_user_id = data.get('user_id')
    demote = data.get('demote', False)  # Demote to member if True
    
    if not target_user_id:
        return jsonify({'error': 'user_id is required'}), 400
        
    membership = GroupMember.query.filter_by(group_id=group_id, user_id=target_user_id, status='Approved').first()
    if not membership:
        return jsonify({'error': 'Member not found in this group'}), 404
        
    if demote:
        if target_user_id == current_user_id:
            # Cannot self demote if sole admin
            admin_count = GroupMember.query.filter_by(group_id=group_id, role='Admin', status='Approved').count()
            if admin_count <= 1:
                return jsonify({'error': 'Cannot demote yourself. You are the sole Admin.'}), 400
        membership.role = 'Member'
        msg = f"You have been demoted to Member in group: {Group.query.get(group_id).name}"
    else:
        # Check maximum admins limit (max 5 admins)
        admin_count = GroupMember.query.filter_by(group_id=group_id, role='Admin', status='Approved').count()
        if admin_count >= 5:
            return jsonify({'error': 'Maximum admin limit reached (max 5 admins allowed)'}), 400
        membership.role = 'Admin'
        msg = f"You have been promoted to Admin in group: {Group.query.get(group_id).name}"
        
    db.session.commit()
    
    # Notify target user
    notif = Notification(user_id=target_user_id, message=msg)
    db.session.add(notif)
    db.session.commit()
    
    return jsonify({'message': f"User {'demoted to Member' if demote else 'promoted to Admin'} successfully"}), 200


@groups_bp.route('/<int:group_id>/penalty-rules', methods=['GET', 'PUT'])
@jwt_required()
def penalty_rules(group_id):
    user_id = int(get_jwt_identity())
    group = Group.query.get(group_id)
    if not group:
        return jsonify({'error': 'Group not found'}), 404

    if request.method == 'GET':
        return jsonify({
            'backout_penalty_enabled': group.backout_penalty_enabled,
            'backout_penalty_type': group.backout_penalty_type,
            'backout_penalty_matches': group.backout_penalty_matches,
            'backout_hours_threshold': group.backout_hours_threshold,
        }), 200

    # PUT - update rules
    admin_check = GroupMember.query.filter_by(group_id=group_id, user_id=user_id, role='Admin', status='Approved').first()
    if not admin_check:
        return jsonify({'error': 'Admin permissions required'}), 403

    data = request.get_json() or {}
    if 'backout_penalty_enabled' in data:
        group.backout_penalty_enabled = bool(data['backout_penalty_enabled'])
    if 'backout_penalty_type' in data:
        group.backout_penalty_type = data['backout_penalty_type']
    if 'backout_penalty_matches' in data:
        group.backout_penalty_matches = int(data['backout_penalty_matches'])
    if 'backout_hours_threshold' in data:
        group.backout_hours_threshold = int(data['backout_hours_threshold'])

    db.session.commit()
    return jsonify({'message': 'Penalty rules updated successfully'}), 200


@groups_bp.route('/<int:group_id>/penalty-rules/list', methods=['GET', 'POST'])
@jwt_required()
def penalty_rules_list(group_id):
    user_id = int(get_jwt_identity())
    group = Group.query.get(group_id)
    if not group:
        return jsonify({'error': 'Group not found'}), 404

    membership = GroupMember.query.filter_by(group_id=group_id, user_id=user_id, status='Approved').first()
    if not membership:
        return jsonify({'error': 'Not a member of this group'}), 403

    if request.method == 'GET':
        rules = PenaltyRule.query.filter_by(group_id=group_id).order_by(PenaltyRule.created_at.desc()).all()
        return jsonify([r.to_dict() for r in rules]), 200

    # POST - create new rule (admin only)
    admin_check = GroupMember.query.filter_by(group_id=group_id, user_id=user_id, role='Admin', status='Approved').first()
    if not admin_check:
        return jsonify({'error': 'Admin permissions required'}), 403

    data = request.get_json() or {}
    rule = PenaltyRule(
        group_id=group_id,
        trigger_event=data.get('trigger_event', 'backout_no_sub'),
        penalty_type=data.get('penalty_type', 'Match Ban'),
        penalty_value=int(data.get('penalty_value', 1)),
        fee_multiplier=float(data.get('fee_multiplier', 1.0)),
        description=data.get('description', ''),
        is_active=bool(data.get('is_active', True)),
    )
    db.session.add(rule)
    db.session.commit()
    return jsonify(rule.to_dict()), 201


@groups_bp.route('/<int:group_id>/penalty-rules/<int:rule_id>', methods=['PUT', 'DELETE'])
@jwt_required()
def penalty_rule_detail(group_id, rule_id):
    user_id = int(get_jwt_identity())
    group = Group.query.get(group_id)
    if not group:
        return jsonify({'error': 'Group not found'}), 404

    admin_check = GroupMember.query.filter_by(group_id=group_id, user_id=user_id, role='Admin', status='Approved').first()
    if not admin_check:
        return jsonify({'error': 'Admin permissions required'}), 403

    rule = PenaltyRule.query.get(rule_id)
    if not rule or rule.group_id != group_id:
        return jsonify({'error': 'Penalty rule not found'}), 404

    if request.method == 'DELETE':
        db.session.delete(rule)
        db.session.commit()
        return jsonify({'message': 'Penalty rule deleted'}), 200

    # PUT
    data = request.get_json() or {}
    if 'trigger_event' in data:
        rule.trigger_event = data['trigger_event']
    if 'penalty_type' in data:
        rule.penalty_type = data['penalty_type']
    if 'penalty_value' in data:
        rule.penalty_value = int(data['penalty_value'])
    if 'fee_multiplier' in data:
        rule.fee_multiplier = float(data['fee_multiplier'])
    if 'description' in data:
        rule.description = data['description']
    if 'is_active' in data:
        rule.is_active = bool(data['is_active'])
    db.session.commit()
    return jsonify(rule.to_dict()), 200

import uuid

@groups_bp.route('/<int:group_id>/invite-link', methods=['GET'])
@jwt_required()
def get_invite_link(group_id):
    user_id = int(get_jwt_identity())
    group = Group.query.get(group_id)
    if not group:
        return jsonify({'error': 'Group not found'}), 404

    admin_check = GroupMember.query.filter_by(group_id=group_id, user_id=user_id, role='Admin', status='Approved').first()
    if not admin_check:
        return jsonify({'error': 'Admin permissions required'}), 403

    if not group.invite_code:
        group.invite_code = str(uuid.uuid4())
        db.session.commit()

    return jsonify({'invite_code': group.invite_code}), 200

@groups_bp.route('/join-by-invite', methods=['POST'])
@jwt_required()
def join_by_invite():
    user_id = int(get_jwt_identity())
    data = request.get_json() or {}
    invite_code = data.get('invite_code')
    
    if not invite_code:
        return jsonify({'error': 'invite_code is required'}), 400
        
    group = Group.query.filter_by(invite_code=invite_code).first()
    if not group:
        return jsonify({'error': 'Invalid or expired invite code'}), 404
        
    existing = GroupMember.query.filter_by(group_id=group.id, user_id=user_id).first()
    if existing:
        return jsonify({'error': f'Already requested or joined. Status: {existing.status}'}), 400
        
    # Create join request (Pending status for admin approval)
    membership = GroupMember(group_id=group.id, user_id=user_id, role='Member', status='Pending')
    db.session.add(membership)
    db.session.commit()
    
    # Notify group admins
    admins = GroupMember.query.filter_by(group_id=group.id, role='Admin').all()
    user = User.query.get(user_id)
    for admin in admins:
        notif = Notification(
            user_id=admin.user_id,
            message=f"{user.name} has requested to join your group via invite link: {group.name}"
        )
        db.session.add(notif)
    db.session.commit()
    
    return jsonify({'message': 'Join request submitted', 'status': 'Pending', 'group_id': group.id}), 200
