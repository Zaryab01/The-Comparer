from django.db import models

from catalog.models import Note


class ProfileGroup(models.Model):
    name        = models.CharField(max_length=200, unique=True)
    description = models.TextField(blank=True)
    created_at  = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["name"]

    def __str__(self) -> str:
        return self.name


class Profile(models.Model):
    name       = models.CharField(max_length=500)
    brand      = models.CharField(max_length=300)
    link       = models.URLField(max_length=1000, blank=True, null=True)
    group      = models.ForeignKey(ProfileGroup, on_delete=models.CASCADE, related_name="profiles")
    notes      = models.ManyToManyField(Note, through="ProfileNote", related_name="profiles")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["name"]

    def __str__(self) -> str:
        return f"{self.name} — {self.brand}"


class ProfileNote(models.Model):
    LAYER_CHOICES = [("top", "Top"), ("middle", "Middle"), ("base", "Base")]

    profile = models.ForeignKey(Profile, on_delete=models.CASCADE, related_name="profile_notes")
    note    = models.ForeignKey(Note, on_delete=models.CASCADE, related_name="profile_notes")
    layer   = models.CharField(max_length=10, choices=LAYER_CHOICES)

    class Meta:
        unique_together = [("profile", "note", "layer")]
        indexes = [models.Index(fields=["profile", "layer"])]

    def __str__(self) -> str:
        return f"{self.profile} — {self.note} ({self.layer})"
