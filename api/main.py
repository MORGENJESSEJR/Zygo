from __future__ import annotations

from typing import Literal
from uuid import uuid4

from fastapi import FastAPI, Header, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field
from pathlib import Path

from api.data import AREAS, PAYMENT_METHODS, STATUS_STAGES, VEHICLES, build_booking, build_quotes


class QuoteRequest(BaseModel):
    intent: Literal["move-me", "move-goods", "hire-vehicle"]
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


class BookingRequest(BaseModel):
    request: QuoteRequest
    vehicleId: str


app = FastAPI(
    title="Zygo API",
    version="0.1.0",
    description="Harare-first mobility and haulage API scaffold for quotes, bookings, and auth.",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

USERS: dict[str, dict] = {}
SESSIONS: dict[str, str] = {}
BOOKINGS: dict[str, dict] = {}
SITE_DIR = Path(__file__).resolve().parents[1] / "site"


def serialize_user(user: dict) -> dict:
    return {"id": user["id"], "name": user["name"], "phone": user["phone"], "email": user["email"]}


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


@app.get("/health")
def health() -> dict:
    return {
        "status": "ok",
        "users": len(USERS),
        "bookings": len(BOOKINGS),
        "vehicles": len(VEHICLES),
    }


@app.get("/areas")
def areas() -> dict:
    return {"areas": AREAS}


@app.get("/vehicles")
def vehicles(intent: str | None = None) -> dict:
    if intent:
        return {"vehicles": [vehicle for vehicle in VEHICLES if intent in vehicle["intents"]]}
    return {"vehicles": VEHICLES}


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
    user = current_user(authorization)
    if user is None:
        raise HTTPException(status_code=401, detail="No active session.")
    return {"user": serialize_user(user)}


@app.post("/quotes")
def quotes(payload: QuoteRequest) -> dict:
    try:
        quote_list = build_quotes(payload.model_dump())
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error
    return {"source": "api", "quotes": quote_list}


@app.post("/bookings")
def create_booking(payload: BookingRequest, authorization: str | None = Header(default=None)) -> dict:
    user = current_user(authorization)
    try:
        booking = build_booking(payload.request.model_dump(), payload.vehicleId, user)
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error

    BOOKINGS[booking["id"]] = booking
    return {"source": "api", "booking": booking}


@app.get("/bookings")
def list_bookings(authorization: str | None = Header(default=None)) -> dict:
    user = current_user(authorization) if authorization else None
    bookings = list(BOOKINGS.values())
    if user is not None:
        bookings = [booking for booking in bookings if booking["riderPhone"] == user["phone"]]
    bookings.sort(key=lambda item: item["createdAt"], reverse=True)
    return {"bookings": bookings}


@app.get("/bookings/{booking_id}")
def get_booking(booking_id: str) -> dict:
    booking = BOOKINGS.get(booking_id)
    if booking is None:
        raise HTTPException(status_code=404, detail="Booking not found.")
    return {"booking": booking, "statusStages": STATUS_STAGES}


app.mount("/", StaticFiles(directory=SITE_DIR, html=True), name="site")
