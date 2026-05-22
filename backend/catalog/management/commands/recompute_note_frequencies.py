"""
Management command: recompute_note_frequencies

Counts how many distinct perfumes contain each note and stores the result
in similarity.NoteFrequency.  Run after every import_data call.
"""

from django.core.management.base import BaseCommand
from django.db.models import Count

from catalog.models import PerfumeNote
from similarity.models import NoteFrequency


class Command(BaseCommand):
    help = "Recompute per-note perfume frequency counts used by the similarity engine."

    def handle(self, *args, **options):
        self.stdout.write("Computing note frequencies …")

        # Count distinct perfumes per note across all layers
        qs = (
            PerfumeNote.objects.values("note__note_id")
            .annotate(freq=Count("perfume", distinct=True))
            .order_by()
        )

        NoteFrequency.objects.all().delete()

        batch = [
            NoteFrequency(note_id=row["note__note_id"], frequency=row["freq"])
            for row in qs
        ]
        NoteFrequency.objects.bulk_create(batch, batch_size=2000)

        self.stdout.write(
            self.style.SUCCESS(f"Done — stored frequencies for {len(batch)} notes.")
        )
