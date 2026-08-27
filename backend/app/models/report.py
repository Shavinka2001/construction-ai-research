"""Historical analysis reports attached to a construction project."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import TYPE_CHECKING, Any, Optional

from sqlalchemy import DateTime, ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.types import JSON

from app.db.database import Base

if TYPE_CHECKING:
    from app.models.project import Project


class Report(Base):
    """
    Persists blueprint URLs and structured analysis payloads (clash boxes,
    severity, and generative resolution-suggestion coordinates).
    """

    __tablename__ = "reports"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    project_id: Mapped[int] = mapped_column(
        ForeignKey("projects.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    report_type: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
        index=True,
        doc='e.g. "FEASIBILITY", "CLASH", "BOQ"',
    )
    blueprint_url_arch: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    blueprint_url_struct: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    # JSONB on Postgres; falls back to generic JSON for other dialects
    clash_data_json: Mapped[Optional[dict[str, Any]]] = mapped_column(
        JSON().with_variant(JSONB(), "postgresql"),
        nullable=True,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    project: Mapped["Project"] = relationship("Project", back_populates="reports")
