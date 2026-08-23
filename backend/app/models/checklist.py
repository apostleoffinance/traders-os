from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, Text, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.enums import ChecklistCategory, ChecklistItemKind
from app.db.base import Base
from app.models.types import UUID_PK


class ChecklistTemplate(Base):
    __tablename__ = "checklist_templates"

    id: Mapped[uuid.UUID] = mapped_column(UUID_PK, primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID_PK, ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False
    )
    setup_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID_PK, ForeignKey("setups.id", ondelete="SET NULL"), index=True, nullable=True
    )
    name: Mapped[str] = mapped_column(String(120), nullable=False, default="Pre-trade")
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    instrument: Mapped[str | None] = mapped_column(String(32), nullable=True)
    is_default: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    items: Mapped[list["ChecklistItem"]] = relationship(
        back_populates="template",
        cascade="all, delete-orphan",
        order_by="ChecklistItem.sort_order",
    )
    setup: Mapped["Setup | None"] = relationship()  # noqa: F821


class ChecklistItem(Base):
    __tablename__ = "checklist_items"

    id: Mapped[uuid.UUID] = mapped_column(UUID_PK, primary_key=True, default=uuid.uuid4)
    template_id: Mapped[uuid.UUID] = mapped_column(
        UUID_PK, ForeignKey("checklist_templates.id", ondelete="CASCADE"), index=True, nullable=False
    )
    label: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    category: Mapped[str] = mapped_column(
        String(40), nullable=False, default=ChecklistCategory.SETUP_CONFIRMATION.value
    )
    kind: Mapped[str] = mapped_column(
        String(20), nullable=False, default=ChecklistItemKind.MANUAL.value
    )
    auto_key: Mapped[str | None] = mapped_column(String(40), nullable=True)
    sort_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    required: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)

    template: Mapped[ChecklistTemplate] = relationship(back_populates="items")


class TradeChecklistResponse(Base):
    __tablename__ = "trade_checklist_responses"
    __table_args__ = (UniqueConstraint("trade_id", "item_id", name="uq_trade_checklist_item"),)

    id: Mapped[uuid.UUID] = mapped_column(UUID_PK, primary_key=True, default=uuid.uuid4)
    trade_id: Mapped[uuid.UUID] = mapped_column(
        UUID_PK, ForeignKey("trades.id", ondelete="CASCADE"), index=True, nullable=False
    )
    item_id: Mapped[uuid.UUID] = mapped_column(
        UUID_PK, ForeignKey("checklist_items.id", ondelete="CASCADE"), nullable=False
    )
    checked: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)

    trade: Mapped["Trade"] = relationship(back_populates="checklist_responses")  # noqa: F821
    item: Mapped[ChecklistItem] = relationship()
