"""Project portfolio model — one user owns many concurrent construction projects."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import TYPE_CHECKING, List, Optional

from sqlalchemy import Boolean, DateTime, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.database import Base

if TYPE_CHECKING:
    from app.models.report import Report
    from app.models.user import User


class Project(Base):
    __tablename__ = "projects"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    location_gps: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # --- approval attributes ---------------------------------------------
    # These settle condition keys in the requirements dataset, so capturing
    # them once here saves asking at every assessment. All are nullable: a
    # value nobody has filled in means *unknown*, and the rule engine reports
    # the requirements that depend on it as manual review rather than assuming
    # they do not apply. See app/models/project_attributes.py.
    application_type: Mapped[Optional[str]] = mapped_column(
        String(32), nullable=True, doc="building_permit | coc"
    )
    building_use: Mapped[Optional[str]] = mapped_column(
        String(32), nullable=True, doc="residential | non_residential | apartment"
    )
    tenure_type: Mapped[Optional[str]] = mapped_column(
        String(32), nullable=True, doc="freehold | condominium"
    )
    applicant_type: Mapped[Optional[str]] = mapped_column(
        String(32), nullable=True, doc="individual | organization"
    )
    development_activity: Mapped[Optional[str]] = mapped_column(
        String(32), nullable=True, doc="building_construction | land_subdivision"
    )
    has_ppc: Mapped[Optional[bool]] = mapped_column(
        Boolean, nullable=True, doc="Preliminary Planning Clearance already obtained"
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    # Relationships
    owner: Mapped["User"] = relationship("User", back_populates="projects")
    reports: Mapped[List["Report"]] = relationship(
        "Report",
        back_populates="project",
        cascade="all, delete-orphan",
        order_by="Report.created_at.desc()",
    )
