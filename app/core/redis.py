"""
Optional Redis transport for real-time telemetry.

Redis is disabled by default (``settings.redis_enabled``) so local development
needs no external services — the SSE stream falls back to polling the database.
When enabled, telemetry events are published to ``if:telemetry:{project_id}``
and the SSE stream subscribes to that channel.
"""
from __future__ import annotations

import json
from collections.abc import AsyncIterator
from typing import Any

import structlog
from redis.asyncio import Redis

from app.core.config import get_settings

log = structlog.get_logger()

_client: Redis | None = None


def get_redis() -> Redis:
    """Return the process-wide async Redis client, creating it on first use."""
    global _client
    if _client is None:
        _client = Redis.from_url(get_settings().redis_url, decode_responses=True)
    return _client


async def close_redis() -> None:
    """Close the shared client. Called on application shutdown."""
    global _client
    if _client is not None:
        await _client.aclose()
        _client = None


def telemetry_channel(project_id: str) -> str:
    """Pub/sub channel carrying a project's telemetry events."""
    return f"{get_settings().telemetry_channel_prefix}{project_id}"


async def publish_telemetry_event(project_id: str, message: dict[str, Any]) -> None:
    """
    Publish a telemetry event to the project's channel.

    Best-effort: the event is already persisted by the caller, so a Redis
    outage must never fail the request — failures are logged and swallowed.
    """
    if not get_settings().redis_enabled:
        return
    try:
        await get_redis().publish(telemetry_channel(project_id), json.dumps(message, default=str))
    except Exception as exc:  # noqa: BLE001 — Redis must never break a request
        log.warning("redis.publish_failed", project_id=project_id, error=str(exc))


async def subscribe_telemetry_events(
    project_id: str,
    timeout: float = 1.0,
) -> AsyncIterator[dict[str, Any] | None]:
    """
    Yield telemetry messages published to a project's channel.

    Yields ``None`` on the poll timeout so the caller can emit an SSE keepalive.
    """
    channel = telemetry_channel(project_id)
    pubsub = get_redis().pubsub()
    await pubsub.subscribe(channel)
    try:
        while True:
            message = await pubsub.get_message(ignore_subscribe_messages=True, timeout=timeout)
            if message is None:
                yield None
                continue
            if message.get("type") != "message":
                continue
            try:
                yield json.loads(message["data"])
            except (TypeError, ValueError):
                log.warning("redis.malformed_message", project_id=project_id)
    finally:
        await pubsub.unsubscribe(channel)
        await pubsub.aclose()
