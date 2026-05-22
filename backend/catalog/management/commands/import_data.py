"""
Management command: import_data

Usage:
    python manage.py import_data <path-to-xlsx> [--dry-run]

Reads five sheets from the workbook in order:
    Accords → Notes → Accord-Note → Perfumes → Perfume-Notes

Normalises sentinels:
    - Text == "Undefined"  → NULL / blank
    - Release_Year == 0    → NULL

Idempotent: uses update_or_create keyed on natural ids.
Bulk-inserts M2M through-table rows in batches.
"""

from __future__ import annotations

import sys
from pathlib import Path

import openpyxl
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

from catalog.models import Accord, AccordNote, Note, Perfume, PerfumeNote

BATCH = 2000  # rows per bulk_create call


def _clean(value: object) -> str | None:
    """Return None for blank / Undefined sentinel; str otherwise."""
    if value is None:
        return None
    s = str(value).strip()
    return None if s in ("", "Undefined") else s


def _clean_year(value: object) -> int | None:
    try:
        y = int(value)
    except (TypeError, ValueError):
        return None
    return None if y == 0 else y


class Command(BaseCommand):
    help = "Import perfume data from the project Excel workbook."

    def add_arguments(self, parser):
        parser.add_argument("xlsx", type=Path, help="Path to Perfume_Database.xlsx")
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Report row counts without writing to the database.",
        )

    def handle(self, *args, **options):
        xlsx: Path = options["xlsx"]
        dry_run: bool = options["dry_run"]

        if not xlsx.exists():
            raise CommandError(f"File not found: {xlsx}")

        self.stdout.write(f"Opening {xlsx} …")
        wb = openpyxl.load_workbook(xlsx, read_only=True, data_only=True)

        try:
            stats = self._import(wb, dry_run)
        finally:
            wb.close()

        self.stdout.write("\n" + "=" * 60)
        self.stdout.write("SUMMARY" + (" (dry-run — nothing written)" if dry_run else ""))
        self.stdout.write("=" * 60)
        for table, counts in stats.items():
            self.stdout.write(
                f"  {table:20s}  created={counts['created']:>6}  "
                f"updated={counts['updated']:>6}  skipped={counts['skipped']:>6}"
            )

    # ------------------------------------------------------------------
    def _import(self, wb: openpyxl.Workbook, dry_run: bool) -> dict:
        stats: dict[str, dict] = {}

        with transaction.atomic():
            stats["Accord"] = self._load_accords(wb, dry_run)
            stats["Note"] = self._load_notes(wb, dry_run)
            stats["AccordNote"] = self._load_accord_notes(wb, dry_run)
            stats["Perfume"] = self._load_perfumes(wb, dry_run)
            stats["PerfumeNote"] = self._load_perfume_notes(wb, dry_run)

            if dry_run:
                transaction.set_rollback(True)

        return stats

    # ------------------------------------------------------------------
    def _load_accords(self, wb, dry_run: bool) -> dict:
        ws = wb["Accords"]
        created = updated = skipped = 0

        for row in ws.iter_rows(min_row=2, values_only=True):
            accord_id, accord_name = row[0], row[1]
            if not accord_id:
                skipped += 1
                continue
            _, was_created = Accord.objects.update_or_create(
                accord_id=str(accord_id).strip(),
                defaults={"name": str(accord_name).strip()},
            )
            if was_created:
                created += 1
            else:
                updated += 1

        self.stdout.write(f"  Accords:      created={created}  updated={updated}  skipped={skipped}")
        return {"created": created, "updated": updated, "skipped": skipped}

    # ------------------------------------------------------------------
    def _load_notes(self, wb, dry_run: bool) -> dict:
        ws = wb["Notes"]
        created = updated = skipped = 0

        for row in ws.iter_rows(min_row=2, values_only=True):
            note_id, note_name = row[0], row[1]
            if not note_id:
                skipped += 1
                continue
            _, was_created = Note.objects.update_or_create(
                note_id=str(note_id).strip(),
                defaults={"name": str(note_name).strip()},
            )
            if was_created:
                created += 1
            else:
                updated += 1

        self.stdout.write(f"  Notes:        created={created}  updated={updated}  skipped={skipped}")
        return {"created": created, "updated": updated, "skipped": skipped}

    # ------------------------------------------------------------------
    def _load_accord_notes(self, wb, dry_run: bool) -> dict:
        ws = wb["Accord-Note"]
        created = skipped = 0
        updated = 0

        # Build lookup maps to avoid per-row queries
        accord_map = {a.accord_id: a for a in Accord.objects.all()}
        note_map = {n.note_id: n for n in Note.objects.all()}

        batch: list[AccordNote] = []

        for row in ws.iter_rows(min_row=2, values_only=True):
            accord_id, note_id, _aname, _nname, mapping_source = row[:5]
            accord_id = str(accord_id).strip() if accord_id else None
            note_id = str(note_id).strip() if note_id else None
            mapping_source = _clean(mapping_source) or "fragrantica"

            accord = accord_map.get(accord_id)
            note = note_map.get(note_id)

            if not accord or not note:
                skipped += 1
                if not accord:
                    self.stderr.write(f"  WARN AccordNote: unknown accord_id={accord_id}")
                if not note:
                    self.stderr.write(f"  WARN AccordNote: unknown note_id={note_id}")
                continue

            batch.append(
                AccordNote(note=note, accord=accord, mapping_source=mapping_source)
            )

            if len(batch) >= BATCH:
                c = self._flush_accord_notes(batch)
                created += c
                batch.clear()

        if batch:
            c = self._flush_accord_notes(batch)
            created += c

        self.stdout.write(f"  AccordNote:   created={created}  updated={updated}  skipped={skipped}")
        return {"created": created, "updated": updated, "skipped": skipped}

    def _flush_accord_notes(self, batch: list[AccordNote]) -> int:
        result = AccordNote.objects.bulk_create(
            batch,
            update_conflicts=True,
            update_fields=["mapping_source"],
            unique_fields=["note", "accord"],
        )
        return len(result)

    # ------------------------------------------------------------------
    def _load_perfumes(self, wb, dry_run: bool) -> dict:
        ws = wb["Perfumes"]
        created = updated = skipped = 0
        total = 0

        for row in ws.iter_rows(min_row=2, values_only=True):
            if not row[0]:
                skipped += 1
                continue
            perfume_id = str(row[0]).strip()
            name = _clean(row[1]) or "(unnamed)"
            brand = _clean(row[2])
            release_year = _clean_year(row[3])
            concentration = _clean(row[4])
            # row[5] is Main_Accords — denormalized, not stored
            url = _clean(row[6])

            _, was_created = Perfume.objects.update_or_create(
                perfume_id=perfume_id,
                defaults={
                    "name": name,
                    "brand": brand,
                    "release_year": release_year,
                    "concentration": concentration,
                    "url": url,
                },
            )
            if was_created:
                created += 1
            else:
                updated += 1

            total += 1
            if total % 5000 == 0:
                self.stdout.write(f"    … {total} perfumes processed")

        self.stdout.write(f"  Perfumes:     created={created}  updated={updated}  skipped={skipped}")
        return {"created": created, "updated": updated, "skipped": skipped}

    # ------------------------------------------------------------------
    def _load_perfume_notes(self, wb, dry_run: bool) -> dict:
        ws = wb["Perfume-Notes"]
        created = skipped = 0
        updated = 0

        perfume_map = {p.perfume_id: p for p in Perfume.objects.only("id", "perfume_id")}
        note_map = {n.note_id: n for n in Note.objects.only("id", "note_id")}

        valid_layers = {"top", "middle", "base"}
        batch: list[PerfumeNote] = []
        total = 0

        for row in ws.iter_rows(min_row=2, values_only=True):
            perfume_id, note_id, layer = row[0], row[1], row[2]
            perfume_id = str(perfume_id).strip() if perfume_id else None
            note_id = str(note_id).strip() if note_id else None
            layer = str(layer).strip().lower() if layer else None

            if layer not in valid_layers:
                skipped += 1
                continue

            perfume = perfume_map.get(perfume_id)
            note = note_map.get(note_id)

            if not perfume or not note:
                skipped += 1
                if not perfume:
                    self.stderr.write(f"  WARN PerfumeNote: unknown perfume_id={perfume_id}")
                if not note:
                    self.stderr.write(f"  WARN PerfumeNote: unknown note_id={note_id}")
                continue

            batch.append(PerfumeNote(perfume=perfume, note=note, layer=layer))

            if len(batch) >= BATCH:
                c = self._flush_perfume_notes(batch)
                created += c
                batch.clear()

            total += 1
            if total % 50000 == 0:
                self.stdout.write(f"    … {total} perfume-notes processed")

        if batch:
            c = self._flush_perfume_notes(batch)
            created += c

        self.stdout.write(f"  PerfumeNote:  created={created}  updated={updated}  skipped={skipped}")
        return {"created": created, "updated": updated, "skipped": skipped}

    def _flush_perfume_notes(self, batch: list[PerfumeNote]) -> int:
        result = PerfumeNote.objects.bulk_create(
            batch,
            ignore_conflicts=True,
        )
        return len(result)
