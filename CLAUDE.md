# CLAUDE.md — Fragrance Comparison Web App

This file orients Claude Code on the project. Read it fully before writing code.
Keep it updated as the project evolves.

---

## 1. What we are building

A web app for **comparing fragrances by their note composition**.

A user enters a custom fragrance — top notes, middle notes, base notes — using an
autocomplete fed by a notes database. The app computes how closely that custom
fragrance resembles each real perfume in the database and returns a report of the
**top 3 closest matches** with a **resemblance percentage** and a per-layer breakdown.

There are two surfaces:
1. **Public UI** — the fragrance input form + the comparison report.
2. **Admin dashboard** — monitor request logs, add/edit notes, add/edit perfumes.

This is a real product, not a prototype. Code should be production-quality:
typed where reasonable, tested at the core, migration-safe.

---

## 2. Tech stack (decided)

| Layer            | Choice                                  |
|------------------|-----------------------------------------|
| Backend          | Django 5.x                              |
| API              | Django REST Framework                   |
| Database         | PostgreSQL 16+                          |
| Frontend         | React + Vite + Tailwind CSS             |
| Similarity       | **Weighted Jaccard** (pure Python/NumPy)|
| Admin            | Django Admin (customized)               |
| Search           | PostgreSQL `ILIKE` + `pg_trgm`          |

### Decisions locked for v1 — do not change without asking
- **Similarity engine is weighted Jaccard, NOT scikit-learn / TF-IDF / embeddings.**
  Embeddings are a planned v2 upgrade. Write the engine behind a clean interface
  (`similarity/engine.py` exposing a single `compare()` function) so it can be
  swapped later, but implement only Jaccard now.
- **Do NOT pull scikit-learn, sentence-transformers, or any ML library into v1.**
  NumPy is the only numeric dependency.
- Note autocomplete uses Postgres `ILIKE`/`pg_trgm`, not full-text search.

---

## 3. The data

The full dataset Excel file is placed in the project directory by the owner
(~30,000 perfume entries and ~5,138 notes). Sheets in the workbook:

| Sheet            | Purpose                                              |
|------------------|------------------------------------------------------|
| `Perfumes`       | One row per perfume                                  |
| `Notes`          | Master list of notes                                 |
| `Perfume-Notes`  | M2M: which notes a perfume has, and in which layer   |
| `Accords`        | Master list of 29 accords                            |
| `Accord-Note`    | M2M: which accord each note belongs to               |

The `Notes by Accord (Normalized)` sheet (presentation only) has been removed
from the workbook by the owner — the importer will only see the five sheets above.

### Column shapes (from the schema file)

**Perfumes**: `Perfume_ID`, `Perfume_Name`, `Brand`, `Release_Year`,
`Concentration`, `Main_Accords`, `URL`
- `Perfume_ID` format: `JDOT-DB-000001` — use as the natural/primary key.
- There is **no perfumer data** — perfumers were intentionally dropped from
  scope. Do not model a Perfumer entity.

**Notes**: `Note_ID` (`NOTE-000001`), `Note_Name`

**Perfume-Notes**: `Perfume_ID`, `Note_ID`, `Layer` — `Layer` is one of
exactly `top`, `middle`, `base` (lowercase).

**Accords**: `Accord_ID` (`ACCORD-000001`), `Accord_Name` — 29 accords.

**Accord-Note**: `Accord_ID`, `Note_ID`, `Accord_Name`, `Note_Name`,
`Mapping_Source`. Each note maps to exactly one accord in v1 (many-to-one),
but **model the relation as M2M** — the mapping is known to be imperfect and a
future pass may assign a note to multiple accords. `Mapping_Source` values seen:
`fragrantica`, `keyword` (also expect `keyword_pass2`, `override`, `manual`).

### CRITICAL — sentinel / missing values
The dataset owner replaced blanks with sentinels. The importer MUST normalize:
- Text fields equal to the string `"Undefined"` → store as `NULL` / empty.
- `Release_Year` equal to `0` → store as `NULL` (it is not a real year).
- `Concentration` is mostly `"Undefined"` (~74%). Treat it as low-value,
  nullable free text for now. Do not build features on it.

