from __future__ import annotations

from datetime import datetime, timezone
from math import sqrt
from random import randint
from uuid import uuid4


AREAS = [
    {"id": "mbare", "label": "Mbare Musika", "x": 1, "y": 1},
    {"id": "magaba", "label": "Magaba", "x": 2, "y": 2},
    {"id": "cbd", "label": "Harare CBD", "x": 4, "y": 4},
    {"id": "avondale", "label": "Avondale", "x": 6, "y": 5},
    {"id": "borrowdale", "label": "Borrowdale", "x": 8, "y": 7},
    {"id": "southerton", "label": "Southerton", "x": 3, "y": 1},
    {"id": "belvedere", "label": "Belvedere", "x": 4, "y": 5},
    {"id": "waterfalls", "label": "Waterfalls", "x": 2, "y": 0},
]

AREA_MAP = {area["id"]: area for area in AREAS}

VEHICLES = [
    {
        "id": "taxi",
        "name": "Taxi",
        "intents": ["move-me"],
        "base_fare": 3.2,
        "per_km": 0.78,
        "eta_base": 5,
        "seats": 4,
        "cargo": "light",
        "hourly": 0.0,
    },
    {
        "id": "sedan",
        "name": "Sedan",
        "intents": ["move-me", "hire-vehicle"],
        "base_fare": 4.4,
        "per_km": 0.88,
        "eta_base": 7,
        "seats": 4,
        "cargo": "medium",
        "hourly": 6.5,
    },
    {
        "id": "scooter",
        "name": "Scooter",
        "intents": ["move-me", "move-goods"],
        "base_fare": 2.4,
        "per_km": 0.56,
        "eta_base": 4,
        "seats": 1,
        "cargo": "light",
        "hourly": 3.8,
    },
    {
        "id": "cart",
        "name": "Cart",
        "intents": ["move-goods"],
        "base_fare": 2.1,
        "per_km": 0.42,
        "eta_base": 10,
        "seats": 0,
        "cargo": "medium",
        "hourly": 2.6,
    },
    {
        "id": "pickup",
        "name": "Pickup",
        "intents": ["move-goods", "hire-vehicle"],
        "base_fare": 5.8,
        "per_km": 1.04,
        "eta_base": 11,
        "seats": 2,
        "cargo": "heavy",
        "hourly": 9.8,
    },
    {
        "id": "truck",
        "name": "Truck",
        "intents": ["move-goods", "hire-vehicle"],
        "base_fare": 8.5,
        "per_km": 1.38,
        "eta_base": 16,
        "seats": 2,
        "cargo": "bulk",
        "hourly": 16.0,
    },
]

PAYMENT_METHODS = [
    {"id": "ecocash", "label": "EcoCash", "note": "Instant mobile money"},
    {"id": "cash", "label": "Cash", "note": "Pay on pickup or dropoff"},
    {"id": "card", "label": "Card", "note": "Visa or Mastercard"},
    {"id": "transfer", "label": "Transfer", "note": "Use for scheduled hire"},
]

DRIVER_POOL = {
    "taxi": {"name": "Farai N.", "phone": "+263 77 321 4928", "plate": "AFR 2481", "rating": 4.8},
    "sedan": {"name": "Tariro M.", "phone": "+263 78 731 5050", "plate": "AGT 1184", "rating": 4.9},
    "scooter": {"name": "Kuda P.", "phone": "+263 71 664 2053", "plate": "SC-19", "rating": 4.7},
    "cart": {"name": "Tendai G.", "phone": "+263 71 155 2309", "plate": "CT-08", "rating": 4.6},
    "pickup": {"name": "Nyasha C.", "phone": "+263 77 507 4081", "plate": "PUK 4402", "rating": 4.9},
    "truck": {"name": "Simba D.", "phone": "+263 77 290 1012", "plate": "TRK 9024", "rating": 4.8},
}

STATUS_STAGES = [
    {"id": "confirmed", "label": "Booking confirmed", "detail": "Dispatch accepted the request."},
    {"id": "driver_en_route", "label": "Driver en route", "detail": "The vehicle is moving toward pickup."},
    {"id": "at_pickup", "label": "At pickup", "detail": "Driver has arrived at the pickup point."},
    {"id": "on_trip", "label": "On trip", "detail": "Trip or delivery is in progress."},
    {"id": "completed", "label": "Completed", "detail": "Route closed and payment reconciled."},
]


