from datetime import datetime
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from models import db, GuestPlayer, Match, MatchVote, GroupMember, User, Notification, PromotionLog, Substitute
from routes.matches import check_group_admin, check_group_member, get_max_waiting_position, renumber_waiting_entries

guests_bp = Blueprint('guests', __name__)


def recalculate_spoc_payment(match_id, user_id):
    match = Match.query.get(match_id)
    if not match or match.cost <= 0 or match.max_players <= 0:
        return
    per_player_cost = round(match.cost / match.max_players, 2)
    confirmed_guests = GuestPlayer.query.filter_by(
        match_id=match_id, added_by_user_id=user_id, status='confirmed'
    ).count()
    splits = 1 + confirmed_guests
    total_due = round(splits * per_player_cost, 2)

    from models import Payment
    payment = Payment.query.filter_by(match_id=match_id, user_id=user_id).first()
    if payment:
        payment.splits = splits
        payment.total_due = total_due
        if payment.amount_paid >= total_due:
            payment.status = 'paid'
        elif payment.amount_paid > 0:
            payment.status = 'partial'
        else:
            payment.status = 'pending'
    else:
        payment = Payment(
            match_id=match_id,
            user_id=user_id,
            splits=splits,
            total_due=total_due,
            amount_paid=0.0,
            status='pending'
        )
        db.session.add(payment)
    db.session.commit()


@guests_bp.route('/matches/<int:match_id>/guests', methods=['POST'])
@jwt_required()
def add_guest(match_id):
    user_id = int(get_jwt_identity())
    match = Match.query.get(match_id)
    if not match:
        return jsonify({'error': 'Match not found'}), 404

    if not check_group_member(match.group_id, user_id):
        return jsonify({'error': 'Not a member of this group'}), 403

    vote = MatchVote.query.filter_by(match_id=match_id, user_id=user_id, vote='Yes').first()
    if not vote:
        return jsonify({'error': 'Only confirmed players can add guests'}), 400

    data = request.get_json() or {}
    name = data.get('name', '').strip()
    status = data.get('status', 'confirmed')
    if not name:
        return jsonify({'error': 'Guest name is required'}), 400
    if status not in ('confirmed', 'waiting'):
        return jsonify({'error': 'Status must be confirmed or waiting'}), 400

    if status == 'confirmed':
        confirmed_voters = MatchVote.query.filter_by(match_id=match_id, vote='Yes').count()
        confirmed_guests = GuestPlayer.query.filter_by(match_id=match_id, status='confirmed').count()
        filled = confirmed_voters + confirmed_guests
        if filled >= match.max_players:
            return jsonify({'error': 'No available slots'}), 400

    # Always use 'invited' for guests joining the playing team so SPOC must explicitly confirm
    guest = GuestPlayer(
        match_id=match_id,
        added_by_user_id=user_id,
        name=name,
        status='invited' if status == 'confirmed' else 'waiting',
        queue_position=get_max_waiting_position(match_id) + 1 if status == 'waiting' else None
    )
    db.session.add(guest)
    db.session.commit()

    if status == 'confirmed':
        notif = Notification(
            user_id=user_id,
            message=f"A slot is available for your guest {name} in match at {match.turf_name} ({match.match_date})! Accept to add them to the Playing Team.",
            type='guest_invite',
            match_id=match_id
        )
        db.session.add(notif)
        db.session.commit()

    return jsonify({'message': 'Guest added and awaiting your confirmation', 'guest': guest.to_dict()}), 201


@guests_bp.route('/matches/<int:match_id>/guests', methods=['GET'])
@jwt_required()
def get_guests(match_id):
    user_id = int(get_jwt_identity())
    match = Match.query.get(match_id)
    if not match:
        return jsonify({'error': 'Match not found'}), 404

    if not check_group_member(match.group_id, user_id):
        return jsonify({'error': 'Not a member of this group'}), 403

    guests = GuestPlayer.query.filter_by(match_id=match_id).all()
    is_admin = check_group_admin(match.group_id, user_id)
    is_spoc = False

    # Non-admin users only see guests they added
    if not is_admin:
        guests = [g for g in guests if g.added_by_user_id == user_id]

    result = []
    for g in guests:
        d = g.to_dict()
        spoc = User.query.get(g.added_by_user_id)
        d['spoc_name'] = spoc.name if spoc else 'Unknown'
        result.append(d)

    return jsonify(result), 200


@guests_bp.route('/matches/<int:match_id>/guests/<int:guest_id>', methods=['DELETE'])
@jwt_required()
def remove_guest(match_id, guest_id):
    user_id = int(get_jwt_identity())
    match = Match.query.get(match_id)
    if not match:
        return jsonify({'error': 'Match not found'}), 404

    guest = GuestPlayer.query.get(guest_id)
    if not guest or guest.match_id != match_id:
        return jsonify({'error': 'Guest not found'}), 404

    if guest.added_by_user_id != user_id:
        return jsonify({'error': 'Only the SPOC can remove this guest'}), 403

    was_confirmed = guest.status == 'confirmed'
    was_waiting = guest.status == 'waiting'
    guest_name = guest.name
    db.session.delete(guest)
    db.session.commit()

    if was_waiting:
        renumber_waiting_entries(match_id)
        db.session.commit()

    if was_confirmed:
        recalculate_spoc_payment(match_id, user_id)

    notif = Notification(
        user_id=user_id,
        message=f"You removed {guest_name} from match at {match.turf_name} ({match.match_date})"
    )
    db.session.add(notif)
    db.session.commit()

    return jsonify({'message': 'Guest removed successfully'}), 200


