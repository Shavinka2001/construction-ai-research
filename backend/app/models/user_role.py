from enum import Enum


class UserRole(str, Enum):
    """Role-based access control roles for Construction AI."""

    CLIENT = "CLIENT"  # Land Owner / Individual Client
    SURVEYOR = "SURVEYOR"  # Land Inspector / Surveyor
    ARCHITECT = "ARCHITECT"  # Architect
    QUANTITY_SURVEYOR = "QUANTITY_SURVEYOR"  # QS / Cost Estimator
    AUTHORITY = "AUTHORITY"  # Municipal / UDA Approval Officer
    ADMIN = "ADMIN"  # Platform administrator

    @property
    def is_professional(self) -> bool:
        """
        A vetted practitioner an administrator onboards, as opposed to a land
        owner who signs themselves up or a platform administrator.

        Self-service registration is restricted to ``CLIENT``; everything this
        returns true for has to come through the admin-only creation endpoint,
        because the role carries authority the applicant should not be able to
        grant themselves.
        """
        return self in PROFESSIONAL_ROLES


PROFESSIONAL_ROLES: frozenset[UserRole] = frozenset(
    {
        UserRole.SURVEYOR,
        UserRole.ARCHITECT,
        UserRole.QUANTITY_SURVEYOR,
        UserRole.AUTHORITY,
    }
)

#: The only role a self-service registration may produce.
SELF_SERVICE_ROLE: UserRole = UserRole.CLIENT
