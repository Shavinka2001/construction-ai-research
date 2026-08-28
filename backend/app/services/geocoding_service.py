"""
Module 3 — Satellite Location Finder (backend geocoding proxy).

Proxies Nominatim from the server with a compliant ``User-Agent`` so the
frontend never hits it directly (avoids CORS + usage-policy issues). Results
are cached briefly to respect the 1 request/second guideline, and transient
upstream failures (timeouts, 429/5xx) are retried with a short backoff so a
single blip on the public instance doesn't surface as an error.
"""

from __future__ import annotations

# --- Windows SSL fix (keep at top, before networked imports) ----------------
import os

import certifi

os.environ.setdefault("SSL_CERT_FILE", certifi.where())
os.environ.setdefault("REQUESTS_CA_BUNDLE", certifi.where())
# ---------------------------------------------------------------------------

import logging
import time
from typing import Any

import requests

from app.core.config import settings

logger = logging.getLogger(__name__)

_CACHE: dict[str, tuple[float, list[dict[str, Any]]]] = {}
_CACHE_TTL_S = 300.0
_last_call = 0.0

_MAX_ATTEMPTS = 3
_RETRY_STATUS = {429, 500, 502, 503, 504}
_REQUEST_TIMEOUT_S = 8.0


def _throttle() -> None:
    global _last_call
    elapsed = time.monotonic() - _last_call
    if elapsed < 1.1:
        time.sleep(1.1 - elapsed)
    _last_call = time.monotonic()


def _fetch_nominatim(q: str, limit: int) -> list[dict[str, Any]]:
    """GET Nominatim, retrying transient failures with a short backoff."""
    last_error: str = "unknown error"

    for attempt in range(1, _MAX_ATTEMPTS + 1):
        if attempt > 1:
            time.sleep(0.7 * (attempt - 1))
        _throttle()
        try:
            resp = requests.get(
                settings.NOMINATIM_URL,
                params={
                    "q": q,
                    "format": "jsonv2",
                    "limit": limit,
                    "addressdetails": 1,
                },
                headers={
                    "User-Agent": settings.NOMINATIM_USER_AGENT,
                    "Accept-Language": "en",
                },
                timeout=_REQUEST_TIMEOUT_S,
            )
        except requests.RequestException as exc:
            last_error = str(exc)
            logger.warning(
                "Nominatim request failed (attempt %d/%d): %s",
                attempt,
                _MAX_ATTEMPTS,
                exc,
            )
            continue

        if resp.status_code in _RETRY_STATUS:
            last_error = f"HTTP {resp.status_code}"
            logger.warning(
                "Nominatim returned %d (attempt %d/%d) for %r",
                resp.status_code,
                attempt,
                _MAX_ATTEMPTS,
                q,
            )
            continue

        try:
            resp.raise_for_status()
            return resp.json()
        except (requests.RequestException, ValueError) as exc:
            last_error = str(exc)
            logger.warning("Nominatim response unusable: %s", exc)
            break

    raise RuntimeError(f"Geocoding service unavailable: {last_error}")


def geocode(query: str, limit: int = 5) -> list[dict[str, Any]]:
    q = (query or "").strip()
    if len(q) < 2:
        raise ValueError("Search query must be at least 2 characters")

    key = f"{q.lower()}::{limit}"
    cached = _CACHE.get(key)
    if cached and (time.monotonic() - cached[0]) < _CACHE_TTL_S:
        return cached[1]

    raw = _fetch_nominatim(q, limit)

    results: list[dict[str, Any]] = []
    for item in raw:
        try:
            bbox = item.get("boundingbox")
            results.append(
                {
                    "display_name": item["display_name"],
                    "lat": float(item["lat"]),
                    "lon": float(item["lon"]),
                    "type": item.get("type"),
                    "bounding_box": [float(v) for v in bbox] if bbox else None,
                }
            )
        except (KeyError, TypeError, ValueError):
            continue

    _CACHE[key] = (time.monotonic(), results)
    return results
