# Wayfarer — Personalized Travel Itinerary Planner

A full-stack, AI-powered trip planner. Enter a destination, dates, budget, travel style and
interests, and it generates a day-by-day itinerary with attractions, dining, accommodation,
transport and estimated costs. Trips can be saved, edited, regenerated (whole trip or a
single day) and shared via a read-only link.

| Layer    | Tech |
|----------|------|
| Frontend | React 18 + Vite + React Router |
| Backend  | Python, FastAPI, Pydantic |
| AI       | Google Gemini (`gemini-2.5-flash`) via REST, JSON-mode prompt engineering |
| Database | Supabase (Postgres) — falls back to a local JSON file when not configured |

## Features

- **Smart trip builder** — solo / couple / family / group presets, pace (relaxed → packed),
  stay level (budget → premium), interests, free-text notes.
- **Group planning** — add each member's interests and budget cap; the prompt asks the AI to
  balance everyone's preferences across the days.
- **Interactive itinerary** — day tabs, timeline of activities, edit / add / remove activities
  (auto-saved), regenerate a single day with optional instructions ("more outdoors").
- **Budget tracker** — live total vs budget, per-person cost, breakdown by category.
- **Accommodation, transport & tips** panels.
- **SaaS dashboard** — saved trips, upcoming count, days planned.
- **Share links** — `/share/<id>` read-only view.
- **Works offline** — with no `GEMINI_API_KEY` an offline planner produces demo itineraries in
  the same format; if a Gemini call fails, the app falls back to it automatically.

## Project structure

```
travel-itinerary-planner/
├── backend/
│   ├── app/
│   │   ├── main.py          # FastAPI routes
│   │   ├── ai.py            # Gemini client + fallback
│   │   ├── prompts.py       # prompt engineering
│   │   ├── mock_planner.py  # offline planner
│   │   ├── storage.py       # Supabase / local JSON stores
│   │   ├── schemas.py       # Pydantic models
│   │   └── config.py
│   ├── tests/test_api.py
│   └── requirements.txt
├── frontend/                # React app
└── supabase/schema.sql      # trips table
```

## Setup

### 1. Backend

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate          # macOS/Linux: source .venv/bin/activate
pip install -r requirements.txt
copy .env.example .env          # macOS/Linux: cp .env.example .env
uvicorn app.main:app --reload --port 8000
```

API docs: http://127.0.0.1:8000/docs

### 2. Frontend

```bash
cd frontend
npm install
npm run dev
```

Open http://localhost:5173 (Vite proxies `/api` to the backend on port 8000).

### 3. Enable AI (optional)

Create a key at https://aistudio.google.com/apikey and set `GEMINI_API_KEY` in `backend/.env`.
Restart the backend; the sidebar shows `AI: gemini-2.5-flash` when it is active.

### 4. Enable Supabase (optional)

1. Create a project at https://supabase.com.
2. Open **SQL Editor** and run `supabase/schema.sql`.
3. In **Project Settings → API**, copy the project URL and the `service_role` key into
   `SUPABASE_URL` and `SUPABASE_SERVICE_KEY` in `backend/.env`.

The service key stays on the server — the browser only talks to FastAPI.

## API

| Method | Path | Description |
|--------|------|-------------|
| GET    | `/api/health` | AI + storage mode |
| POST   | `/api/itineraries/preview` | Generate without saving |
| GET    | `/api/trips` | List trips |
| POST   | `/api/trips` | Create + generate a trip |
| GET    | `/api/trips/{id}` | Get a trip |
| PATCH  | `/api/trips/{id}` | Update title / itinerary |
| DELETE | `/api/trips/{id}` | Delete |
| POST   | `/api/trips/{id}/regenerate` | Regenerate the whole itinerary |
| POST   | `/api/trips/{id}/days/{n}/regenerate` | Regenerate one day (`{"instructions": "..."}`) |
| GET    | `/api/shared/{share_id}` | Read-only shared trip |

## Tests

```bash
cd backend
python -m pytest -q
```

## Deployment

- **Backend**: Render / Railway / Google Cloud Run — start command
  `uvicorn app.main:app --host 0.0.0.0 --port $PORT`; set the `.env` variables and
  `CORS_ORIGINS` to your frontend URL.
- **Frontend**: Vercel / Netlify — build `npm run build`, output `dist/`, and set
  `VITE_API_URL` to the backend URL. Add a SPA rewrite so `/trips/*` and `/share/*` serve `index.html`.

## Limitations

- No user accounts: everyone using one backend sees the same trip list. Supabase Auth would be
  the next step for per-user trips.
- Costs are AI estimates, not live prices.