@guests_bp.route('/matches/<int:match_id>/guests/<int:guest_id>', methods=['PATCH'])
@jwt_required()
def update_guest_status(match_id, guest_id):
    user_id = int(get_jwt_identity())
    match = Match.query.get(match_id)
    if not match:
        return jsonify({'error': 'Match not found'}), 404

    guest = GuestPlayer.query.get(guest_id)
    if not guest or guest.match_id != match_id:
        return jsonify({'error': 'Guest not found'}), 404

    if guest.added_by_user_id != user_id and not check_group_admin(match.group_id, user_id):
        return jsonify({'error': 'Only the SPOC or admin can update this guest'}), 403

    data = request.get_json() or {}
    new_status = data.get('status')
    if new_status not in ('confirmed', 'waiting'):
        return jsonify({'error': 'Status must be confirmed or waiting'}), 400

    if new_status == 'confirmed' and guest.status != 'confirmed':
        confirmed_voters = MatchVote.query.filter_by(match_id=match_id, vote='Yes').count()
        confirmed_guests = GuestPlayer.query.filter_by(match_id=match_id, status='confirmed').count()
        filled = confirmed_voters + confirmed_guests
        if filled >= match.max_players:
            return jsonify({'error': 'No available slots'}), 400

    old_status = guest.status
    guest.status = new_status

    if new_status == 'confirmed' and old_status == 'waiting':
        guest.queue_position = None
        renumber_waiting_entries(match_id)
    elif new_status == 'waiting' and old_status != 'waiting':
        guest.queue_position = get_max_waiting_position(match_id) + 1

    db.session.commit()

    recalculate_spoc_payment(match_id, guest.added_by_user_id)

    notif = Notification(
        user_id=guest.added_by_user_id,
        message=f"{guest.name}'s status updated to {new_status} in match at {match.turf_name} ({match.match_date})"
    )
    db.session.add(notif)
    db.session.commit()

    return jsonify({'message': 'Guest status updated', 'guest': guest.to_dict()}), 200


@guests_bp.route('/matches/<int:match_id>/guests/<int:guest_id>/accept', methods=['POST'])
@jwt_required()
def accept_guest_promotion(match_id, guest_id):
    user_id = int(get_jwt_identity())
    match = Match.query.get(match_id)
    if not match:
        return jsonify({'error': 'Match not found'}), 404

    guest = GuestPlayer.query.get(guest_id)
    if not guest or guest.match_id != match_id:
        return jsonify({'error': 'Guest not found'}), 404

    if guest.added_by_user_id != user_id:
        return jsonify({'error': 'Only the SPOC who added this guest can accept on their behalf'}), 403

    if guest.status != 'invited':
        return jsonify({'error': 'This guest has no pending invitation'}), 400

    from routes.matches import PROMOTION_TIMEOUT_MINUTES, process_slot_opening, PromotionLog, MatchVote, Notification

    # Check timeout
    if guest.invited_at and (datetime.utcnow() - guest.invited_at).total_seconds() > PROMOTION_TIMEOUT_MINUTES * 60:
        guest.status = 'timed_out'
        notif = Notification(
            user_id=user_id,
            message=f"The invitation for your guest {guest.name} in match at {match.turf_name} ({match.match_date}) has expired.",
            type='invite_expired',
            match_id=match_id
        )
        db.session.add(notif)
        db.session.commit()
        process_slot_opening(match_id)
        return jsonify({'error': 'Invitation has expired.'}), 400

    # Promote guest to confirmed
    guest.queue_position = None
    guest.status = 'confirmed'

    log = PromotionLog.query.filter_by(match_id=match_id, entry_type='guest', entry_id=guest.id, response=None).order_by(PromotionLog.id.desc()).first()
    if log:
        log.response = 'accepted'
        log.response_received_at = datetime.utcnow()
        log.promoted_to_playing = True

    # Recalculate SPOC payment to include this guest
    from routes.guests import recalculate_spoc_payment
    recalculate_spoc_payment(match_id, user_id)

    notif = Notification(
        user_id=user_id,
        message=f"Your guest {guest.name} has been moved to the Playing Team in match at {match.turf_name} ({match.match_date}).",
        type='guest_promoted',
        match_id=match_id
    )
    db.session.add(notif)

    db.session.commit()
    return jsonify({'message': f'{guest.name} has been added to the Playing Team'}), 200


@guests_bp.route('/matches/<int:match_id>/guests/<int:guest_id>/decline', methods=['POST'])
@jwt_required()
def decline_guest_promotion(match_id, guest_id):
    user_id = int(get_jwt_identity())
    match = Match.query.get(match_id)
    if not match:
        return jsonify({'error': 'Match not found'}), 404

    guest = GuestPlayer.query.get(guest_id)
    if not guest or guest.match_id != match_id:
        return jsonify({'error': 'Guest not found'}), 404

    if guest.added_by_user_id != user_id:
        return jsonify({'error': 'Only the SPOC who added this guest can decline on their behalf'}), 403

    if guest.status != 'invited':
        return jsonify({'error': 'This guest has no pending invitation'}), 400

    from routes.matches import process_slot_opening, PromotionLog, Notification

    guest.status = 'declined'

    log = PromotionLog.query.filter_by(match_id=match_id, entry_type='guest', entry_id=guest.id, response=None).order_by(PromotionLog.id.desc()).first()
    if log:
        log.response = 'declined'
        log.response_received_at = datetime.utcnow()

    notif = Notification(
        user_id=user_id,
        message=f"You declined the slot for your guest {guest.name} in match at {match.turf_name} ({match.match_date}).",
        type='guest_declined',
        match_id=match_id
    )
    db.session.add(notif)

    db.session.commit()

    # Try next entry in unified queue
    process_slot_opening(match_id)

    return jsonify({'message': 'Declined the invitation. The next waiting entry will be notified.'}), 200
