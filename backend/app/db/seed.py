"""Database seeding utilities."""

from app.core.security import hash_password
from app.db.database import SessionLocal
from app.models.user import User
from app.models.user_role import UserRole

DEFAULT_ADMIN = {
    "full_name": "System Administrator",
    "email": "admin@constructionai.com",
    "password": "admin123",
    "contact_number": "+94112345678",
    "role": UserRole.ADMIN,
}


def seed_default_admin() -> None:
    """Create the default admin account if no ADMIN user exists."""
    db = SessionLocal()
    try:
        admin_exists = (
            db.query(User).filter(User.role == UserRole.ADMIN).first() is not None
        )
        if admin_exists:
            return

        admin = User(
            full_name=DEFAULT_ADMIN["full_name"],
            email=DEFAULT_ADMIN["email"],
            contact_number=DEFAULT_ADMIN["contact_number"],
            hashed_password=hash_password(DEFAULT_ADMIN["password"]),
            role=DEFAULT_ADMIN["role"],
        )
        db.add(admin)
        db.commit()
    finally:
        db.close()
