from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.deps import require_admin
from app.db.database import get_db
from app.models.user import User
from app.schemas.response import ApiResponse, success_response
from app.schemas.user import UserOut

router = APIRouter(prefix="/admin", tags=["Admin"])


@router.get(
    "/users",
    response_model=ApiResponse[list[UserOut]],
    summary="List all registered users",
    description="Admin-only endpoint to fetch the full user directory.",
)
def list_users(
    db: Session = Depends(get_db),
    _: dict = Depends(require_admin),
) -> dict:
    users = db.query(User).order_by(User.created_at.desc()).all()
    return success_response(
        data=[UserOut.model_validate(user).model_dump() for user in users],
        message="Users retrieved successfully",
    )
