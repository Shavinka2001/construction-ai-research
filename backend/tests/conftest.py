"""
Test fixtures: a FastAPI client backed by a throwaway SQLite database.

The app's own `get_db` dependency is overridden so tests never touch the
developer's `structura_dev.db`, and each test gets a fresh schema so one test's
users cannot change another's outcome.
"""

from __future__ import annotations

from collections.abc import Iterator

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app.db.database import Base, get_db
from app.models.user import User
from app.models.user_role import UserRole
from app.models.user_status import UserStatus
from main import create_app

# Imported for the side effect of registering the models on Base.metadata.
from app.models import project as _project  # noqa: F401
from app.models import report as _report  # noqa: F401


@pytest.fixture
def db_session() -> Iterator[Session]:
    # One in-memory database shared by every connection in the test, which is
    # what StaticPool gives us; without it each connection sees its own empty
    # database and nothing the API writes is visible to assertions.
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(bind=engine)
    TestingSession = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    session = TestingSession()
    try:
        yield session
    finally:
        session.close()
        Base.metadata.drop_all(bind=engine)
        engine.dispose()


@pytest.fixture
def client(db_session: Session) -> Iterator[TestClient]:
    app = create_app()

    def _override_get_db() -> Iterator[Session]:
        yield db_session

    app.dependency_overrides[get_db] = _override_get_db
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()


@pytest.fixture
def make_user(db_session: Session):
    """Create a user directly, bypassing the API's role restrictions."""
    from app.core.security import hash_password

    def _make(
        email: str,
        role: UserRole = UserRole.CLIENT,
        password: str = "testpass123",
        status: UserStatus = UserStatus.ACTIVE,
    ) -> User:
        user = User(
            email=email,
            full_name=f"Test {role.value.title()}",
            hashed_password=hash_password(password),
            role=role,
            status=status,
        )
        db_session.add(user)
        db_session.commit()
        db_session.refresh(user)
        return user

    return _make


@pytest.fixture
def token_for(client: TestClient):
    """Sign in and return the bearer token for an existing account."""

    def _token(email: str, password: str = "testpass123") -> str:
        response = client.post(
            "/api/v1/auth/login", json={"email": email, "password": password}
        )
        assert response.status_code == 200, response.text
        return response.json()["data"]["access_token"]

    return _token


@pytest.fixture
def auth_headers(token_for):
    def _headers(email: str, password: str = "testpass123") -> dict[str, str]:
        return {"Authorization": f"Bearer {token_for(email, password)}"}

    return _headers
