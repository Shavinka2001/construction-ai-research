from enum import Enum


class UserRole(str, Enum):
    """Role-based access control roles for Construction AI."""

    CLIENT = "CLIENT"  # Land Owner / Individual Client
    SURVEYOR = "SURVEYOR"  # Land Inspector / Surveyor
    ARCHITECT = "ARCHITECT"  # Architect
    QUANTITY_SURVEYOR = "QUANTITY_SURVEYOR"  # QS / Cost Estimator
    AUTHORITY = "AUTHORITY"  # Municipal / UDA Approval Officer
    ADMIN = "ADMIN"  # Platform administrator
