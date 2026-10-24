# ClaimCheck

A Stony Brook lost-and-found PWA demo. People can post found items, report lost items, see ranked matches, claim an item, and arrange a handoff. Django stores data in SQLite and serves a same-origin API through Vite's local proxy.

## Run locally

In one terminal:

```sh
cd backend
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt
cp .env.example .env
# Edit .env and set GEMINI_API_KEY to your Google AI Studio API key.
.venv/bin/python manage.py migrate
.venv/bin/python manage.py runserver
```

In a second terminal:

```sh
cd frontend
npm ci
npm run dev
```

Open [http://localhost:5173](http://localhost:5173). Use a separate browser profile or private window to test the finder and owner as two demo users.

## Gemini and maps

Put `GEMINI_API_KEY` in `backend/.env` to enable image review, semantic embeddings, and claim answer checks. Django loads that file when it starts, so restart Django after changing the key. Optionally set `GEMINI_MODEL` (default: `gemini-2.5-flash-lite`). The key is never sent to the browser. The map uses OpenStreetMap tiles through Leaflet; no Google Maps key is needed.

Without a Gemini key, the app still works as a demo: matching uses keywords plus location and time, found photos stay private, and claims go to the finder for manual approval. The PWA caches its app shell for offline opening; reports and claims require a connection.

## Demo scope

Demo profiles are session-based and do **not** authenticate people. Do not expose this server publicly with real user data. Found posts have no browse feed; a lost report must match an item before its detail can be opened. Uploaded images are re-encoded to remove EXIF metadata. Public found photos are shown only when Gemini review marks them safe.

Run `backend/.venv/bin/python backend/manage.py test api` and `npm run build` in `frontend` to check the API flow and PWA build.
