"""Opt-in journal reminders via Web Push. Never used for trading signals."""

from __future__ import annotations

import json
import logging
from datetime import date, datetime, time, timedelta, timezone
from uuid import UUID
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from sqlalchemy.orm import Session, joinedload

from app.core.config import settings
from app.core.exceptions import DomainError
from app.models.push import PushSubscription
from app.models.trade import Trade
from app.models.user import User

log = logging.getLogger("traderos.push")

REMINDER_TITLE = "Trader OS"
REMINDER_BODY = "You haven't journaled today."
REMINDER_PATH = "/trades/new"


def local_now(tz_name: str, now: datetime | None = None) -> datetime:
    try:
        zone = ZoneInfo(tz_name)
    except ZoneInfoNotFoundError:
        zone = ZoneInfo(settings.default_timezone)
    stamp = now or datetime.now(timezone.utc)
    if stamp.tzinfo is None:
        stamp = stamp.replace(tzinfo=timezone.utc)
    return stamp.astimezone(zone)


def local_day_bounds(tz_name: str, local_date: date) -> tuple[datetime, datetime]:
    try:
        zone = ZoneInfo(tz_name)
    except ZoneInfoNotFoundError:
        zone = ZoneInfo(settings.default_timezone)
    start = datetime.combine(local_date, time.min, tzinfo=zone)
    return start.astimezone(timezone.utc), (start + timedelta(days=1)).astimezone(timezone.utc)


def journaled_on(db: Session, user_id: UUID, tz_name: str, local_date: date) -> bool:
    start, end = local_day_bounds(tz_name, local_date)
    row = (
        db.query(Trade.id)
        .filter(
            Trade.user_id == user_id,
            Trade.trade_timestamp >= start,
            Trade.trade_timestamp < end,
        )
        .first()
    )
    return row is not None


def config_payload() -> dict:
    if not settings.push_configured:
        return {
            "available": False,
            "vapid_public_key": None,
            "reminder_hour": settings.journal_reminder_hour,
            "message": "Journal reminders are not configured on this server.",
        }
    return {
        "available": True,
        "vapid_public_key": settings.vapid_public_key,
        "reminder_hour": settings.journal_reminder_hour,
        "message": None,
    }


def subscribe(db: Session, user: User, *, endpoint: str, p256dh: str, auth: str) -> PushSubscription:
    if not settings.push_configured:
        raise DomainError("Journal reminders are not configured.", "push_unavailable")
    existing = db.query(PushSubscription).filter(PushSubscription.endpoint == endpoint).one_or_none()
    if existing and existing.user_id != user.id:
        db.delete(existing)
        db.flush()
        existing = None
    if existing:
        existing.p256dh = p256dh
        existing.auth = auth
        row = existing
    else:
        row = PushSubscription(user_id=user.id, endpoint=endpoint, p256dh=p256dh, auth=auth)
        db.add(row)
    user.reminders_enabled = True
    db.commit()
    db.refresh(row)
    return row


def disable(db: Session, user: User) -> None:
    db.query(PushSubscription).filter(PushSubscription.user_id == user.id).delete()
    user.reminders_enabled = False
    db.commit()


def send_web_push(row: PushSubscription, payload: dict) -> None:
    from pywebpush import webpush

    webpush(
        subscription_info={
            "endpoint": row.endpoint,
            "keys": {"p256dh": row.p256dh, "auth": row.auth},
        },
        data=json.dumps(payload),
        vapid_private_key=settings.vapid_private_key,
        vapid_claims={"sub": settings.vapid_mailto},
    )


def reminder_payload() -> dict:
    origin = settings.public_web_origin
    return {
        "title": REMINDER_TITLE,
        "body": REMINDER_BODY,
        "url": f"{origin}{REMINDER_PATH}",
    }


def _gone(exc: BaseException) -> bool:
    status = getattr(exc, "response", None)
    code = getattr(status, "status_code", None) if status is not None else None
    if code in {404, 410}:
        return True
    text = str(exc)
    return "410" in text or "404" in text


def dispatch_due(
    db: Session,
    *,
    now: datetime | None = None,
    sender=send_web_push,
) -> dict:
    """Send at most one 'haven't journaled today' push per opted-in user per local day."""
    if not settings.push_configured:
        return {"sent": 0, "skipped": 0, "failed": 0, "reason": "not_configured"}

    stamp = now or datetime.now(timezone.utc)
    users = (
        db.query(User)
        .options(joinedload(User.push_subscriptions))
        .filter(User.reminders_enabled.is_(True))
        .all()
    )
    sent = skipped = failed = 0
    payload = reminder_payload()
    hour = settings.journal_reminder_hour

    for user in users:
        local = local_now(user.timezone, stamp)
        today = local.date()
        if local.hour != hour:
            skipped += 1
            continue
        if user.last_journal_reminder_on == today:
            skipped += 1
            continue
        if journaled_on(db, user.id, user.timezone, today):
            skipped += 1
            continue
        subs = list(user.push_subscriptions)
        if not subs:
            skipped += 1
            continue
        delivered = False
        for sub in subs:
            try:
                sender(sub, payload)
                delivered = True
            except Exception as exc:  # noqa: BLE001 — drop dead endpoints, keep going
                if _gone(exc):
                    db.delete(sub)
                else:
                    failed += 1
                    log.warning("push failed user=%s: %s", user.id, type(exc).__name__)
        if delivered:
            user.last_journal_reminder_on = today
            sent += 1
        else:
            skipped += 1
    db.commit()
    return {"sent": sent, "skipped": skipped, "failed": failed, "reason": None}
