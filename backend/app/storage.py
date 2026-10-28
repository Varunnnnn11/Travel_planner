"""Trip persistence: Supabase (PostgREST) when configured, local JSON file otherwise."""
import asyncio
import json
from typing import Protocol

import httpx

from .config import settings


class TripStore(Protocol):
    async def list(self) -> list[dict]: ...
    async def get(self, trip_id: str) -> dict | None: ...
    async def get_by_share(self, share_id: str) -> dict | None: ...
    async def insert(self, row: dict) -> dict: ...
    async def update(self, trip_id: str, fields: dict) -> dict | None: ...
    async def delete(self, trip_id: str) -> bool: ...


class SupabaseStore:
    """Talks to the `trips` table through Supabase's REST API using the service key."""

    def __init__(self, url: str, key: str):
        self.endpoint = f"{url}/rest/v1/trips"
        self.headers = {
            "apikey": key,
            "Authorization": f"Bearer {key}",
            "Content-Type": "application/json",
            "Prefer": "return=representation",
        }

    async def _req(self, method: str, params: dict | None = None, body: dict | None = None) -> list[dict]:
        async with httpx.AsyncClient(timeout=20) as client:
            resp = await client.request(method, self.endpoint, headers=self.headers, params=params, json=body)
        resp.raise_for_status()
        return resp.json() if resp.content else []

    async def list(self):
        return await self._req("GET", {"select": "*", "order": "updated_at.desc"})

    async def get(self, trip_id):
        rows = await self._req("GET", {"select": "*", "id": f"eq.{trip_id}"})
        return rows[0] if rows else None

    async def get_by_share(self, share_id):
        rows = await self._req("GET", {"select": "*", "share_id": f"eq.{share_id}"})
        return rows[0] if rows else None

    async def insert(self, row):
        return (await self._req("POST", body=row))[0]

    async def update(self, trip_id, fields):
        rows = await self._req("PATCH", {"id": f"eq.{trip_id}"}, fields)
        return rows[0] if rows else None

    async def delete(self, trip_id):
        return bool(await self._req("DELETE", {"id": f"eq.{trip_id}"}))


class LocalJSONStore:
    """Single-file JSON store for local development without Supabase."""

    def __init__(self, path):
        self.path = path
        self.lock = asyncio.Lock()

    def _read(self) -> dict[str, dict]:
        if not self.path.exists():
            return {}
        return json.loads(self.path.read_text(encoding="utf-8") or "{}")

    def _write(self, data: dict[str, dict]) -> None:
        self.path.parent.mkdir(parents=True, exist_ok=True)
        tmp = self.path.with_suffix(".tmp")
        tmp.write_text(json.dumps(data, indent=2), encoding="utf-8")
        tmp.replace(self.path)

    async def list(self):
        return sorted(self._read().values(), key=lambda r: r["updated_at"], reverse=True)

    async def get(self, trip_id):
        return self._read().get(trip_id)

    async def get_by_share(self, share_id):
        return next((r for r in self._read().values() if r["share_id"] == share_id), None)

    async def insert(self, row):
        async with self.lock:
            data = self._read()
            data[row["id"]] = row
            self._write(data)
        return row

    async def update(self, trip_id, fields):
        async with self.lock:
            data = self._read()
            if trip_id not in data:
                return None
            data[trip_id].update(fields)
            self._write(data)
            return data[trip_id]

    async def delete(self, trip_id):
        async with self.lock:
            data = self._read()
            if data.pop(trip_id, None) is None:
                return False
            self._write(data)
            return True


def make_store() -> TripStore:
    if settings.supabase_enabled:
        return SupabaseStore(settings.supabase_url, settings.supabase_key)
    return LocalJSONStore(settings.local_db_path)
