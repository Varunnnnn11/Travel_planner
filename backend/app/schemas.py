"""Request / response models."""
from datetime import date
from typing import Literal

from pydantic import BaseModel, Field, model_validator

Pace = Literal["relaxed", "balanced", "packed"]
Stay = Literal["budget", "mid-range", "premium"]
Category = Literal["attraction", "dining", "activity", "transport", "accommodation", "shopping", "nightlife"]


class GroupMember(BaseModel):
    name: str = Field(min_length=1, max_length=60)
    interests: list[str] = []
    max_budget: float | None = Field(default=None, ge=0)


class TripPreferences(BaseModel):
    destination: str = Field(min_length=2, max_length=120)
    origin: str | None = Field(default=None, max_length=120)
    start_date: date
    end_date: date
    budget: float = Field(gt=0, description="Total trip budget for the whole party")
    currency: str = Field(default="INR", min_length=3, max_length=3)
    travelers: int = Field(default=1, ge=1, le=30)
    trip_type: Literal["solo", "couple", "family", "group"] = "solo"
    pace: Pace = "balanced"
    stay: Stay = "mid-range"
    interests: list[str] = []
    members: list[GroupMember] = []
    notes: str | None = Field(default=None, max_length=1000)

    @model_validator(mode="after")
    def check_dates(self):
        if self.end_date < self.start_date:
            raise ValueError("end_date must be on or after start_date")
        if self.num_days > 14:
            raise ValueError("Trips are limited to 14 days")
        return self

    @property
    def num_days(self) -> int:
        return (self.end_date - self.start_date).days + 1

    def combined_interests(self) -> list[str]:
        seen: dict[str, None] = {}
        for i in self.interests + [i for m in self.members for i in m.interests]:
            key = i.strip().lower()
            if key:
                seen.setdefault(key, None)
        return list(seen) or ["sightseeing", "food"]


class Activity(BaseModel):
    id: str
    time: str
    title: str
    description: str = ""
    category: Category = "attraction"
    location: str = ""
    estimated_cost: float = 0
    duration_minutes: int = 60


class Day(BaseModel):
    day: int
    date: str
    theme: str
    activities: list[Activity]


class Accommodation(BaseModel):
    name: str
    area: str = ""
    price_per_night: float = 0
    why: str = ""


class Transportation(BaseModel):
    getting_there: str = ""
    getting_around: str = ""
    tips: list[str] = []


class Itinerary(BaseModel):
    summary: str
    days: list[Day]
    accommodation: list[Accommodation] = []
    transportation: Transportation = Transportation()
    tips: list[str] = []
    generated_by: str = "planner"


class Trip(BaseModel):
    id: str
    share_id: str
    title: str
    preferences: TripPreferences
    itinerary: Itinerary
    created_at: str
    updated_at: str


class TripCreate(BaseModel):
    title: str | None = Field(default=None, max_length=120)
    preferences: TripPreferences


class TripUpdate(BaseModel):
    title: str | None = Field(default=None, max_length=120)
    itinerary: Itinerary | None = None


class RegenerateRequest(BaseModel):
    instructions: str | None = Field(default=None, max_length=500)
