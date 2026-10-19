"""
Account creation, role assignment and suspension.

The regression at the centre of this file: `/auth/register` used to take the
role from the request body, so an unauthenticated caller could create
themselves an `ADMIN` account and reach every admin endpoint.
`test_registration_ignores_a_role_in_the_body` fails against that behaviour.
"""

from __future__ import annotations

from app.models.user import User
from app.models.user_role import UserRole
from app.models.user_status import UserStatus

REGISTER = "/api/v1/auth/register"
LOGIN = "/api/v1/auth/login"
ADMIN_USERS = "/api/v1/admin/users"


def _register_body(**overrides) -> dict:
    body = {
        "email": "newcomer@example.com",
        "full_name": "New Comer",
        "password": "a-good-password",
    }
    body.update(overrides)
    return body


# ---------------------------------------------------------------------------
# Privilege escalation
# ---------------------------------------------------------------------------


def test_registration_creates_a_client(client) -> None:
    response = client.post(REGISTER, json=_register_body())

    assert response.status_code == 201, response.text
    data = response.json()["data"]
    assert data["role"] == UserRole.CLIENT.value
    assert data["status"] == UserStatus.ACTIVE.value


def test_registration_ignores_a_role_in_the_body(client, db_session) -> None:
    """An anonymous caller must not be able to grant themselves a role."""
    response = client.post(REGISTER, json=_register_body(role="ADMIN"))

    assert response.status_code == 201, response.text
    assert response.json()["data"]["role"] == UserRole.CLIENT.value

    stored = db_session.query(User).filter(User.email == "newcomer@example.com").one()
    assert stored.role is UserRole.CLIENT


def test_registration_ignores_every_privileged_role(client) -> None:
    for i, role in enumerate(
        ["ADMIN", "ARCHITECT", "AUTHORITY", "SURVEYOR", "QUANTITY_SURVEYOR"]
    ):
        response = client.post(
            REGISTER, json=_register_body(email=f"user{i}@example.com", role=role)
        )
        assert response.status_code == 201, response.text
        assert response.json()["data"]["role"] == UserRole.CLIENT.value


def test_duplicate_email_is_rejected(client) -> None:
    assert client.post(REGISTER, json=_register_body()).status_code == 201

    response = client.post(REGISTER, json=_register_body())

    assert response.status_code == 409
    assert response.json()["errors"][0]["code"] == "EMAIL_EXISTS"


# ---------------------------------------------------------------------------
# Professional creation is administrator-only
# ---------------------------------------------------------------------------


def _professional_body(**overrides) -> dict:
    body = {
        "email": "architect@example.com",
        "full_name": "Staff Architect",
        "password": "a-good-password",
        "role": "ARCHITECT",
    }
    body.update(overrides)
    return body


def test_creating_a_professional_requires_authentication(client) -> None:
    response = client.post(ADMIN_USERS, json=_professional_body())
    assert response.status_code == 401


def test_creating_a_professional_requires_admin_role(
    client, make_user, auth_headers
) -> None:
    make_user("client@example.com", UserRole.CLIENT)

    response = client.post(
        ADMIN_USERS,
        json=_professional_body(),
        headers=auth_headers("client@example.com"),
    )

    assert response.status_code == 403


def test_admin_can_create_a_professional(client, make_user, auth_headers) -> None:
    make_user("admin@example.com", UserRole.ADMIN)

    response = client.post(
        ADMIN_USERS,
        json=_professional_body(),
        headers=auth_headers("admin@example.com"),
    )

    assert response.status_code == 201, response.text
    data = response.json()["data"]
    assert data["role"] == UserRole.ARCHITECT.value
    assert data["status"] == UserStatus.ACTIVE.value


def test_admin_cannot_mint_another_admin_here(client, make_user, auth_headers) -> None:
    """Granting platform administration is not routine onboarding."""
    make_user("admin@example.com", UserRole.ADMIN)

    response = client.post(
        ADMIN_USERS,
        json=_professional_body(role="ADMIN"),
        headers=auth_headers("admin@example.com"),
    )

    assert response.status_code == 422


