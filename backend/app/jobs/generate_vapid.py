"""Print VAPID keys to stdout. Copy into .env — never commit the private key."""

from __future__ import annotations

from py_vapid import Vapid01


def main() -> None:
    vapid = Vapid01()
    vapid.generate_keys()
    public = vapid.public_key.decode() if isinstance(vapid.public_key, bytes) else str(vapid.public_key)
    private = vapid.private_key.decode() if isinstance(vapid.private_key, bytes) else str(vapid.private_key)
    print("VAPID_PUBLIC_KEY=" + public)
    print("VAPID_PRIVATE_KEY=" + private)
    print("VAPID_MAILTO=mailto:trader-os@localhost")


if __name__ == "__main__":
    main()
