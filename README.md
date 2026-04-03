# Zygo

Zygo is a standalone Harare-first product prototype for booking:

- city rides
- shared rides with approved private drivers
- goods movement
- vehicle hire

The folder is separate from `kweli/`.

## What is here

- `site/`: mobile-first web app with home, booking, driver onboarding, trip tracking, account, and auth routes
- `api/`: FastAPI app for auth, quotes, driver review, bookings, and safety checkpoints
- `tests/`: `unittest` coverage for booking, approval, and safety flows
- `BRAND.md`: refined product brief and design logic

## Run the app locally

From `C:\Users\morge\Documents\New project`:

```powershell
cd zygo
python -m uvicorn api.main:app --reload
```

Then open:

- `http://127.0.0.1:8000`
- `http://127.0.0.1:8000/docs`

## Run tests

From `C:\Users\morge\Documents\New project`:

```powershell
cd zygo
python -m unittest tests.test_api
```

## Product logic

The main product choice is task-first routing:

1. Move me
2. Shared ride
3. Move goods
4. Hire a vehicle

That reduces the real bottleneck: users should not have to decode the full fleet before they know which vehicles fit the job.

## Marketplace flows

- Riders can request dispatch rides, goods delivery, vehicle hire, or shared rides.
- Private drivers can create driver and vehicle profiles with plate number, route corridor, and both photos.
- New driver supply stays in `pending-review` until a reviewer approves it.
- Trip safety uses a start PIN and end PIN before a booking can be completed.

## Demo reviewer

Shared-ride approval is protected. Use this seeded reviewer account if you want to test the review queue locally or on Railway:

- Phone: `+263770000001`
- Password: `review123`

## Railway

This repo is set up to run as one service:

- FastAPI serves the API
- FastAPI also serves the `site/` app
- Railway only needs one web process
- `railway.json` defines the Railway start command and healthcheck
