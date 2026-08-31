from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, sessionmaker

from app.core.config import settings


def _normalize_database_url(url: str) -> str:
    """
    Ensure SQLAlchemy uses the psycopg2 driver for PostgreSQL (Neon).

    Neon may provide `postgres://` or `postgresql://` URLs. A local `sqlite://`
    URL is passed through untouched for offline development.
    """
    if url.startswith("postgres://"):
        return url.replace("postgres://", "postgresql+psycopg2://", 1)
    if url.startswith("postgresql://") and "+psycopg2" not in url:
        return url.replace("postgresql://", "postgresql+psycopg2://", 1)
    return url


_DATABASE_URL = _normalize_database_url(settings.DATABASE_URL)
_IS_SQLITE = _DATABASE_URL.startswith("sqlite")

# SQLite needs check_same_thread disabled for FastAPI's threadpool; Postgres
# benefits from pool_pre_ping to survive Neon's idle-connection drops.
_engine_kwargs: dict = (
    {"connect_args": {"check_same_thread": False}}
    if _IS_SQLITE
    else {"pool_pre_ping": True}
)

engine = create_engine(_DATABASE_URL, **_engine_kwargs)

if _IS_SQLITE:
    from sqlalchemy import event

    @event.listens_for(engine, "connect")
    def _sqlite_fk_pragma(dbapi_connection, _connection_record):  # noqa: ANN001
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.close()

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
    """Create all database tables (PostgreSQL/Neon in prod, SQLite in local dev)."""
    # Import models so they register on Base.metadata before create_all.
    from app.models import project as _project  # noqa: F401
    from app.models import report as _report  # noqa: F401
    from app.models import user as _user  # noqa: F401

    Base.metadata.create_all(bind=engine)
