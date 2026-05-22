# Fragrance Comparer

A web app for comparing fragrances by their note composition. Enter top, middle,
and base notes; the engine returns the top 3 closest-matching real perfumes with
a resemblance percentage and a per-layer breakdown.

---

## Prerequisites

| Tool | Minimum version |
|------|----------------|
| Python | 3.12 |
| Node.js | 20 LTS |
| PostgreSQL | 16 |

---

## Backend setup

```bash
# 1. Create and activate a virtual environment
cd backend
python -m venv .venv
# Windows
.venv\Scripts\activate
# macOS / Linux
source .venv/bin/activate

# 2. Install dependencies
pip install -r requirements.txt

# 3. Create the database
# Connect to psql as a superuser and run:
#   CREATE DATABASE fragrance_comparer;

# 4. Copy and fill in environment variables
cp .env.example .env
# Edit .env — set SECRET_KEY, DATABASE_URL (with your DB credentials), etc.

# 5. Run migrations (enables pg_trgm and applies all schema migrations)
python manage.py migrate

# 6. Create a Django superuser (for the admin dashboard)
python manage.py createsuperuser

# 7. Start the development server
python manage.py runserver
# Server runs at http://localhost:8000
```

---

## Frontend setup

```bash
# From the repo root
cd frontend

# 1. Install dependencies
npm install

# 2. Start the Vite dev server
npm run dev
# Server runs at http://localhost:5173
```

The Vite dev server proxies `/api/*` requests to `http://localhost:8000`, so
both servers must be running during development.

---

## Useful commands

```bash
# Backend — check for configuration errors
python manage.py check

# Backend — lint
cd backend
ruff check .
black --check .

# Frontend — build for production
cd frontend
npm run build
```

---

## Project structure

```
backend/
  manage.py
  config/           # Settings (base / dev / prod), urls, wsgi, asgi
  core/             # Shared utilities, request logging
  catalog/          # Perfume, Note, Accord models + data importer
  similarity/       # Weighted Jaccard engine + compare API
  requirements.txt
  .env.example
frontend/
  src/
    components/     # Reusable UI components
    pages/          # Page-level views
    api/            # Thin fetch client
  index.html
  vite.config.js
  tailwind.config.js
  package.json
```
