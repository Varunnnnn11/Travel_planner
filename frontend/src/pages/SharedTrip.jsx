import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../api.js";
import { Brand } from "../components/Layout.jsx";
import ItineraryView, { TripHero } from "../components/ItineraryView.jsx";

export default function SharedTrip() {
  const { shareId } = useParams();
  const [trip, setTrip] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api.getShared(shareId).then(setTrip).catch((e) => setError(e.message));
  }, [shareId]);

  return (
    <main className="content shared">
      <div className="shared-bar">
        <Brand />
        <Link className="btn primary" to="/new">Plan your own trip</Link>
      </div>
      {error && <div className="alert">{error}</div>}
      {!trip && !error && <div className="card skeleton tall" />}
      {trip && (
        <>
          <TripHero trip={trip}>
            <h1 className="title-static">{trip.title}</h1>
          </TripHero>
          <ItineraryView trip={trip} />
        </>
      )}
    </main>
  );
}
