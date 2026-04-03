# Zygo

Zygo is a standalone Harare-first product prototype for booking:

- city rides
- goods movement
- vehicle hire

The folder is separate from `kweli/`.

## What is here

- `site/`: mobile-first web app prototype with client-side routes for home, booking, tracking, account, and auth
- `api/`: FastAPI scaffold for auth, quotes, payments, areas, vehicles, and bookings
- `tests/`: API smoke tests using `unittest`
- `BRAND.md`: refined product brief and design logic

## Run the app locally

From `C:\Users\morge\Documents\New project`:

```powershell
python -m uvicorn zygo.api.main:app --reload
```

Then open:

- `http://127.0.0.1:8000`
- `http://127.0.0.1:8000/docs`

## Run tests

From `C:\Users\morge\Documents\New project`:

```powershell
python -m unittest zygo.tests.test_api
```

## Product logic

The main product choice is task-first routing:

1. Move me
2. Move goods
3. Hire a vehicle

That reduces the real bottleneck: users should not have to decode the full fleet before they know which vehicles fit the job.

## Railway

This repo is set up to run as one service:

- FastAPI serves the API
- FastAPI also serves the `site/` app
- Railway only needs one web process
- `railway.json` defines the Railway start command and healthcheck
