from __future__ import annotations

from pathlib import Path
from typing import Literal
from uuid import uuid4

from fastapi import FastAPI, Header, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

from api.data import (
    AREAS,
    BOOKING_STATES,
    DISPATCH_VEHICLES,
    PAYMENT_METHODS,
    area_label,
    build_booking,
    build_profile_summary,
    build_shared_ride_quotes,
    build_dispatch_quotes,
    clone_seed_profiles,
    now_iso,
    set_booking_state,
)


class QuoteRequest(BaseModel):
    intent: Literal["move-me", "shared-ride", "move-goods", "hire-vehicle"]
    pickup: str
    dropoff: str
    schedule: Literal["now", "today", "later"] = "now"
    paymentMethod: Literal["ecocash", "cash", "card", "transfer"] = "ecocash"
    passengers: int = Field(default=1, ge=1, le=4)
    loadLevel: Literal["light", "medium", "heavy", "bulk"] = "light"
    hireHours: int = Field(default=2, ge=1, le=24)
    notes: str = Field(default="", max_length=280)


class RegisterRequest(BaseModel):
    name: str = Field(min_length=2, max_length=80)
    phone: str = Field(min_length=8, max_length=32)
    email: str = Field(min_length=5, max_length=120)
    password: str = Field(min_length=6, max_length=120)


class LoginRequest(BaseModel):
    phone: str = Field(min_length=8, max_length=32)
    email: str | None = None
    password: str = Field(min_length=6, max_length=120)


class DriverProfileRequest(BaseModel):
    driverName: str = Field(min_length=2, max_length=80)
    driverPhone: str = Field(min_length=8, max_length=32)
    bio: str = Field(min_length=12, max_length=220)
    vehicleType: Literal["hatchback", "sedan", "suv", "pickup", "truck", "scooter"]
    vehicleLabel: str = Field(min_length=3, max_length=80)
    plateNumber: str = Field(min_length=4, max_length=20)
    seats: int = Field(ge=1, le=6)
    homeArea: str
    routeArea: str
    availability: str = Field(min_length=4, max_length=120)
    farePerSeat: float = Field(ge=0.5, le=25)
    sharedRideEnabled: bool = True
    driverPhotoData: str = Field(default="", max_length=800000)
    vehiclePhotoData: str = Field(default="", max_length=800000)


class BookingCreateRequest(BaseModel):
    request: QuoteRequest
    selectionType: Literal["vehicle", "offer"]
    selectionId: str


class PinConfirmationRequest(BaseModel):
    pin: str = Field(min_length=4, max_length=6)


class SafetyAlertRequest(BaseModel):
    reason: str = Field(min_length=6, max_length=240)


