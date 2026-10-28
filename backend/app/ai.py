"""Itinerary generation via Google Gemini, with an offline fallback."""
import json
import logging
import random
import uuid

import httpx

from .config import settings
from .mock_planner import mock_day, mock_itinerary
from .prompts import SYSTEM_PROMPT, build_day_prompt, build_itinerary_prompt
from .schemas import Day, Itinerary, TripPreferences

log = logging.getLogger(__name__)

GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"


class AIError(RuntimeError):
    pass


async def _call_gemini(prompt: str) -> dict:
    body = {
        "systemInstruction": {"parts": [{"text": SYSTEM_PROMPT}]},
        "contents": [{"role": "user", "parts": [{"text": prompt}]}],
        "generationConfig": {"temperature": 0.8, "responseMimeType": "application/json"},
    }
    async with httpx.AsyncClient(timeout=90) as client:
        resp = await client.post(
            GEMINI_URL.format(model=settings.gemini_model),
            headers={"x-goog-api-key": settings.gemini_api_key},
            json=body,
        )
    if resp.status_code != 200:
        raise AIError(f"Gemini returned {resp.status_code}: {resp.text[:300]}")
    try:
        text = resp.json()["candidates"][0]["content"]["parts"][0]["text"]
        return json.loads(text)
    except (KeyError, IndexError, json.JSONDecodeError) as exc:
        raise AIError(f"Could not parse Gemini response: {exc}") from exc


def _with_ids(day: dict) -> dict:
    for act in day.get("activities", []):
        act["id"] = uuid.uuid4().hex[:10]
    day.setdefault("activities", []).sort(key=lambda a: a.get("time", ""))
    return day


async def generate_itinerary(p: TripPreferences) -> Itinerary:
    if not settings.ai_enabled:
        return mock_itinerary(p, seed=random.randint(0, 10_000))
    try:
        data = await _call_gemini(build_itinerary_prompt(p))
        data["days"] = [_with_ids(d) for d in data.get("days", [])]
        data["generated_by"] = settings.gemini_model
        return Itinerary.model_validate(data)
    except Exception as exc:  # network failure, quota, bad JSON, schema mismatch
        log.warning("AI generation failed, using offline planner: %s", exc)
        itinerary = mock_itinerary(p, seed=random.randint(0, 10_000))
        itinerary.summary = f"[AI unavailable: {str(exc)[:120]}] " + itinerary.summary
        return itinerary


async def regenerate_day(p: TripPreferences, itinerary: Itinerary, day_num: int, instructions: str | None) -> Day:
    day = next(d for d in itinerary.days if d.day == day_num)
    others = [d for d in itinerary.days if d.day != day_num]
    if settings.ai_enabled:
        try:
            data = _with_ids(await _call_gemini(build_day_prompt(p, day, others, instructions)))
            data["day"], data["date"] = day.day, day.date
            return Day.model_validate(data)
        except Exception as exc:
            log.warning("AI day regeneration failed, using offline planner: %s", exc)
    return mock_day(p, day, others, seed=random.randint(0, 10_000))
