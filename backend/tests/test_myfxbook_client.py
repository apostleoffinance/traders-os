from __future__ import annotations

import asyncio

import httpx
import pytest

from app.integrations.investor_access.myfxbook import MyfxbookClient, MyfxbookError


def test_login_and_history_uses_session_and_account_id():
    def handler(request: httpx.Request):
        if request.url.path.endswith("/login.json"):
            assert request.url.params["email"] == "trader@example.com"
            return httpx.Response(200, json={"error": False, "session": "session-123"})
        if request.url.path.endswith("/get-history.json"):
            assert request.url.params["session"] == "session-123"
            assert request.url.params["id"] == "42"
            return httpx.Response(200, json={"error": False, "history": [{"symbol": "EURUSD"}]})
        raise AssertionError(f"Unexpected request: {request.url}")

    async def run():
        client = MyfxbookClient(transport=httpx.MockTransport(handler))
        try:
            await client.login("trader@example.com", "not-a-real-password")
            assert await client.get_history(42) == [{"symbol": "EURUSD"}]
        finally:
            await client.close()

    asyncio.run(run())


def test_rejects_api_error_response():
    calls = 0

    def handler(request: httpx.Request):
        nonlocal calls
        calls += 1
        if request.url.path.endswith("/login.json"):
            return httpx.Response(200, json={"error": False, "session": "session-123"})
        return httpx.Response(200, json={"error": True, "message": "Invalid session"})

    async def run():
        client = MyfxbookClient(transport=httpx.MockTransport(handler))
        try:
            await client.login("trader@example.com", "not-a-real-password")
            with pytest.raises(MyfxbookError, match="Invalid session"):
                await client.get_accounts()
        finally:
            await client.close()

    asyncio.run(run())


def test_requires_login_before_reading():
    async def run():
        client = MyfxbookClient(transport=httpx.MockTransport(lambda request: httpx.Response(500)))
        try:
            with pytest.raises(MyfxbookError, match="Authenticate"):
                await client.get_accounts()
        finally:
            await client.close()

    asyncio.run(run())
