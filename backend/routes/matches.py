import threading
import math
from datetime import datetime
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from models import db, Match, MatchVote, GroupMember, Group, User, Notification, Penalty, Substitute, PenaltyRule, GuestPlayer, Payment, PromotionLog
from match_utils import (
    parse_match_datetime,
    is_match_past,
    is_match_active,
)

matches_bp = Blueprint('matches', __name__)


def check_group_admin(group_id, user_id):
    membership = GroupMember.query.filter_by(group_id=group_id, user_id=user_id, status='Approved').first()
    return membership is not None and membership.role == 'Admin'


def check_group_member(group_id, user_id):
    membership = GroupMember.query.filter_by(group_id=group_id, user_id=user_id, status='Approved').first()
    return membership is not None


def is_user_banned(group_id, user_id):
    penalty = Penalty.query.filter(
        Penalty.group_id == group_id,
        Penalty.user_id == user_id,
        Penalty.remaining_matches > 0
    ).first()
    return penalty is not None


def enrich_match_dict(match_dict, match):
    """Add computed fields for list/detail responses."""
    match_dict['is_past'] = is_match_past(match)
    match_dict['is_active'] = is_match_active(match)
    return match_dict


def normalize_player_counts(max_players):
    max_players = int(max_players)
    if max_players < 1:
        max_players = 1
    return max_players


PROMOTION_TIMEOUT_MINUTES = 10
_promotion_lock = threading.Lock()


def get_max_waiting_position(match_id):
    max_sub = db.session.query(db.func.max(Substitute.queue_position)).filter_by(match_id=match_id).scalar() or 0
    max_guest = db.session.query(db.func.max(GuestPlayer.queue_position)).filter_by(match_id=match_id, status='waiting').scalar() or 0
    return max(max_sub, max_guest)


def get_next_waiting_entry(match_id):
    next_sub = Substitute.query.filter_by(match_id=match_id, status='waiting').order_by(Substitute.queue_position.asc()).first()
    next_guest = GuestPlayer.query.filter_by(match_id=match_id, status='waiting').order_by(GuestPlayer.queue_position.asc()).first()

    if next_sub and next_guest:
        if next_sub.queue_position <= next_guest.queue_position:
            return ('substitute', next_sub)
        else:
            return ('guest', next_guest)
    elif next_sub:
        return ('substitute', next_sub)
    elif next_guest:
        return ('guest', next_guest)
    return None


def invite_entry(match_id, entry_type, entry, slot_opened_at):
    match = Match.query.get(match_id)
    if not match:
        return

    entry.invited_at = datetime.utcnow()
    if entry_type == 'substitute':
        entry.status = 'invited'
        # Re-number remaining waiting substitutes
        remaining = Substitute.query.filter_by(match_id=match_id, status='waiting').order_by(Substitute.queue_position.asc()).all()
        for idx, s in enumerate(remaining):
            s.queue_position = idx + 1
        notif = Notification(
            user_id=entry.user_id,
            message=f"A spot opened up in match at {match.turf_name} ({match.match_date})! Acknowledge your participation to join the Playing Team.",
            type='substitute_invite',
            match_id=match_id
        )
        db.session.add(notif)
        notif_admin = Notification(
            user_id=match.created_by,
            message=f"Substitute invited to fill the open slot in match at {match.turf_name} ({match.match_date}). Awaiting their acknowledgement.",
            type='admin_info',
            match_id=match_id
        )
        db.session.add(notif_admin)
        entry_name = User.query.get(entry.user_id).name if User.query.get(entry.user_id) else 'Unknown'
    else:
        entry.status = 'invited'
        notif = Notification(
            user_id=entry.added_by_user_id,
            message=f"A slot opened up for your guest {entry.name} in match at {match.turf_name} ({match.match_date})! Accept to move them to the Playing Team.",
            type='guest_invite',
            match_id=match_id
        )
        db.session.add(notif)
        notif_admin = Notification(
            user_id=match.created_by,
            message=f"Guest {entry.name} invited to fill the open slot in match at {match.turf_name} ({match.match_date}). Awaiting SPOC acknowledgement.",
            type='admin_info',
            match_id=match_id
        )
        db.session.add(notif_admin)
        entry_name = entry.name

    log = PromotionLog(
        match_id=match_id,
        slot_opened_at=slot_opened_at,
        entry_type=entry_type,
        entry_id=entry.id,
        entry_name=entry_name,
        notification_sent_at=datetime.utcnow(),
        promoted_to_playing=False
    )
    db.session.add(log)


def process_slot_opening(match_id):
    with _promotion_lock:
        slot_opened_at = datetime.utcnow()
        match = Match.query.get(match_id)
        if not match:
            return {'invited': False, 'entry_type': None, 'entry_id': None}

        result = get_next_waiting_entry(match_id)
        if not result:
            log = PromotionLog(
                match_id=match_id,
                slot_opened_at=slot_opened_at,
                entry_type='none',
                entry_id=0,
                entry_name='No waiting entries',
                notes='Waiting list was empty'
            )
            db.session.add(log)
            db.session.commit()
            return {'invited': False, 'entry_type': None, 'entry_id': None}

        entry_type, entry = result
        invite_entry(match_id, entry_type, entry, slot_opened_at)
        db.session.commit()

        return {
            'invited': True,
            'entry_type': entry_type,
            'entry_id': entry.id,
            'entry_name': entry.name if entry_type == 'guest' else User.query.get(entry.user_id).name if User.query.get(entry.user_id) else 'Unknown'
        }


