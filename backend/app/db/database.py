from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, sessionmaker

from app.core.config import settings


def _normalize_database_url(url: str) -> str:
    """
    Ensure SQLAlchemy uses the psycopg2 driver for PostgreSQL (Neon).

    Neon may provide `postgres://` or `postgresql://` URLs.
    """
    if url.startswith("postgres://"):
        return url.replace("postgres://", "postgresql+psycopg2://", 1)
    if url.startswith("postgresql://") and "+psycopg2" not in url:
        return url.replace("postgresql://", "postgresql+psycopg2://", 1)
    return url


engine = create_engine(
    _normalize_database_url(settings.DATABASE_URL),
    pool_pre_ping=True,
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


class Base(DeclarativeBase):
    pass


def get_db():
    """FastAPI dependency that yields a database session."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db() -> None:
    """Create all database tables in PostgreSQL (Neon)."""
    # Import models so they register on Base.metadata before create_all.
    from app.models import project as _project  # noqa: F401
    from app.models import report as _report  # noqa: F401
    from app.models import user as _user  # noqa: F401

    Base.metadata.create_all(bind=engine)
