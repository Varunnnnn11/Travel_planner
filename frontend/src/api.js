const BASE = import.meta.env.VITE_API_URL ?? "";

async function request(path, options = {}) {
  const res = await fetch(`${BASE}/api${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  if (!res.ok) {
    let msg = `Request failed (${res.status})`;
    try {
      const data = await res.json();
      msg = Array.isArray(data.detail)
        ? data.detail.map((d) => d.msg.replace(/^Value error, /, "")).join("; ")
        : data.detail || msg;
    } catch {
      /* non-JSON error body */
    }
    throw new Error(msg);
  }
  return res.status === 204 ? null : res.json();
}

export const api = {
  health: () => request("/health"),
  listTrips: () => request("/trips"),
  getTrip: (id) => request(`/trips/${id}`),
  getShared: (shareId) => request(`/shared/${shareId}`),
  createTrip: (preferences, title) => request("/trips", { method: "POST", body: { preferences, title } }),
  updateTrip: (id, fields) => request(`/trips/${id}`, { method: "PATCH", body: fields }),
  deleteTrip: (id) => request(`/trips/${id}`, { method: "DELETE" }),
  regenerateTrip: (id) => request(`/trips/${id}/regenerate`, { method: "POST" }),
  regenerateDay: (id, day, instructions) =>
    request(`/trips/${id}/days/${day}/regenerate`, { method: "POST", body: { instructions } }),
};

export function formatMoney(value, currency = "INR") {
  try {
    return new Intl.NumberFormat(undefined, { style: "currency", currency, maximumFractionDigits: 0 }).format(value || 0);
  } catch {
    return `${currency} ${Math.round(value || 0)}`;
  }
}

// Muted, low-saturation tones so trip covers stay calm next to each other.
const COVER_TONES = ["#1B2430", "#2E6E8E", "#3F5E5A", "#5A4A3C", "#4B5563", "#3D4F6B", "#6B4F45"];

/** Stable, destination-specific cover colour. */
export function coverStyle(destination = "") {
  let h = 0;
  for (const ch of destination.toLowerCase()) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return { backgroundColor: COVER_TONES[h % COVER_TONES.length] };
}

export function daysUntil(dateStr) {
  const ms = new Date(dateStr + "T00:00") - new Date(new Date().toDateString());
  return Math.round(ms / 864e5);
}

export const CATEGORY_META = {
  attraction: { icon: "landmark", label: "Sights" },
  dining: { icon: "food", label: "Food" },
  activity: { icon: "target", label: "Activities" },
  transport: { icon: "train", label: "Transport" },
  shopping: { icon: "bag", label: "Shopping" },
  nightlife: { icon: "moon", label: "Nightlife" },
  accommodation: { icon: "bed", label: "Stay" },
};

export function tripCosts(trip) {
  const { itinerary, preferences } = trip;
  const byCategory = {};
  for (const day of itinerary.days) {
    for (const a of day.activities) {
      byCategory[a.category] = (byCategory[a.category] || 0) + Number(a.estimated_cost || 0);
    }
  }
  const nights = Math.max(itinerary.days.length - 1, 1);
  const stay = itinerary.accommodation?.[0]?.price_per_night || 0;
  if (stay) byCategory.accommodation = (byCategory.accommodation || 0) + stay * nights;
  const total = Object.values(byCategory).reduce((s, v) => s + v, 0);
  return { byCategory, total, budget: preferences.budget, nights };
}
