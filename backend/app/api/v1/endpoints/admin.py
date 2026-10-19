"""
Administrator-only user management.

Creating a privileged account lives here rather than on `/auth/register`
because the role is the privilege: when registration accepted a role from the
request body, anyone could issue themselves an `ADMIN` account and reach these
endpoints. Registration is now client-only and every professional account is
created by an authenticated administrator.
"""

from math import ceil
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import JSONResponse
from sqlalchemy import func, or_
from sqlalchemy.orm import Session

from app.core.deps import get_current_user_id, require_admin
from app.core.security import hash_password
from app.db.database import get_db
from app.models.user import User
from app.models.user_role import UserRole
from app.models.user_status import UserStatus
from app.schemas.response import (
    ApiResponse,
    ErrorDetail,
    PaginatedData,
    error_response,
    success_response,
)
from app.schemas.user import (
    AdminStatsOut,
    ProfessionalCreate,
    UserOut,
    UserStatusUpdate,
)

router = APIRouter(prefix="/admin", tags=["Admin"])

MAX_PAGE_SIZE = 100


@router.get(
    "/stats",
    response_model=ApiResponse[AdminStatsOut],
    summary="Platform account totals",
    description=(
        "Counts over the whole user table. A separate endpoint because the "
        "directory is paged: totals derived from one page of results would be "
        "wrong the moment there is more than one page."
    ),
)
def user_stats(
    db: Session = Depends(get_db),
    _: dict = Depends(require_admin),
) -> dict:
    # One grouped query rather than six counts — the aggregation is cheap and
    # this keeps the numbers consistent with each other.
    rows = (
        db.query(User.role, User.status, func.count(User.id))
        .group_by(User.role, User.status)
        .all()
    )

    stats = AdminStatsOut(
        total_users=0,
        active_users=0,
        suspended_users=0,
        clients=0,
        professionals=0,
        admins=0,
    )
    for role, account_status, count in rows:
        stats.total_users += count
        if account_status is UserStatus.ACTIVE:
            stats.active_users += count
        else:
            stats.suspended_users += count

        if role is UserRole.CLIENT:
            stats.clients += count
        elif role is UserRole.ADMIN:
            stats.admins += count
        else:
            stats.professionals += count

    return success_response(
        data=stats.model_dump(),
        message="Account totals retrieved successfully",
    )


@router.get(
    "/users",
    response_model=ApiResponse[PaginatedData[UserOut]],
    summary="List registered users",
    description=(
        "Admin-only user directory, newest first. Supports `q` (name or email "
        "substring), `role`, `status`, and `page`/`size` paging. Paging is not "
        "optional politeness — an unbounded directory becomes an unusable "
        "response as soon as the platform has real users."
    ),
)
def list_users(
    q: Optional[str] = Query(
        None,
        max_length=255,
        description="Case-insensitive substring match on full name or email.",
    ),
    role: Optional[UserRole] = Query(None, description="Filter by role."),
    status_filter: Optional[UserStatus] = Query(
        None, alias="status", description="Filter by account status."
    ),
    page: int = Query(1, ge=1, description="1-based page number."),
    size: int = Query(
        25, ge=1, le=MAX_PAGE_SIZE, description=f"Page size (max {MAX_PAGE_SIZE})."
    ),
    db: Session = Depends(get_db),
    _: dict = Depends(require_admin),
) -> dict:
    query = db.query(User)

    if q:
        pattern = f"%{q.strip()}%"
        query = query.filter(
            or_(User.full_name.ilike(pattern), User.email.ilike(pattern))
        )
    if role is not None:
        query = query.filter(User.role == role)
    if status_filter is not None:
        query = query.filter(User.status == status_filter)

    total = query.count()
    users = (
        query.order_by(User.created_at.desc(), User.id.desc())
        .offset((page - 1) * size)
        .limit(size)
        .all()
    )

    # The client needs the total as a number to render paging controls, so it
    # goes in the payload. It used to be interpolated into `message`, which
    # left the frontend parsing a sentence to find out how many pages exist.
    payload = PaginatedData[UserOut](
        items=[UserOut.model_validate(user) for user in users],
        total=total,
        page=page,
        page_size=size,
        total_pages=max(1, ceil(total / size)) if total else 0,
    )

    return success_response(
        data=payload.model_dump(),
        message=f"Retrieved {len(users)} of {total} user(s)",
    )


@router.post(
    "/users",
    response_model=ApiResponse[UserOut],
    status_code=status.HTTP_201_CREATED,
    summary="Create a professional account",
    description=(
        "Creates a vetted practitioner account (surveyor, architect, quantity "
        "surveyor or authority officer). Requires an administrator token. "
        "`ADMIN` is not an accepted role here — granting platform "
        "administration is not a routine onboarding action."
    ),
)
def create_professional(
    payload: ProfessionalCreate,
    db: Session = Depends(get_db),
    _: dict = Depends(require_admin),
):
    existing = db.query(User).filter(User.email == payload.email).first()
    if existing:
        return JSONResponse(
            status_code=status.HTTP_409_CONFLICT,
            content=error_response(
                message="Could not create account",
                errors=[
                    ErrorDetail(
                        code="EMAIL_EXISTS",
                        message="A user with this email already exists",
                        field="email",
                    )
                ],
            ),
        )

    user = User(
        email=payload.email,
        full_name=payload.full_name,
        contact_number=payload.contact_number,
        hashed_password=hash_password(payload.password),
        role=payload.role,
        status=UserStatus.ACTIVE,
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    return success_response(
        data=UserOut.model_validate(user).model_dump(),
        message=f"{user.role.value} account created successfully",
    )


@router.patch(
    "/users/{user_id}/status",
    response_model=ApiResponse[UserOut],
    summary="Suspend or reinstate an account",
    description=(
        "Revokes or restores sign-in without deleting the account. Deletion is "
        "not offered: a user owns projects, reports and uploaded blueprints "
        "that remain part of the audit trail, and removing the row would take "
        "them with it."
    ),
)
def update_user_status(
    user_id: int,
    payload: UserStatusUpdate,
    db: Session = Depends(get_db),
    admin_payload: dict = Depends(require_admin),
    admin_id: int = Depends(get_current_user_id),
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )

    if user.id == admin_id:
        # This is also what keeps the platform administrable. The caller is an
        # active administrator, so refusing to let them suspend themselves
        # means at least one active administrator always survives any sequence
        # of calls to this endpoint — no separate "last admin" check is
        # reachable. That invariant has to be revisited the moment a role-change
        # endpoint exists, because demoting the last admin would bypass this.
        return JSONResponse(
            status_code=status.HTTP_400_BAD_REQUEST,
            content=error_response(
                message="Could not change account status",
                errors=[
                    ErrorDetail(
                        code="CANNOT_SUSPEND_SELF",
                        message="An administrator cannot suspend their own account",
                    )
                ],
            ),
        )

    user.status = payload.status
    db.commit()
    db.refresh(user)

    return success_response(
        data=UserOut.model_validate(user).model_dump(),
        message=f"Account {user.status.value.lower()}",
    )

