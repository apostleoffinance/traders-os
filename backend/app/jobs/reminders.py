"""Hourly job: python -m app.jobs.reminders"""

from __future__ import annotations

from app.db.session import SessionLocal
from app.services.push_service import dispatch_due


def main() -> None:
    db = SessionLocal()
    try:
        print(dispatch_due(db))
    finally:
        db.close()


if __name__ == "__main__":
    main()
