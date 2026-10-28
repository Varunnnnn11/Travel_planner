import { useEffect, useState } from "react";
import { NavLink, Outlet } from "react-router-dom";
import { api } from "../api.js";
import Icon from "./Icon.jsx";

export function Brand() {
  return (
    <div className="brand">
      <Icon name="compass" size={22} className="brand-icon" />
      <span>Way<span className="brand-accent">farer</span></span>
    </div>
  );
}

export default function Layout() {
  const [health, setHealth] = useState(null);
  useEffect(() => {
    api.health().then(setHealth).catch(() => setHealth({ status: "down" }));
  }, []);

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="sidebar-header"><Brand /></div>
        <nav>
          <NavLink to="/" end className="nav-item"><Icon name="home" /> <span className="nav-label">Dashboard</span></NavLink>
          <NavLink to="/new" className="nav-item"><Icon name="plus" /> <span className="nav-label">New trip</span></NavLink>
        </nav>
        <div className="sidebar-foot">
          {health?.status === "ok" ? (
            <>
              <span><span className="dot ok" /> API online</span>
              <small>{health.ai === "offline-planner" ? "Offline planner" : health.ai} · {health.storage}</small>
            </>
          ) : health ? (
            <span><span className="dot bad" /> API offline</span>
          ) : (
            <small>Connecting…</small>
          )}
        </div>
      </aside>
      <main className="content">
        <Outlet />
      </main>
    </div>
  );
}
