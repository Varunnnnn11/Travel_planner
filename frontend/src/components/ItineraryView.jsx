import { useState } from "react";
import { CATEGORY_META, coverStyle, formatMoney, tripCosts } from "../api.js";
import Icon from "./Icon.jsx";

const CATEGORIES = ["attraction", "dining", "activity", "transport", "shopping", "nightlife"];
const icon = (c) => CATEGORY_META[c]?.icon || "pin";
const fmtDate = (d) => new Date(d + "T00:00").toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });

/** Destination cover banner shown at the top of a trip; children render the title + actions. */
export function TripHero({ trip, children }) {
  const p = trip.preferences;
  return (
    <header className="trip-hero" style={coverStyle(p.destination)}>
      <span className="eyebrow light">{p.destination}</span>
      {children}
      <div className="hero-chips">
        <span><Icon name="calendar" size={14} /> {fmtDate(p.start_date)} – {fmtDate(p.end_date)}</span>
        <span><Icon name="users" size={14} /> {p.travelers} {p.travelers > 1 ? "travelers" : "traveler"}</span>
        <span className="cap"><Icon name="clock" size={14} /> {p.pace} pace</span>
        <span className="cap"><Icon name="bed" size={14} /> {p.stay}</span>
        {p.members?.length > 0 && <span><Icon name="user" size={14} /> {p.members.map((m) => m.name).join(", ")}</span>}
      </div>
    </header>
  );
}

/**
 * Renders a trip's itinerary. When `onChange` is given the itinerary is editable;
 * `onRegenerateDay` enables per-day AI regeneration.
 */
export default function ItineraryView({ trip, onChange, onRegenerateDay, busyDay }) {
  const [active, setActive] = useState(0);
  const [editing, setEditing] = useState(null);
  const [instructions, setInstructions] = useState("");
  const { itinerary, preferences: p } = trip;
  const day = itinerary.days[Math.min(active, itinerary.days.length - 1)];
  const editable = Boolean(onChange);
  const money = (v) => formatMoney(v, p.currency);

  function updateDay(fn) {
    const days = itinerary.days.map((d) => (d.day === day.day ? fn(d) : d));
    onChange({ ...itinerary, days });
  }

  function saveActivity(act) {
    updateDay((d) => {
      const exists = d.activities.some((a) => a.id === act.id);
      const activities = exists ? d.activities.map((a) => (a.id === act.id ? act : a)) : [...d.activities, act];
      return { ...d, activities: activities.sort((a, b) => a.time.localeCompare(b.time)) };
    });
    setEditing(null);
  }

  const dayTotal = day.activities.reduce((s, a) => s + Number(a.estimated_cost || 0), 0);
  const dayHours = Math.round(day.activities.reduce((s, a) => s + Number(a.duration_minutes || 0), 0) / 60);
  const regenerating = busyDay === day.day;

  return (
    <div className="itinerary">
      <div className="itinerary-main">
        <div className="summary">
          <span className="summary-icon"><Icon name="sparkle" size={18} /></span>
          <p>{itinerary.summary}</p>
        </div>

        <div className="day-tabs" role="tablist" aria-label="Days">
          {itinerary.days.map((d, i) => {
            const date = new Date(d.date + "T00:00");
            return (
              <button key={d.day} role="tab" aria-selected={i === active} className={i === active ? "active" : ""}
                onClick={() => { setActive(i); setEditing(null); }}>
                <small>{date.toLocaleDateString(undefined, { weekday: "short" })}</small>
                <strong>{date.getDate()}</strong>
                <small>Day {d.day}</small>
              </button>
            );
          })}
        </div>

        <section className={`card day ${regenerating ? "is-busy" : ""}`}>
          <header className="day-head">
            <div>
              <span className="eyebrow">Day {day.day}</span>
              <h2>{day.theme}</h2>
              <div className="day-facts">
                <span><Icon name="pin" size={14} /> {day.activities.length} stops</span>
                <span><Icon name="clock" size={14} /> ~{dayHours}h</span>
                <span><Icon name="wallet" size={14} /> {money(dayTotal)}</span>
              </div>
            </div>
          </header>

          {onRegenerateDay && (
            <div className="regen">
              <input placeholder="Not quite right? e.g. more outdoors, cheaper food…" value={instructions}
                aria-label="Instructions for regenerating this day" onChange={(e) => setInstructions(e.target.value)} />
              <button className="btn" disabled={regenerating}
                onClick={() => onRegenerateDay(day.day, instructions).then(() => setInstructions(""))}>
                <Icon name="refresh" size={15} className={regenerating ? "spin" : ""} />
                {regenerating ? "Regenerating…" : "Regenerate day"}
              </button>
            </div>
          )}

          <ol className="timeline">
            {day.activities.map((a) =>
              editing?.id === a.id ? (
                <li key={a.id} className="timeline-form"><ActivityForm initial={editing} onSave={saveActivity} onCancel={() => setEditing(null)} /></li>
              ) : (
                <li key={a.id} className={`act cat-${a.category}`}>
                  <time>{a.time}</time>
                  <span className="act-dot"><Icon name={icon(a.category)} size={16} /></span>
                  <div className="act-card">
                    <div className="act-top">
                      <h4>{a.title}</h4>
                      <span className="act-cost">{a.estimated_cost ? money(a.estimated_cost) : "Free"}</span>
                    </div>
                    {a.description && <p>{a.description}</p>}
                    <div className="act-meta">
                      <span className="tag">{CATEGORY_META[a.category]?.label || a.category}</span>
                      {a.location && <span><Icon name="pin" size={13} /> {a.location}</span>}
                      <span><Icon name="clock" size={13} /> {a.duration_minutes} min</span>
                    </div>
                    {editable && (
                      <div className="act-actions">
                        <button className="icon-btn" aria-label={`Edit ${a.title}`} onClick={() => setEditing(a)}><Icon name="edit" size={15} /></button>
                        <button className="icon-btn" aria-label={`Remove ${a.title}`}
                          onClick={() => updateDay((d) => ({ ...d, activities: d.activities.filter((x) => x.id !== a.id) }))}>
                          <Icon name="x" size={15} />
                        </button>
                      </div>
                    )}
                  </div>
                </li>
              )
            )}
            {editing && !day.activities.some((a) => a.id === editing.id) && (
              <li className="timeline-form"><ActivityForm initial={editing} onSave={saveActivity} onCancel={() => setEditing(null)} /></li>
            )}
          </ol>
          {editable && !editing && (
            <button className="btn dashed" onClick={() => setEditing({
              id: crypto.randomUUID().slice(0, 10), time: "12:00", title: "", description: "",
              category: "attraction", location: "", estimated_cost: 0, duration_minutes: 60,
            })}>
              <Icon name="plus" size={15} /> Add a stop
            </button>
          )}
        </section>
      </div>

      <aside className="itinerary-side">
        <BudgetPanel trip={trip} />

        {itinerary.accommodation?.length > 0 && (
          <section className="card">
            <h3><Icon name="bed" size={17} /> Where to stay</h3>
            {itinerary.accommodation.map((h, i) => (
              <div key={i} className="side-item">
                <div className="side-item-top">
                  <strong>{h.name}</strong>
                  {i === 0 && <span className="pill">Top pick</span>}
                </div>
                <span className="muted">{h.area} · {money(h.price_per_night)}/night</span>
                {h.why && <p>{h.why}</p>}
              </div>
            ))}
          </section>
        )}

        <section className="card">
          <h3><Icon name="compass" size={17} /> Getting there & around</h3>
          {itinerary.transportation.getting_there && <p><strong>Arrive</strong> · {itinerary.transportation.getting_there}</p>}
          {itinerary.transportation.getting_around && <p><strong>Local</strong> · {itinerary.transportation.getting_around}</p>}
          {itinerary.transportation.tips?.length > 0 && (
            <ul className="tips">{itinerary.transportation.tips.map((t, i) => <li key={i}>{t}</li>)}</ul>
          )}
        </section>

        {itinerary.tips?.length > 0 && (
          <section className="card">
            <h3><Icon name="bulb" size={17} /> Good to know</h3>
            <ul className="tips">{itinerary.tips.map((t, i) => <li key={i}>{t}</li>)}</ul>
          </section>
        )}
      </aside>
    </div>
  );
}

