from typing import Any, Generic, List, Optional, TypeVar

from pydantic import BaseModel, Field

T = TypeVar("T")


class ErrorDetail(BaseModel):
    """Structured error information for failed responses."""

    code: str = Field(..., description="Machine-readable error code")
    message: str = Field(..., description="Human-readable error message")
    field: Optional[str] = Field(None, description="Related field name, if applicable")


class PaginatedData(BaseModel, Generic[T]):
    """Wrapper for paginated list responses."""

    items: List[T]
    total: int
    page: int
    page_size: int
    total_pages: int


class ApiResponse(BaseModel, Generic[T]):
    """
    Unified API response envelope.

    All endpoints should return this shape for consistent client handling.
    """

    success: bool = Field(..., description="Whether the request succeeded")
    message: str = Field(..., description="Summary message for the client")
    data: Optional[T] = Field(None, description="Response payload on success")
    errors: Optional[List[ErrorDetail]] = Field(
        None, description="Error details on failure"
    )


def success_response(
    data: Any = None,
    message: str = "Request completed successfully",
) -> dict:
    """Build a standardized success response dict."""
    return ApiResponse(success=True, message=message, data=data).model_dump()


def error_response(
    message: str,
    errors: Optional[List[ErrorDetail]] = None,
    data: Any = None,
) -> dict:
    """Build a standardized error response dict."""
    return ApiResponse(
        success=False,
        message=message,
        data=data,
        errors=errors or [],
    ).model_dump()
