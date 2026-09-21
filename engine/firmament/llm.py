"""Groq chat-completions client with rate-limit awareness.

Free tier (per model, measured on this key): 1,000 requests/day and 8,000 tokens/minute.
The client reads Groq's x-ratelimit-* headers after every call, waits for the token
window to reset instead of hammering the API, and moves to the next model in its list
when one model's daily quota is exhausted.
"""

from __future__ import annotations

import asyncio
import json
import os
import re
import time
from pathlib import Path

import httpx

ENV_FILE = Path(__file__).resolve().parent.parent / ".env"
URL = "https://api.groq.com/openai/v1/chat/completions"


def load_env() -> None:
    """Minimal .env reader (KEY=value, optional quotes). Never logs values."""
    if not ENV_FILE.exists():
        return
    for line in ENV_FILE.read_text(encoding="utf-8-sig").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, v = line.split("=", 1)
        os.environ.setdefault(k.strip(), v.strip().strip('"').strip("'"))


def parse_duration(text: str | None) -> float:
    """'1m26.4s' → 86.4, '3.33s' → 3.33, '450ms' → 0.45, '2h1m' → 7260."""
    if not text:
        return 0.0
    total = 0.0
    for num, unit in re.findall(r"([\d.]+)(ms|h|m|s)", text):
        total += float(num) * {"ms": 0.001, "s": 1, "m": 60, "h": 3600}[unit]
    return total


class QuotaExhausted(Exception):
    pass


class LLMError(Exception):
    pass


class GroqClient:
    def __init__(self, key: str, models: list[str]):
        self._key = key
        self.models = models
        self._http = httpx.AsyncClient(timeout=45)
        self._tokens_left: dict[str, int] = {}
        self._tokens_reset_at: dict[str, float] = {}
        self._exhausted_until: dict[str, float] = {}
        self.stats = {
            "calls": 0, "errors": 0, "tokens": 0, "msTotal": 0.0,
            "status": "ok", "lastError": None, "lastModel": models[0],
        }

    def available(self, prefer: str | None = None) -> str | None:
        now = time.monotonic()
        order = ([prefer] if prefer in self.models else []) + [m for m in self.models if m != prefer]
        return next((m for m in order if self._exhausted_until.get(m, 0) <= now), None)

    async def _respect_token_window(self, model: str, need: int) -> None:
        left = self._tokens_left.get(model)
        reset_at = self._tokens_reset_at.get(model, 0)
        wait = reset_at - time.monotonic()
        if left is not None and left < need and wait > 0:
            self.stats["status"] = "rate-limited"
            await asyncio.sleep(min(wait + 0.2, 60))

    def _read_limits(self, model: str, headers: httpx.Headers) -> None:
        if "x-ratelimit-remaining-tokens" in headers:
            self._tokens_left[model] = int(float(headers["x-ratelimit-remaining-tokens"]))
            self._tokens_reset_at[model] = time.monotonic() + parse_duration(headers.get("x-ratelimit-reset-tokens"))
        if headers.get("x-ratelimit-remaining-requests") == "0":
            self._exhausted_until[model] = time.monotonic() + parse_duration(headers.get("x-ratelimit-reset-requests"))

    async def complete_json(self, messages: list[dict], *, prefer: str | None = None, max_tokens: int = 700) -> tuple[dict, str]:
        """Returns (parsed JSON object, model used). Raises QuotaExhausted or LLMError."""
        for attempt in range(4):
            model = self.available(prefer)
            if model is None:
                self.stats["status"] = "quota"
                raise QuotaExhausted("Daily AI quota used up on every model")
            await self._respect_token_window(model, 1400)
            started = time.perf_counter()
            try:
                r = await self._http.post(
                    URL,
                    headers={"Authorization": f"Bearer {self._key}"},
                    json={
                        "model": model,
                        "messages": messages,
                        "temperature": 0.8,
                        "max_tokens": max_tokens,
                        "response_format": {"type": "json_object"},
                        "reasoning_effort": "low",
                        "include_reasoning": False,
                    },
                )
            except httpx.HTTPError as e:
                self._fail(f"network: {type(e).__name__}")
                await asyncio.sleep(2 + attempt * 2)
                continue

            self._read_limits(model, r.headers)
            if r.status_code == 429:
                retry = float(r.headers.get("retry-after") or 5)
                body = r.text.lower()
                if "per day" in body or "(rpd)" in body or "(tpd)" in body:
                    self._exhausted_until[model] = time.monotonic() + max(retry, 60)
                    self._fail(f"{model} daily quota reached")
                else:
                    self.stats["status"] = "rate-limited"
                    await asyncio.sleep(min(retry, 30))
                continue
            if r.status_code >= 400:
                self._fail(f"HTTP {r.status_code}: {r.text[:120]}")
                if r.status_code in (401, 403):
                    raise LLMError(self.stats["lastError"])
                await asyncio.sleep(1)
                continue

            data = r.json()
            self.stats["calls"] += 1
            self.stats["tokens"] += data.get("usage", {}).get("total_tokens", 0)
            self.stats["msTotal"] += (time.perf_counter() - started) * 1000
            self.stats["lastModel"] = model
            content = data["choices"][0]["message"].get("content") or ""
            try:
                parsed = json.loads(content)
                if not isinstance(parsed, dict):
                    raise ValueError("not an object")
            except ValueError:
                self._fail("model returned invalid JSON")
                continue
            self.stats["status"] = "ok"
            return parsed, model
        raise LLMError(self.stats["lastError"] or "no valid reply")

    def _fail(self, message: str) -> None:
        self.stats["errors"] += 1
        self.stats["lastError"] = message
        self.stats["status"] = "error"

    def public_stats(self) -> dict:
        s = self.stats
        return {
            "calls": s["calls"], "errors": s["errors"], "tokens": s["tokens"],
            "avgMs": round(s["msTotal"] / s["calls"]) if s["calls"] else None,
            "status": s["status"], "lastError": s["lastError"], "model": s["lastModel"],
        }