`Main_Accords` in the Perfumes sheet is a denormalized convenience string.
**Do not rely on it.** The authoritative accord data is the `Accord-Note`
mapping joined through a perfume's notes.

---

## 4. Data model (Django)

App split — create these Django apps:
- `catalog` — Perfume, Note, Accord, and all relations.
- `similarity` — the comparison engine + the compare API.
- `core` — request logging, shared utilities, base settings.

### Models

```
Note
  note_id        CharField  unique, natural key ("NOTE-000001")
  name           CharField  indexed
  accords        M2M -> Accord  (through AccordNote)

Accord
  accord_id      CharField  unique ("ACCORD-000001")
  name           CharField  unique

AccordNote            # through model, M2M Note<->Accord
  note           FK Note
  accord         FK Accord
  mapping_source CharField  (fragrantica|keyword|keyword_pass2|override|manual)
  unique_together(note, accord)

Perfume
  perfume_id     CharField  unique, natural key ("JDOT-DB-000001")
  name           CharField  indexed
  brand          CharField  indexed, nullable
  release_year   IntegerField  nullable        # 0 -> NULL
  concentration  CharField  nullable           # "Undefined" -> NULL
  url            URLField  nullable
  notes          M2M -> Note  (through PerfumeNote)

PerfumeNote           # through model, carries the layer
  perfume        FK Perfume
  note           FK Note
  layer          CharField  choices = top|middle|base
  unique_together(perfume, note, layer)
  index on (perfume, layer)

ComparisonLog         # in `core` or `similarity`
  created_at     DateTimeField  auto_now_add
  top_notes      JSONField   # list of note ids submitted
  middle_notes   JSONField
  base_notes     JSONField
  results        JSONField   # the top-3 payload returned
  duration_ms    IntegerField
  ip_hash        CharField   nullable   # hashed, never store raw IP
```

Use `layer` as a `TextChoices` enum. Add DB indexes as annotated above —
similarity scoring reads `PerfumeNote` heavily.

---

## 5. The similarity engine — `similarity/engine.py`

This is the heart of the app. It gets its own module and its own tests.

Public interface (keep this stable so embeddings can be swapped in later):

```python
def compare(top_ids, middle_ids, base_ids, limit=3) -> list[MatchResult]
```

Inputs are lists of `Note` ids. Output is a ranked list of `MatchResult`
objects, each with: perfume, overall_score (0-100), and a per-layer breakdown
(top/middle/base sub-scores + which note ids overlapped).

### Algorithm — weighted Jaccard per layer

For each candidate perfume, for each layer L in {top, middle, base}:

```
J(L) = |user_notes(L) ∩ perfume_notes(L)| / |user_notes(L) ∪ perfume_notes(L)|
```

If both sets are empty for a layer, that layer is excluded from the average
(do not score it 0 or 1 — drop it and renormalize the remaining weights).

Overall score = weighted average of present layers. Default weights:

```
TOP    = 0.25
MIDDLE = 0.35
BASE   = 0.40   # base notes define a fragrance's identity most
```

Put weights in `settings` / a constants module so they are tunable.

### Frequency weighting (the "IDF" substitute)
A match on a rare note (e.g. "ambergris") should count more than a match on a
common note (e.g. "musk"). Precompute a `note_frequency` map = how many perfumes
contain each note. Weight each note's contribution to the intersection by
`1 / log(1 + frequency)` (or similar). Compute this map once via a management
command (`recompute_note_frequencies`) and cache it; do NOT recompute per request.

### Performance
~30k perfumes must be scored in well under one second. Do not loop in Python
naively over 30k rows with separate DB queries. Strategy:
- Load the perfume→layer→noteset structure into memory once (or cache it).
- Vectorize with NumPy where possible, or use Python set operations over
  preloaded dicts. Measure it; add a fast path before optimizing further.

