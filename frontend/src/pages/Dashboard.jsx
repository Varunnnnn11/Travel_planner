import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, coverStyle, daysUntil, formatMoney, tripCosts } from "../api.js";
import Icon from "../components/Icon.jsx";

const TYPE_ICON = { solo: "user", couple: "heart", family: "home", group: "users" };

export default function Dashboard() {
  const [trips, setTrips] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api.listTrips().then(setTrips).catch((e) => setError(e.message));
  }, []);

  async function remove(id) {
    if (!confirm("Delete this trip?")) return;
    await api.deleteTrip(id);
    setTrips((t) => t.filter((x) => x.id !== id));
  }

  const upcoming = trips?.filter((t) => daysUntil(t.preferences.start_date) >= 0) ?? [];
  const next = [...upcoming].sort((a, b) => a.preferences.start_date.localeCompare(b.preferences.start_date))[0];
  const totalDays = trips?.reduce((s, t) => s + t.itinerary.days.length, 0) ?? 0;
  const places = new Set(trips?.map((t) => t.preferences.destination.toLowerCase())).size;

  return (
    <>
      <section className="hero">
        <div className="hero-text">
          <span className="eyebrow">AI travel planner</span>
          <h1>Where to next?</h1>
          <p>Tell us your budget, pace and interests. Get a day-by-day plan with places to see, eat and stay — then tweak it until it's perfect.</p>
          <div className="hero-actions">
            <Link className="btn primary large" to="/new">Plan a trip <Icon name="arrow" size={16} /></Link>
            {next && (
              <Link className="btn on-dark large" to={`/trips/${next.id}`}>
                Next up: {next.preferences.destination}
              </Link>
            )}
          </div>
        </div>
        <HeroArt />
      </section>

      {error && <div className="alert">{error}</div>}

      <section className="stats">
        <Stat icon="suitcase" label="Saved trips" value={trips?.length} />
        <Stat icon="calendar" label="Upcoming" value={trips && upcoming.length} />
        <Stat icon="map" label="Days planned" value={trips && totalDays} />
        <Stat icon="pin" label="Destinations" value={trips && places} />
      </section>

      <div className="section-head">
        <h2>Your trips</h2>
        {trips?.length > 0 && <span className="muted">{trips.length} saved</span>}
      </div>

      {trips && trips.length === 0 && (
        <div className="empty card">
          <div className="empty-art"><Icon name="map" size={34} /></div>
          <h3>Your passport is empty</h3>
          <p className="muted">Plan your first trip and it'll show up here, ready to edit, regenerate or share.</p>
          <Link className="btn primary" to="/new">Plan your first trip</Link>
        </div>
      )}

      {!trips && !error && (
        <div className="trip-grid">{[0, 1, 2].map((i) => <div key={i} className="card skeleton" />)}</div>
      )}

      <section className="trip-grid">
        {trips?.map((t) => {
          const { total } = tripCosts(t);
          const p = t.preferences;
          const until = daysUntil(p.start_date);
          const pct = Math.min((total / p.budget) * 100, 100);
          return (
            <article key={t.id} className="trip-card">
              <Link to={`/trips/${t.id}`} className="trip-card-link">
                <div className="trip-cover" style={coverStyle(p.destination)}>
                  <span className="cover-chip">
                    {until > 0 ? `In ${until} day${until === 1 ? "" : "s"}` : until === 0 ? "Today!" : "Past trip"}
                  </span>
                  <span className="cover-icon"><Icon name={TYPE_ICON[p.trip_type]} size={20} /></span>
                  <strong className="cover-title">{p.destination}</strong>
                </div>
                <div className="trip-card-body">
                  <h3>{t.title}</h3>
                  <p className="muted">
                    {fmtDate(p.start_date)} – {fmtDate(p.end_date)} · {p.travelers} {p.travelers > 1 ? "travelers" : "traveler"}
                  </p>
                  <div className="mini-budget">
                    <div className="bar"><div className={total > p.budget ? "over" : ""} style={{ width: `${pct}%` }} /></div>
                    <span>{formatMoney(total, p.currency)} <span className="muted">/ {formatMoney(p.budget, p.currency)}</span></span>
                  </div>
                </div>
              </Link>
              <button className="icon-btn trip-delete" aria-label={`Delete ${t.title}`} onClick={() => remove(t.id)}><Icon name="trash" size={16} /></button>
            </article>
          );
        })}
      </section>
    </>
  );
}

const fmtDate = (d) => new Date(d + "T00:00").toLocaleDateString(undefined, { day: "numeric", month: "short" });

function Stat({ icon, label, value }) {
  return (
    <div className="card stat">
      <span className="stat-icon"><Icon name={icon} size={20} /></span>
      <div>
        <strong>{value ?? "–"}</strong>
        <span className="muted">{label}</span>
      </div>
    </div>
  );
}

function HeroArt() {
  return (
    <svg className="hero-art" viewBox="0 0 360 220" fill="none" aria-hidden="true">
      <circle cx="262" cy="78" r="34" stroke="#D6470F" strokeWidth="2" />
      <path d="M10 200 L85 112 L135 160 L205 80 L285 170 L350 120" stroke="rgba(237,239,240,.55)" strokeWidth="2" strokeLinejoin="round" />
      <path d="M10 200 H350" stroke="rgba(237,239,240,.25)" strokeWidth="2" />
      <path d="M30 140 C 90 60, 180 36, 300 30" stroke="rgba(237,239,240,.45)" strokeWidth="1.6" strokeDasharray="4 7" />
      <path d="M318 22 l-24 9 10 4 4 10z" stroke="#EDEFF0" strokeWidth="1.8" strokeLinejoin="round" />
    </svg>
  );
}
