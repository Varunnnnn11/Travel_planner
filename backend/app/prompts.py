"""Prompt templates for itinerary generation."""
import json

from .schemas import Day, TripPreferences

ITINERARY_SHAPE = {
    "summary": "2-3 sentence overview of the trip",
    "days": [
        {
            "day": 1,
            "date": "YYYY-MM-DD",
            "theme": "short theme for the day",
            "activities": [
                {
                    "time": "09:00",
                    "title": "name of place or activity",
                    "description": "1-2 sentences, why it fits these travelers",
                    "category": "attraction|dining|activity|transport|shopping|nightlife",
                    "location": "neighbourhood or address",
                    "estimated_cost": 0,
                    "duration_minutes": 90,
                }
            ],
        }
    ],
    "accommodation": [
        {"name": "hotel name", "area": "neighbourhood", "price_per_night": 0, "why": "reason"}
    ],
    "transportation": {
        "getting_there": "how to reach the destination from the origin",
        "getting_around": "best local transport options",
        "tips": ["tip"],
    },
    "tips": ["practical tip"],
}

PACE_GUIDE = {
    "relaxed": "3-4 activities per day with long breaks and late starts",
    "balanced": "4-6 activities per day with sensible breaks",
    "packed": "6-8 activities per day, early starts, maximise sightseeing",
}

SYSTEM_PROMPT = (
    "You are an expert travel planner. You build realistic, geographically sensible "
    "day-by-day itineraries using real, well-known places at the destination. Group "
    "nearby places on the same day to minimise travel time, always include meals, and "
    "keep the total estimated cost within the stated budget. All costs are numbers in the "
    "trip currency for the WHOLE party (not per person). Respond with JSON only."
)


def _traveler_block(p: TripPreferences) -> str:
    lines = [
        f"Destination: {p.destination}",
        f"Origin: {p.origin or 'not specified'}",
        f"Dates: {p.start_date} to {p.end_date} ({p.num_days} days)",
        f"Travelers: {p.travelers} ({p.trip_type})",
        f"Total budget: {p.budget:.0f} {p.currency}",
        f"Pace: {p.pace} - {PACE_GUIDE[p.pace]}",
        f"Accommodation level: {p.stay}",
        f"Interests: {', '.join(p.combined_interests())}",
    ]
    if p.members:
        lines.append("Group members (balance everyone's interests across the days):")
        for m in p.members:
            cap = f", personal budget cap {m.max_budget:.0f} {p.currency}" if m.max_budget else ""
            lines.append(f"  - {m.name}: {', '.join(m.interests) or 'no preference'}{cap}")
    if p.notes:
        lines.append(f"Extra notes from the traveler: {p.notes}")
    return "\n".join(lines)


def build_itinerary_prompt(p: TripPreferences) -> str:
    return (
        f"{_traveler_block(p)}\n\n"
        f"Create a complete itinerary with exactly {p.num_days} days. Recommend 2-3 "
        f"accommodation options matching the '{p.stay}' level.\n"
        f"Return JSON matching this shape:\n{json.dumps(ITINERARY_SHAPE, indent=2)}"
    )


def build_day_prompt(p: TripPreferences, day: Day, other_days: list[Day], instructions: str | None) -> str:
    used = sorted({a.title for d in other_days for a in d.activities})
    return (
        f"{_traveler_block(p)}\n\n"
        f"Regenerate ONLY day {day.day} ({day.date}) of this trip. The current plan for that day "
        f"was themed '{day.theme}' - produce a fresh alternative.\n"
        f"Do not repeat any of these places already used on other days: {', '.join(used) or 'none'}.\n"
        f"Extra instructions: {instructions or 'none'}\n"
        f"Return JSON for a single day matching this shape:\n"
        f"{json.dumps(ITINERARY_SHAPE['days'][0], indent=2)}"
    )
