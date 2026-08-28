import pytest

from app.ai.providers.base import ProviderError
from app.ai.providers.router import FailoverRouter
from app.core.exceptions import AIUnavailable


class FakeProvider:
    def __init__(self, name: str, available: bool, result=None, error: str | None = None) -> None:
        self.name = name
        self._available = available
        self._result = result
        self._error = error
        self.calls = 0

    def available(self) -> bool:
        return self._available

    def complete_json(self, *, system: str, user: str, schema_name: str) -> tuple[str, str]:
        self.calls += 1
        if self._error:
            raise ProviderError(self.name, self._error)
        return self._result or "{}", self.name + "-model"


def test_skips_unconfigured_and_uses_next() -> None:
    dead = FakeProvider("gemini", False)
    live = FakeProvider("openrouter", True, result='{"ok": true}')
    text, name, model = FailoverRouter([dead, live]).complete_json(
        system="s", user="u", schema_name="x"
    )
    assert dead.calls == 0
    assert live.calls == 1
    assert name == "openrouter"
    assert "ok" in text
    assert model == "openrouter-model"


def test_fails_over_on_provider_error() -> None:
    a = FakeProvider("gemini", True, error="500")
    b = FakeProvider("bazaarlink", True, result='{"summary": "x"}')
    text, name, _ = FailoverRouter([a, b]).complete_json(system="s", user="u", schema_name="x")
    assert a.calls == 1
    assert name == "bazaarlink"
    assert "summary" in text


def test_all_down_raises_unavailable() -> None:
    a = FakeProvider("gemini", True, error="down")
    b = FakeProvider("openrouter", True, error="down")
    with pytest.raises(AIUnavailable):
        FailoverRouter([a, b]).complete_json(system="s", user="u", schema_name="x")


def test_none_configured() -> None:
    from app.ai.messages import AI_UNAVAILABLE_MESSAGE

    with pytest.raises(AIUnavailable, match="journal"):
        FailoverRouter([FakeProvider("gemini", False)]).complete_json(system="s", user="u", schema_name="x")
    # Message must not leak env var names to API consumers.
    assert "API_KEY" not in AI_UNAVAILABLE_MESSAGE
