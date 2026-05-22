from django.contrib.postgres.indexes import GinIndex
from django.db import models


class Accord(models.Model):
    accord_id = models.CharField(max_length=50, unique=True)
    name = models.CharField(max_length=200, unique=True)

    class Meta:
        ordering = ["name"]

    def __str__(self) -> str:
        return self.name


class Note(models.Model):
    note_id = models.CharField(max_length=50, unique=True)
    name = models.CharField(max_length=200, db_index=True)
    accords = models.ManyToManyField(
        Accord,
        through="AccordNote",
        related_name="notes",
    )

    class Meta:
        ordering = ["name"]
        indexes  = [
            GinIndex(fields=["name"], name="catalog_note_name_gin", opclasses=["gin_trgm_ops"]),
        ]

    def __str__(self) -> str:
        return self.name


class AccordNote(models.Model):
    note = models.ForeignKey(Note, on_delete=models.CASCADE, related_name="accord_notes")
    accord = models.ForeignKey(Accord, on_delete=models.CASCADE, related_name="accord_notes")
    mapping_source = models.CharField(
        max_length=50,
        help_text="fragrantica | keyword | keyword_pass2 | override | manual",
    )

    class Meta:
        unique_together = [("note", "accord")]

    def __str__(self) -> str:
        return f"{self.note} → {self.accord} ({self.mapping_source})"


class Perfume(models.Model):
    perfume_id = models.CharField(max_length=50, unique=True)
    name = models.CharField(max_length=500, db_index=True)
    brand = models.CharField(max_length=300, null=True, blank=True, db_index=True)
    release_year = models.IntegerField(null=True, blank=True)
    concentration = models.CharField(max_length=100, null=True, blank=True)
    url = models.URLField(max_length=1000, null=True, blank=True)
    notes = models.ManyToManyField(
        Note,
        through="PerfumeNote",
        related_name="perfumes",
    )

    class Meta:
        ordering = ["name"]

    def __str__(self) -> str:
        return f"{self.name} ({self.brand or 'Unknown'})"


class Layer(models.TextChoices):
    TOP = "top", "Top"
    MIDDLE = "middle", "Middle"
    BASE = "base", "Base"


class PerfumeNote(models.Model):
    perfume = models.ForeignKey(Perfume, on_delete=models.CASCADE, related_name="perfume_notes")
    note = models.ForeignKey(Note, on_delete=models.CASCADE, related_name="perfume_notes")
    layer = models.CharField(max_length=10, choices=Layer.choices)

    class Meta:
        unique_together = [("perfume", "note", "layer")]
        indexes = [
            models.Index(fields=["perfume", "layer"]),
        ]

    def __str__(self) -> str:
        return f"{self.perfume} — {self.note} ({self.layer})"
