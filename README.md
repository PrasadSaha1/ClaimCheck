# ClaimCheck

A verified lost-and-found app for campuses, airports, and stations (demo places: Stony Brook, JFK Airport, LaGuardia Airport, Penn Station, Grand Central Terminal). Finders post an item with a private detail only the owner would know; owners report what they lost and see ranked matches; an item only goes back to someone who answers the claim question correctly. It runs as a **PWA**: a web app that installs to a phone's home screen and opens full-screen, with no app store.

Django serves the API and stores data in a shared TigerData Postgres database. The React frontend (Vite) proxies `/api` to Django, so everything runs from one address.

## Run on your laptop

You need two terminals. Commands below are for Windows PowerShell; on Mac or Linux use `.venv/bin/` instead of `.venv\Scripts\`.

### First time only

```powershell
cd backend
python -m venv .venv
.venv\Scripts\pip install -r requirements.txt
copy .env.example .env
# Edit .env: set GEMINI_API_KEY and the database and email settings.
.venv\Scripts\python manage.py migrate
cd ..\frontend
npm ci
```

### Every time

**Terminal 1, backend:**

```powershell
cd backend
.venv\Scripts\python manage.py runserver
```

**Terminal 2, frontend:**

```powershell
cd frontend
npm run dev
```

Open [http://localhost:5173](http://localhost:5173). Use a private window to test a second account (for example the finder and the owner).

### After you pull new code

| If the pull changed… | Run this once |
|---|---|
| `backend/requirements.txt` | `.venv\Scripts\pip install -r requirements.txt` (in `backend`) |
| a new file in `backend/api/migrations/` | `.venv\Scripts\python manage.py migrate` (in `backend`) |
| `frontend/package.json` | `npm ci` (in `frontend`) |

`migrate` updates the database's tables to match `backend/api/models.py`. Running it with nothing new is harmless. The team shares one database, so one person running it is enough. If the home screen shows "Something went wrong. Try again." right after a pull, a missing migration is the first thing to check.

**The database is shared.** `python manage.py flush` deletes every account, report, and item for the whole team, so tell everyone before running it. Never drop columns or tables by hand in the TigerData console; the app breaks until they are recreated.

## Run on your phone (PWA)

A phone can only install a PWA from an `https://` link, and `localhost` doesn't work on a phone. A tunnel gives your laptop a public HTTPS link. Your laptop must stay on and awake while the phone uses the app.

### Option A: ngrok, a permanent link (recommended for demos)

One-time setup:

1. Sign up at [dashboard.ngrok.com](https://dashboard.ngrok.com/signup) (free).
2. Under **Domains**, note your free domain, like `your-name.ngrok-free.dev`.
3. Install ngrok, then fully close and reopen VS Code so the terminal finds it:
   ```powershell
   winget install ngrok.ngrok
   ngrok update
   ```
4. Copy your token from [Your Authtoken](https://dashboard.ngrok.com/get-started/your-authtoken) and run:
   ```powershell
   ngrok config add-authtoken YOUR_TOKEN
   ```
   The token is saved on your laptop. Never commit it.

Every time, with terminals 1 and 2 running, open **terminal 3**:

```powershell
ngrok http 5173 --url https://your-name.ngrok-free.dev
```

Wait for `Session Status: online`. The link never changes, so the phone app only has to be installed once.

### Option B: Cloudflare, no account

```powershell
winget install Cloudflare.cloudflared
cloudflared tunnel --url http://localhost:5173
```

It prints a `https://…trycloudflare.com` link. The link **changes every time** you restart it, so you would reinstall the app on the phone each time.

### Install it on the phone

1. Open the tunnel link. ngrok shows a warning page the first time; tap **Visit Site**.
2. Install:
   - **iPhone:** open the link in **Safari**, tap **Share** (square with an arrow), then **Add to Home Screen**, then **Add**.
   - **Android:** open the link in **Chrome**, tap **⋮**, then **Install app** or **Add to Home screen**.
3. Open **ClaimCheck** from the home screen. It runs full-screen like a native app.

Notes:

- The phone can be on any internet connection, not only your Wi-Fi.
- Sign-up works on the phone. The verification email links back to the address you signed up from, so tap it on the same phone.
- The found form can pin your location automatically because the link is HTTPS. Allow location when the phone asks.
- Photos are saved on the laptop that runs the backend. Photos a teammate posted from their own laptop don't show up on yours, so post demo items from the laptop you present on.
- iPhone photos (HEIC) are supported.

## Gemini and maps

Put `GEMINI_API_KEY` in `backend/.env` to turn on photo review, "Describe with Gemini", meaning-based matching, and claim answer checks. Restart Django after changing it. Optionally set `GEMINI_MODEL` (default: `gemini-3.5-flash-lite`). The key never reaches the browser. Maps use OpenStreetMap through Leaflet; no Google Maps key is needed.

Without a Gemini key the app still works as a demo: matching uses keywords, location, and time; found photos stay private; and claims go to the finder for manual approval.

## Places, icons, and notifications

- **Places** are listed in `backend/api/sites.py`. Add one entry (name, map area, drop-off desks) to add a place.
- **App icons** are drawn by `frontend/scripts/generate_icons.py` from the same ticket logo as `frontend/public/favicon.svg`. Run `python scripts/generate_icons.py` in `frontend` after changing the logo. Phones keep the icon from when the app was installed, so reinstall to see a new one.
- **Notifications** are in-app (the Inbox). Each user turns kinds on or off in **Profile**.

## Demo scope

This is a demo: do not put real personal data on it or leave a tunnel running unattended. Found posts have no public feed; an owner only sees items that match their report. Uploaded photos are re-encoded to remove location data, and public photos are shown only when Gemini marks them safe.

## Checks

```powershell
cd frontend
npm run build
```

`backend/.venv/Scripts/python backend/manage.py test api` runs the API tests. Django's test runner needs to create a test database, which TigerData does not allow, so run the tests against a local SQLite settings file.