### Accords are NOT used for v1 scoring
v1 similarity is computed on **notes only**. The accord mapping exists for
display, filtering, and the future embedding model. Do not factor accords into
the Jaccard score. (`Chypre`, `Fougere`, `Oriental` accords each have only ~1
note and are structural, not per-note — another reason to keep accords out of
scoring for now.)

### Tests (required)
Write `similarity/tests/` with synthetic fixtures:
- Identical note sets → 100%.
- Zero overlap → 0%.
- Partial overlap → hand-computed expected value.
- Empty-layer renormalization behaves correctly.
- A "golden" case: pick a known perfume, feed its own notes back, expect it
  ranked #1.

---

## 6. API — Django REST Framework

Endpoints:

```
GET  /api/notes/?q=<query>
     Autocomplete. Postgres ILIKE / pg_trgm on Note.name. Return id + name.
     Cap results (e.g. 20). Throttled.

GET  /api/notes/<id>/
     Single note detail incl. its accord(s).

POST /api/compare/
     Body: { "top": [ids], "middle": [ids], "base": [ids] }
     Validates ids exist. Runs similarity.engine.compare().
     Returns top 3 matches with per-layer breakdown.
     Writes a ComparisonLog row.
     Throttled (it is the expensive endpoint).

GET  /api/perfumes/<perfume_id>/
     Perfume detail incl. notes grouped by layer, brand, year, url.
```

- Use DRF serializers; validate that submitted note ids exist and that the
  request is not empty (at least one note across all layers).
- Apply DRF throttling to `/api/compare/` and `/api/notes/`.
- Return clear 400s with field-level errors.
- CORS: allow the Vite dev origin in dev only.

---

## 7. Frontend — React + Vite + Tailwind

### The form
Three labelled sections: **Top Notes**, **Middle Notes**, **Base Notes**.
Each is a tag-style multi-select input with autocomplete backed by
`GET /api/notes/`. Selected notes show as removable chips. Debounce the
autocomplete queries (~250ms). At least one note total is required to submit.

### The report
On submit, call `POST /api/compare/` and render the **top 3** perfumes:
- Perfume name, brand, release year (hide year if null), link out via `URL`.
- A prominent **resemblance %**.
- An expandable per-layer breakdown: top/middle/base sub-scores and which of
  the user's notes matched in each layer ("why this matched").
- Loading state while scoring; empty state if nothing meaningful matched;
  error state on API failure.

### Design — fragrance theme
The UI should feel like a perfumery, not a generic SaaS dashboard.
- Warm, refined palette: deep amber/brown, cream, muted gold accents.
  (The data workbook uses header brown `#6B4423` — stay in that family.)
- Elegant serif for headings, clean sans for body.
- Generous whitespace, restrained motion. Avoid neon gradients and glassmorphism.
- Mobile-responsive.

Keep components small and typed. No state-management library needed for v1
(local component state + a thin API client module is enough).

---

## 8. Admin dashboard

Use **Django Admin**, customized — do not build a separate React admin for v1.

Requirements:
- Register `Perfume`, `Note`, `Accord`, `AccordNote`, `PerfumeNote`.
- `Perfume` admin: searchable by name/brand, inline editor for its
  `PerfumeNote` rows (so an admin can add a fragrance and assign layered notes
  in one screen). List filters for brand, release_year, concentration.
- `Note` admin: searchable, shows mapped accord(s), `mapping_source` visible.
- `ComparisonLog` admin: **read-only**, list view with timestamp, duration,
  submitted note counts. This is the "monitor logs" requirement. Add a simple
  date-hierarchy and ordering by newest first. Do not allow edits/deletes here.
- Adding a new note and a new fragrance must both be possible entirely through
  this admin.

If a richer admin is wanted later it can become a v2 React surface; for v1,
Django Admin satisfies "add new notes and fragrances" and "monitor logs".

---

## 9. Data import

Management command: `python manage.py import_data <path-to-xlsx>`

