import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, formatMoney } from "../api.js";
import Icon from "../components/Icon.jsx";

const INTERESTS = {
  sightseeing: "camera", food: "food", culture: "landmark", adventure: "mountain", nature: "leaf",
  shopping: "bag", nightlife: "moon", romantic: "heart", relaxation: "sun",
};
const CURRENCIES = ["INR", "USD", "EUR", "GBP", "AED", "SGD", "JPY", "AUD"];

const iso = (d) => d.toISOString().slice(0, 10);
const plusDays = (n) => iso(new Date(Date.now() + n * 864e5));

const PRESETS = {
  solo: { travelers: 1, pace: "balanced", stay: "budget", interests: ["food", "sightseeing"] },
  couple: { travelers: 2, pace: "relaxed", stay: "premium", interests: ["romantic", "nature"] },
  family: { travelers: 4, pace: "relaxed", stay: "mid-range", interests: ["sightseeing", "nature"] },
  group: { travelers: 4, pace: "packed", stay: "mid-range", interests: ["adventure", "culture"] },
};
const TYPES = [
  { id: "solo", icon: "user", label: "Solo", hint: "Your pace, your rules" },
  { id: "couple", icon: "heart", label: "Couple", hint: "Scenic & romantic" },
  { id: "family", icon: "home", label: "Family", hint: "Easy days for all ages" },
  { id: "group", icon: "users", label: "Group", hint: "Balance everyone's picks" },
];
const PACES = [
  { id: "relaxed", icon: "pace1", label: "Relaxed" },
  { id: "balanced", icon: "pace2", label: "Balanced" },
  { id: "packed", icon: "pace3", label: "Packed" },
];
const STAYS = [
  { id: "budget", icon: "bed", label: "Budget" },
  { id: "mid-range", icon: "building", label: "Mid-range" },
  { id: "premium", icon: "star", label: "Premium" },
];
const LOADING_LINES = [
  "Scouting the best neighbourhoods…", "Finding where the locals eat…",
  "Mapping routes to save you time…", "Balancing your budget…", "Adding a few hidden gems…",
];

