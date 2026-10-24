# ClaimCheck — Backend Part A: Core API & Data (Backend Dev A)

> Splits `plan_backend.md` into two parallel workstreams. **Part A (this file): Django project, database, auth, REST endpoints, media, notifications, deploy.** Part B (`plan_backend_B_ai.md`): Gemini, image processing, matching, verification, seed + eval.
> `plan_backend.md` stays the **reference spec**: the API contract (§4), env vars (§10), setup (§11), deploy (§12), cut list (§13), demo checklist (§14) are unchanged and not repeated here. `plan_frontend.md` is unchanged.

---

## 1. Ownership split [SHARED A/B]

| Area | Part A — Core API & Data | Part B — AI & Matching |
|---|---|---|
| Django project, `settings.py`, `urls.py`, env loading | ✅ | requests new env vars from A |
| Models, migrations, admin | ✅ | reads models, never edits them |
| Serializers, views, permissions, error envelope | ✅ | — |
| Auth, meta, health, media serving + signed URLs | ✅ | — |
| Notifications service + endpoints | ✅ | calls A's hooks |
| Gemini client, prompts, schemas, mock mode | — | ✅ |
| Image normalize / EXIF strip / blur | — | ✅ |
| Found analysis pipeline, lost embedding | — | ✅ |
| Matching score + pgvector queries | — | ✅ |
| Claim verification (judge + decision rule) | — | ✅ |
| Seed photos, `seed_demo`, `eval_matching`, `cache.json` | — | ✅ |
| API tests, leak test, smoke script | ✅ | — |
| Unit tests for scoring, verification, images, pipeline | — | ✅ |
| Railway deploy, prod env, CORS | ✅ | — |
| Devpost "How we built it" | writes API/data part | writes AI/matching part |

### File ownership (prevents merge conflicts) [SHARED A/B]

```
backend/
├── config/                         A
├── claimcheck/
│   ├── enums.py                    A (B reads)
│   ├── models.py, migrations/      A
│   ├── admin.py                    A
│   ├── exceptions.py               A
│   ├── permissions.py              A
│   ├── serializers.py              A
│   ├── urls.py, views/             A
│   ├── data/campus_places.json     A
│   ├── services/
│   │   ├── ai_errors.py            B   (exceptions A catches)
│   │   ├── gemini.py               B
│   │   ├── gemini_mock.py          B
│   │   ├── prompts.py              B
│   │   ├── schemas.py              B
│   │   ├── images.py               B
│   │   ├── pipeline.py             B   (found analysis + lost embedding)
│   │   ├── matching.py             B
│   │   ├── verification.py         B
│   │   ├── notifications.py        A   (B calls the hooks)
│   │   └── signing.py              A
│   ├── management/commands/        B
│   └── tests/
│       ├── test_auth.py, test_*_api.py, test_notifications.py, test_leaks.py   A
│       └── test_scoring.py, test_verification.py, test_images.py, test_pipeline.py   B
├── seed/                           B
└── scripts/spike_gemini.py         B · scripts/smoke.sh  A
```

Rule: never edit the other person's files. Need a change? Message them, or open a tiny PR they merge.

---

## 2. Internal interface contract (A ↔ B) [SHARED A/B]

Frozen at **CP0.5 (Sat ~12:45 AM)**. B ships **stubs with these exact signatures in the first 30 minutes** (mock-backed), so A is never blocked.

