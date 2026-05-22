from django.db import models


class ComparisonLog(models.Model):
    created_at = models.DateTimeField(auto_now_add=True)
    top_notes = models.JSONField(default=list)
    middle_notes = models.JSONField(default=list)
    base_notes = models.JSONField(default=list)
    results = models.JSONField(default=list)
    duration_ms = models.IntegerField()
    ip_hash = models.CharField(max_length=64, null=True, blank=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self) -> str:
        return f"ComparisonLog {self.pk} @ {self.created_at:%Y-%m-%d %H:%M}"
