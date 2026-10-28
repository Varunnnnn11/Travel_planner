# Wayfarer — Project Walkthrough

Wayfarer is a full-stack, AI-powered travel itinerary planner. A traveler describes a
trip (destination, dates, budget, group, pace, stay level, interests) and gets a
day-by-day plan with attractions, meals, activities, accommodation, transport and
estimated costs. Plans can be saved, edited, regenerated one day at a time, and shared.

- **Repository:** https://github.com/akshatbagora8389-droid/wayfarer

---

## 1. Architecture

```
┌──────────────────────┐   /api/*   ┌──────────────────────────┐   REST (service key)  ┌──────────────┐
│  React + Vite (5173) │ ─────────► │  FastAPI backend (8000)  │ ────────────────────► │   Supabase   │
│  Dashboard, Builder, │ ◄───────── │  validation · prompts ·  │ ◄──────────────────── │  trips table │
│  Itinerary, Share    │    JSON    │  storage · AI fallback   │                       └──────────────┘
└──────────────────────┘            └────────────┬─────────────┘
                                                 │ JSON-mode prompt
                                                 ▼
                                    ┌──────────────────────────┐
                                    │ Google Gemini 2.5 Flash  │
                                    │ (offline planner if no   │
                                    │  key or the call fails)  │
                                    └──────────────────────────┘
```

| Layer | Files | Responsibility |
|---|---|---|
| Frontend | `frontend/src/pages/*`, `components/*` | Dashboard, trip builder, itinerary view, share page |
| API | `backend/app/main.py` | REST endpoints, error handling |
| Validation | `backend/app/schemas.py` | Pydantic models for preferences and itineraries |
| Prompting | `backend/app/prompts.py` | Turns preferences into a structured prompt |
| AI | `backend/app/ai.py` | Calls Gemini in JSON mode; falls back to the offline planner |
| Offline planner | `backend/app/mock_planner.py` | Deterministic, budget-aware plans for demos without a key |
| Storage | `backend/app/storage.py` | Supabase store, or a local JSON file when Supabase isn't configured |
| Database | `supabase/schema.sql` | `trips` table, RLS, service-role-only access |

The browser never talks to Supabase or Gemini directly; all secrets stay in `backend/.env`.

---

## 2. Walkthrough of the app

### Dashboard
- Stats: saved trips, upcoming trips, days planned, destinations.
- One card per trip: destination, countdown, dates, travelers, and estimated cost against budget.
- **Plan a trip** opens the builder; **Next up** jumps to the soonest trip.

### Trip builder (5 steps)
1. **Who's travelling** — Solo, Couple, Family or Group. Each preset sets sensible defaults
   (e.g. Couple → relaxed pace, premium stay, romantic + nature).
2. **Where & when** — destination, starting city, dates (up to 14 days).
3. **Budget & style** — total budget and currency, pace (relaxed / balanced / packed),
   stay level (budget / mid-range / premium), shared interests.
4. **Group preferences** (family/group) — each member's name, interests and optional budget cap.
5. **Anything else** — free-text notes (dietary needs, must-sees, accessibility).

A summary bar shows destination, days, travelers and budget; **Generate itinerary** creates and saves the trip.

### Itinerary view
- **Header** — editable title, dates, travelers, pace, stay, group members; Share, Regenerate trip, Delete.
- **Summary** of the whole trip.
- **Day tabs** and a **timeline** per day: time, category, title, notes, location, duration, cost.
- **Edit / add / remove stops** — changes save immediately.
- **Regenerate day** with an optional instruction ("more outdoor time", "cheaper food");
  the other days are untouched, and the AI is told not to repeat places used elsewhere.
- **Budget panel** — total vs budget, % used, per-person cost, breakdown by category.
- **Where to stay**, **Getting there & around**, **Good to know** tips.

### Share
**Share** copies a read-only link (`/share/<id>`) that anyone can open without editing rights.

---

## 3. How it maps to the three scenarios

| Scenario | What the user does | What Wayfarer provides |
|---|---|---|
| **1. Solo weekend** | Picks Solo, enters destination, budget, dates, food + sightseeing | A balanced plan with affordable dining and nearby attractions grouped by area |
| **2. Couple's vacation** | Picks Couple (relaxed, premium, romantic, scenic) | Curated restaurants and experiences; they edit stops, regenerate individual days, and track cost |
| **3. Group trip** | Picks Group, adds each member's interests and budget cap | A plan that balances everyone's interests across days within the group budget, shareable with one link |

---

## 4. How the AI generation works