def promote_entry_to_playing(entry_type, entry, match_id):
    match = Match.query.get(match_id)
    if not match:
        return

    if entry_type == 'substitute':
        entry.status = 'accepted'
        existing_vote = MatchVote.query.filter_by(match_id=match_id, user_id=entry.user_id).first()
        if existing_vote:
            existing_vote.vote = 'Yes'
            existing_vote.backout_reason = None
            existing_vote.backout_at = None
        else:
            new_vote = MatchVote(match_id=match_id, user_id=entry.user_id, vote='Yes')
            db.session.add(new_vote)
        # Re-number remaining waiting substitutes
        remaining = Substitute.query.filter_by(match_id=match_id, status='waiting').order_by(Substitute.queue_position.asc()).all()
        for idx, s in enumerate(remaining):
            s.queue_position = idx + 1
    else:
        entry.queue_position = None
        entry.status = 'confirmed'


def renumber_waiting_entries(match_id):
    """Re-number both substitute and guest waiting entries to maintain consistent FIFO ordering."""
    waiting_subs = Substitute.query.filter_by(match_id=match_id, status='waiting').order_by(Substitute.queue_position.asc()).all()
    waiting_guests = GuestPlayer.query.filter_by(match_id=match_id, status='waiting').order_by(GuestPlayer.queue_position.asc()).all()
    combined = [(s, 'substitute', s.queue_position) for s in waiting_subs] + \
               [(g, 'guest', g.queue_position) for g in waiting_guests]
    combined.sort(key=lambda x: x[2])
    for idx, (entry, etype, _) in enumerate(combined):
        entry.queue_position = idx + 1


def notify_admin_on_full(match):
    """Notify admins when max players are reached so they can manually confirm."""
    if match.status in ['Turf Confirmed', 'Completed', 'Cancelled']:
        return False

    yes_votes = MatchVote.query.filter_by(match_id=match.id, vote='Yes').count()
    if yes_votes < match.max_players:
        return False

    admins = GroupMember.query.filter_by(group_id=match.group_id, role='Admin', status='Approved').all()
    for admin in admins:
        existing = Notification.query.filter_by(
            user_id=admin.user_id,
            message=f"Match at {match.turf_name} ({match.match_date}) is fully booked — confirm the booking!"
        ).first()
        if not existing:
            notif = Notification(
                user_id=admin.user_id,
                message=f"Match at {match.turf_name} ({match.match_date}) is fully booked — confirm the booking!"
            )
            db.session.add(notif)

    db.session.commit()
    return True


@matches_bp.route('', methods=['POST'])
@jwt_required()
def create_match():
    user_id = int(get_jwt_identity())
    data = request.get_json() or {}

    group_id = data.get('group_id')
    turf_name = data.get('turf_name')
    location = data.get('location')
    match_date = data.get('match_date')
    match_time = data.get('match_time')
    end_time = data.get('end_time')
    max_players = data.get('max_players', 10)
    cost = data.get('cost', 0.0)

    if not group_id or not turf_name or not location or not match_date or not match_time:
        return jsonify({'error': 'Missing required fields'}), 400

    if not check_group_admin(group_id, user_id):
        return jsonify({'error': 'Admin permissions required'}), 403

    try:
        if isinstance(max_players, bool) or int(max_players) != float(max_players) or not 1 <= int(max_players) <= 100:
            raise ValueError()
        max_players = int(max_players)
        cost = float(cost)
        if not math.isfinite(cost) or cost < 0:
            raise ValueError()
        if not isinstance(turf_name, str) or not turf_name.strip() or len(turf_name) > 100:
            raise ValueError()
        if not isinstance(location, str) or not location.strip() or len(location) > 200:
            raise ValueError()
        if not isinstance(match_date, str) or not isinstance(match_time, str) or not parse_match_datetime(match_date, match_time):
            raise ValueError()
        if end_time and (not isinstance(end_time, str) or not parse_match_datetime(match_date, end_time)):
            raise ValueError()
    except (ValueError, TypeError, OverflowError):
        return jsonify({'error': 'Enter a valid venue, date, time, 1–100 players and nonnegative finite cost'}), 400

    match = Match(
        group_id=group_id,
        created_by=user_id,
        turf_name=turf_name,
        location=location,
        match_date=match_date,
        match_time=match_time,
        end_time=end_time,
        max_players=max_players,
        cost=cost,
        auto_booked=False,
        status='Proposed'
    )
    db.session.add(match)
    db.session.commit()

    members = GroupMember.query.filter_by(group_id=group_id, status='Approved').all()
    for member in members:
        if member.user_id != user_id:
            notif = Notification(
                user_id=member.user_id,
                message=f"New match proposed in group at {match.turf_name} on {match.match_date}"
            )
            db.session.add(notif)
    db.session.commit()

    result = enrich_match_dict(match.to_dict(), match)
    return jsonify({'message': 'Match proposed successfully', 'match': result}), 201


@matches_bp.route('', methods=['GET'])
@jwt_required()
def get_matches():
    user_id = int(get_jwt_identity())
    group_id = request.args.get('group_id', type=int)

    query = Match.query
    if group_id:
        if not check_group_member(group_id, user_id):
            return jsonify({'error': 'Not a member of this group'}), 403
        query = query.filter_by(group_id=group_id)
    else:
        memberships = GroupMember.query.filter_by(user_id=user_id, status='Approved').all()
        user_group_ids = [m.group_id for m in memberships]
        query = query.filter(Match.group_id.in_(user_group_ids))

    matches = query.order_by(Match.match_date.desc(), Match.match_time.desc()).all()

    res = []
    for m in matches:
        d = enrich_match_dict(m.to_dict(), m)
        yes_votes = MatchVote.query.filter_by(match_id=m.id, vote='Yes').count()
        no_votes = MatchVote.query.filter_by(match_id=m.id, vote='No').count()
        d['registered_players'] = yes_votes
        d['confirmed_guests_count'] = GuestPlayer.query.filter_by(match_id=m.id, status='confirmed').count()
        d['yes_votes'] = yes_votes + d['confirmed_guests_count']
        d['is_admin'] = check_group_admin(m.group_id, user_id)
        d['no_votes'] = no_votes

        user_vote = MatchVote.query.filter_by(match_id=m.id, user_id=user_id).first()
        d['user_vote'] = user_vote.vote if user_vote else 'None'

        in_sub_queue = Substitute.query.filter_by(match_id=m.id, user_id=user_id).first()
        d['in_substitute_queue'] = in_sub_queue is not None
        d['substitute_position'] = in_sub_queue.queue_position if in_sub_queue else 0
        d['substitute_status'] = in_sub_queue.status if in_sub_queue else None

        sub_records = Substitute.query.filter_by(match_id=m.id).order_by(Substitute.queue_position.asc()).all()
        substitutes = []
        for s in sub_records:
            u = User.query.get(s.user_id)
            if u:
                substitutes.append({
                    'user_id': u.id,
                    'name': u.name,
                    'queue_position': s.queue_position,
                    'promoted': s.promoted,
                    'status': s.status
                })
        d['substitutes'] = substitutes

        res.append(d)

    return jsonify(res), 200


