# Nish workstream checklist

Status against [nish.md](nish.md), audited 2026-10-24. A checked box means the **full task and its acceptance criteria** are complete. “Partial” identifies code that exists but does not yet satisfy the spec. This is a status report, not a change to the original plan.

## Implemented pieces

- [x] Server-side Gemini REST adapter for structured found-item review, lost-photo description, text embeddings, and claim verdicts ([backend/api/ai.py](backend/api/ai.py)).
- [x] Backend environment loading and [backend/.env.example](backend/.env.example). **Live Gemini calls are unverified**; no local API key is configured.
- [x] Upload size/type checks, EXIF stripping, JPEG re-encoding, and private photo access ([backend/api/views.py](backend/api/views.py)).
- [x] A basic hybrid match score using keywords, optional embedding cosine similarity, distance, time, and category. Results are capped at ten.
- [x] Claim flow with two failed-answer attempts, manual review, optional proof photo, finder decision, and handoff.
- [x] Two local Django flow tests cover matching, photo privacy, manual claim, approval, and return ([backend/api/tests.py](backend/api/tests.py)).

## Phase B0 — Spike and stubs

- [ ] **B0.1 — Gemini spike.** Not done: no real photo-to-analysis/embedding experiment or recorded right-versus-wrong cosine values.
- [ ] **B0.2 — Freeze the A/B interface.** No evidence of the specified CP0.5 agreement; current code uses a different `api` package and function signatures.
- [ ] **B0.3 — Contract stubs and deterministic mock mode.** Not done: no `GEMINI_MOCK`, `gemini_mock.py`, `ai_errors.py`, or section-2-compatible stubs. Current no-key fallback is basic/manual rather than the requested deterministic mock.

## Phase B1 — Gemini and images

- [ ] **B1.1 — Schemas and prompts (partial).** Inline prompts and JSON parsing exist; separate schemas/prompts, multiple hidden details, and bounding boxes do not.
- [ ] **B1.2 — Gemini client (partial).** Generate, embedding, and judge calls exist. Missing retries, raised `AIUnavailable`, latency/token logging, deterministic mock mode, and verified live calls.
- [ ] **B1.3 — Image utilities (partial).** Size/type checks, EXIF transpose, JPEG conversion, and EXIF removal exist. Missing HEIF support, 1600 px cap, box blur, whole-image blur fallback, and image-specific unit tests.

## Phase B2 — Pipeline

- [ ] **B2.1 — Thirty-plus seed photos.** No `seed/photos/` set or decoys.
- [ ] **B2.2 — Found analysis pipeline (partial).** Found posts are normalized, reviewed, embedded, and stored. Missing the specified pipeline interface, SHA-256 cache, multiple `HiddenDetail` records, bounding boxes/public blur, failed-analysis status and retry, and pipeline tests.
- [ ] **B2.3 — Lost embedding pipeline (partial).** Lost descriptions and optional owner photos feed an embedding call. Missing text-hash cache, `embed_lost_report` interface/return value, and verified 768-dimensional live vector.

## Phase B3 — Matching

- [ ] **B3.1 — Pure scoring functions (partial).** Haversine and weighted score are inline in `matches_for`. Missing separate components, configurable floors/ceilings and weight renormalization, confidence rules, and 12 scoring tests.
- [ ] **B3.2 — Matching queries (partial).** Owner-facing top-ten matches work locally. Missing pgvector top-50 candidate query, `matches_for_lost`/`matches_for_found` contract objects, breakdown/rank fields, and real-photo top-three evaluation.

## Phase B4 — Verification

- [ ] **B4.1 — Decision thresholds (partial).** Gemini returns pass/fail/unsure. Missing confidence-based `decide`, claimant-safe message function, and threshold-boundary tests.
- [ ] **B4.2 — Contract verification (partial).** One private detail and answer are judged; pending results go to the finder. Missing multiple hidden-detail pairs, `VerificationResult`, propagated `AIUnavailable`, and live correct/wrong/injection checks.

## Phase B5 — Seed, evaluation, tuning

- [ ] **B5.1 — Seed manifest.** No 30-found/10-lost YAML dataset.
- [ ] **B5.2 — `seed_demo` and cache.** No management command or committed analysis/embedding cache.
- [ ] **B5.3 — `eval_matching` and top-three target.** No evaluation command, metrics, or measured ≥90% top-three result.
- [ ] **B5.4 — Location/time weights (partial).** Both influence local ranking, but the specified 0.15/0.15 tuned weights have not been evaluated against decoys.

## Phase B6 — Hardening and delivery

- [ ] **B6.1 — Sensitive-item mock ID path (partial).** No-key fallback uses a generic public description and hides found photos, but the specified mock ID case is not tested.
- [ ] **B6.2 — Visual blur audit.** No blurred public images or by-eye review.
- [ ] **B6.3 — Owner-photo matching (partial).** Gemini can describe owner photos for text embeddings, but this contract addition has not been agreed/evaluated.
- [ ] **B6.4 — Production demo three times.** No production run or latency record.
- [ ] **B6.5 — Devpost AI write-up.** Not written.

## Definition of done

- [ ] Every section-2 function has the exact contract, live Gemini path, and deterministic mock path.
- [ ] Nish unit suite passes with `GEMINI_MOCK=true`.
- [ ] `eval_matching` reports top-three ≥90% and final production weights.
- [ ] Committed cache makes production seeding use zero Gemini calls.
- [ ] All planned objects pass the complete production demo three times.

**Current full-task count: 0/22.** The checked “implemented pieces” above are real progress, but each corresponding Nish task has additional acceptance criteria outstanding.
