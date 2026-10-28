import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api } from "../api.js";
import ItineraryView, { TripHero } from "../components/ItineraryView.jsx";
import Icon from "../components/Icon.jsx";

export default function TripPage() {
  const { tripId } = useParams();
  const navigate = useNavigate();
  const [trip, setTrip] = useState(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [busyDay, setBusyDay] = useState(null);
  const [regenAll, setRegenAll] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    api.getTrip(tripId).then(setTrip).catch((e) => setError(e.message));
  }, [tripId]);

  async function save(fields) {
    setSaving(true);
    setError("");
    try {
      setTrip(await api.updateTrip(tripId, fields));
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  function onChange(itinerary) {
    setTrip((t) => ({ ...t, itinerary })); // optimistic
    save({ itinerary });
  }

  async function regenerateDay(day, instructions) {
    setBusyDay(day);
    try {
      setTrip(await api.regenerateDay(tripId, day, instructions || null));
    } catch (e) {
      setError(e.message);
    } finally {
      setBusyDay(null);
    }
  }

  async function regenerateAll() {
    if (!confirm("Replace the whole itinerary with a fresh plan? Your edits will be lost.")) return;
    setRegenAll(true);
    try {
      setTrip(await api.regenerateTrip(tripId));
    } catch (e) {
      setError(e.message);
    } finally {
      setRegenAll(false);
    }
  }

  async function share() {
    const url = `${location.origin}/share/${trip.share_id}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      prompt("Copy this share link:", url);
    }
  }

  if (error && !trip) return <div className="alert">{error}</div>;
  if (!trip) return <div className="card skeleton tall" aria-label="Loading trip" />;

  return (
    <>
      <TripHero trip={trip}>
        <input className="title-input" aria-label="Trip title" defaultValue={trip.title}
          onBlur={(e) => e.target.value.trim() && e.target.value !== trip.title && save({ title: e.target.value.trim() })} />
        <div className="hero-actions">
          <button className="btn on-dark" onClick={share}><Icon name={copied ? "check" : "link"} size={15} /> {copied ? "Link copied" : "Share"}</button>
          <button className="btn on-dark" disabled={regenAll} onClick={regenerateAll}>
            <Icon name="refresh" size={15} className={regenAll ? "spin" : ""} /> {regenAll ? "Regenerating…" : "Regenerate trip"}
          </button>
          <button className="btn on-dark" aria-label="Delete trip" onClick={async () => {
            if (confirm("Delete this trip?")) { await api.deleteTrip(tripId); navigate("/"); }
          }}><Icon name="trash" size={15} /></button>
          <span className="save-state">{saving ? "Saving…" : `Saved · ${trip.itinerary.generated_by}`}</span>
        </div>
      </TripHero>
      {error && <div className="alert">{error}</div>}
      <ItineraryView trip={trip} onChange={onChange} onRegenerateDay={regenerateDay} busyDay={busyDay} />
    </>
  );
}
