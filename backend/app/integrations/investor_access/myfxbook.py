"""Read-only Myfxbook API client used for MT4/MT5 investor-access imports.

This client never accepts a broker/master trading password. Users must first link their
MT5 account to Myfxbook with their investor password; TraderOS then reads the linked
account through the user's Myfxbook API session.
"""
from __future__ import annotations

from typing import Any

import httpx

API_BASE = "https://www.myfxbook.com/api"


class MyfxbookError(RuntimeError):
    """Raised when Myfxbook rejects a request or returns an invalid response."""


class MyfxbookClient:
    def __init__(self, *, timeout: float = 12.0, transport: httpx.AsyncBaseTransport | None = None):
        self._client = httpx.AsyncClient(
            base_url=API_BASE,
            timeout=timeout,
            transport=transport,
            follow_redirects=False,
        )
        self._session: str | None = None

    async def close(self) -> None:
        await self._client.aclose()

    async def login(self, email: str, password: str) -> str:
        """Create a Myfxbook API session. Call only on the backend over HTTPS."""
        response = await self._client.get(
            "/login.json",
            params={"email": email, "password": password},
        )
        response.raise_for_status()
        payload = self._json_object(response.json())
        if payload.get("error") is True or not payload.get("session"):
            raise MyfxbookError(str(payload.get("message") or "Myfxbook login failed"))
        self._session = str(payload["session"])
        return self._session

    async def get_accounts(self) -> list[dict[str, Any]]:
        payload = await self._request("get-my-accounts.json")
        accounts = payload.get("accounts")
        if not isinstance(accounts, list):
            raise MyfxbookError("Myfxbook returned no account list")
        return [item for item in accounts if isinstance(item, dict)]

    async def get_history(self, account_id: str | int) -> list[dict[str, Any]]:
        """Return the history currently exposed by Myfxbook (documented as last 50 transactions)."""
        payload = await self._request("get-history.json", id=str(account_id))
        history = payload.get("history")
        if not isinstance(history, list):
            raise MyfxbookError("Myfxbook returned no trade history")
        return [item for item in history if isinstance(item, dict)]

    async def get_open_trades(self, account_id: str | int) -> list[dict[str, Any]]:
        payload = await self._request("get-open-trades.json", id=str(account_id))
        trades = payload.get("openTrades")
        if not isinstance(trades, list):
            raise MyfxbookError("Myfxbook returned no open-trades list")
        return [item for item in trades if isinstance(item, dict)]

    async def logout(self) -> None:
        if not self._session:
            return
        try:
            await self._request("logout.json")
        finally:
            self._session = None

    async def _request(self, path: str, **params: str) -> dict[str, Any]:
        if not self._session:
            raise MyfxbookError("Authenticate with Myfxbook before requesting account data")
        response = await self._client.get(path, params={"session": self._session, **params})
        response.raise_for_status()
        payload = self._json_object(response.json())
        if payload.get("error") is True:
            raise MyfxbookError(str(payload.get("message") or "Myfxbook request failed"))
        return payload

    @staticmethod
    def _json_object(value: Any) -> dict[str, Any]:
        if not isinstance(value, dict):
            raise MyfxbookError("Myfxbook returned an unexpected response")
        return value