1. The builder sends `TripPreferences` to `POST /api/trips`.
2. Pydantic validates it (dates in order, ≤ 14 days, positive budget, 1–30 travelers).
3. `prompts.py` builds the prompt:
   - a **system instruction**: expert planner, real places, group nearby places on the same day,
     always include meals, stay within budget, costs for the whole party, JSON only;
   - the **traveler block**: destination, dates, party, budget, pace guidance
     (e.g. *relaxed = 3–4 activities, long breaks*), stay level, combined interests,
     each member's interests and budget cap, notes;
   - the exact **JSON shape** to return.
4. `ai.py` calls Gemini with `responseMimeType: application/json`, adds IDs to activities,
   sorts by time, and validates the result against the `Itinerary` model.
5. If there is no API key, the network fails, or the response doesn't match the schema,
   the **offline planner** returns a plan of the same shape, so the app never breaks.
6. The trip is stored in Supabase and returned to the UI.

**Regenerate day** sends the same traveler block, plus the current day's theme, the places
already used on other days (to avoid repeats) and the user's instruction.

---

## 5. Data model

`trips` table (`supabase/schema.sql`):

| Column | Type | Notes |
|---|---|---|
| `id` | uuid | primary key |
| `share_id` | text, unique | random token for read-only links |
| `title` | text | editable |
| `preferences` | jsonb | everything from the builder |
| `itinerary` | jsonb | summary, days → activities, accommodation, transportation, tips |
| `created_at`, `updated_at` | timestamptz | |

**Security:** Row Level Security is on; only the backend's `service_role` key can read or
write the table, and the public `anon` key is explicitly revoked.

---

## 6. API

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/health` | Shows AI mode and storage mode |
| POST | `/api/trips` | Create + generate a trip |
| GET | `/api/trips` · `/api/trips/{id}` | List / get trips |
| PATCH | `/api/trips/{id}` | Update title or itinerary (edits) |
| DELETE | `/api/trips/{id}` | Delete |
| POST | `/api/trips/{id}/regenerate` | Regenerate the whole trip |
| POST | `/api/trips/{id}/days/{n}/regenerate` | Regenerate one day, with optional instructions |
| GET | `/api/shared/{share_id}` | Read-only shared trip |
| POST | `/api/itineraries/preview` | Generate without saving |

Interactive docs: http://127.0.0.1:8000/docs

---

## 7. Reliability details

- Supabase requests reuse one pooled connection and retry reads, edits and deletes on
  network errors; inserts aren't retried, to avoid duplicates.
- Database outages return a clear `503 Couldn't reach the database` instead of crashing.
- AI failures fall back to the offline planner, with the reason noted in the trip summary.
- Backend tests (`backend/tests/test_api.py`) cover the trip lifecycle, budget limits,
  day regeneration, sharing and validation.

---

## 8. Demo script

A scene-by-scene script for presenting the project or recording a demo: read one line per
scene while doing the action on screen. With Gemini connected, generating a trip takes
roughly 15–35 seconds, so pause on the "Planning…" screen at step 7.

| # | On screen | Narration |
|---|---|---|
| 1 | Dashboard banner | This is Wayfarer, a personalized travel itinerary planner. It's a full-stack app with a React front end, a FastAPI back end, Supabase for storage, and generative AI for planning. |
| 2 | Stats and trip cards | The dashboard shows your saved trips at a glance: how many are coming up, how many days are planned, and each trip's estimated cost against its budget. |
| 3 | Plan a trip → Group | Let's plan a group trip. Four friends want a long weekend in Rishikesh, so we pick Group and set four travelers. |
| 4 | Destination, origin, dates | We enter the destination, the starting city and the travel dates. |
| 5 | Budget, pace, stay, interests | Then the budget and travel style: a total budget for the whole group, the pace, the kind of stay, and the interests everyone shares. |
| 6 | Group members | Each friend can add their own interests. The planner balances everyone's preferences across the days, so nobody's left out. |
| 7 | Notes → Generate | We add a note and generate. The back end turns these preferences into a structured prompt and gets back a day-by-day plan. |
| 8 | Trip header, timeline | Here's the plan. Each day has a theme and a timeline of stops: sights, meals and activities, with times, durations and estimated costs. |
| 9 | Day tabs | We can switch between days to see the whole trip. |
| 10 | Budget panel, side cards | Alongside, the budget panel tracks estimated spend against the budget, the cost per person, and a breakdown by category, with places to stay, transport and travel tips. |
| 11 | Edit a stop | Everything is editable. Here we change a stop's details, and the change is saved to Supabase straight away. |
| 12 | Regenerate day | If a day doesn't feel right, we can regenerate just that day with an instruction, like more outdoor time, without touching the rest of the trip. |
| 13 | Share link | Share creates a read-only link, so the whole group can open the same plan. |
| 14 | Back to dashboard | That's Wayfarer: personalized, budget-aware itineraries in seconds, saved to Supabase, and easy to refine and share. Thanks for watching. |
