from datetime import datetime, timezone

from fastapi import APIRouter, Depends, status
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session

from app.core.security import create_access_token, hash_password, verify_password
from app.db.database import get_db
from app.models.user import User
from app.models.user_role import SELF_SERVICE_ROLE
from app.models.user_status import UserStatus
from app.schemas.response import ApiResponse, ErrorDetail, error_response, success_response
from app.schemas.user import Token, UserLogin, UserOut, UserRegister

router = APIRouter(prefix="/auth", tags=["Authentication"])


@router.post(
    "/register",
    response_model=ApiResponse[UserOut],
    status_code=status.HTTP_201_CREATED,
    summary="Register a new client account",
    description=(
        "Self-service registration. Always creates a "
        f"`{SELF_SERVICE_ROLE.value}` account — the role is not accepted from "
        "the request. Professional and administrator accounts are created by "
        "an existing administrator via `POST /admin/users`."
    ),
)
def register(user_in: UserRegister, db: Session = Depends(get_db)):
    existing = db.query(User).filter(User.email == user_in.email).first()
    if existing:
        return JSONResponse(
            status_code=status.HTTP_409_CONFLICT,
            content=error_response(
                message="Registration failed",
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
        email=user_in.email,
        full_name=user_in.full_name,
        contact_number=user_in.contact_number,
        hashed_password=hash_password(user_in.password),
        # Not taken from the request: a self-service registration can only ever
        # produce a client, whatever the caller sends.
        role=SELF_SERVICE_ROLE,
        status=UserStatus.ACTIVE,
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    return success_response(
        data=UserOut.model_validate(user).model_dump(),
        message="User registered successfully",
    )


@router.post(
    "/login",
    response_model=ApiResponse[Token],
    summary="Authenticate and obtain JWT access token",
)
def login(credentials: UserLogin, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == credentials.email).first()
    if not user or not verify_password(credentials.password, user.hashed_password):
        return JSONResponse(
            status_code=status.HTTP_401_UNAUTHORIZED,
            content=error_response(
                message="Authentication failed",
                errors=[
                    ErrorDetail(
                        code="INVALID_CREDENTIALS",
                        message="Invalid email or password",
                    )
                ],
            ),
        )

    if not user.status.can_sign_in:
        # Distinct from INVALID_CREDENTIALS: the password was right, so telling
        # the person their account is suspended is what lets them contact an
        # administrator instead of resetting a password that already works.
        return JSONResponse(
            status_code=status.HTTP_403_FORBIDDEN,
            content=error_response(
                message="Account unavailable",
                errors=[
                    ErrorDetail(
                        code="ACCOUNT_SUSPENDED",
                        message=(
                            "This account has been suspended. Contact a "
                            "platform administrator to restore access."
                        ),
                    )
                ],
            ),
        )

    user.last_login_at = datetime.now(timezone.utc)
    db.commit()

    access_token = create_access_token(
        data={
            "sub": str(user.id),
            "email": user.email,
            "role": user.role.value,
        }
    )

    token = Token(
        access_token=access_token,
        token_type="bearer",
        role=user.role,
    )

    return success_response(
        data=token.model_dump(),
        message="Login successful",
    )
