from datetime import datetime
from typing import Literal, Optional, Union

from pydantic import BaseModel, ConfigDict, EmailStr, Field

from app.models.user_role import UserRole
from app.models.user_status import UserStatus

#: The roles an administrator may hand out through the professional-create
#: endpoint. Kept as a closed union so an unexpected value is a 422 from the
#: schema rather than a check somewhere inside the handler.
ProfessionalRole = Union[
    Literal[UserRole.SURVEYOR],
    Literal[UserRole.ARCHITECT],
    Literal[UserRole.QUANTITY_SURVEYOR],
    Literal[UserRole.AUTHORITY],
]


class UserRegister(BaseModel):
    """
    Self-service registration.

    Deliberately carries no ``role``: the field used to be accepted from the
    request body, so anyone could register themselves as ``ADMIN`` and reach
    the admin endpoints. Registration now always produces a
    ``SELF_SERVICE_ROLE`` account, and every privileged role has to be created
    by an existing administrator.
    """

    email: EmailStr
    full_name: str = Field(..., min_length=2, max_length=255)
    password: str = Field(..., min_length=8, max_length=128)
    contact_number: Optional[str] = Field(None, max_length=50)


class ProfessionalCreate(BaseModel):
    """
    Administrator-only creation of a vetted practitioner account.

    ``role`` is restricted to the professional roles. ``ADMIN`` is absent on
    purpose — granting platform administration is not a routine action and
    should not share an endpoint with onboarding a surveyor.
    """

    email: EmailStr
    full_name: str = Field(..., min_length=2, max_length=255)
    password: str = Field(..., min_length=8, max_length=128)
    role: ProfessionalRole
    contact_number: Optional[str] = Field(None, max_length=50)


class UserStatusUpdate(BaseModel):
    """Suspend or reinstate an account without deleting its history."""

    status: UserStatus


class AdminStatsOut(BaseModel):
    """
    Account totals across the whole user table.

    Served separately from the directory because that endpoint is paged: a
    client counting the rows it was given would report the size of one page as
    the size of the platform.
    """

    total_users: int = Field(..., ge=0)
    active_users: int = Field(..., ge=0)
    suspended_users: int = Field(..., ge=0)
    clients: int = Field(..., ge=0, description="Self-registered land owners")
    professionals: int = Field(
        ..., ge=0, description="Surveyors, architects, QSs and authority officers"
    )
    admins: int = Field(..., ge=0)


class UserLogin(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=1, max_length=128)


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    email: EmailStr
    full_name: str
    contact_number: Optional[str] = None
    role: UserRole
    status: UserStatus
    created_at: datetime
    last_login_at: Optional[datetime] = None


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    role: UserRole