export default function NewTrip() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    title: "", destination: "", origin: "",
    start_date: plusDays(14), end_date: plusDays(16),
    budget: 25000, currency: "INR", trip_type: "solo", notes: "",
    ...PRESETS.solo,
  });
  const [members, setMembers] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.type === "number" ? Number(e.target.value) : e.target.value }));
  const toggle = (list, item) => (list.includes(item) ? list.filter((i) => i !== item) : [...list, item]);
  const nights = Math.max(0, Math.round((new Date(form.end_date) - new Date(form.start_date)) / 864e5));

  function pickType(type) {
    setForm((f) => ({ ...f, trip_type: type, ...PRESETS[type] }));
    if ((type === "group" || type === "family") && members.length === 0) {
      setMembers([{ name: "", interests: [] }, { name: "", interests: [] }]);
    }
  }

  async function submit(e) {
    e.preventDefault();
    setError("");
    setBusy(true);
    const { title, origin, notes, ...prefs } = form;
    try {
      const trip = await api.createTrip(
        {
          ...prefs,
          origin: origin || null,
          notes: notes || null,
          members: members
            .filter((m) => m.name.trim())
            .map((m) => ({ ...m, max_budget: m.max_budget ? Number(m.max_budget) : null })),
        },
        title || null
      );
      navigate(`/trips/${trip.id}`);
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  const showMembers = form.trip_type === "group" || form.trip_type === "family";

  return (
    <>
      {busy && <PlanningOverlay destination={form.destination} />}
      <header className="page-head">
        <div>
          <span className="eyebrow">Trip builder</span>
          <h1>Plan a new trip</h1>
          <p className="muted">A few details and we'll build a balanced, day-by-day itinerary.</p>
        </div>
      </header>

      <form className="builder" onSubmit={submit}>
        <section className="card">
          <Step n={1} title="Who's travelling?" />
          <div className="type-grid">
            {TYPES.map((t) => (
              <button type="button" key={t.id} className={`type-card ${form.trip_type === t.id ? "active" : ""}`}
                aria-pressed={form.trip_type === t.id} onClick={() => pickType(t.id)}>
                <span className="type-icon"><Icon name={t.icon} size={20} /></span>
                <strong>{t.label}</strong>
                <small>{t.hint}</small>
              </button>
            ))}
          </div>
          <label className="inline-label">
            Number of travelers
            <div className="stepper">
              <button type="button" aria-label="Fewer travelers" onClick={() => setForm((f) => ({ ...f, travelers: Math.max(1, f.travelers - 1) }))}>−</button>
              <input type="number" min="1" max="30" value={form.travelers} onChange={set("travelers")} />
              <button type="button" aria-label="More travelers" onClick={() => setForm((f) => ({ ...f, travelers: Math.min(30, f.travelers + 1) }))}>+</button>
            </div>
          </label>
        </section>

        <section className="card">
          <Step n={2} title="Where & when" />
          <div className="grid-2">
            <label className="span-full">
              Destination
              <div className="input-icon">
                <Icon name="pin" size={16} />
                <input required minLength={2} placeholder="Goa, Kyoto, Lisbon…" value={form.destination} onChange={set("destination")} />
              </div>
            </label>
            <label>
              <span>Starting from <span className="optional">optional</span></span>
              <div className="input-icon">
                <Icon name="home" size={16} />
                <input placeholder="e.g. Mumbai" value={form.origin} onChange={set("origin")} />
              </div>
            </label>
            <label>
              <span>Trip name <span className="optional">optional</span></span>
              <input placeholder="Auto-generated if empty" value={form.title} onChange={set("title")} />
            </label>
            <label>
              Start date
              <input type="date" required value={form.start_date} onChange={set("start_date")} />
            </label>
            <label>
              End date
              <input type="date" required min={form.start_date} value={form.end_date} onChange={set("end_date")} />
            </label>
          </div>
        </section>

        <section className="card">
          <Step n={3} title="Budget & style" />
          <label>
            Total budget for the whole group
            <div className="input-group">
              <select value={form.currency} onChange={set("currency")} aria-label="Currency">
                {CURRENCIES.map((c) => <option key={c}>{c}</option>)}
              </select>
              <input type="number" min="1" required value={form.budget} onChange={set("budget")} />
            </div>
          </label>
          <div className="grid-2 gap-top">
            <div>
              <span className="label">Pace</span>
              <div className="segmented">
                {PACES.map((o) => (
                  <button type="button" key={o.id} aria-pressed={form.pace === o.id} className={form.pace === o.id ? "active" : ""}
                    onClick={() => setForm((f) => ({ ...f, pace: o.id }))}>
                    <Icon name={o.icon} size={15} /> {o.label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <span className="label">Stay</span>
              <div className="segmented">
                {STAYS.map((o) => (
                  <button type="button" key={o.id} aria-pressed={form.stay === o.id} className={form.stay === o.id ? "active" : ""}
                    onClick={() => setForm((f) => ({ ...f, stay: o.id }))}>
                    <Icon name={o.icon} size={15} /> {o.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <span className="label">Interests</span>
          <div className="chips">
            {Object.entries(INTERESTS).map(([i, iconName]) => (
              <button type="button" key={i} aria-pressed={form.interests.includes(i)} className={`chip ${form.interests.includes(i) ? "on" : ""}`}
                onClick={() => setForm((f) => ({ ...f, interests: toggle(f.interests, i) }))}>
                <Icon name={iconName} size={15} /> {i}
              </button>
            ))}
          </div>
        </section>

        {showMembers && (
          <section className="card">
            <Step n={4} title="Group preferences" sub="Add each person's interests — the planner balances them across the days." />
            <div className="members">
              {members.map((m, idx) => (
                <div key={idx} className="member">
                  <div className="member-row">
                    <span className="avatar" aria-hidden="true">{(m.name || "?").charAt(0).toUpperCase()}</span>
                    <input placeholder={`Member ${idx + 1} name`} value={m.name} aria-label={`Member ${idx + 1} name`}
                      onChange={(e) => setMembers((ms) => ms.map((x, i) => (i === idx ? { ...x, name: e.target.value } : x)))} />
                    <input type="number" min="0" placeholder="Budget cap" value={m.max_budget ?? ""} aria-label={`Member ${idx + 1} budget cap`}
                      onChange={(e) => setMembers((ms) => ms.map((x, i) => (i === idx ? { ...x, max_budget: e.target.value } : x)))} />
                    <button type="button" className="icon-btn" aria-label={`Remove member ${idx + 1}`}
                      onClick={() => setMembers((ms) => ms.filter((_, i) => i !== idx))}><Icon name="x" size={16} /></button>
                  </div>
                  <div className="chips small">
                    {Object.entries(INTERESTS).map(([i, iconName]) => (
                      <button type="button" key={i} aria-pressed={m.interests.includes(i)} className={`chip ${m.interests.includes(i) ? "on" : ""}`}
                        onClick={() => setMembers((ms) => ms.map((x, j) => (j === idx ? { ...x, interests: toggle(x.interests, i) } : x)))}>
                        <Icon name={iconName} size={15} /> {i}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <button type="button" className="btn ghost" onClick={() => setMembers((ms) => [...ms, { name: "", interests: [] }])}>
              + Add member
            </button>
          </section>
        )}

        <section className="card">
          <Step n={showMembers ? 5 : 4} title="Anything else?" sub="Dietary needs, must-see places, accessibility — the AI will factor it in." />
          <textarea rows="3" placeholder="e.g. vegetarian, want to see Amber Fort, no early mornings" value={form.notes} onChange={set("notes")} />
        </section>

        {error && <div className="alert">{error}</div>}

        <div className="builder-bar">
          <div className="builder-summary">
            <strong>{form.destination || "Your destination"}</strong>
            <span className="muted">
              {nights + 1} day{nights ? "s" : ""} · {form.travelers} {form.travelers > 1 ? "travelers" : "traveler"} · {formatMoney(form.budget, form.currency)}
            </span>
          </div>
          <button className="btn primary large" disabled={busy}><Icon name="sparkle" size={16} /> Generate itinerary</button>
        </div>
      </form>
    </>
  );
}

function Step({ n, title, sub }) {
  return (
    <div className="step-head">
      <span className="step-num">{n}</span>
      <div><h2>{title}</h2>{sub && <p className="muted">{sub}</p>}</div>
    </div>
  );
}

function PlanningOverlay({ destination }) {
  const [i, setI] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setI((n) => (n + 1) % LOADING_LINES.length), 1800);
    return () => clearInterval(t);
  }, []);
  return (
    <div className="overlay" role="status" aria-live="polite">
      <div className="overlay-card">
        <div className="loader"><Icon name="plane" size={22} /></div>
        <h2>Planning {destination || "your trip"}</h2>
        <p className="muted">{LOADING_LINES[i]}</p>
      </div>
    </div>
  );
}
