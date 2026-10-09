from flask_limiter import Limiter
from flask_limiter.util import get_remote_address

# Global limiter — imported by route blueprints that need per-endpoint limits
limiter = Limiter(
    key_func=get_remote_address,
    default_limits=["200 per minute"],  # global safety net
    storage_uri="memory://",
)