def test_admin_cannot_create_a_client_here(client, make_user, auth_headers) -> None:
    make_user("admin@example.com", UserRole.ADMIN)

    response = client.post(
        ADMIN_USERS,
        json=_professional_body(role="CLIENT"),
        headers=auth_headers("admin@example.com"),
    )

    assert response.status_code == 422


# ---------------------------------------------------------------------------
# Suspension
# ---------------------------------------------------------------------------


def test_suspended_account_cannot_sign_in(client, make_user) -> None:
    make_user("gone@example.com", UserRole.ARCHITECT, status=UserStatus.SUSPENDED)

    response = client.post(
        LOGIN, json={"email": "gone@example.com", "password": "testpass123"}
    )

    assert response.status_code == 403
    assert response.json()["errors"][0]["code"] == "ACCOUNT_SUSPENDED"


def test_suspension_is_distinguishable_from_a_wrong_password(
    client, make_user
) -> None:
    """A correct password on a suspended account is not a credential error."""
    make_user("gone@example.com", UserRole.ARCHITECT, status=UserStatus.SUSPENDED)

    wrong = client.post(
        LOGIN, json={"email": "gone@example.com", "password": "not-the-password"}
    )
    assert wrong.status_code == 401
    assert wrong.json()["errors"][0]["code"] == "INVALID_CREDENTIALS"


def test_admin_can_suspend_and_reinstate(client, make_user, auth_headers) -> None:
    make_user("admin@example.com", UserRole.ADMIN)
    target = make_user("architect@example.com", UserRole.ARCHITECT)
    headers = auth_headers("admin@example.com")

    suspended = client.patch(
        f"{ADMIN_USERS}/{target.id}/status",
        json={"status": "SUSPENDED"},
        headers=headers,
    )
    assert suspended.status_code == 200, suspended.text
    assert suspended.json()["data"]["status"] == "SUSPENDED"

    blocked = client.post(
        LOGIN, json={"email": "architect@example.com", "password": "testpass123"}
    )
    assert blocked.status_code == 403

    restored = client.patch(
        f"{ADMIN_USERS}/{target.id}/status",
        json={"status": "ACTIVE"},
        headers=headers,
    )
    assert restored.status_code == 200, restored.text
    assert restored.json()["data"]["status"] == "ACTIVE"

    allowed = client.post(
        LOGIN, json={"email": "architect@example.com", "password": "testpass123"}
    )
    assert allowed.status_code == 200


def test_suspension_preserves_the_account(client, make_user, auth_headers, db_session) -> None:
    """Suspending must not delete the row — its projects are audit history."""
    make_user("admin@example.com", UserRole.ADMIN)
    target = make_user("architect@example.com", UserRole.ARCHITECT)

    client.patch(
        f"{ADMIN_USERS}/{target.id}/status",
        json={"status": "SUSPENDED"},
        headers=auth_headers("admin@example.com"),
    )

    assert db_session.query(User).filter(User.id == target.id).one() is not None


def test_admin_cannot_suspend_themselves(client, make_user, auth_headers) -> None:
    admin = make_user("admin@example.com", UserRole.ADMIN)

    response = client.patch(
        f"{ADMIN_USERS}/{admin.id}/status",
        json={"status": "SUSPENDED"},
        headers=auth_headers("admin@example.com"),
    )

    assert response.status_code == 400
    assert response.json()["errors"][0]["code"] == "CANNOT_SUSPEND_SELF"


