from __future__ import annotations

from uuid import UUID

from sqlalchemy.orm import Session, selectinload

from app.core.exceptions import NotFoundError
from app.engines.fx_math import INSTRUMENTS
from app.models.checklist import ChecklistItem, ChecklistTemplate
from app.models.setup import Setup
from app.services.defaults import (
    AUTO_CHECK_SPECS,
    CATEGORY_LABELS,
    CATEGORY_ORDER,
    SHARED_MANUAL_SPECS,
    SETUP_MANUAL_SPECS,
    items_for_setup,
)


def _item_kwargs(spec: dict, sort_order: int) -> dict:
    return {
        "label": spec["label"],
        "description": spec.get("description"),
        "category": spec["category"],
        "kind": spec["kind"],
        "auto_key": spec.get("auto_key"),
        "required": bool(spec.get("required", False)),
        "sort_order": sort_order,
    }


def add_items(db: Session, template: ChecklistTemplate, specs: list[dict]) -> None:
    for i, spec in enumerate(specs):
        db.add(ChecklistItem(template_id=template.id, **_item_kwargs(spec, i)))


def create_template(
    db: Session,
    *,
    user_id: UUID,
    name: str,
    setup_id: UUID | None = None,
    is_default: bool = False,
    description: str | None = None,
    instrument: str | None = None,
    specs: list[dict] | None = None,
) -> ChecklistTemplate:
    tmpl = ChecklistTemplate(
        user_id=user_id,
        name=name,
        setup_id=setup_id,
        is_default=is_default,
        description=description,
        instrument=instrument,
        active=True,
    )
    db.add(tmpl)
    db.flush()
    add_items(db, tmpl, specs if specs is not None else items_for_setup(name if setup_id else None))
    return tmpl


def provision_user_checklists(db: Session, user_id: UUID, setups: list[Setup]) -> None:
    create_template(
        db,
        user_id=user_id,
        name="Pre-trade",
        is_default=True,
        description="Fallback process check when a setup has no template.",
        specs=items_for_setup(None),
    )
    for setup in setups:
        create_template(
            db,
            user_id=user_id,
            name=setup.name,
            setup_id=setup.id,
            description=f"Process checks for {setup.name}. Confirmation records review, not edge.",
            specs=items_for_setup(setup.name),
        )


def _template_query(db: Session):
    return db.query(ChecklistTemplate).options(selectinload(ChecklistTemplate.items))


def get_default_template(db: Session, user_id: UUID) -> ChecklistTemplate | None:
    return (
        _template_query(db)
        .filter(
            ChecklistTemplate.user_id == user_id,
            ChecklistTemplate.is_default.is_(True),
        )
        .one_or_none()
    )


def list_templates(db: Session, user_id: UUID) -> list[ChecklistTemplate]:
    return (
        _template_query(db)
        .filter(ChecklistTemplate.user_id == user_id)
        .order_by(ChecklistTemplate.is_default.desc(), ChecklistTemplate.name)
        .all()
    )


def get_owned_template(db: Session, user_id: UUID, template_id: UUID) -> ChecklistTemplate:
    tmpl = (
        _template_query(db)
        .filter(ChecklistTemplate.id == template_id, ChecklistTemplate.user_id == user_id)
        .one_or_none()
    )
    if tmpl is None:
        raise NotFoundError("Checklist not found")
    return tmpl


def resolve_template(
    db: Session,
    user_id: UUID,
    *,
    setup_id: UUID | None = None,
    instrument: str | None = None,
    create_missing: bool = False,
) -> ChecklistTemplate | None:
    """Most specific matching template: setup+instrument, then setup, then default."""
    symbol = (instrument or "").upper().replace("/", "") or None
    if setup_id and symbol:
        match = (
            _template_query(db)
            .filter(
                ChecklistTemplate.user_id == user_id,
                ChecklistTemplate.setup_id == setup_id,
                ChecklistTemplate.active.is_(True),
                ChecklistTemplate.instrument == symbol,
            )
            .one_or_none()
        )
        if match is not None:
            return match
    if setup_id:
        match = (
            _template_query(db)
            .filter(
                ChecklistTemplate.user_id == user_id,
                ChecklistTemplate.setup_id == setup_id,
                ChecklistTemplate.active.is_(True),
                ChecklistTemplate.instrument.is_(None),
            )
            .one_or_none()
        )
        if match is not None:
            return match
        if create_missing:
            setup = db.query(Setup).filter(Setup.id == setup_id, Setup.user_id == user_id).one_or_none()
            if setup is not None:
                return create_template(
                    db,
                    user_id=user_id,
                    name=setup.name,
                    setup_id=setup.id,
                    description=f"Process checks for {setup.name}. Confirmation records review, not edge.",
                    specs=items_for_setup(setup.name),
                )
    tmpl = get_default_template(db, user_id)
    if tmpl is None and create_missing:
        tmpl = create_template(
            db,
            user_id=user_id,
            name="Pre-trade",
            is_default=True,
            description="Fallback process check when a setup has no template.",
            specs=items_for_setup(None),
        )
    return tmpl


def replace_items(db: Session, tmpl: ChecklistTemplate, items: list) -> ChecklistTemplate:
    db.query(ChecklistItem).filter(ChecklistItem.template_id == tmpl.id).delete()
    for i, item in enumerate(items):
        data = item.model_dump() if hasattr(item, "model_dump") else dict(item)
        db.add(
            ChecklistItem(
                template_id=tmpl.id,
                label=data["label"],
                description=data.get("description"),
                category=data.get("category") or "setup_confirmation",
                kind=data.get("kind") or "manual",
                auto_key=data.get("auto_key"),
                required=bool(data.get("required", False)),
                sort_order=data.get("sort_order") if data.get("sort_order") is not None else i,
            )
        )
    db.flush()
    db.refresh(tmpl)
    return get_owned_template(db, tmpl.user_id, tmpl.id)


def library_payload() -> dict:
    return {
        "categories": [{"key": key, "label": CATEGORY_LABELS[key]} for key in CATEGORY_ORDER],
        "auto_items": AUTO_CHECK_SPECS,
        "shared_manual": SHARED_MANUAL_SPECS,
        "setup_presets": SETUP_MANUAL_SPECS,
        "instruments": list(INSTRUMENTS.keys()),
        "helper": (
            "Checklist confirmation records that you reviewed your trading conditions. "
            "It does not indicate that the setup is profitable or that the trade will win."
        ),
    }


def instruments_payload() -> dict:
    return {
        "instruments": [
            {"symbol": spec.symbol, "quote_currency": spec.quote_currency, "price_decimals": spec.price_decimals}
            for spec in INSTRUMENTS.values()
        ]
    }
