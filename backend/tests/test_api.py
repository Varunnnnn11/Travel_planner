import os
import tempfile
from pathlib import Path

# Force offline planner + temp local store before the app is imported.
os.environ["GEMINI_API_KEY"] = ""
os.environ["SUPABASE_URL"] = ""
os.environ["LOCAL_DB_PATH"] = str(Path(tempfile.mkdtemp()) / "trips.json")

from fastapi.testclient import TestClient  # noqa: E402

from app.main import app  # noqa: E402

client = TestClient(app)

PREFS = {
    "destination": "Jaipur",
    "start_date": "2026-12-05",
    "end_date": "2026-12-07",
    "budget": 30000,
    "currency": "INR",
    "travelers": 3,
    "trip_type": "group",
    "pace": "balanced",
    "stay": "mid-range",
    "interests": ["food"],
    "members": [{"name": "Riya", "interests": ["culture"]}, {"name": "Dev", "interests": ["adventure"]}],
}


def test_health():
    assert client.get("/api/health").json()["storage"] == "local-json"


def test_trip_lifecycle():
    r = client.post("/api/trips", json={"preferences": PREFS})
    assert r.status_code == 201, r.text
    trip = r.json()
    assert len(trip["itinerary"]["days"]) == 3
    assert trip["title"] == "3 days in Jaipur"
    it = trip["itinerary"]
    spend = sum(a["estimated_cost"] for d in it["days"] for a in d["activities"])
    spend += it["accommodation"][0]["price_per_night"] * (len(it["days"]) - 1)
    assert spend <= PREFS["budget"]

    assert [t["id"] for t in client.get("/api/trips").json()] == [trip["id"]]
    assert client.get(f"/api/shared/{trip['share_id']}").json()["id"] == trip["id"]

    before = trip["itinerary"]["days"][1]["activities"]
    r = client.post(f"/api/trips/{trip['id']}/days/2/regenerate", json={})
    assert r.status_code == 200
    days = r.json()["itinerary"]["days"]
    assert days[1]["day"] == 2 and days[1]["date"] == "2026-12-06"
    assert days[0] == trip["itinerary"]["days"][0]  # other days untouched
    assert len(before) > 0

    r = client.patch(f"/api/trips/{trip['id']}", json={"title": "Pink City"})
    assert r.json()["title"] == "Pink City"

    assert client.delete(f"/api/trips/{trip['id']}").status_code == 204
    assert client.get(f"/api/trips/{trip['id']}").status_code == 404


def test_rejects_bad_dates():
    bad = {**PREFS, "end_date": "2026-12-01"}
    assert client.post("/api/trips", json={"preferences": bad}).status_code == 422


def test_unknown_day():
    trip = client.post("/api/trips", json={"preferences": PREFS}).json()
    assert client.post(f"/api/trips/{trip['id']}/days/9/regenerate").status_code == 404
