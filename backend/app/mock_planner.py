"""Deterministic offline planner used when no Gemini API key is configured.

It produces itineraries in the same shape as the AI so the whole app can be
developed and demoed without network access or credentials.
"""
import random
from datetime import timedelta

from .schemas import Accommodation, Activity, Day, Itinerary, Transportation, TripPreferences

# (title template, category, share of daily activity budget, minutes)
INTEREST_ACTIVITIES: dict[str, list[tuple[str, str, float, int]]] = {
    "sightseeing": [
        ("Old Town walking tour of {d}", "attraction", 0.4, 150),
        ("{d} viewpoint at sunset", "attraction", 0.1, 60),
        ("Historic landmarks of central {d}", "attraction", 0.6, 120),
    ],
    "food": [
        ("Street food crawl in {d}", "dining", 0.6, 120),
        ("Local market tasting tour", "dining", 0.5, 90),
        ("Regional cooking class", "activity", 1.2, 180),
    ],
    "culture": [
        ("{d} city museum", "attraction", 0.5, 120),
        ("Traditional performance evening", "activity", 0.8, 90),
        ("Heritage temple & architecture trail", "attraction", 0.3, 120),
    ],
    "adventure": [
        ("Guided hike near {d}", "activity", 1.0, 240),
        ("Kayaking / water sports session", "activity", 1.4, 150),
        ("Zipline & adventure park", "activity", 1.5, 120),
    ],
    "nature": [
        ("Botanical gardens & lakeside walk", "attraction", 0.2, 120),
        ("Day trip to a nearby national park", "activity", 1.2, 300),
        ("Sunrise nature trail", "activity", 0.1, 90),
    ],
    "shopping": [
        ("Artisan craft bazaar", "shopping", 0.8, 90),
        ("Main shopping street of {d}", "shopping", 1.0, 120),
    ],
    "nightlife": [
        ("Rooftop bar with city views", "nightlife", 0.8, 120),
        ("Live music district", "nightlife", 0.6, 150),
    ],
    "romantic": [
        ("Scenic sunset cruise", "activity", 1.5, 120),
        ("Candle-lit dinner with a view", "dining", 1.6, 120),
        ("Couples spa session", "activity", 1.6, 120),
    ],
    "relaxation": [
        ("Spa & wellness afternoon", "activity", 1.2, 150),
        ("Lazy café hopping", "dining", 0.3, 120),
    ],
}

MEALS = [
    ("08:30", "Breakfast at a local café", 0.06),
    ("13:00", "Lunch at a popular neighbourhood eatery", 0.12),
    ("20:00", "Dinner at a well-reviewed local restaurant", 0.2),
]

THEMES = ["Arrival & first impressions", "Heart of the city", "Culture & heritage", "Hidden gems",
          "Nature escape", "Local flavours", "Leisure & shopping", "Farewell day"]

STAY_FACTOR = {"budget": 0.18, "mid-range": 0.3, "premium": 0.45}
PACE_COUNT = {"relaxed": 2, "balanced": 3, "packed": 5}


def _slot_times(n: int) -> list[str]:
    base = ["10:00", "15:00", "17:30", "11:30", "16:30", "21:30"]
    return sorted(base[:n])


def _make_day(p: TripPreferences, day_num: int, rng: random.Random, used: set[str], daily_spend: float) -> Day:
    interests = [i for i in p.combined_interests() if i in INTEREST_ACTIVITIES] or ["sightseeing", "food"]
    pool = [a for i in interests for a in INTEREST_ACTIVITIES[i]]
    rng.shuffle(pool)
    fresh = [a for a in pool if a[0].format(d=p.destination) not in used] or pool

    picks = fresh[: PACE_COUNT[p.pace]]
    activities: list[Activity] = []
    for (template, cat, share, mins), t in zip(picks, _slot_times(len(picks))):
        title = template.format(d=p.destination)
        used.add(title)
        activities.append(Activity(
            id=f"d{day_num}-{len(activities)}",
            time=t,
            title=title,
            description=f"Picked for your interest in {' & '.join(interests[:2])}.",
            category=cat,  # type: ignore[arg-type]
            location=f"{p.destination}",
            estimated_cost=round(daily_spend * share / 2, -1),
            duration_minutes=mins,
        ))
    for t, title, share in MEALS:
        activities.append(Activity(
            id=f"d{day_num}-{len(activities)}", time=t, title=title,
            description="Try a regional speciality.", category="dining",
            location=p.destination, estimated_cost=round(daily_spend * share, -1), duration_minutes=60,
        ))
    activities.sort(key=lambda a: a.time)
    # Keep the day within its share of the budget.
    total = sum(a.estimated_cost for a in activities)
    if total > daily_spend:
        for a in activities:
            a.estimated_cost = round(a.estimated_cost * daily_spend / total, -1)
    return Day(
        day=day_num,
        date=str(p.start_date + timedelta(days=day_num - 1)),
        theme=THEMES[(day_num - 1) % len(THEMES)] if day_num > 1 else THEMES[0],
        activities=activities,
    )


def mock_itinerary(p: TripPreferences, seed: int = 0) -> Itinerary:
    rng = random.Random(f"{p.destination}-{seed}")
    nights = max(p.num_days - 1, 1)
    stay_total = p.budget * STAY_FACTOR[p.stay]
    daily_spend = (p.budget - stay_total) * 0.8 / p.num_days
    used: set[str] = set()
    days = [_make_day(p, n, rng, used, daily_spend) for n in range(1, p.num_days + 1)]
    per_night = round(stay_total / nights, -1)
    return Itinerary(
        summary=(f"A {p.pace} {p.num_days}-day {p.trip_type} trip to {p.destination} focused on "
                 f"{', '.join(p.combined_interests()[:3])}, planned to stay within "
                 f"{p.budget:,.0f} {p.currency}. (Offline demo planner - add a GEMINI_API_KEY for AI plans.)"),
        days=days,
        accommodation=[
            Accommodation(name=f"Central {p.stay} stay", area=f"Central {p.destination}",
                          price_per_night=per_night, why="Walkable to most of the itinerary."),
            Accommodation(name="Boutique guesthouse", area="Old quarter",
                          price_per_night=round(per_night * 0.8, -1), why="Characterful and good value."),
        ],
        transportation=Transportation(
            getting_there=f"Compare trains, buses and flights from {p.origin or 'your city'} to {p.destination}.",
            getting_around="Walk within neighbourhoods; use metro / ride-hailing between areas.",
            tips=["Buy a day pass if you take more than 3 rides a day."],
        ),
        tips=["Keep 10% of the budget as a buffer.", "Book popular attractions a day ahead."],
        generated_by="offline-planner",
    )


def mock_day(p: TripPreferences, day: Day, other_days: list[Day], seed: int) -> Day:
    rng = random.Random(f"{p.destination}-{day.day}-{seed}")
    used = {a.title for d in other_days for a in d.activities} | {a.title for a in day.activities}
    stay_total = p.budget * STAY_FACTOR[p.stay]
    new = _make_day(p, day.day, rng, used, (p.budget - stay_total) * 0.8 / p.num_days)
    new.theme = rng.choice(THEMES)
    return new