@matches_bp.route('/<int:match_id>', methods=['GET'])
@jwt_required()
def get_match(match_id):
    user_id = int(get_jwt_identity())
    match = Match.query.get(match_id)
    if not match:
        return jsonify({'error': 'Match not found'}), 404

    if not check_group_member(match.group_id, user_id):
        return jsonify({'error': 'Not a member of this group'}), 403

    # ── Auto-heal: if a slot is open with no active invite and waiting entries exist,
    #    trigger the promotion NOW so the response already carries the 'invited' status.
    #    This means the first person in the waiting list sees the Yes/No prompt the moment
    #    they (or anyone) loads the match page — no separate event or refresh required.
    if match.status not in ('Completed', 'Cancelled') and not is_match_past(match):
        _yes_pre = MatchVote.query.filter_by(match_id=match_id, vote='Yes').count()
        _conf_guests_pre = GuestPlayer.query.filter_by(match_id=match_id, status='confirmed').count()
        if _yes_pre + _conf_guests_pre < match.max_players:
            _active_invite = (
                Substitute.query.filter_by(match_id=match_id, status='invited').first() or
                GuestPlayer.query.filter_by(match_id=match_id, status='invited').first()
            )
            if not _active_invite:
                _next = get_next_waiting_entry(match_id)
                if _next:
                    _etype, _eobj = _next
                    invite_entry(match_id, _etype, _eobj, datetime.utcnow())
                    db.session.commit()

    votes = []
    vote_records = MatchVote.query.filter_by(match_id=match_id).all()
    for v in vote_records:
        u = User.query.get(v.user_id)
        if u:
            votes.append({
                'id': v.id,
                'user_id': u.id,
                'name': u.name,
                'vote': v.vote,
                'has_paid': v.has_paid,
                'paid_amount': v.paid_amount,
                'payment_verified': v.payment_verified,
                'created_at': v.created_at.isoformat() if v.created_at else None
            })

    substitutes = []
    sub_records = Substitute.query.filter_by(match_id=match_id).order_by(Substitute.queue_position.asc()).all()
    for s in sub_records:
        u = User.query.get(s.user_id)
        if u:
            substitutes.append({
                'user_id': u.id,
                'name': u.name,
                'queue_position': s.queue_position,
                'promoted': s.promoted,
                'status': s.status,
                'invited_at': s.invited_at.isoformat() if s.invited_at else None
            })

    res = enrich_match_dict(match.to_dict(), match)
    res['votes'] = votes
    res['substitutes'] = substitutes
    res['is_admin'] = check_group_admin(match.group_id, user_id)
    yes_count = sum(1 for v in votes if v['vote'] == 'Yes')
    res['per_player_cost'] = round(match.cost / match.max_players, 2) if match.cost > 0 and match.max_players > 0 else 0

    user_vote = MatchVote.query.filter_by(match_id=match_id, user_id=user_id).first()
    res['user_vote'] = user_vote.vote if user_vote else 'None'
    res['paid_amount'] = user_vote.paid_amount if user_vote else 0

    # Guest-aware payment calculation
    confirmed_guests_count = GuestPlayer.query.filter_by(match_id=match_id, added_by_user_id=user_id, status='confirmed').count()
    splits = 1 + confirmed_guests_count
    res['confirmed_guests_count'] = confirmed_guests_count
    res['splits'] = splits
    res['user_total_cost'] = round(res['per_player_cost'] * splits, 2)
    res['pending_amount'] = round(max(0, res['user_total_cost'] - res['paid_amount']), 2)

    in_sub_queue = Substitute.query.filter_by(match_id=match_id, user_id=user_id).first()
    res['in_substitute_queue'] = in_sub_queue is not None
    res['substitute_position'] = in_sub_queue.queue_position if in_sub_queue else 0
    res['substitute_promoted'] = in_sub_queue.promoted if in_sub_queue else False
    res['substitute_status'] = in_sub_queue.status if in_sub_queue else None

    # Unified waiting list (substitutes + guests with status='waiting')
    waiting_list = []
    waiting_subs = Substitute.query.filter_by(match_id=match_id, status='waiting').order_by(Substitute.queue_position.asc()).all()
    for s in waiting_subs:
        u = User.query.get(s.user_id)
        waiting_list.append({
            'type': 'substitute',
            'id': s.id,
            'name': u.name if u else 'Unknown',
            'queue_position': s.queue_position,
            'status': s.status,
            'invited_at': s.invited_at.isoformat() if s.invited_at else None,
        })
    waiting_guests = GuestPlayer.query.filter_by(match_id=match_id, status='waiting').order_by(GuestPlayer.queue_position.asc()).all()
    for g in waiting_guests:
        waiting_list.append({
            'type': 'guest',
            'id': g.id,
            'name': g.name,
            'queue_position': g.queue_position,
            'status': g.status,
            'invited_at': g.invited_at.isoformat() if g.invited_at else None,
            'added_by_user_id': g.added_by_user_id,
            'added_by_name': g.added_by.name if g.added_by else 'Unknown',
        })
    waiting_list.sort(key=lambda x: x['queue_position'] or 999)
    res['waiting_list'] = waiting_list

    # All confirmed guests — visible to every group member in the playing list
    confirmed_guests = []
    confirmed_guest_records = GuestPlayer.query.filter_by(match_id=match_id, status='confirmed').order_by(GuestPlayer.created_at.asc()).all()
    for g in confirmed_guest_records:
        confirmed_guests.append({
            'id': g.id,
            'name': g.name,
            'created_at': g.created_at.isoformat() if g.created_at else None,
            'added_by_user_id': g.added_by_user_id,
            'added_by_name': g.added_by.name if g.added_by else 'Unknown',
        })
    res['confirmed_guests'] = confirmed_guests

    # Pending guest invite for SPOC
    pending_guest = GuestPlayer.query.filter_by(match_id=match_id, added_by_user_id=user_id, status='invited').first()
    res['has_pending_guest_invite'] = pending_guest is not None
    res['pending_guest_invite_id'] = pending_guest.id if pending_guest else None
    res['pending_guest_invite_name'] = pending_guest.name if pending_guest else None
    res['pending_guest_invited_at'] = pending_guest.invited_at.isoformat() if pending_guest and pending_guest.invited_at else None

    # Include active penalties for this match's group
    active_penalties = []
    penalty_records = Penalty.query.filter(
        Penalty.group_id == match.group_id,
        Penalty.remaining_matches > 0
    ).all()
    for p in penalty_records:
        pu = User.query.get(p.user_id)
        pd = p.to_dict()
        pd['user_name'] = pu.name if pu else 'Unknown'
        active_penalties.append(pd)
    res['penalties'] = active_penalties

    # Include backed-out players
    backed_out_votes = MatchVote.query.filter_by(match_id=match_id, vote='BackedOut').all()
    backed_out_list = []
    for bv in backed_out_votes:
        bu = User.query.get(bv.user_id)
        backed_out_list.append({
            'user_id': bv.user_id,
            'name': bu.name if bu else 'Unknown',
            'reason': bv.backout_reason,
            'backout_at': bv.backout_at.isoformat() if bv.backout_at else None,
        })
    res['backed_out_players'] = backed_out_list

    return jsonify(res), 200


