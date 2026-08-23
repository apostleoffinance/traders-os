"""initial schema

Revision ID: 0001_initial
Revises:
Create Date: 2026-08-21
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0001_initial"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "users",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("email", sa.String(length=320), nullable=False),
        sa.Column("hashed_password", sa.String(length=255), nullable=False),
        sa.Column("display_name", sa.String(length=120), nullable=False),
        sa.Column("timezone", sa.String(length=64), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_users_email"), "users", ["email"], unique=True)

    op.create_table(
        "accounts",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("firm", sa.String(length=120), nullable=False),
        sa.Column("program", sa.String(length=120), nullable=False),
        sa.Column("account_name", sa.String(length=160), nullable=False),
        sa.Column("currency", sa.String(length=8), nullable=False),
        sa.Column("starting_balance", sa.Numeric(18, 2), nullable=False),
        sa.Column("current_balance", sa.Numeric(18, 2), nullable=False),
        sa.Column("current_equity", sa.Numeric(18, 2), nullable=False),
        sa.Column("status", sa.String(length=32), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_accounts_user_id"), "accounts", ["user_id"], unique=False)

    op.create_table(
        "account_risk_profiles",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("account_id", sa.Uuid(), nullable=False),
        sa.Column("risk_per_trade", sa.Numeric(18, 2), nullable=False),
        sa.Column("personal_daily_loss_limit", sa.Numeric(18, 2), nullable=False),
        sa.Column("personal_max_drawdown", sa.Numeric(18, 2), nullable=False),
        sa.Column("firm_daily_drawdown_limit", sa.Numeric(18, 2), nullable=False),
        sa.Column("firm_max_drawdown_limit", sa.Numeric(18, 2), nullable=False),
        sa.Column("max_trades_per_day", sa.Integer(), nullable=False),
        sa.Column("preferred_min_rr", sa.Numeric(12, 4), nullable=False),
        sa.Column("preferred_rr", sa.Numeric(12, 4), nullable=False),
        sa.Column("minimum_trading_days", sa.Integer(), nullable=False),
        sa.Column("profit_split", sa.Numeric(12, 4), nullable=True),
        sa.Column("payout_cap", sa.Numeric(18, 2), nullable=True),
        sa.Column("hard_risk_per_trade", sa.Numeric(18, 2), nullable=True),
        sa.Column("risk_per_trade_enforcement", sa.String(length=16), nullable=False),
        sa.Column("hard_risk_enforcement", sa.String(length=16), nullable=False),
        sa.Column("drawdown_basis", sa.String(length=32), nullable=False),
        sa.Column("preferred_windows", sa.JSON(), nullable=False),
        sa.Column("extra_restrictions", sa.JSON(), nullable=False),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["account_id"], ["accounts.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("account_id"),
    )

    op.create_table(
        "setups",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("name", sa.String(length=120), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("active", sa.Boolean(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_setups_user_id"), "setups", ["user_id"], unique=False)

    op.create_table(
        "checklist_templates",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("name", sa.String(length=120), nullable=False),
        sa.Column("is_default", sa.Boolean(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_checklist_templates_user_id"), "checklist_templates", ["user_id"], unique=False)

    op.create_table(
        "checklist_items",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("template_id", sa.Uuid(), nullable=False),
        sa.Column("label", sa.String(length=255), nullable=False),
        sa.Column("sort_order", sa.Integer(), nullable=False),
        sa.Column("required", sa.Boolean(), nullable=False),
        sa.ForeignKeyConstraint(["template_id"], ["checklist_templates.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_checklist_items_template_id"), "checklist_items", ["template_id"], unique=False)

    op.create_table(
        "trades",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("account_id", sa.Uuid(), nullable=False),
        sa.Column("symbol", sa.String(length=32), nullable=False),
        sa.Column("direction", sa.String(length=8), nullable=False),
        sa.Column("trade_timestamp", sa.DateTime(timezone=True), nullable=False),
        sa.Column("exit_timestamp", sa.DateTime(timezone=True), nullable=True),
        sa.Column("timezone", sa.String(length=64), nullable=False),
        sa.Column("session", sa.String(length=32), nullable=False),
        sa.Column("in_preferred_session", sa.Boolean(), nullable=False),
        sa.Column("setup_id", sa.Uuid(), nullable=True),
        sa.Column("timeframe", sa.String(length=8), nullable=False),
        sa.Column("entry_price", sa.Numeric(18, 6), nullable=False),
        sa.Column("exit_price", sa.Numeric(18, 6), nullable=True),
        sa.Column("stop_loss", sa.Numeric(18, 6), nullable=False),
        sa.Column("take_profit", sa.Numeric(18, 6), nullable=True),
        sa.Column("lot_size", sa.Numeric(18, 4), nullable=False),
        sa.Column("stop_pips", sa.Numeric(12, 4), nullable=True),
        sa.Column("tp_pips", sa.Numeric(12, 4), nullable=True),
        sa.Column("risk_amount", sa.Numeric(18, 2), nullable=False),
        sa.Column("risk_percent", sa.Numeric(12, 6), nullable=False),
        sa.Column("planned_reward", sa.Numeric(18, 2), nullable=True),
        sa.Column("planned_rr", sa.Numeric(12, 4), nullable=True),
        sa.Column("realized_pnl", sa.Numeric(18, 2), nullable=True),
        sa.Column("realized_r", sa.Numeric(12, 4), nullable=True),
        sa.Column("realized_rr", sa.Numeric(12, 4), nullable=True),
        sa.Column("result", sa.String(length=16), nullable=False),
        sa.Column("status", sa.String(length=16), nullable=False),
        sa.Column("holding_time_seconds", sa.Integer(), nullable=True),
        sa.Column("setup_valid", sa.Boolean(), nullable=False),
        sa.Column("rules_followed", sa.Boolean(), nullable=False),
        sa.Column("emotional_trade", sa.Boolean(), nullable=False),
        sa.Column("mistake", sa.Boolean(), nullable=False),
        sa.Column("mistake_notes", sa.Text(), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("discipline_score", sa.Integer(), nullable=True),
        sa.Column("acknowledged_warnings", sa.Boolean(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["account_id"], ["accounts.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["setup_id"], ["setups.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_trades_user_id"), "trades", ["user_id"], unique=False)
    op.create_index(op.f("ix_trades_account_id"), "trades", ["account_id"], unique=False)
    op.create_index(op.f("ix_trades_trade_timestamp"), "trades", ["trade_timestamp"], unique=False)

    op.create_table(
        "psychology",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("trade_id", sa.Uuid(), nullable=False),
        sa.Column("emotion_before", sa.String(length=32), nullable=False),
        sa.Column("emotion_during", sa.String(length=32), nullable=False),
        sa.Column("emotion_after", sa.String(length=32), nullable=False),
        sa.Column("emotional_intensity", sa.Integer(), nullable=False),
        sa.Column("confidence", sa.Integer(), nullable=False),
        sa.Column("fear", sa.Integer(), nullable=False),
        sa.Column("fomo", sa.Integer(), nullable=False),
        sa.Column("frustration", sa.Integer(), nullable=False),
        sa.Column("revenge", sa.Integer(), nullable=False),
        sa.Column("boredom", sa.Integer(), nullable=False),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["trade_id"], ["trades.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("trade_id"),
    )
    op.create_index(op.f("ix_psychology_user_id"), "psychology", ["user_id"], unique=False)

    op.create_table(
        "trade_screenshots",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("trade_id", sa.Uuid(), nullable=False),
        sa.Column("type", sa.String(length=16), nullable=False),
        sa.Column("storage_key", sa.String(length=512), nullable=False),
        sa.Column("original_filename", sa.String(length=255), nullable=True),
        sa.Column("content_type", sa.String(length=128), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["trade_id"], ["trades.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_trade_screenshots_user_id"), "trade_screenshots", ["user_id"], unique=False)
    op.create_index(op.f("ix_trade_screenshots_trade_id"), "trade_screenshots", ["trade_id"], unique=False)

    op.create_table(
        "trade_checklist_responses",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("trade_id", sa.Uuid(), nullable=False),
        sa.Column("item_id", sa.Uuid(), nullable=False),
        sa.Column("checked", sa.Boolean(), nullable=False),
        sa.ForeignKeyConstraint(["item_id"], ["checklist_items.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["trade_id"], ["trades.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("trade_id", "item_id", name="uq_trade_checklist_item"),
    )
    op.create_index(
        op.f("ix_trade_checklist_responses_trade_id"),
        "trade_checklist_responses",
        ["trade_id"],
        unique=False,
    )

    op.create_table(
        "risk_events",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("account_id", sa.Uuid(), nullable=False),
        sa.Column("trade_id", sa.Uuid(), nullable=True),
        sa.Column("event_type", sa.String(length=64), nullable=False),
        sa.Column("severity", sa.String(length=16), nullable=False),
        sa.Column("message", sa.Text(), nullable=False),
        sa.Column("metric_value", sa.Numeric(12, 4), nullable=True),
        sa.Column("threshold_value", sa.Numeric(12, 4), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["account_id"], ["accounts.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["trade_id"], ["trades.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_risk_events_user_id"), "risk_events", ["user_id"], unique=False)
    op.create_index(op.f("ix_risk_events_account_id"), "risk_events", ["account_id"], unique=False)
    op.create_index(op.f("ix_risk_events_event_type"), "risk_events", ["event_type"], unique=False)
    op.create_index(op.f("ix_risk_events_created_at"), "risk_events", ["created_at"], unique=False)


def downgrade() -> None:
    op.drop_table("risk_events")
    op.drop_table("trade_checklist_responses")
    op.drop_table("trade_screenshots")
    op.drop_table("psychology")
    op.drop_table("trades")
    op.drop_table("checklist_items")
    op.drop_table("checklist_templates")
    op.drop_table("setups")
    op.drop_table("account_risk_profiles")
    op.drop_table("accounts")
    op.drop_table("users")
