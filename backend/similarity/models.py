from django.db import models


class NoteFrequency(models.Model):
    """Precomputed count of perfumes that contain each note."""

    note_id = models.CharField(max_length=50, unique=True, db_index=True)
    frequency = models.IntegerField(default=0)

    class Meta:
        verbose_name_plural = "note frequencies"

    def __str__(self) -> str:
        return f"{self.note_id}: {self.frequency}"