```python
# services/ai_errors.py  (B)
class AIUnavailable(Exception): ...          # A maps → 503 AI_UNAVAILABLE
class UnsupportedImage(Exception): ...       # A maps → 415 UNSUPPORTED_IMAGE
class ImageTooLarge(Exception): ...          # A maps → 413 PAYLOAD_TOO_LARGE

# services/pipeline.py  (B)
def create_found_item(*, finder: User, upload: UploadedFile, lat: float, lng: float,
                      location_note: str, found_at: datetime, pickup_instructions: str,
                      category: str | None, private_hint: str | None,
                      private_answer: str | None, batch_id: UUID | None = None) -> FoundItem:
    """Validates + stores image, runs analysis. Returns saved item with status
    'available' or 'failed' (analysis_error set). Raises UnsupportedImage/ImageTooLarge
    BEFORE saving anything. Never raises AIUnavailable (records it as 'failed').
    Calls notifications.on_found_available(item) when it becomes available."""

def reanalyze_found_item(item: FoundItem) -> FoundItem:
    """For status 'failed'. Same outcome rules as above."""

def embed_lost_report(report: LostReport) -> bool:
    """Sets + saves report.embedding. Returns False on AI failure (embedding stays None)."""

# services/matching.py  (B)
@dataclass
class MatchResult:
    rank: int
    score: float                 # 0..1
    confidence: str              # "high" | "medium" | "low"
    breakdown: dict              # {"similarity","category","location","time"} 0..1
    distance_m: float
    found_item: FoundItem | None = None    # set by matches_for_lost
    lost_report: LostReport | None = None  # set by matches_for_found

def matches_for_lost(report: LostReport, limit: int = 10) -> list[MatchResult]: ...
def matches_for_found(item: FoundItem, limit: int = 10) -> list[MatchResult]: ...
# Both return [] if the source embedding is None; they never raise AIUnavailable.

# services/verification.py  (B)
@dataclass
class VerificationResult:
    status: str                  # "approved" | "rejected" | "pending_review"
    decided_by: str | None       # "ai" or None (pending)
    ai_verdict: str              # "match" | "no_match" | "uncertain"
    ai_confidence: float
    ai_reason: str
    message: str                 # claimant-safe text

def verify_claim(item: FoundItem, answers: list[dict]) -> VerificationResult:
    """answers = [{"hidden_detail_id": str, "answer": str}] already validated by A
    (exactly one per hidden detail). Raises AIUnavailable (A returns 503, no attempt saved)."""

# services/notifications.py  (A) — B calls these
def on_found_available(item: FoundItem) -> None: ...
def on_lost_created(report: LostReport) -> None: ...
```

Model field names B relies on are exactly those in `plan_backend.md` task B1.2. A must not rename them without telling B.

---

## 3. Part A responsibilities

Django project and settings, Postgres + pgvector schema, all REST endpoints in the contract (§4 of `plan_backend.md`), auth, error envelope, media storage and signed URLs, notifications, API tests, leak test, smoke script, Railway deploy and prod environment, working with Dev 2 (frontend) at every checkpoint.

---

## 4. Tasks

Priority: `P0` demo fails without it · `P1` should-have · `P2` hardening · `P3` stretch.
"Spec" points to the detailed instructions in `plan_backend.md`.

### Phase A0 — Kickoff and skeleton (Sat 12:15 AM → 1:30 AM)

- [ ] **A0.1 (P0)** Create the monorepo, add all devs, commit the four plan files and `shared/API_CONTRACT.md`. Spec: B0.1.
  - AC: Everyone can clone; contract file present.
- [ ] **A0.2 (P0)** CP0 with Dev 2 (API contract) and CP0.5 with Dev B (section 2 interface). Spec: B0.2.
  - AC: Both contracts marked frozen in a commit.
- [ ] **A0.3 (P0)** `docker-compose.yml` with `pgvector/pgvector:pg16`. Spec: B0.4, §11.
  - AC: `CREATE EXTENSION vector;` works locally.
- [ ] **A0.4 (P0)** Scaffold Django + DRF + CORS + whitenoise, settings via `django-environ` with **every** env var from §10 already declared (so B never edits settings), `GET /api/health/` (`ai` reads `GEMINI_MOCK`/`GEMINI_API_KEY`). Create empty `services/` package and `services/notifications.py` with no-op `on_found_available` / `on_lost_created`. Spec: B0.5.
  - AC: `curl localhost:8000/api/health/` returns the contract shape. Push to `main` by 1:00 AM so B can start on top of it.
- [ ] **A0.5 (P0)** Railway deploy of the skeleton (Postgres with pgvector, volume `/data`, env vars, Procfile). Spec: B0.6, §12.
  - AC: Prod `/api/health/` → 200, `db: true`. URL sent to Dev 2 and Dev B.

### Phase A1 — Data layer, auth, meta, media (Sat 1:30 AM → 4:00 AM)

- [ ] **A1.1 (P0)** `enums.py`. Spec: B1.1.
  - AC: Values match contract §4.3.