def score_cargo(level: str) -> int:
    return {"light": 1, "medium": 2, "heavy": 3, "bulk": 4}.get(level, 1)


def area_label(area_id: str) -> str:
    if area_id not in AREA_MAP:
        raise ValueError(f"Unknown area: {area_id}")
    return AREA_MAP[area_id]["label"]


def distance_km(pickup: str, dropoff: str) -> float:
    if pickup not in AREA_MAP or dropoff not in AREA_MAP:
        raise ValueError("Unknown pickup or dropoff area.")
    if pickup == dropoff:
        return 2.5

    start = AREA_MAP[pickup]
    end = AREA_MAP[dropoff]
    dx = start["x"] - end["x"]
    dy = start["y"] - end["y"]
    return max(2.5, round(sqrt((dx * dx) + (dy * dy)) * 2.9, 1))


def matches_request(vehicle: dict, request: dict) -> bool:
    if request["intent"] not in vehicle["intents"]:
        return False
    if request["intent"] == "move-me":
        return request["passengers"] <= vehicle["seats"]
    return score_cargo(vehicle["cargo"]) >= score_cargo(request["loadLevel"])


def quote_reason(vehicle_id: str, intent: str) -> str:
    reasons = {
        "taxi": "Lowest-friction option for a standard city ride.",
        "sedan": "Balanced for rider comfort and mixed luggage.",
        "scooter": "Fast fit for one rider or compact delivery movement.",
        "cart": "Practical for short local moves and lighter stock.",
        "pickup": "Balanced for stock volume and same-day flexibility.",
        "truck": "Best fit for heavier cargo or repeated drop-offs.",
    }
    if intent == "hire-vehicle" and vehicle_id == "pickup":
        return "Flexible for mixed passenger and cargo scheduling."
    if intent == "hire-vehicle" and vehicle_id == "truck":
        return "Built for longer use windows and heavier route plans."
    return reasons[vehicle_id]


def build_quotes(request: dict) -> list[dict]:
    trip_distance = distance_km(request["pickup"], request["dropoff"])
    demand_factor = 0.95 if request["schedule"] == "later" else 1
    load_factor = 0 if request["intent"] == "move-me" else (score_cargo(request["loadLevel"]) - 1) * 1.25

    quotes = []
    for index, vehicle in enumerate(filter(lambda item: matches_request(item, request), VEHICLES), start=1):
        if request["intent"] == "hire-vehicle":
            fare = vehicle["base_fare"] + (vehicle["hourly"] * max(1, request["hireHours"])) + (trip_distance * 0.25)
        else:
            fare = vehicle["base_fare"] + (vehicle["per_km"] * trip_distance) + load_factor

        eta_minutes = vehicle["eta_base"] + max(0, round(trip_distance / 1.8)) + (6 if request["schedule"] == "later" else 0)
        quotes.append(
            {
                "id": f"{vehicle['id']}-{index}",
                "vehicleId": vehicle["id"],
                "vehicleName": vehicle["name"],
                "fareUsd": round(fare * demand_factor, 2),
                "etaMinutes": eta_minutes,
                "distanceKm": trip_distance,
                "paymentLabels": ["EcoCash", "Card", "Transfer"] if request["intent"] == "hire-vehicle" else ["EcoCash", "Cash", "Card"],
                "fitReason": quote_reason(vehicle["id"], request["intent"]),
            }
        )

    return sorted(quotes, key=lambda item: item["fareUsd"])


def build_booking(request: dict, vehicle_id: str, rider: dict | None) -> dict:
    quote = next((entry for entry in build_quotes(request) if entry["vehicleId"] == vehicle_id), None)
    if quote is None:
        raise ValueError("Selected vehicle does not match the request.")

    booking_id = f"ZG-{uuid4().hex[:8]}".upper()
    driver = DRIVER_POOL[vehicle_id]
    return {
        "id": booking_id,
        "routeCode": f"RT-{randint(1000, 9999)}",
        "pickupLabel": area_label(request["pickup"]),
        "dropoffLabel": area_label(request["dropoff"]),
        "paymentMethod": request["paymentMethod"],
        "quote": quote,
        "driver": driver,
        "request": request,
        "riderName": rider["name"] if rider else "Guest rider",
        "riderPhone": rider["phone"] if rider else "+263 77 000 0000",
        "statusIndex": 0,
        "statusStages": STATUS_STAGES,
        "createdAt": datetime.now(timezone.utc).isoformat(),
    }