- Reads all five sheets: `Perfumes`, `Notes`, `Perfume-Notes`, `Accords`,
  `Accord-Note`. (The workbook contains only these five.)
- Normalizes sentinels: `"Undefined"` text → NULL, `Release_Year == 0` → NULL.
- Idempotent: use `update_or_create` keyed on the natural ids
  (`perfume_id`, `note_id`, `accord_id`) so re-running does not duplicate.
- Bulk-insert relationship rows for speed (`bulk_create`, batched).
- Order: Accords → Notes → AccordNote → Perfumes → PerfumeNote.
- `--dry-run` flag that reports counts without writing.
- Print a summary: rows created/updated per table, rows skipped, warnings for
  unmatched foreign keys (e.g. a Perfume-Notes row pointing at a missing note).

Second command: `python manage.py recompute_note_frequencies`
- Builds the note→count map used by the similarity engine; stores it
  (a small table or a cached structure). Run after every import.

---

## 10. Project layout

```
backend/
  manage.py
  config/                 # settings (split: base/dev/prod), urls, wsgi
  core/                   # logging, shared utils, ComparisonLog
  catalog/                # models, admin, importer, migrations
    management/commands/
      import_data.py
      recompute_note_frequencies.py
  similarity/             # engine.py, constants, compare API, tests
  requirements.txt
  .env.example
frontend/
  src/
    components/           # NoteSelect, resultCard, etc.
    pages/                # Compare page, Result view
    api/                  # thin fetch client
  index.html
  tailwind.config.js
  package.json
README.md
CLAUDE.md                 # this file
```

---

## 11. Environment & config

- Secrets via environment variables / `.env` (never commit `.env`). Provide
  `.env.example`. Keys: `SECRET_KEY`, `DEBUG`, `DATABASE_URL`,
  `ALLOWED_HOSTS`, `CORS_ALLOWED_ORIGINS`.
- Split settings: `config/settings/base.py`, `dev.py`, `prod.py`.
- `DEBUG=False` and proper `ALLOWED_HOSTS` in prod settings.
- Enable the Postgres `pg_trgm` extension via a migration before relying on it.

---

## 12. Build order (suggested phases)

Work in this order. Finish and verify each phase before the next.

1. **Scaffold** — Django project, three apps, Postgres connection, split
   settings, `.env.example`, requirements. App should run and reach an empty DB.
2. **Models & migrations** — all models from §4, including the `pg_trgm`
   migration. Register everything in Django Admin (§8).
3. **Importer** — `import_data` + `recompute_note_frequencies` (§9). Load the
   sample workbook; confirm counts and sentinel handling.
4. **Similarity engine** — `similarity/engine.py` (§5) with full unit tests.
   This is the riskiest part; get it correct and tested before any UI.
5. **API** — DRF endpoints (§6) with serializers, validation, throttling.
6. **Frontend** — Vite + React + Tailwind, the fragrance-themed form and the
   top-3 report (§7).
7. **Admin polish** — inline note editor on Perfume, read-only ComparisonLog
   views, list filters (§8).
8. **Deployment prep** — gunicorn, static handling, prod settings, README.

---

## 13. Conventions & guardrails

- Python: type hints on function signatures; `ruff` + `black` clean.
- Keep the similarity engine framework-agnostic — it takes ids and returns
  plain objects; it must be unit-testable without a running server.
- Never store raw client IPs in `ComparisonLog` — hash them.
- Migrations must always be reviewed; never edit a migration after it ships.
- Do not introduce new heavy dependencies (especially ML libraries) without
  asking — see the locked decisions in §2.
- When something in the data is ambiguous (e.g. a note that arguably belongs
  to multiple accords), do NOT silently guess in code — surface it and ask.
- Update this file when a decision changes.

## 14. Known open items (raise before assuming)
- The accord→note mapping is **many-to-one but imperfect**; v2 may move to
  many-to-many and/or embedding-based similarity. Keep the relation modeled
  as M2M so that change is non-breaking.
- `Concentration` is ~74% `Undefined` — confirmed low-value; not a feature in v1.
