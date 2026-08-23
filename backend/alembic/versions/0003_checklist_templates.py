"""Categorized, setup-scoped checklist templates.

Revision ID: 0003_checklist_templates
Revises: 0002_ai
Create Date: 2026-08-21
"""

from typing import Sequence, Union
from uuid import uuid4

import sqlalchemy as sa
from alembic import op

from app.services.defaults import LEGACY_ITEM_MAP, items_for_setup

revision: str = "0003_checklist_templates"
down_revision: Union[str, None] = "0002_ai"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("checklist_templates", sa.Column("setup_id", sa.Uuid(), nullable=True))
    op.add_column("checklist_templates", sa.Column("description", sa.Text(), nullable=True))
    op.add_column("checklist_templates", sa.Column("instrument", sa.String(length=32), nullable=True))
    op.add_column(
        "checklist_templates",
        sa.Column("active", sa.Boolean(), nullable=False, server_default=sa.true()),
    )
    op.create_index(op.f("ix_checklist_templates_setup_id"), "checklist_templates", ["setup_id"])
    op.create_foreign_key(
        "fk_checklist_templates_setup_id",
        "checklist_templates",
        "setups",
        ["setup_id"],
        ["id"],
        ondelete="SET NULL",
    )

    op.add_column("checklist_items", sa.Column("description", sa.Text(), nullable=True))
    op.add_column(
        "checklist_items",
        sa.Column("category", sa.String(length=40), nullable=False, server_default="setup_confirmation"),
    )
    op.add_column(
        "checklist_items",
        sa.Column("kind", sa.String(length=20), nullable=False, server_default="manual"),
    )
    op.add_column("checklist_items", sa.Column("auto_key", sa.String(length=40), nullable=True))

    bind = op.get_bind()
    templates = list(
        bind.execute(sa.text("SELECT id, user_id, is_default FROM checklist_templates"))
    )
    items = list(
        bind.execute(
            sa.text("SELECT id, template_id, label, sort_order, required FROM checklist_items")
        )
    )
    by_template: dict = {}
    for item in items:
        by_template.setdefault(str(item.template_id), []).append(item)

    for item in items:
        label = (item.label or "").strip()
        if label.upper().replace("/", "") in {"EURUSD", "GBPUSD", "USDJPY", "XAUUSD", "BTCUSD"}:
            bind.execute(
                sa.text("DELETE FROM trade_checklist_responses WHERE item_id = :id"),
                {"id": item.id},
            )
            bind.execute(sa.text("DELETE FROM checklist_items WHERE id = :id"), {"id": item.id})
            continue
        spec = LEGACY_ITEM_MAP.get(label.lower())
        if spec is None:
            bind.execute(
                sa.text(
                    "UPDATE checklist_items SET category = :category, kind = 'manual' WHERE id = :id"
                ),
                {"category": "setup_confirmation", "id": item.id},
            )
            continue
        bind.execute(
            sa.text(
                """
                UPDATE checklist_items
                SET label = :label,
                    category = :category,
                    kind = :kind,
                    auto_key = :auto_key,
                    required = :required,
                    description = :description
                WHERE id = :id
                """
            ),
            {
                "label": spec["label"],
                "category": spec["category"],
                "kind": spec["kind"],
                "auto_key": spec.get("auto_key"),
                "required": bool(spec.get("required", False)),
                "description": spec.get("description"),
                "id": item.id,
            },
        )

    setups = list(bind.execute(sa.text("SELECT id, user_id, name FROM setups")))
    templates_by_user: dict = {}
    for tmpl in templates:
        templates_by_user.setdefault(str(tmpl.user_id), []).append(tmpl)

    for setup in setups:
        user_tmpls = templates_by_user.get(str(setup.user_id), [])
        already = False
        for tmpl in user_tmpls:
            row = bind.execute(
                sa.text("SELECT setup_id FROM checklist_templates WHERE id = :id"),
                {"id": tmpl.id},
            ).first()
            if row and str(row.setup_id) == str(setup.id):
                already = True
                break
        if already:
            continue
        tmpl_id = uuid4()
        bind.execute(
            sa.text(
                """
                INSERT INTO checklist_templates (id, user_id, setup_id, name, description, instrument, is_default, active, created_at)
                VALUES (:id, :user_id, :setup_id, :name, :description, NULL, false, true, now())
                """
            ),
            {
                "id": tmpl_id,
                "user_id": setup.user_id,
                "setup_id": setup.id,
                "name": setup.name,
                "description": f"Process checks for {setup.name}. Confirmation records review, not edge.",
            },
        )
        for i, spec in enumerate(items_for_setup(setup.name)):
            bind.execute(
                sa.text(
                    """
                    INSERT INTO checklist_items
                        (id, template_id, label, description, category, kind, auto_key, sort_order, required)
                    VALUES
                        (:id, :template_id, :label, :description, :category, :kind, :auto_key, :sort_order, :required)
                    """
                ),
                {
                    "id": uuid4(),
                    "template_id": tmpl_id,
                    "label": spec["label"],
                    "description": spec.get("description"),
                    "category": spec["category"],
                    "kind": spec["kind"],
                    "auto_key": spec.get("auto_key"),
                    "sort_order": i,
                    "required": bool(spec.get("required", False)),
                },
            )

    op.alter_column("checklist_templates", "active", server_default=None)
    op.alter_column("checklist_items", "category", server_default=None)
    op.alter_column("checklist_items", "kind", server_default=None)


def downgrade() -> None:
    op.drop_column("checklist_items", "auto_key")
    op.drop_column("checklist_items", "kind")
    op.drop_column("checklist_items", "category")
    op.drop_column("checklist_items", "description")
    op.drop_constraint("fk_checklist_templates_setup_id", "checklist_templates", type_="foreignkey")
    op.drop_index(op.f("ix_checklist_templates_setup_id"), table_name="checklist_templates")
    op.drop_column("checklist_templates", "active")
    op.drop_column("checklist_templates", "instrument")
    op.drop_column("checklist_templates", "description")
    op.drop_column("checklist_templates", "setup_id")