@matches_bp.route('/<int:match_id>', methods=['PUT'])
@jwt_required()
def edit_match(match_id):
    user_id = int(get_jwt_identity())
    match = Match.query.get(match_id)
    if not match:
        return jsonify({'error': 'Match not found'}), 404

    if not check_group_admin(match.group_id, user_id):
        return jsonify({'error': 'Admin permissions required'}), 403

    if match.status in ['Completed', 'Cancelled']:
        return jsonify({'error': 'Cannot edit a completed or cancelled match'}), 400

    if is_match_past(match):
        return jsonify({'error': 'Cannot edit a match after kickoff time'}), 400

    if MatchVote.query.filter_by(match_id=match_id, has_paid=True).first() or GuestPlayer.query.filter_by(match_id=match_id).first():
        return jsonify({'error': 'This match has guest or payment records. Create a new fixture instead of resetting participation.'}), 400

    data = request.get_json() or {}
    try:
        players = data.get('max_players', match.max_players)
        cost = float(data.get('cost', match.cost))
        if isinstance(players, bool) or int(players) != float(players) or not 1 <= int(players) <= 100 or not math.isfinite(cost) or cost < 0:
            raise ValueError()
        turf = data.get('turf_name', match.turf_name)
        location = data.get('location', match.location)
        date = data.get('match_date', match.match_date)
        time = data.get('match_time', match.match_time)
        end = data.get('end_time', match.end_time)
        if not isinstance(turf, str) or not turf.strip() or len(turf) > 100 or not isinstance(location, str) or not location.strip() or len(location) > 200:
            raise ValueError()
        if not isinstance(date, str) or not isinstance(time, str) or not parse_match_datetime(date, time):
            raise ValueError()
        if end and (not isinstance(end, str) or not parse_match_datetime(date, end)):
            raise ValueError()
    except (ValueError, TypeError, OverflowError):
        return jsonify({'error': 'Enter valid match details, 1–100 players and nonnegative finite cost'}), 400

    match.turf_name = data.get('turf_name', match.turf_name)
    match.location = data.get('location', match.location)
    match.match_date = data.get('match_date', match.match_date)
    match.match_time = data.get('match_time', match.match_time)
    match.end_time = data.get('end_time', match.end_time)
    match.max_players = int(players)
    match.cost = cost

    match.max_players = normalize_player_counts(match.max_players)

    match.status = 'Proposed'
    match.auto_booked = False

    MatchVote.query.filter_by(match_id=match_id).delete()
    Substitute.query.filter_by(match_id=match_id).delete()

    db.session.commit()

    members = GroupMember.query.filter_by(group_id=match.group_id, status='Approved').all()
    for member in members:
        if member.user_id != user_id:
            notif = Notification(
                user_id=member.user_id,
                message=f"Match at {match.turf_name} ({match.match_date}) details updated by admin. Votes have been reset."
            )
            db.session.add(notif)
    db.session.commit()

    result = enrich_match_dict(match.to_dict(), match)
    return jsonify({'message': 'Match updated successfully. Votes reset.', 'match': result}), 200