app = FastAPI(
    title="Zygo API",
    version="0.2.0",
    description="Harare-first mobility, shared ride, and haulage API scaffold.",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

def seed_users() -> dict[str, dict]:
    reviewer = {
        "id": "user-review-0001",
        "name": "Zygo Review Desk",
        "phone": "+263770000001",
        "email": "review@zygo.local",
        "password": "review123",
        "createdAt": now_iso(),
        "canReviewSupply": True,
    }
    return {reviewer["phone"]: reviewer}


USERS: dict[str, dict] = seed_users()
SESSIONS: dict[str, str] = {}
DRIVER_PROFILES: dict[str, dict] = {profile["id"]: profile for profile in clone_seed_profiles()}
BOOKINGS: dict[str, dict] = {}
SITE_DIR = Path(__file__).resolve().parents[1] / "site"


def serialize_user(user: dict) -> dict:
    return {
        "id": user["id"],
        "name": user["name"],
        "phone": user["phone"],
        "email": user["email"],
        "canReviewSupply": bool(user.get("canReviewSupply")),
    }


def create_session(phone: str) -> str:
    token = f"session-{uuid4().hex}"
    SESSIONS[token] = phone
    return token


def current_user(authorization: str | None) -> dict | None:
    if not authorization:
        return None
    scheme, _, token = authorization.partition(" ")
    if scheme.lower() != "bearer" or token not in SESSIONS:
        raise HTTPException(status_code=401, detail="Invalid session token.")
    phone = SESSIONS[token]
    return USERS.get(phone)


def require_user(authorization: str | None) -> dict:
    user = current_user(authorization)
    if user is None:
        raise HTTPException(status_code=401, detail="Authentication required.")
    return user


def require_supply_reviewer(user: dict | None) -> dict:
    if user is None:
        raise HTTPException(status_code=401, detail="Authentication required.")
    if not user.get("canReviewSupply"):
        raise HTTPException(status_code=403, detail="Supply review access is restricted.")
    return user


def approved_profiles() -> list[dict]:
    return [profile for profile in DRIVER_PROFILES.values() if profile["approvalStatus"] == "approved"]


def get_quote_choices(request: dict) -> list[dict]:
    if request["intent"] == "shared-ride":
        return build_shared_ride_quotes(request, approved_profiles())
    return build_dispatch_quotes(request)


def get_booking_or_404(booking_id: str) -> dict:
    booking = BOOKINGS.get(booking_id)
    if booking is None:
        raise HTTPException(status_code=404, detail="Booking not found.")
    return booking


def ensure_booking_owner(booking: dict, user: dict) -> None:
    if booking["rider"]["userId"] and booking["rider"]["userId"] != user["id"]:
        raise HTTPException(status_code=403, detail="This booking belongs to a different user.")


@app.get("/health")
def health() -> dict:
    return {
        "status": "ok",
        "users": len(USERS),
        "bookings": len(BOOKINGS),
        "vehicles": len(DISPATCH_VEHICLES),
        "driverProfiles": len(DRIVER_PROFILES),
        "approvedSharedDrivers": len(approved_profiles()),
    }


@app.get("/areas")
def areas() -> dict:
    return {"areas": AREAS}


@app.get("/vehicles")
def vehicles(intent: str | None = None) -> dict:
    vehicles_list = DISPATCH_VEHICLES
    if intent:
        vehicles_list = [vehicle for vehicle in DISPATCH_VEHICLES if intent in vehicle["intents"]]
    return {"vehicles": vehicles_list}


@app.get("/payments/methods")
def payment_methods() -> dict:
    return {"methods": PAYMENT_METHODS}


@app.post("/auth/register")
def register(payload: RegisterRequest) -> dict:
    if payload.phone in USERS:
        raise HTTPException(status_code=409, detail="Phone number already registered.")

    user = {
        "id": f"user-{uuid4().hex[:8]}",
        "name": payload.name.strip(),
        "phone": payload.phone.strip(),
        "email": payload.email.strip(),
        "password": payload.password,
        "createdAt": now_iso(),
        "canReviewSupply": False,
    }
    USERS[user["phone"]] = user
    token = create_session(user["phone"])
    return {"token": token, "user": serialize_user(user)}


@app.post("/auth/login")
def login(payload: LoginRequest) -> dict:
    user = USERS.get(payload.phone)
    if not user or user["password"] != payload.password:
        raise HTTPException(status_code=401, detail="Invalid phone or password.")
    token = create_session(user["phone"])
    return {"token": token, "user": serialize_user(user)}


@app.get("/auth/me")
def me(authorization: str | None = Header(default=None)) -> dict:
    user = require_user(authorization)
    return {"user": serialize_user(user)}


@app.get("/driver-profiles")
def list_driver_profiles(
    authorization: str | None = Header(default=None),
    mine: bool = Query(default=False),
    status: str | None = Query(default=None),
) -> dict:
    user = current_user(authorization)
    profiles = list(DRIVER_PROFILES.values())

    if mine:
        if user is None:
            raise HTTPException(status_code=401, detail="Authentication required to view your driver profiles.")
        profiles = [profile for profile in profiles if profile["ownerUserId"] == user["id"]]
    elif status == "pending-review":
        require_supply_reviewer(user)
        profiles = [profile for profile in profiles if profile["approvalStatus"] == "pending-review"]
    elif status == "approved":
        profiles = [profile for profile in profiles if profile["approvalStatus"] == "approved"]
    else:
        profiles = [profile for profile in profiles if profile["approvalStatus"] == "approved"]

    profiles.sort(key=lambda item: item["createdAt"], reverse=True)
    return {"profiles": [build_profile_summary(profile) for profile in profiles]}


@app.post("/driver-profiles")
def create_driver_profile(payload: DriverProfileRequest, authorization: str | None = Header(default=None)) -> dict:
    user = require_user(authorization)
    try:
        area_label(payload.homeArea)
        area_label(payload.routeArea)
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error

    profile_id = f"DRV-{uuid4().hex[:8]}".upper()
    profile = {
        "id": profile_id,
        "ownerUserId": user["id"],
        "driverName": payload.driverName.strip(),
        "driverPhone": payload.driverPhone.strip(),
        "bio": payload.bio.strip(),
        "vehicleType": payload.vehicleType,
        "vehicleLabel": payload.vehicleLabel.strip(),
        "plateNumber": payload.plateNumber.strip().upper(),
        "seats": payload.seats,
        "homeArea": payload.homeArea,
        "routeArea": payload.routeArea,
        "availability": payload.availability.strip(),
        "farePerSeat": round(payload.farePerSeat, 2),
        "sharedRideEnabled": payload.sharedRideEnabled,
        "approvalStatus": "pending-review",
        "driverPhotoData": payload.driverPhotoData,
        "vehiclePhotoData": payload.vehiclePhotoData,
        "rating": 4.7,
        "createdAt": now_iso(),
    }
    DRIVER_PROFILES[profile_id] = profile
    return {"profile": build_profile_summary(profile)}


@app.post("/driver-profiles/{profile_id}/approve")
def approve_driver_profile(profile_id: str, authorization: str | None = Header(default=None)) -> dict:
    user = require_user(authorization)
    require_supply_reviewer(user)
    profile = DRIVER_PROFILES.get(profile_id)
    if profile is None:
        raise HTTPException(status_code=404, detail="Driver profile not found.")
    profile["approvalStatus"] = "approved"
    return {"profile": build_profile_summary(profile)}


@app.post("/quotes")
def quotes(payload: QuoteRequest) -> dict:
    try:
        quote_list = get_quote_choices(payload.model_dump())
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error

    return {"source": "api", "quotes": quote_list}


@app.post("/bookings")
def create_booking(payload: BookingCreateRequest, authorization: str | None = Header(default=None)) -> dict:
    user = require_user(authorization)
    request = payload.request.model_dump()
    quote_list = get_quote_choices(request)
    quote = next(
        (
            item
            for item in quote_list
            if item["selectionType"] == payload.selectionType and item["selectionId"] == payload.selectionId
        ),
        None,
    )
    if quote is None:
        raise HTTPException(status_code=400, detail="Selected quote is no longer available.")

    booking = build_booking(request, quote, user, DRIVER_PROFILES)
    BOOKINGS[booking["id"]] = booking
    return {"booking": booking}


@app.get("/bookings")
def list_bookings(authorization: str | None = Header(default=None)) -> dict:
    user = require_user(authorization)
    bookings = [booking for booking in BOOKINGS.values() if booking["rider"]["userId"] == user["id"]]
    bookings.sort(key=lambda item: item["createdAt"], reverse=True)
    return {"bookings": bookings}


@app.get("/bookings/{booking_id}")
def get_booking(booking_id: str, authorization: str | None = Header(default=None)) -> dict:
    user = require_user(authorization)
    booking = get_booking_or_404(booking_id)
    ensure_booking_owner(booking, user)
    return {"booking": booking, "states": BOOKING_STATES}


@app.post("/bookings/{booking_id}/driver-arrived")
def mark_driver_arrived(booking_id: str, authorization: str | None = Header(default=None)) -> dict:
    user = require_user(authorization)
    booking = get_booking_or_404(booking_id)
    ensure_booking_owner(booking, user)
    if booking["state"] != "driver_en_route":
        raise HTTPException(status_code=409, detail="Driver arrival can only be marked once the booking is en route.")
    return {"booking": set_booking_state(booking, "awaiting_start_pin")}


@app.post("/bookings/{booking_id}/confirm-start")
def confirm_start_pin(booking_id: str, payload: PinConfirmationRequest, authorization: str | None = Header(default=None)) -> dict:
    user = require_user(authorization)
    booking = get_booking_or_404(booking_id)
    ensure_booking_owner(booking, user)
    if booking["state"] != "awaiting_start_pin":
        raise HTTPException(status_code=409, detail="Start PIN can only be confirmed after the driver reaches pickup.")
    if payload.pin != booking["safety"]["startPin"]:
        raise HTTPException(status_code=400, detail="Incorrect start PIN.")
    return {"booking": set_booking_state(booking, "on_trip")}


@app.post("/bookings/{booking_id}/dropoff-arrived")
def mark_dropoff_arrived(booking_id: str, authorization: str | None = Header(default=None)) -> dict:
    user = require_user(authorization)
    booking = get_booking_or_404(booking_id)
    ensure_booking_owner(booking, user)
    if booking["state"] != "on_trip":
        raise HTTPException(status_code=409, detail="Dropoff arrival can only be marked once the trip is active.")
    return {"booking": set_booking_state(booking, "awaiting_end_pin")}


@app.post("/bookings/{booking_id}/confirm-complete")
def confirm_complete_pin(booking_id: str, payload: PinConfirmationRequest, authorization: str | None = Header(default=None)) -> dict:
    user = require_user(authorization)
    booking = get_booking_or_404(booking_id)
    ensure_booking_owner(booking, user)
    if booking["state"] != "awaiting_end_pin":
        raise HTTPException(status_code=409, detail="End PIN can only be confirmed after dropoff arrival.")
    if payload.pin != booking["safety"]["endPin"]:
        raise HTTPException(status_code=400, detail="Incorrect end PIN.")
    return {"booking": set_booking_state(booking, "completed")}


@app.post("/bookings/{booking_id}/safety-alert")
def create_safety_alert(booking_id: str, payload: SafetyAlertRequest, authorization: str | None = Header(default=None)) -> dict:
    user = require_user(authorization)
    booking = get_booking_or_404(booking_id)
    ensure_booking_owner(booking, user)
    booking["safety"]["alerts"].append({"reason": payload.reason.strip(), "createdAt": now_iso()})
    return {"booking": set_booking_state(booking, "safety_alert")}


app.mount("/", StaticFiles(directory=SITE_DIR, html=True), name="site")
