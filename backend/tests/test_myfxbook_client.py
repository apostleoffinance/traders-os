from __future__ import annotations

import json

import httpx
import pytest

from app.integrations.investor_access.myfxbook import MyfxbookClient, MyfxbookError


class MockTransport:
    def __init__(self, handler):
        self.handler = handler

    async def __call__(self, request: httpx.Request) -> httpx.Response:
        return self.handler(request)


@pytest.mark.asyncio
async def test_login_and_history_uses_session_and_account_id():
    def handler(request: httpx.Request):
        if request.url.path.endswith("/login.json"):
            assert request.url.params["email"] == "trader@example.com"
            return httpx.Response(200, json={"error": False, "session": "session-123"})
        if request.url.path.endswith("/get-history.json"):
            assert request.url.params["session"] == "session-123"
            assert request.url.params["id"] == "42"
            return httpx.Response(200, json={"error": False, "history": [{"symbol": "EURUSD"}]})
        raise AssertionError(f"Unexpected request: {request.url}")

    client = MyfxbookClient(transport=httpx.MockTransport(handler))
    try:
        await client.login("trader@example.com", "not-a-real-password")
        assert await client.get_history(42) == [{"symbol": "EURUSD"}]
    finally:
        await client.close()


@pytest.mark.asyncio
async def test_rejects_api_error_response():
    def handler(request: httpx.Request):
        return httpx.Response(200, json={"error": True, "message": "Invalid session"})

    client = MyfxbookClient(transport=httpx.MockTransport(handler))
    try:
        await client.login("trader@example.com", "bad")
        with pytest.raises(MyfxbookError, match="Invalid session"):
            await client.get_accounts()
    finally:
        await client.close()


@pytest.mark.asyncio
async def test_requires_login_before_reading():
    client = MyfxbookClient(transport=httpx.MockTransport(lambda request: httpx.Response(500)))
    try:
        with pytest.raises(MyfxbookError, match="Authenticate"):
            await client.get_accounts()
    finally:
        await client.close()