@matches_bp.route('/<int:match_id>/vote', methods=['POST'])
@jwt_required()
def vote_match(match_id):
    user_id = int(get_jwt_identity())
    match = Match.query.get(match_id)
    if not match:
        return jsonify({'error': 'Match not found'}), 404

    if not check_group_member(match.group_id, user_id):
        return jsonify({'error': 'Not a member of this group'}), 403

    if is_user_banned(match.group_id, user_id):
        return jsonify({'error': 'You cannot vote due to an active ban/restriction penalty'}), 403

    if match.status in ['Completed', 'Cancelled']:
        return jsonify({'error': 'Voting is locked for this match'}), 400

    if is_match_past(match):
        return jsonify({'error': 'Voting is closed — match kickoff time has passed'}), 400

    data = request.get_json() or {}
    vote_val = data.get('vote')
    if vote_val not in ['Yes', 'No']:
        return jsonify({'error': 'Vote must be Yes or No'}), 400

    yes_votes = MatchVote.query.filter_by(match_id=match_id, vote='Yes').count() + GuestPlayer.query.filter_by(match_id=match_id, status='confirmed').count()
    existing_vote = MatchVote.query.filter_by(match_id=match_id, user_id=user_id).first()

    if vote_val == 'Yes':
        if existing_vote and existing_vote.vote == 'Yes':
            pass
        elif yes_votes >= match.max_players:
            return jsonify({'error': 'Match is full — maximum players reached'}), 400
        elif existing_vote:
            existing_vote.vote = vote_val
        else:
            db.session.add(MatchVote(match_id=match_id, user_id=user_id, vote=vote_val))
    else:
        if existing_vote:
            existing_vote.vote = vote_val
        else:
            db.session.add(MatchVote(match_id=match_id, user_id=user_id, vote=vote_val))

    db.session.commit()

    fully_booked = notify_admin_on_full(match)
    db.session.refresh(match)

    return jsonify({
        'message': 'Vote recorded successfully',
        'match_status': match.status,
        'auto_booked': match.auto_booked,
        'fully_booked': fully_booked,
    }), 200


@matches_bp.route('/<int:match_id>/confirm', methods=['POST'])
@jwt_required()
def confirm_match(match_id):
    user_id = int(get_jwt_identity())
    match = Match.query.get(match_id)
    if not match:
        return jsonify({'error': 'Match not found'}), 404

    if not check_group_admin(match.group_id, user_id):
        return jsonify({'error': 'Admin permissions required'}), 403

    match.status = 'Turf Confirmed'
    match.auto_booked = False

    # Notify confirmed players
    confirmed_voters = MatchVote.query.filter_by(match_id=match_id, vote='Yes').all()
    for voter in confirmed_voters:
        notif = Notification(
            user_id=voter.user_id,
            message=f"Match at {match.turf_name} ({match.match_date}) has been confirmed!"
        )
        db.session.add(notif)

    db.session.commit()

    result = enrich_match_dict(match.to_dict(), match)
    return jsonify({'message': 'Turf confirmed manually.', 'match': result}), 200


@matches_bp.route('/<int:match_id>/backout', methods=['POST'])
@jwt_required()
def backout_match(match_id):
    user_id = int(get_jwt_identity())
    match = Match.query.get(match_id)
    if not match:
        return jsonify({'error': 'Match not found'}), 404

    if not check_group_member(match.group_id, user_id):
        return jsonify({'error': 'Not a member of this group'}), 403

    if match.status in ['Completed', 'Cancelled']:
        return jsonify({'error': 'Cannot back out of a completed or cancelled match'}), 400

    vote_record = MatchVote.query.filter_by(match_id=match_id, user_id=user_id, vote='Yes').first()
    if not vote_record:
        return jsonify({'error': 'You are not confirmed to play in this match'}), 400

    match_dt = parse_match_datetime(match.match_date, match.match_time)
    if match_dt and datetime.utcnow() >= match_dt:
        return jsonify({'error': 'Cannot back out — the match has already started'}), 400

    data = request.get_json() or {}
    reason = data.get('reason', '')

    # Track backout on the vote record (instead of deleting)
    vote_record.vote = 'BackedOut'
    vote_record.backout_reason = reason
    vote_record.backout_at = datetime.utcnow()

    # Process unified waiting list (substitutes + guests) via promotion system
    promo_result = process_slot_opening(match_id)
    has_waiting_entry = promo_result['invited']

    # Auto-apply penalty if group rules are enabled and backout is within threshold
    group = Group.query.get(match.group_id)
    if group and group.backout_penalty_enabled and match_dt:
        hours_before = (match_dt - datetime.utcnow()).total_seconds() / 3600
        if hours_before <= group.backout_hours_threshold:
            existing_penalty = Penalty.query.filter_by(user_id=user_id, group_id=match.group_id, penalty_type=group.backout_penalty_type).filter(Penalty.remaining_matches > 0).first()
            if not existing_penalty:
                penalty = Penalty(
                    user_id=user_id,
                    group_id=match.group_id,
                    penalty_type=group.backout_penalty_type,
                    remaining_matches=group.backout_penalty_matches,
                    reason=f'Auto-applied: Backed out {round(hours_before, 1)}h before match',
                    created_by=user_id
                )
                db.session.add(penalty)
                notif_penalty = Notification(
                    user_id=user_id,
                    message=f"Penalty '{group.backout_penalty_type}' auto-applied for backing out of match at {match.turf_name} ({match.match_date}). Duration: {group.backout_penalty_matches} matches."
                )
                db.session.add(notif_penalty)

    # Apply custom PenaltyRule for backout_no_sub when no unified waiting entry available
    if not has_waiting_entry and group:
        backout_rules = PenaltyRule.query.filter_by(group_id=match.group_id, trigger_event='backout_no_sub', is_active=True).all()
        for rule in backout_rules:
            existing = Penalty.query.filter_by(user_id=user_id, group_id=match.group_id, penalty_type=rule.penalty_type).filter(Penalty.remaining_matches > 0).first()
            if not existing:
                penalty = Penalty(
                    user_id=user_id,
                    group_id=match.group_id,
                    penalty_type=rule.penalty_type,
                    remaining_matches=rule.penalty_value,
                    reason=f'Backout without substitute: {rule.description}' if rule.description else 'Backed out with no substitute available',
                    created_by=user_id
                )
                db.session.add(penalty)
                notif_backout = Notification(
                    user_id=user_id,
                    message=f"Penalty '{rule.penalty_type}' applied for backing out with no substitute. Duration: {rule.penalty_value} matches."
                )
                db.session.add(notif_backout)

    admins = GroupMember.query.filter_by(group_id=match.group_id, role='Admin').all()
    user_voter = User.query.get(user_id)
    for admin in admins:
        notif_admin = Notification(
            user_id=admin.user_id,
            message=f"{user_voter.name} backed out of match at {match.turf_name} ({match.match_date}). Reason: {reason}"
        )
        db.session.add(notif_admin)

    db.session.commit()

    response_data = {
        'message': 'Successfully backed out of the match',
        'substitute_invited': has_waiting_entry,
    }

    return jsonify(response_data), 200


