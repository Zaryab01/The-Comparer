# D:\Zaryab\Fragrance Comparer\start-backend.ps1
# Starts PostgreSQL (if not already running) then launches the Django dev server.

$ROOT        = $PSScriptRoot
$PGCTL       = "$ROOT\pgsql\bin\pg_ctl.exe"
$PGDATA      = "$ROOT\pgsql\data"
$PGLOG       = "$ROOT\pgsql\pg.log"
$PYTHON      = "$ROOT\backend\.venv\Scripts\python.exe"
$BACKEND_DIR = "$ROOT\backend"

Write-Host ""
Write-Host "  Fragrance Comparer -- Backend Launcher" -ForegroundColor DarkYellow
Write-Host "  --------------------------------------" -ForegroundColor DarkYellow
Write-Host ""

# ── 1. Start PostgreSQL ────────────────────────────────────────────────────────
$pgListening = netstat -ano | Select-String ":5432 "
if ($pgListening) {
    Write-Host "  [postgres]  Already running on port 5432." -ForegroundColor Green
} else {
    Write-Host "  [postgres]  Starting..." -ForegroundColor Cyan
    & $PGCTL start -D $PGDATA -l $PGLOG -w

    $pgListening = netstat -ano | Select-String ":5432 "
    if ($pgListening) {
        Write-Host "  [postgres]  Started successfully." -ForegroundColor Green
    } else {
        Write-Host "  [postgres]  ERROR -- could not start. Check: $PGLOG" -ForegroundColor Red
        exit 1
    }
}

# ── 2. Start Django ────────────────────────────────────────────────────────────
Write-Host ""
Write-Host "  [django]    Starting on http://127.0.0.1:8000 ..." -ForegroundColor Cyan
Write-Host "  [django]    Press Ctrl+C to stop." -ForegroundColor DarkGray
Write-Host ""

$env:DJANGO_SETTINGS_MODULE = "config.settings.dev"
Set-Location $BACKEND_DIR
& $PYTHON manage.py runserver 127.0.0.1:8000 --noreload