function BudgetPanel({ trip }) {
  const { byCategory, total, budget, nights } = tripCosts(trip);
  const cur = trip.preferences.currency;
  const over = total > budget;
  const entries = Object.entries(byCategory).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]);

  // Donut: each category's slice of the total spend.
  let acc = 0;
  const stops = entries.map(([k, v]) => {
    const from = acc;
    acc += (v / (total || 1)) * 100;
    return `var(--c-${k}) ${from}% ${acc}%`;
  });
  const used = Math.round((total / budget) * 100);

  return (
    <section className="card budget">
      <h3><Icon name="wallet" size={17} /> Budget</h3>
      <div className="budget-top">
        <div className="donut" style={{ background: `conic-gradient(${stops.join(", ") || "var(--surface-2) 0 100%"})` }}>
          <div className="donut-hole">
            <strong className={over ? "warn" : ""}>{used}%</strong>
            <small>used</small>
          </div>
        </div>
        <div className="budget-total">
          <strong>{formatMoney(total, cur)}</strong>
          <span className="muted">of {formatMoney(budget, cur)}</span>
          <span className={`budget-status ${over ? "over" : "ok"}`}>
            {over ? `${formatMoney(total - budget, cur)} over` : `${formatMoney(budget - total, cur)} left`}
          </span>
          {trip.preferences.travelers > 1 && (
            <small className="muted">{formatMoney(total / trip.preferences.travelers, cur)} per person</small>
          )}
        </div>
      </div>
      <dl>
        {entries.map(([k, v]) => (
          <div key={k}>
            <dt><span className="swatch" style={{ background: `var(--c-${k})` }} />{CATEGORY_META[k]?.label || k}{k === "accommodation" ? ` · ${nights}n` : ""}</dt>
            <dd>{formatMoney(v, cur)}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

function ActivityForm({ initial, onSave, onCancel }) {
  const [a, setA] = useState(initial);
  const set = (k, num) => (e) => setA({ ...a, [k]: num ? Number(e.target.value) : e.target.value });
  return (
    <form className="act-form" onSubmit={(e) => { e.preventDefault(); onSave(a); }}>
      <div className="grid-3">
        <label>Time<input type="time" required value={a.time} onChange={set("time")} /></label>
        <label className="span-2">Title<input required value={a.title} onChange={set("title")} autoFocus /></label>
        <label>Category
          <select value={a.category} onChange={set("category")}>
            {CATEGORIES.map((c) => <option key={c} value={c}>{CATEGORY_META[c].label}</option>)}
          </select>
        </label>
        <label>Cost<input type="number" min="0" value={a.estimated_cost} onChange={set("estimated_cost", true)} /></label>
        <label>Minutes<input type="number" min="0" value={a.duration_minutes} onChange={set("duration_minutes", true)} /></label>
        <label className="span-3">Location<input value={a.location} onChange={set("location")} /></label>
        <label className="span-3">Notes<textarea rows="2" value={a.description} onChange={set("description")} /></label>
      </div>
      <div className="row-end">
        <button type="button" className="btn ghost" onClick={onCancel}>Cancel</button>
        <button className="btn primary">Save stop</button>
      </div>
    </form>
  );
}