@matches_bp.route('/<int:match_id>/substitute/accept', methods=['POST'])
@jwt_required()
def accept_substitute_promotion(match_id):
    user_id = int(get_jwt_identity())
    match = Match.query.get(match_id)
    if not match:
        return jsonify({'error': 'Match not found'}), 404

    sub = Substitute.query.filter_by(match_id=match_id, user_id=user_id, status='invited').first()
    if not sub:
        return jsonify({'error': 'No pending invitation found for you in this match'}), 400

    # Check timeout
    if sub.invited_at and (datetime.utcnow() - sub.invited_at).total_seconds() > PROMOTION_TIMEOUT_MINUTES * 60:
        sub.status = 'timed_out'
        notif = Notification(
            user_id=user_id,
            message=f"Your invitation to join match at {match.turf_name} ({match.match_date}) has expired.",
            type='invite_expired',
            match_id=match_id
        )
        db.session.add(notif)
        db.session.commit()
        process_slot_opening(match_id)
        return jsonify({'error': 'Invitation has expired. The next waiting entry has been notified.'}), 400

    # Promote via shared helper
    promote_entry_to_playing('substitute', sub, match_id)

    notif_sub = Notification(
        user_id=user_id,
        message=f"You have confirmed your spot in match at {match.turf_name} ({match.match_date}). You are now on the Playing Team!",
        type='promotion_accepted',
        match_id=match_id
    )
    db.session.add(notif_sub)

    admins = GroupMember.query.filter_by(group_id=match.group_id, role='Admin').all()
    for admin in admins:
        notif_admin = Notification(
            user_id=admin.user_id,
            message=f"Substitute has accepted the open spot in match at {match.turf_name} ({match.match_date}).",
            type='admin_info',
            match_id=match_id
        )
        db.session.add(notif_admin)

    db.session.commit()
    return jsonify({'message': 'Successfully accepted the spot. You are now a confirmed player!'}), 200


@matches_bp.route('/<int:match_id>/substitute/decline', methods=['POST'])
@jwt_required()
def decline_substitute_promotion(match_id):
    user_id = int(get_jwt_identity())
    match = Match.query.get(match_id)
    if not match:
        return jsonify({'error': 'Match not found'}), 404

    sub = Substitute.query.filter_by(match_id=match_id, user_id=user_id, status='invited').first()
    if not sub:
        return jsonify({'error': 'No pending invitation found for you in this match'}), 400

    # Mark as declined (preserve record for audit)
    sub.status = 'declined'

    # Log the response
    log = PromotionLog.query.filter_by(match_id=match_id, entry_type='substitute', entry_id=sub.id, response=None).order_by(PromotionLog.id.desc()).first()
    if log:
        log.response = 'declined'
        log.response_received_at = datetime.utcnow()

    notif_decline = Notification(
        user_id=match.created_by,
        message=f"A substitute declined the open spot in match at {match.turf_name} ({match.match_date}).",
        type='admin_info',
        match_id=match_id
    )
    db.session.add(notif_decline)

    db.session.commit()

    # Try next entry in unified queue
    process_slot_opening(match_id)

    return jsonify({'message': 'Declined the invitation. The next waiting entry will be notified.'}), 200


@matches_bp.route('/<int:match_id>/attendance', methods=['GET', 'POST'])
@jwt_required()
def match_attendance(match_id):
    user_id = int(get_jwt_identity())
    match = Match.query.get(match_id)
    if not match:
        return jsonify({'error': 'Match not found'}), 404

    if not check_group_admin(match.group_id, user_id):
        return jsonify({'error': 'Admin permissions required'}), 403

    if request.method == 'GET':
        votes = MatchVote.query.filter_by(match_id=match_id).all()
        result = []
        for v in votes:
            u = User.query.get(v.user_id)
            result.append({
                'vote_id': v.id,
                'user_id': v.user_id,
                'name': u.name if u else 'Unknown',
                'vote': v.vote,
                'backout_reason': v.backout_reason,
                'backout_at': v.backout_at.isoformat() if v.backout_at else None,
            })
        return jsonify(result), 200

    # POST - admin marks attendance for a specific vote
    data = request.get_json() or {}
    vote_id = data.get('vote_id')
    if not vote_id:
        return jsonify({'error': 'vote_id is required'}), 400

    vote_record = MatchVote.query.filter_by(id=vote_id, match_id=match_id).first()
    if not vote_record:
        return jsonify({'error': 'Vote record not found'}), 404

    # Apply no-show penalty rules if player was confirmed but didn't attend
    if vote_record.vote == 'Yes':
        penalty_rules = PenaltyRule.query.filter_by(group_id=match.group_id, trigger_event='no_show', is_active=True).all()
        for rule in penalty_rules:
            existing = Penalty.query.filter_by(user_id=vote_record.user_id, group_id=match.group_id, penalty_type=rule.penalty_type).filter(Penalty.remaining_matches > 0).first()
            if not existing:
                penalty = Penalty(
                    user_id=vote_record.user_id,
                    group_id=match.group_id,
                    penalty_type=rule.penalty_type,
                    remaining_matches=rule.penalty_value,
                    reason=f'No-show penalty: {rule.description}' if rule.description else 'No-show penalty (failed to attend confirmed match)',
                    created_by=user_id
                )
                db.session.add(penalty)
                notif = Notification(
                    user_id=vote_record.user_id,
                    message=f"No-show penalty '{rule.penalty_type}' applied for match at {match.turf_name} ({match.match_date}). Duration: {rule.penalty_value} matches."
                )
                db.session.add(notif)

    db.session.commit()
    return jsonify({'message': 'Attendance marked'}), 200


