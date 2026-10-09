"""Personal dashboard and payment ledger. All data is scoped to approved memberships."""
from flask import Blueprint, jsonify, request
from flask_jwt_extended import jwt_required, get_jwt_identity
from models import db, GroupMember, Match, MatchVote, GuestPlayer, Notification, Payment
from match_utils import is_match_active

overview_bp = Blueprint('overview', __name__)


def payment_rows(user_id, managed=False):
    memberships = GroupMember.query.filter_by(user_id=user_id, status='Approved').all()
    group_ids = [m.group_id for m in memberships if not managed or m.role == 'Admin']
    query = MatchVote.query.join(Match).filter(
        Match.group_id.in_(group_ids), Match.status.in_(['Turf Confirmed', 'Completed']),
        MatchVote.vote == 'Yes', Match.cost > 0)
    if not managed:
        query = query.filter(MatchVote.user_id == user_id)
    rows = []
    for vote in query.all():
        match = vote.match
        guests = GuestPlayer.query.filter_by(match_id=match.id, added_by_user_id=vote.user_id,
                                             status='confirmed').count()
        splits = 1 + guests
        due = round(round(match.cost / match.max_players, 2) * splits, 2)
        verified = vote.payment_verified and vote.paid_amount >= due
        status = 'verified' if verified else 'verification_pending' if vote.has_paid and vote.paid_amount >= due else 'pending'
        rows.append({
            'match_id': match.id, 'user_id': vote.user_id, 'player_name': vote.user.name,
            'group_name': match.group.name, 'turf_name': match.turf_name,
            'match_date': match.match_date, 'match_time': match.match_time,
            'upi_id': match.creator.upi_id if match.creator else None,
            'organizer_name': match.creator.name if match.creator else '',
            'splits': splits, 'total_due': due, 'amount_paid': round(vote.paid_amount, 2),
            'transfer_due': round(max(0, due - vote.paid_amount), 2),
            'outstanding': round(max(0, due - vote.paid_amount), 2) if vote.payment_verified else due,
            'status': status,
        })
    return sorted(rows, key=lambda r: (r['match_date'], r['match_time']), reverse=True)


@overview_bp.get('/payments')
@jwt_required()
def payments():
    user_id = int(get_jwt_identity())
    if request.args.get('scope', 'mine') not in ('mine', 'managed'):
        return jsonify({'error': 'Scope must be mine or managed'}), 400
    rows = payment_rows(user_id, request.args.get('scope') == 'managed')
    return jsonify({'payments': rows, 'summary': {
        'total_due': round(sum(r['total_due'] for r in rows), 2),
        'verified': round(sum(r['total_due'] for r in rows if r['status'] == 'verified'), 2),
        'outstanding': round(sum(r['outstanding'] for r in rows), 2),
        'verification_pending': sum(r['status'] == 'verification_pending' for r in rows),
    }})


@overview_bp.get('/dashboard')
@jwt_required()
def dashboard():
    user_id = int(get_jwt_identity())
    memberships = GroupMember.query.filter_by(user_id=user_id, status='Approved').all()
    group_ids = [m.group_id for m in memberships]
    matches = Match.query.filter(Match.group_id.in_(group_ids)).all()
    my_votes = {v.match_id: v.vote for v in MatchVote.query.filter_by(user_id=user_id).all()}
    upcoming = [m for m in matches if is_match_active(m)]
    rows = payment_rows(user_id)
    return jsonify({
        'upcoming_matches': len(upcoming),
        'confirmed_matches': sum(my_votes.get(m.id) == 'Yes' for m in upcoming),
        'completed_matches': sum(m.status == 'Completed' and my_votes.get(m.id) == 'Yes' for m in matches),
        'active_groups': len(memberships),
        'admin_groups': sum(m.role == 'Admin' for m in memberships),
        'outstanding': round(sum(r['outstanding'] for r in rows), 2),
        'pending_payments': sum(r['status'] == 'pending' for r in rows),
        'verification_pending': sum(r['status'] == 'verification_pending' for r in rows),
        'unread_notifications': Notification.query.filter_by(user_id=user_id, read=False).count(),
    })