- [ ] **A1.2 (P0)** All models + `VectorExtension()` first in `0001_initial`. Spec: B1.2, B1.3.
  - AC: Fresh DB migrates with no manual SQL. **Push by 2:30 AM and tell B** (B's query code depends on it).
- [ ] **A1.3 (P0)** `exceptions.py`: `ApiError`, DRF handler producing the envelope, `handler404/500` for `/api/`. Map B's `AIUnavailable` → 503 `AI_UNAVAILABLE`, `UnsupportedImage` → 415, `ImageTooLarge` → 413 inside the handler, so views can let them propagate. Spec: B1.4.
  - AC: Test: raising `AIUnavailable` in a view returns 503 with envelope.
- [ ] **A1.4 (P0)** Auth endpoints (register, login, me, logout). Spec: B1.5.
  - AC: `test_auth.py` passes.
- [ ] **A1.5 (P0)** `shared/campus_places.json` + copy to `claimcheck/data/`; `GET /api/meta/`. Spec: B1.6, B1.7.
  - AC: Places land on correct buildings; meta validates against `Meta`.
- [ ] **A1.6 (P0)** Media serving: public route restricted to `MEDIA_ROOT/public`, signed private route, `private_url()` helper in `services/signing.py`. Spec: B1.8.
  - AC: Tampered/expired token → 404; private files unreachable via public route.
- [ ] **A1.7 (P1)** Admin registration for all models. Spec: B1.9.
- [ ] **A1.8 (P0)** Demo users via data migration or `ensure_demo_users` call at startup (fiona/alex/ivan/desk, `DEMO_PASSWORD`) so Dev 2 can log in before B's seed exists.
  - AC: Quick-login works on prod.

**CP1 (≈4:00 AM):** prod auth + meta live; Dev 2 logs in from Vercel. Sleep 4:00–8:30 AM.

### Phase A2 — Found + lost endpoints (Sat 8:30 AM → 12:00 PM) — CRITICAL PATH

- [ ] **A2.1 (P0)** Found serializers: public, private (signed `photo_url`, `claim_counts`), create (contract validation: both-or-neither private pair, `found_at ≤ now+5min`, lat/lng ranges, size check before calling B). Spec: B2.6.
  - AC: Other users never receive private keys.
- [ ] **A2.2 (P0)** Found views calling B's pipeline: `POST /found/` → `pipeline.create_found_item(...)` → 201 private serializer; `GET /found/?scope=public|mine&category=`; `GET /found/{id}/` (owner private / others public if `available|claimed`, else 404); `POST /found/{id}/reanalyze/` → `pipeline.reanalyze_found_item`; `POST /found/{id}/hidden-details/` (max 3). Spec: B2.7.
  - AC: With `GEMINI_MOCK=true`, create returns `available` with hints; with B's stub raising `UnsupportedImage` → 415.
- [ ] **A2.3 (P0)** Lost serializers + views: create (validation rules; then `pipeline.embed_lost_report(report)`; then `notifications.on_lost_created(report)`), list/retrieve own, PATCH status. Spec: B3.3.
  - AC: `test_lost_api.py` validation cases pass.
- [ ] **A2.4 (P0)** Match endpoints serializing B's `MatchResult`: `GET /lost/{id}/matches/` (if `report.embedding is None`, call `embed_lost_report` again; still `False` → 503), `GET /found/{id}/matches/` (finder only, `LostReportSummary`). `match_count`/`top_score` on `LostReport` from `matches_for_lost`. Spec: B3.3, B3.4.
  - AC: Response matches contract `FoundMatch`/`LostMatch` exactly (`rank`, `score`, `confidence`, `breakdown`, `distance_m`, nested object).

**CP2 (≈1:30 PM):** real photo → vague lost report → top-3 match on prod, through the frontend.

### Phase A3 — Claim endpoints (Sat 1:30 PM → 4:30 PM) — CRITICAL PATH

- [ ] **A3.1 (P0)** `POST /found/{id}/claims/`: transaction + `select_for_update()`; checks `OWN_ITEM` (403), `ITEM_NOT_CLAIMABLE` (409), answers cover exactly the item's hidden detail IDs (400), attempts < `CLAIM_MAX_ATTEMPTS` (429); call `verification.verify_claim(item, answers)` (`AIUnavailable` → 503, nothing saved); save `Claim` from `VerificationResult`; approved → item `claimed`, owned `lost_report` → `resolved`; trigger claim notifications (A4.1). Spec: B4.3.
  - AC: `test_claims_api.py`: imposter rejected without pickup, owner approved with pickup, 4th attempt 429, claim after approval 409, own item 403, AI failure 503 without consuming an attempt.
- [ ] **A3.2 (P0)** `GET /claims/`, `GET /claims/{id}/` (claimant → `Claim`; finder → `ClaimForFinder` with `answers[].expected`), `GET /found/{id}/claims/`. Spec: B4.4.
  - AC: Claimant responses never include `expected`, `ai_reason`, `ai_verdict`.
- [ ] **A3.3 (P1)** `POST /claims/{id}/decision/` (finder; `NOT_PENDING`, `ITEM_NOT_CLAIMABLE`). Spec: B4.5.
- [ ] **A3.4 (P0)** `test_leaks.py`. Spec: B4.6.
  - AC: Passes; run before every deploy.

**CP3 (≈5:00 PM):** imposter rejected, owner stamped, on prod.

### Phase A4 — Notifications (Sat 6:30 PM → 9:00 PM)

- [ ] **A4.1 (P1)** Implement `services/notifications.py`: `on_found_available` and `on_lost_created` (use B's `matches_for_found` / `matches_for_lost`, threshold `MATCH_ALERT_THRESHOLD`, dedupe via `MatchAlert`), plus claim notifications (`claim_needs_review`, `item_claimed`, `claim_approved`, `claim_rejected`). Spec: B5.2.
  - AC: `test_notifications.py`: one `new_match` per pair, no duplicates on repost.
- [ ] **A4.2 (P1)** `GET /notifications/`, `POST /notifications/mark-read/`. Spec: B5.3.
  - AC: Contract shapes; other users' IDs ignored.

**CP4 (≈9:30 PM):** all mocks off on the frontend; full demo on two phones.

### Phase A5 — Hardening and prod (Sat 9:30 PM → Sun 9:00 AM)

- [ ] **A5.1 (P2)** Request logging middleware. Spec: B7.2.
- [ ] **A5.2 (P2)** `scripts/smoke.sh`. Spec: B7.3.
  - AC: Green against prod.
- [ ] **A5.3 (P2)** Auth throttling. Spec: B7.4.
- [ ] **A5.4 (P3)** Bulk endpoints (`POST /found/bulk/`, `GET /found/batches/{id}/`) using B's `create_found_item(..., batch_id=...)` in a `ThreadPoolExecutor(3)`, `close_old_connections()` per worker. Spec: B8.1. Only after CP4 + dry run.
- [ ] **A5.5 (P0)** Feature freeze 4:00 AM; prod `SEED_ON_DEPLOY=true` (B's command), smoke + leak test green; `/api/health/` → `ai: "live"` before judging. Spec: B9.
- [ ] **A5.6 (P0)** Devpost "How we built it" — API/data half (Django, pgvector, token auth, signed media, leak test).

---

## 5. Integration checkpoints with Dev B [SHARED A/B]

| When | A gives B | B gives A | Pass when |
|---|---|---|---|
| Sat 12:45 AM (CP0.5) | — | — | Section 2 frozen |
| Sat 1:00 AM | Django skeleton on `main`, all env vars declared | — | B runs `runserver` on it |
| Sat 1:15 AM | — | Stubs for every section-2 function (mock-backed) | A imports them; `GEMINI_MOCK=true` works |
| Sat 2:30 AM | Models + migrations on `main` | — | B's query code compiles against models |
| Sat 11:00 AM | Found/lost views wired to pipeline | Real Gemini pipeline + matching on `main` | Prod: photo → `available` with real hidden details |
| Sat 1:30 PM (CP2) | Match endpoints | Matching quality on seed set | Top-3 on prod with real photos |
| Sat 4:00 PM | Claim view wired | Real `verify_claim` | Imposter/owner cases correct on prod |
| Sat 6:30 PM | Notifications | Tuned weights + `seed_demo` | Prod seeded, alerts fire |

---

## 6. Testing

```bash
GEMINI_MOCK=true pytest -q claimcheck/tests/test_auth.py claimcheck/tests/test_found_api.py \
  claimcheck/tests/test_lost_api.py claimcheck/tests/test_claims_api.py \
  claimcheck/tests/test_notifications.py claimcheck/tests/test_leaks.py
bash scripts/smoke.sh https://<app>.up.railway.app
```

A's tests use B's mock mode, never live Gemini.

---

## 7. Definition of done (Part A)

- [ ] Every endpoint in the contract returns exact shapes and the error envelope on prod.
- [ ] All A tests pass with `GEMINI_MOCK=true`; leak test green on the deployed commit.
- [ ] Prod deployed, seeded, CORS correct for the Vercel domain, `DEBUG=false`, Gemini key only in env.
- [ ] Smoke script green; demo script runs on prod 3× in a row with no manual DB edits.