@matches_bp.route('/<int:match_id>/substitute', methods=['POST'])
@jwt_required()
def join_substitute_queue(match_id):
    user_id = int(get_jwt_identity())
    match = Match.query.get(match_id)
    if not match:
        return jsonify({'error': 'Match not found'}), 404

    if not check_group_member(match.group_id, user_id):
        return jsonify({'error': 'Not a member of this group'}), 403

    if is_user_banned(match.group_id, user_id):
        return jsonify({'error': 'You cannot join substitute queue due to active ban/restriction penalty'}), 403

    if is_match_past(match):
        return jsonify({'error': 'Substitute queue is closed — match has started'}), 400

    vote_record = MatchVote.query.filter_by(match_id=match_id, user_id=user_id, vote='Yes').first()
    if vote_record:
        return jsonify({'error': 'You are already a confirmed player'}), 400

    existing_sub = Substitute.query.filter_by(match_id=match_id, user_id=user_id).first()
    if existing_sub:
        return jsonify({'error': 'You are already in the substitute queue'}), 400

    subs_count = Substitute.query.filter_by(match_id=match_id, status='waiting').count()
    if subs_count >= 3:
        return jsonify({'error': 'Waiting list is full (max 3 players allowed)'}), 400

    max_pos = get_max_waiting_position(match_id)
    sub = Substitute(
        match_id=match_id,
        user_id=user_id,
        queue_position=max_pos + 1,
        status='waiting'
    )
    db.session.add(sub)
    db.session.commit()

    return jsonify({
        'message': 'Successfully joined the waiting list',
        'position': sub.queue_position
    }), 200


@matches_bp.route('/<int:match_id>/substitute/leave', methods=['DELETE'])
@jwt_required()
def leave_substitute_queue(match_id):
    user_id = int(get_jwt_identity())
    match = Match.query.get(match_id)
    if not match:
        return jsonify({'error': 'Match not found'}), 404

    sub = Substitute.query.filter_by(match_id=match_id, user_id=user_id, status='waiting').first()
    if not sub:
        return jsonify({'error': 'You are not in the waiting list'}), 404

    db.session.delete(sub)

    renumber_waiting_entries(match_id)
    db.session.commit()
    return jsonify({'message': 'Left the waiting list'}), 200


@matches_bp.route('/<int:match_id>/substitute/<int:sub_id>', methods=['DELETE'])
@jwt_required()
def remove_from_substitute_queue(match_id, sub_id):
    user_id = int(get_jwt_identity())
    match = Match.query.get(match_id)
    if not match:
        return jsonify({'error': 'Match not found'}), 404

    if not check_group_admin(match.group_id, user_id):
        return jsonify({'error': 'Admin permissions required'}), 403

    sub = Substitute.query.get(sub_id)
    if not sub or sub.match_id != match_id:
        return jsonify({'error': 'Substitute not found'}), 404

    db.session.delete(sub)

    renumber_waiting_entries(match_id)
    db.session.commit()
    return jsonify({'message': 'Removed from waiting list'}), 200


@matches_bp.route('/<int:match_id>/substitute/admin-add', methods=['POST'])
@jwt_required()
def admin_add_substitute(match_id):
    user_id = int(get_jwt_identity())
    match = Match.query.get(match_id)
    if not match:
        return jsonify({'error': 'Match not found'}), 404

    if not check_group_admin(match.group_id, user_id):
        return jsonify({'error': 'Admin permissions required'}), 403

    data = request.get_json() or {}
    target_user_id = data.get('user_id')
    if not target_user_id:
        return jsonify({'error': 'user_id is required'}), 400

    target_user = User.query.get(target_user_id)
    if not target_user:
        return jsonify({'error': 'User not found'}), 404

    if not check_group_member(match.group_id, target_user_id):
        return jsonify({'error': 'User is not a group member'}), 400

    vote_record = MatchVote.query.filter_by(match_id=match_id, user_id=target_user_id, vote='Yes').first()
    if vote_record:
        return jsonify({'error': 'User is already a confirmed player'}), 400

    existing_sub = Substitute.query.filter_by(match_id=match_id, user_id=target_user_id).first()
    if existing_sub:
        return jsonify({'error': 'User is already in the waiting list'}), 400

    subs_count = Substitute.query.filter_by(match_id=match_id, status='waiting').count()
    if subs_count >= 3:
        return jsonify({'error': 'Waiting list is full (max 3 players allowed)'}), 400

    max_pos = get_max_waiting_position(match_id)
    sub = Substitute(
        match_id=match_id,
        user_id=target_user_id,
        queue_position=max_pos + 1,
        status='waiting'
    )
    db.session.add(sub)

    notif = Notification(
        user_id=target_user_id,
        message=f"You have been added to the waiting list for match at {match.turf_name} ({match.match_date})"
    )
    db.session.add(notif)
    db.session.commit()

    return jsonify({'message': f'{target_user.name} added to waiting list', 'position': sub.queue_position}), 200


