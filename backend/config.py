import os
import sys
from datetime import timedelta
from dotenv import load_dotenv

# Load .env from the directory this file lives in
load_dotenv(os.path.join(os.path.dirname(__file__), '.env'))

_INSECURE_DEFAULTS = {
    'absoluturf-secret-key-12345',
    'absoluturf-jwt-secret-key-67890',
}

def _require_secret(name: str) -> str:
    """Return the env var value, or exit with a clear error if it is missing / still the old default."""
    value = os.environ.get(name, '')
    if not value or value in _INSECURE_DEFAULTS:
        print(
            f"\n[AbsoluTurf] FATAL: {name} is not set or is using an insecure default.\n"
            f"  Add a real value to backend/.env  (see .env.example for instructions).\n",
            file=sys.stderr,
        )
        sys.exit(1)
    return value


class Config:
    SECRET_KEY = _require_secret('SECRET_KEY')
    SQLALCHEMY_DATABASE_URI = os.environ.get('DATABASE_URL', 'sqlite:///absoluturf.db')
    if SQLALCHEMY_DATABASE_URI.startswith(('postgresql://', 'postgres://')):
        SQLALCHEMY_DATABASE_URI = 'postgresql+psycopg://' + SQLALCHEMY_DATABASE_URI.split('://', 1)[1]
    SQLALCHEMY_ENGINE_OPTIONS = {'pool_pre_ping': True}
    SQLALCHEMY_TRACK_MODIFICATIONS = False

    JWT_SECRET_KEY = _require_secret('JWT_SECRET_KEY')
    JWT_ACCESS_TOKEN_EXPIRES = timedelta(days=7)
    JWT_TOKEN_LOCATION = ['headers', 'cookies']
    JWT_COOKIE_SECURE = os.environ.get('JWT_COOKIE_SECURE', 'false').lower() == 'true'
    JWT_COOKIE_CSRF_PROTECT = False  # Simplified for MVP; enable with same-site CSRF tokens in production

    # Allowed CORS origins — comma-separated list from env, e.g. "http://localhost:3000"
    CORS_ORIGINS: list[str] = [
        o.strip()
        for o in os.environ.get('CORS_ORIGINS', 'http://localhost:3000').split(',')
        if o.strip()
    ]

    # Upload folder for images
    UPLOAD_FOLDER = os.path.join(os.path.abspath(os.path.dirname(__file__)), 'uploads')
    MAX_CONTENT_LENGTH = 16 * 1024 * 1024  # 16 MB max upload size
