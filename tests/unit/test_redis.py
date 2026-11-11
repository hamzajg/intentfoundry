"""
Unit tests for the optional Redis telemetry transport.
All tests use fakes — no external Redis server is required.
"""
import json
from types import SimpleNamespace

import pytest

from app.core import redis as redis_module
from app.core.redis import (
    close_redis,
    get_redis,
    publish_telemetry_event,
    subscribe_telemetry_events,
    telemetry_channel,
)


def _settings(enabled: bool = True):
    return SimpleNamespace(
        redis_enabled=enabled,
        redis_url="redis://localhost:6379/0",
        telemetry_channel_prefix="if:telemetry:",
    )


@pytest.fixture(autouse=True)
def reset_client():
    """Ensure the module-level client never leaks between tests."""
    redis_module._client = None
    yield
    redis_module._client = None


class FakePubSub:
    def __init__(self, messages):
        self._messages = list(messages)
        self.subscribed: list[str] = []
        self.unsubscribed: list[str] = []
        self.closed = False

    async def subscribe(self, channel):
        self.subscribed.append(channel)

    async def get_message(self, ignore_subscribe_messages=True, timeout=1.0):
        if self._messages:
            return self._messages.pop(0)
        return None

    async def unsubscribe(self, channel):
        self.unsubscribed.append(channel)

    async def aclose(self):
        self.closed = True


class FakeRedis:
    def __init__(self, pubsub: FakePubSub | None = None, fail_publish: bool = False):
        self._pubsub = pubsub
        self.fail_publish = fail_publish
        self.published: list[tuple[str, str]] = []
        self.closed = False

    def pubsub(self):
        return self._pubsub

    async def publish(self, channel, data):
        if self.fail_publish:
            raise ConnectionError("redis down")
        self.published.append((channel, data))

    async def aclose(self):
        self.closed = True


# ─── Channel naming ───────────────────────────────────────────────────────────

class TestTelemetryChannel:
    def test_channel_uses_configured_prefix(self, monkeypatch):
        monkeypatch.setattr(redis_module, "get_settings", lambda: _settings())
        assert telemetry_channel("proj-1") == "if:telemetry:proj-1"

    def test_channel_prefix_override(self, monkeypatch):
        settings = _settings()
        settings.telemetry_channel_prefix = "custom:"
        monkeypatch.setattr(redis_module, "get_settings", lambda: settings)
        assert telemetry_channel("p9") == "custom:p9"


# ─── get_redis / close_redis ──────────────────────────────────────────────────

class TestClientLifecycle:
    def test_get_redis_caches_instance(self, monkeypatch):
        sentinel = object()
        fake_cls = SimpleNamespace(from_url=lambda *a, **k: sentinel)
        monkeypatch.setattr(redis_module, "Redis", fake_cls)
        monkeypatch.setattr(redis_module, "get_settings", lambda: _settings())

        assert get_redis() is sentinel
        assert get_redis() is sentinel

    async def test_close_redis_closes_and_resets(self):
        fake = FakeRedis()
        redis_module._client = fake

        await close_redis()

        assert fake.closed is True
        assert redis_module._client is None

    async def test_close_redis_noop_when_unset(self):
        # Must not raise when no client was ever created.
        await close_redis()
        assert redis_module._client is None


# ─── publish ──────────────────────────────────────────────────────────────────

class TestPublishTelemetryEvent:
    async def test_noop_when_disabled(self, monkeypatch):
        fake = FakeRedis()
        monkeypatch.setattr(redis_module, "get_settings", lambda: _settings(enabled=False))
        monkeypatch.setattr(redis_module, "get_redis", lambda: fake)

        await publish_telemetry_event("p1", {"event_type": "x"})

        assert fake.published == []

    async def test_publishes_json_when_enabled(self, monkeypatch):
        fake = FakeRedis()
        monkeypatch.setattr(redis_module, "get_settings", lambda: _settings())
        monkeypatch.setattr(redis_module, "get_redis", lambda: fake)

        await publish_telemetry_event("p1", {"event_type": "x", "payload": {"a": 1}})

        assert len(fake.published) == 1
        channel, data = fake.published[0]
        assert channel == "if:telemetry:p1"
        assert json.loads(data) == {"event_type": "x", "payload": {"a": 1}}

    async def test_publish_failure_is_swallowed(self, monkeypatch):
        fake = FakeRedis(fail_publish=True)
        monkeypatch.setattr(redis_module, "get_settings", lambda: _settings())
        monkeypatch.setattr(redis_module, "get_redis", lambda: fake)

        # Must not raise — a Redis outage cannot break the caller.
        await publish_telemetry_event("p1", {"event_type": "x"})


# ─── subscribe ────────────────────────────────────────────────────────────────

class TestSubscribeTelemetryEvents:
    async def test_yields_parsed_message(self, monkeypatch):
        pubsub = FakePubSub(
            [{"type": "message", "data": json.dumps({"event_type": "x", "payload": {}})}]
        )
        monkeypatch.setattr(redis_module, "get_settings", lambda: _settings())
        monkeypatch.setattr(redis_module, "get_redis", lambda: FakeRedis(pubsub))

        gen = subscribe_telemetry_events("p1", timeout=0.01)
        try:
            first = await anext(gen)
        finally:
            await gen.aclose()

        assert first == {"event_type": "x", "payload": {}}
        assert pubsub.subscribed == ["if:telemetry:p1"]

    async def test_yields_none_on_timeout(self, monkeypatch):
        pubsub = FakePubSub([])
        monkeypatch.setattr(redis_module, "get_settings", lambda: _settings())
        monkeypatch.setattr(redis_module, "get_redis", lambda: FakeRedis(pubsub))

        gen = subscribe_telemetry_events("p1", timeout=0.01)
        try:
            first = await anext(gen)
        finally:
            await gen.aclose()

        assert first is None

    async def test_skips_non_message_types(self, monkeypatch):
        pubsub = FakePubSub(
            [
                {"type": "subscribe", "data": "if:telemetry:p1"},
                {"type": "message", "data": json.dumps({"event_type": "y"})},
            ]
        )
        monkeypatch.setattr(redis_module, "get_settings", lambda: _settings())
        monkeypatch.setattr(redis_module, "get_redis", lambda: FakeRedis(pubsub))

        gen = subscribe_telemetry_events("p1", timeout=0.01)
        try:
            first = await anext(gen)
        finally:
            await gen.aclose()

        assert first == {"event_type": "y"}

    async def test_malformed_message_is_skipped(self, monkeypatch):
        pubsub = FakePubSub([{"type": "message", "data": "{not json"}])
        monkeypatch.setattr(redis_module, "get_settings", lambda: _settings())
        monkeypatch.setattr(redis_module, "get_redis", lambda: FakeRedis(pubsub))

        gen = subscribe_telemetry_events("p1", timeout=0.01)
        try:
            # Malformed payload is logged and skipped; the next poll returns None.
            first = await anext(gen)
        finally:
            await gen.aclose()

        assert first is None

    async def test_cleans_up_on_close(self, monkeypatch):
        pubsub = FakePubSub([])
        monkeypatch.setattr(redis_module, "get_settings", lambda: _settings())
        monkeypatch.setattr(redis_module, "get_redis", lambda: FakeRedis(pubsub))

        gen = subscribe_telemetry_events("p1", timeout=0.01)
        await anext(gen)
        await gen.aclose()

        assert pubsub.unsubscribed == ["if:telemetry:p1"]
        assert pubsub.closed is True
