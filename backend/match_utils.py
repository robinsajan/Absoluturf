import os
from datetime import datetime, timedelta
from typing import Optional


def parse_match_datetime(match_date: str, match_time: str) -> Optional[datetime]:
    """Convert venue-local date/time to naive UTC for kickoff and backout checks.

    Indian venues default to UTC+05:30, consistent with INR pricing. Set
    MATCH_UTC_OFFSET_MINUTES for a deployment in another fixed-offset region.
    """
    for time_fmt in ('%H:%M:%S', '%H:%M'):
        try:
            local = datetime.strptime(f"{match_date} {match_time}", f"%Y-%m-%d {time_fmt}")
            return local - timedelta(minutes=int(os.environ.get('MATCH_UTC_OFFSET_MINUTES', '330')))
        except ValueError:
            continue
    return None


def is_match_past(match) -> bool:
    """True once scheduled kickoff has passed."""
    match_dt = parse_match_datetime(match.match_date, match.match_time)
    if not match_dt:
        return False
    return datetime.utcnow() >= match_dt


def is_match_active(match) -> bool:
    """Active until kickoff time; excludes completed/cancelled."""
    if match.status in ('Completed', 'Cancelled'):
        return False
    return not is_match_past(match)


def calc_cost_per_player(total_cost: float, max_players: int) -> float:
    if max_players <= 0:
        return 0.0
    return round(float(total_cost) / max_players, 2)
