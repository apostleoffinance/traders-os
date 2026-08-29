"""Connector token generation and verification."""

from __future__ import annotations

import hashlib
import secrets


def generate_connector_token() -> tuple[str, str, str]:
    """Return (plaintext_token, sha256_hex_hash, display_prefix)."""
    parts = [secrets.token_hex(2).upper() for _ in range(3)]
    token = "TOS-" + "-".join(parts)
    token_hash = hash_token(token)
    prefix = token[:12]
    return token, token_hash, prefix


def hash_token(token: str) -> str:
    return hashlib.sha256(token.strip().encode("utf-8")).hexdigest()
