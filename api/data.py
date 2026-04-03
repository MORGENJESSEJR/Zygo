from __future__ import annotations

from datetime import datetime, timezone
from math import sqrt
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

DISPATCH_VEHICLES = [
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

BOOKING_STATES = [
    {"id": "driver_en_route", "label": "Driver en route", "detail": "The driver is moving toward the pickup point."},
    {"id": "awaiting_start_pin", "label": "Awaiting start PIN", "detail": "Confirm the right driver and vehicle before the trip begins."},
    {"id": "on_trip", "label": "On trip", "detail": "The trip is active and the route is underway."},
    {"id": "awaiting_end_pin", "label": "Awaiting end PIN", "detail": "The rider must confirm safe arrival before closing the trip."},
    {"id": "completed", "label": "Completed", "detail": "Trip closed after the correct end PIN was confirmed."},
    {"id": "safety_alert", "label": "Safety alert", "detail": "The trip is flagged for safety review."},
]

BOOKING_STATE_MAP = {entry["id"]: entry for entry in BOOKING_STATES}

DISPATCH_DRIVER_POOL = {
    "taxi": {"name": "Farai N.", "phone": "+263 77 321 4928", "plateNumber": "AFR 2481", "rating": 4.8},
    "sedan": {"name": "Tariro M.", "phone": "+263 78 731 5050", "plateNumber": "AGT 1184", "rating": 4.9},
    "scooter": {"name": "Kuda P.", "phone": "+263 71 664 2053", "plateNumber": "SC-19", "rating": 4.7},
    "cart": {"name": "Tendai G.", "phone": "+263 71 155 2309", "plateNumber": "CT-08", "rating": 4.6},
    "pickup": {"name": "Nyasha C.", "phone": "+263 77 507 4081", "plateNumber": "PUK 4402", "rating": 4.9},
    "truck": {"name": "Simba D.", "phone": "+263 77 290 1012", "plateNumber": "TRK 9024", "rating": 4.8},
}

VEHICLE_TYPE_LABELS = {
    "hatchback": "Hatchback",
    "sedan": "Sedan",
    "suv": "SUV",
    "pickup": "Pickup",
    "truck": "Truck",
    "scooter": "Scooter",
}

SEEDED_DRIVER_PROFILES = [
    {
        "id": "DRV-SEED-1",
        "ownerUserId": "seed-user-1",
        "driverName": "Tatenda M.",
        "driverPhone": "+263 77 811 4400",
        "bio": "Daily commuter from Mbare to CBD with room for two riders.",
        "vehicleType": "hatchback",
        "vehicleLabel": "Silver Honda Fit",
        "plateNumber": "AFR 1184",
        "seats": 3,
        "homeArea": "mbare",
        "routeArea": "cbd",
        "availability": "Weekdays 06:00 to 09:00 and 16:30 to 19:00",
        "farePerSeat": 1.8,
        "sharedRideEnabled": True,
        "approvalStatus": "approved",
        "driverPhotoData": "",
        "vehiclePhotoData": "",
        "rating": 4.8,
    },
    {
        "id": "DRV-SEED-2",
        "ownerUserId": "seed-user-2",
        "driverName": "Rumbi K.",
        "driverPhone": "+263 78 244 1832",
        "bio": "Shared commute from Southerton through the CBD into Avondale.",
        "vehicleType": "sedan",
        "vehicleLabel": "Blue Toyota Axio",
        "plateNumber": "AGT 2201",
        "seats": 3,
        "homeArea": "southerton",
        "routeArea": "avondale",
        "availability": "Daily 07:00 to 10:00 and 17:00 to 20:00",
        "farePerSeat": 2.1,
        "sharedRideEnabled": True,
        "approvalStatus": "approved",
        "driverPhotoData": "",
        "vehiclePhotoData": "",
        "rating": 4.9,
    },
]


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def clone_seed_profiles() -> list[dict]:
    profiles = []
    for profile in SEEDED_DRIVER_PROFILES:
        copied = dict(profile)
        copied["createdAt"] = now_iso()
        profiles.append(copied)
    return profiles


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


def generate_pin() -> str:
    return str((uuid4().int % 9000) + 1000)


def vehicle_type_label(vehicle_type: str) -> str:
    return VEHICLE_TYPE_LABELS.get(vehicle_type, vehicle_type.replace("-", " ").title())


def build_profile_summary(profile: dict) -> dict:
    return {
        "id": profile["id"],
        "driverName": profile["driverName"],
        "driverPhone": profile["driverPhone"],
        "bio": profile["bio"],
        "vehicleType": profile["vehicleType"],
        "vehicleLabel": profile["vehicleLabel"],
        "plateNumber": profile["plateNumber"],
        "seats": profile["seats"],
        "homeArea": profile["homeArea"],
        "homeAreaLabel": area_label(profile["homeArea"]),
        "routeArea": profile["routeArea"],
        "routeAreaLabel": area_label(profile["routeArea"]),
        "availability": profile["availability"],
        "farePerSeat": profile["farePerSeat"],
        "sharedRideEnabled": profile["sharedRideEnabled"],
        "approvalStatus": profile["approvalStatus"],
        "driverPhotoData": profile.get("driverPhotoData", ""),
        "vehiclePhotoData": profile.get("vehiclePhotoData", ""),
        "rating": profile.get("rating", 4.7),
        "createdAt": profile["createdAt"],
    }


def matches_dispatch_request(vehicle: dict, request: dict) -> bool:
    if request["intent"] not in vehicle["intents"]:
        return False
    if request["intent"] == "move-me":
        return request["passengers"] <= vehicle["seats"]
    return score_cargo(vehicle["cargo"]) >= score_cargo(request["loadLevel"])


def dispatch_reason(vehicle_id: str, intent: str) -> str:
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


def build_dispatch_quotes(request: dict) -> list[dict]:
    trip_distance = distance_km(request["pickup"], request["dropoff"])
    demand_factor = 0.95 if request["schedule"] == "later" else 1
    load_factor = 0 if request["intent"] == "move-me" else (score_cargo(request["loadLevel"]) - 1) * 1.25

    quotes = []
    for vehicle in filter(lambda item: matches_dispatch_request(item, request), DISPATCH_VEHICLES):
        if request["intent"] == "hire-vehicle":
            fare = vehicle["base_fare"] + (vehicle["hourly"] * max(1, request["hireHours"])) + (trip_distance * 0.25)
        else:
            fare = vehicle["base_fare"] + (vehicle["per_km"] * trip_distance) + load_factor

        driver = DISPATCH_DRIVER_POOL[vehicle["id"]]
        quotes.append(
            {
                "selectionType": "vehicle",
                "selectionId": vehicle["id"],
                "vehicleId": vehicle["id"],
                "vehicleName": vehicle["name"],
                "fareUsd": round(fare * demand_factor, 2),
                "etaMinutes": vehicle["eta_base"] + max(0, round(trip_distance / 1.8)) + (6 if request["schedule"] == "later" else 0),
                "distanceKm": trip_distance,
                "paymentLabels": ["EcoCash", "Card", "Transfer"] if request["intent"] == "hire-vehicle" else ["EcoCash", "Cash", "Card"],
                "fitReason": dispatch_reason(vehicle["id"], request["intent"]),
                "driverPreview": {
                    "driverName": driver["name"],
                    "plateNumber": driver["plateNumber"],
                    "rating": driver["rating"],
                },
            }
        )

    return sorted(quotes, key=lambda item: item["fareUsd"])


def build_shared_ride_quotes(request: dict, profiles: list[dict]) -> list[dict]:
    trip_distance = distance_km(request["pickup"], request["dropoff"])
    quotes = []

    for profile in profiles:
        if profile["approvalStatus"] != "approved" or not profile["sharedRideEnabled"]:
            continue
        if request["passengers"] > profile["seats"]:
            continue

        pickup_gap = distance_km(request["pickup"], profile["homeArea"])
        drop_gap = distance_km(request["dropoff"], profile["routeArea"])
        if pickup_gap > 9 or drop_gap > 9:
            continue

        fare = round(profile["farePerSeat"] * request["passengers"], 2)
        eta = 6 + round(pickup_gap) + (4 if request["schedule"] == "later" else 0)
        quotes.append(
            {
                "selectionType": "offer",
                "selectionId": profile["id"],
                "vehicleId": profile["vehicleType"],
                "vehicleName": f"{vehicle_type_label(profile['vehicleType'])} shared ride",
                "fareUsd": fare,
                "etaMinutes": eta,
                "distanceKm": trip_distance,
                "paymentLabels": ["EcoCash", "Cash", "Card"],
                "fitReason": f"Shared commute from {area_label(profile['homeArea'])} toward {area_label(profile['routeArea'])}.",
                "driverPreview": {
                    "driverName": profile["driverName"],
                    "plateNumber": profile["plateNumber"],
                    "rating": profile.get("rating", 4.7),
                    "seats": profile["seats"],
                    "driverPhotoData": profile.get("driverPhotoData", ""),
                    "vehiclePhotoData": profile.get("vehiclePhotoData", ""),
                },
            }
        )

    return sorted(quotes, key=lambda item: (item["fareUsd"], item["etaMinutes"]))


def build_dispatch_driver(vehicle_id: str) -> dict:
    driver = DISPATCH_DRIVER_POOL[vehicle_id]
    vehicle_name = next(vehicle["name"] for vehicle in DISPATCH_VEHICLES if vehicle["id"] == vehicle_id)
    return {
        "driverName": driver["name"],
        "driverPhone": driver["phone"],
        "plateNumber": driver["plateNumber"],
        "rating": driver["rating"],
        "vehicleLabel": vehicle_name,
        "vehiclePhotoData": "",
        "driverPhotoData": "",
    }


def build_driver_from_profile(profile: dict) -> dict:
    return {
        "driverName": profile["driverName"],
        "driverPhone": profile["driverPhone"],
        "plateNumber": profile["plateNumber"],
        "rating": profile.get("rating", 4.7),
        "vehicleLabel": profile["vehicleLabel"],
        "vehiclePhotoData": profile.get("vehiclePhotoData", ""),
        "driverPhotoData": profile.get("driverPhotoData", ""),
    }


def build_booking_history(state: str) -> list[dict]:
    return [{"state": state, "timestamp": now_iso(), "detail": BOOKING_STATE_MAP[state]["detail"]}]


def append_history(booking: dict, state: str) -> None:
    booking["history"].append({"state": state, "timestamp": now_iso(), "detail": BOOKING_STATE_MAP[state]["detail"]})


def build_booking(request: dict, quote: dict, rider: dict | None, profile_lookup: dict[str, dict]) -> dict:
    booking_id = f"ZG-{uuid4().hex[:8]}".upper()
    service_type = "shared-ride" if quote["selectionType"] == "offer" else request["intent"]
    if quote["selectionType"] == "offer":
        profile = profile_lookup[quote["selectionId"]]
        driver = build_driver_from_profile(profile)
    else:
        driver = build_dispatch_driver(quote["selectionId"])

    state = "driver_en_route"
    return {
        "id": booking_id,
        "routeCode": f"RT-{booking_id[-4:]}",
        "serviceType": service_type,
        "state": state,
        "stateLabel": BOOKING_STATE_MAP[state]["label"],
        "stateDetail": BOOKING_STATE_MAP[state]["detail"],
        "pickup": request["pickup"],
        "pickupLabel": area_label(request["pickup"]),
        "dropoff": request["dropoff"],
        "dropoffLabel": area_label(request["dropoff"]),
        "paymentMethod": request["paymentMethod"],
        "request": request,
        "quote": quote,
        "driver": driver,
        "rider": {
            "name": rider["name"] if rider else "Guest rider",
            "phone": rider["phone"] if rider else "+263 77 000 0000",
            "userId": rider["id"] if rider else "",
        },
        "safety": {
            "startPin": generate_pin(),
            "endPin": generate_pin(),
            "alerts": [],
        },
        "history": build_booking_history(state),
        "createdAt": now_iso(),
    }


def set_booking_state(booking: dict, state: str) -> dict:
    booking["state"] = state
    booking["stateLabel"] = BOOKING_STATE_MAP[state]["label"]
    booking["stateDetail"] = BOOKING_STATE_MAP[state]["detail"]
    append_history(booking, state)
    return booking
