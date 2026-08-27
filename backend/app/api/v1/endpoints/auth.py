from fastapi import APIRouter, Depends, status
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session

from app.core.security import create_access_token, hash_password, verify_password
from app.db.database import get_db
from app.models.user import User
from app.schemas.response import ApiResponse, ErrorDetail, error_response, success_response
from app.schemas.user import Token, UserCreate, UserLogin, UserOut

router = APIRouter(prefix="/auth", tags=["Authentication"])


@router.post(
    "/register",
    response_model=ApiResponse[UserOut],
    status_code=status.HTTP_201_CREATED,
    summary="Register a new user",
)
def register(user_in: UserCreate, db: Session = Depends(get_db)):
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
        role=user_in.role,
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