@matches_bp.route('/<int:match_id>/complete', methods=['POST'])
@jwt_required()
def complete_match(match_id):
    user_id = int(get_jwt_identity())
    match = Match.query.get(match_id)
    if not match:
        return jsonify({'error': 'Match not found'}), 404

    if not check_group_admin(match.group_id, user_id):
        return jsonify({'error': 'Admin permissions required'}), 403

    match.status = 'Completed'

    active_penalties = Penalty.query.filter(
        Penalty.group_id == match.group_id,
        Penalty.remaining_matches > 0
    ).all()

    for penalty in active_penalties:
        penalty.remaining_matches -= 1

    db.session.commit()
    return jsonify({'message': 'Match marked as completed. Ban counts updated.'}), 200


@matches_bp.route('/<int:match_id>/cancel', methods=['POST'])
@jwt_required()
def cancel_match(match_id):
    user_id = int(get_jwt_identity())
    match = Match.query.get(match_id)
    if not match:
        return jsonify({'error': 'Match not found'}), 404

    if not check_group_admin(match.group_id, user_id):
        return jsonify({'error': 'Admin permissions required'}), 403

    match.status = 'Cancelled'

    members = GroupMember.query.filter_by(group_id=match.group_id, status='Approved').all()
    for member in members:
        if member.user_id != user_id:
            notif = Notification(
                user_id=member.user_id,
                message=f"Match at {match.turf_name} ({match.match_date}) has been cancelled by the admin."
            )
            db.session.add(notif)

    db.session.commit()
    return jsonify({'message': 'Match cancelled successfully'}), 200


@matches_bp.route('/<int:match_id>/pay', methods=['POST'])
@jwt_required()
def user_pay(match_id):
    user_id = int(get_jwt_identity())
    match = Match.query.get(match_id)
    if not match:
        return jsonify({'error': 'Match not found'}), 404

    if not check_group_member(match.group_id, user_id):
        return jsonify({'error': 'Not a member of this group'}), 403
    if match.status not in ['Turf Confirmed', 'Completed']:
        return jsonify({'error': 'Payments are available after booking confirmation'}), 400
    if match.cost <= 0:
        return jsonify({'error': 'This match has no payment due'}), 400

    vote = MatchVote.query.filter_by(match_id=match_id, user_id=user_id, vote='Yes').first()
    if not vote:
        return jsonify({'error': 'You are not a confirmed player in this match'}), 400

    per_player_cost = round(match.cost / match.max_players, 2) if match.cost > 0 and match.max_players > 0 else 0
    confirmed_guests = GuestPlayer.query.filter_by(match_id=match_id, added_by_user_id=user_id, status='confirmed').count()
    splits = 1 + confirmed_guests
    total_due = round(per_player_cost * splits, 2)

    if vote.payment_verified and vote.paid_amount >= total_due:
        return jsonify({'error': 'Payment already verified'}), 400
    already_submitted = vote.has_paid and vote.paid_amount >= total_due

    vote.has_paid = True
    vote.paid_amount = total_due
    vote.payment_verified = False

    # Update or create payment record
    payment = Payment.query.filter_by(match_id=match_id, user_id=user_id).first()
    if payment:
        payment.splits = splits
        payment.total_due = total_due
        payment.amount_paid = total_due
        payment.status = 'verification_pending'
    else:
        payment = Payment(
            match_id=match_id,
            user_id=user_id,
            splits=splits,
            total_due=total_due,
            amount_paid=total_due,
            status='verification_pending'
        )
        db.session.add(payment)
    if not already_submitted:
        for admin in GroupMember.query.filter_by(group_id=match.group_id, role='Admin', status='Approved').all():
            db.session.add(Notification(user_id=admin.user_id, type='payment_submitted', match_id=match.id,
                message=f'{vote.user.name} marked payment for {match.turf_name}. Please verify the transfer.'))
    db.session.commit()

    pending = round(max(0, total_due - vote.paid_amount), 2)

    return jsonify({
        'message': 'Payment recorded. Waiting for admin verification.',
        'has_paid': vote.has_paid,
        'paid_amount': vote.paid_amount,
        'splits': splits,
        'user_total_cost': total_due,
        'pending_amount': pending
    }), 200


@matches_bp.route('/<int:match_id>/verify_payment/<int:player_id>', methods=['POST'])
@jwt_required()
def verify_payment(match_id, player_id):
    current_user_id = int(get_jwt_identity())
    match = Match.query.get(match_id)
    if not match:
        return jsonify({'error': 'Match not found'}), 404
        
    if not check_group_admin(match.group_id, current_user_id):
        return jsonify({'error': 'Admin permissions required to verify payments'}), 403
    if match.status not in ['Turf Confirmed', 'Completed']:
        return jsonify({'error': 'Payments are available after booking confirmation'}), 400
        
    vote = MatchVote.query.filter_by(match_id=match_id, user_id=player_id, vote='Yes').first()
    if not vote:
        return jsonify({'error': 'Player not found in playing list'}), 404

    if not vote.has_paid:
        return jsonify({'error': 'Player has not marked payment yet'}), 400

    confirmed_guests = GuestPlayer.query.filter_by(match_id=match_id, added_by_user_id=player_id, status='confirmed').count()
    splits = 1 + confirmed_guests
    per_player_cost = round(match.cost / match.max_players, 2) if match.cost > 0 and match.max_players > 0 else 0
    total_due = round(per_player_cost * splits, 2)

    if vote.paid_amount < total_due:
        return jsonify({'error': 'Player has not paid the full amount yet'}), 400

    if not vote.payment_verified:
        db.session.add(Notification(user_id=player_id, type='payment_verified', match_id=match.id,
            message=f'Your payment for {match.turf_name} has been verified.'))
    vote.payment_verified = True

    # Update payment record
    payment = Payment.query.filter_by(match_id=match_id, user_id=player_id).first()
    if payment:
        payment.status = 'verified'
    db.session.commit()
    
    return jsonify({
        'message': 'Payment verified successfully',
        'has_paid': vote.has_paid,
        'paid_amount': vote.paid_amount,
        'splits': splits,
        'user_total_cost': total_due,
        'payment_verified': vote.payment_verified
    }), 200