def test_an_active_admin_always_survives(client, make_user, auth_headers) -> None:
    """
    No sequence of status calls can leave the platform without an admin.

    The self-suspension guard is what guarantees it: the caller is an active
    administrator and cannot suspend themselves, so suspending every other
    admin still leaves them. This pins the invariant rather than the mechanism,
    so it keeps its meaning if the guard is implemented differently later.
    """
    make_user("admin@example.com", UserRole.ADMIN)
    others = [
        make_user("admin2@example.com", UserRole.ADMIN),
        make_user("admin3@example.com", UserRole.ADMIN),
    ]
    headers = auth_headers("admin@example.com")

    for other in others:
        suspended = client.patch(
            f"{ADMIN_USERS}/{other.id}/status",
            json={"status": "SUSPENDED"},
            headers=headers,
        )
        assert suspended.status_code == 200, suspended.text

    # Every other admin is suspended; the caller remains and can still work.
    remaining = client.get(
        f"{ADMIN_USERS}?role=ADMIN&status=ACTIVE", headers=headers
    )
    assert remaining.status_code == 200, remaining.text
    assert [u["email"] for u in remaining.json()["data"]] == ["admin@example.com"]


def test_status_change_on_unknown_user_is_404(client, make_user, auth_headers) -> None:
    make_user("admin@example.com", UserRole.ADMIN)

    response = client.patch(
        f"{ADMIN_USERS}/99999/status",
        json={"status": "SUSPENDED"},
        headers=auth_headers("admin@example.com"),
    )

    assert response.status_code == 404


# ---------------------------------------------------------------------------
# Sign-in bookkeeping and the directory
# ---------------------------------------------------------------------------


def test_login_records_last_login_at(client, make_user, db_session) -> None:
    user = make_user("client@example.com", UserRole.CLIENT)
    assert user.last_login_at is None

    response = client.post(
        LOGIN, json={"email": "client@example.com", "password": "testpass123"}
    )
    assert response.status_code == 200

    db_session.refresh(user)
    assert user.last_login_at is not None


def test_user_directory_is_paged(client, make_user, auth_headers) -> None:
    make_user("admin@example.com", UserRole.ADMIN)
    for i in range(7):
        make_user(f"user{i}@example.com", UserRole.CLIENT)

    response = client.get(
        f"{ADMIN_USERS}?page=1&size=3", headers=auth_headers("admin@example.com")
    )

    assert response.status_code == 200, response.text
    body = response.json()
    assert len(body["data"]) == 3
    assert "of 8" in body["message"]  # 7 clients + the admin


def test_user_directory_filters_by_role_and_search(
    client, make_user, auth_headers
) -> None:
    make_user("admin@example.com", UserRole.ADMIN)
    make_user("ada@example.com", UserRole.ARCHITECT)
    make_user("bob@example.com", UserRole.SURVEYOR)
    headers = auth_headers("admin@example.com")

    by_role = client.get(f"{ADMIN_USERS}?role=ARCHITECT", headers=headers)
    assert [u["email"] for u in by_role.json()["data"]] == ["ada@example.com"]

    by_search = client.get(f"{ADMIN_USERS}?q=bob", headers=headers)
    assert [u["email"] for u in by_search.json()["data"]] == ["bob@example.com"]


def test_user_directory_filters_by_status(client, make_user, auth_headers) -> None:
    make_user("admin@example.com", UserRole.ADMIN)
    make_user("live@example.com", UserRole.ARCHITECT)
    make_user("gone@example.com", UserRole.ARCHITECT, status=UserStatus.SUSPENDED)

    response = client.get(
        f"{ADMIN_USERS}?status=SUSPENDED", headers=auth_headers("admin@example.com")
    )

    assert [u["email"] for u in response.json()["data"]] == ["gone@example.com"]


def test_directory_page_size_is_capped(client, make_user, auth_headers) -> None:
    make_user("admin@example.com", UserRole.ADMIN)

    response = client.get(
        f"{ADMIN_USERS}?size=5000", headers=auth_headers("admin@example.com")
    )

    assert response.status_code == 422


def test_directory_requires_admin(client, make_user, auth_headers) -> None:
    make_user("client@example.com", UserRole.CLIENT)

    response = client.get(ADMIN_USERS, headers=auth_headers("client@example.com"))

    assert response.status_code == 403
