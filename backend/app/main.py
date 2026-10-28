"""FastAPI entrypoint for the Personalized Travel Itinerary Planner."""
import logging
import secrets
import uuid
from datetime import datetime, timezone

import httpx
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, RedirectResponse

from .ai import generate_itinerary, regenerate_day
from .config import settings
from .schemas import Itinerary, RegenerateRequest, Trip, TripCreate, TripPreferences, TripUpdate
from .storage import make_store

log = logging.getLogger(__name__)
app = FastAPI(title="Travel Itinerary Planner API", version="1.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_methods=["*"],
    allow_headers=["*"],
)
store = make_store()


@app.exception_handler(httpx.TransportError)
async def storage_unreachable(_request, exc: httpx.TransportError):
    log.warning("Storage request failed: %r", exc)
    return JSONResponse(status_code=503, content={"detail": "Couldn't reach the database. Please try again."})


@app.exception_handler(httpx.HTTPStatusError)
async def storage_error(_request, exc: httpx.HTTPStatusError):
    log.error("Storage returned %s: %s", exc.response.status_code, exc.response.text[:300])
    return JSONResponse(status_code=502, content={"detail": "The database rejected the request."})


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


async def _load(trip_id: str) -> Trip:
    row = await store.get(trip_id)
    if not row:
        raise HTTPException(404, "Trip not found")
    return Trip.model_validate(row)


@app.get("/", include_in_schema=False)
async def root():
    # The UI is the React app (port 5173); the API root just points at its docs.
    return RedirectResponse("/docs")


@app.get("/api/health")
async def health():
    return {
        "status": "ok",
        "ai": settings.gemini_model if settings.ai_enabled else "offline-planner",
        "storage": "supabase" if settings.supabase_enabled else "local-json",
    }


@app.post("/api/itineraries/preview", response_model=Itinerary)
async def preview(prefs: TripPreferences):
    """Generate an itinerary without saving it."""
    return await generate_itinerary(prefs)


@app.get("/api/trips", response_model=list[Trip])
async def list_trips():
    return await store.list()


@app.post("/api/trips", response_model=Trip, status_code=201)
async def create_trip(payload: TripCreate):
    p = payload.preferences
    itinerary = await generate_itinerary(p)
    now = _now()
    trip = Trip(
        id=str(uuid.uuid4()),
        share_id=secrets.token_urlsafe(8),
        title=payload.title or f"{p.num_days} days in {p.destination}",
        preferences=p,
        itinerary=itinerary,
        created_at=now,
        updated_at=now,
    )
    return await store.insert(trip.model_dump(mode="json"))


@app.get("/api/trips/{trip_id}", response_model=Trip)
async def get_trip(trip_id: str):
    return await _load(trip_id)


@app.get("/api/shared/{share_id}", response_model=Trip)
async def get_shared(share_id: str):
    row = await store.get_by_share(share_id)
    if not row:
        raise HTTPException(404, "Shared trip not found")
    return row


@app.patch("/api/trips/{trip_id}", response_model=Trip)
async def update_trip(trip_id: str, payload: TripUpdate):
    await _load(trip_id)
    fields = payload.model_dump(mode="json", exclude_none=True)
    fields["updated_at"] = _now()
    return await store.update(trip_id, fields)


@app.delete("/api/trips/{trip_id}", status_code=204)
async def delete_trip(trip_id: str):
    if not await store.delete(trip_id):
        raise HTTPException(404, "Trip not found")


@app.post("/api/trips/{trip_id}/regenerate", response_model=Trip)
async def regenerate_trip(trip_id: str):
    trip = await _load(trip_id)
    itinerary = await generate_itinerary(trip.preferences)
    return await store.update(trip_id, {"itinerary": itinerary.model_dump(mode="json"), "updated_at": _now()})


@app.post("/api/trips/{trip_id}/days/{day_num}/regenerate", response_model=Trip)
async def regenerate_trip_day(trip_id: str, day_num: int, payload: RegenerateRequest | None = None):
    trip = await _load(trip_id)
    if not any(d.day == day_num for d in trip.itinerary.days):
        raise HTTPException(404, f"Day {day_num} not in this trip")
    new_day = await regenerate_day(trip.preferences, trip.itinerary, day_num,
                                   payload.instructions if payload else None)
    trip.itinerary.days = [new_day if d.day == day_num else d for d in trip.itinerary.days]
    return await store.update(trip_id, {"itinerary": trip.itinerary.model_dump(mode="json"), "updated_at": _now()})
