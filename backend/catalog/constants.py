"""Catalog tuning constants and the single source of the brand-ranking metric.

Keep the "top brands" ranking and the default brand count HERE so the catalog
default, the brand multi-select, and any future curated list all agree (CLAUDE
§12 / §15.2).
"""

from __future__ import annotations

from django.db.models import Count, QuerySet

# Curated brands shown on the catalog by default (when none are selected).
# These are exact brand strings as stored on Perfume.brand.
FEATURED_BRANDS = [
    "Creed",
    "Louis Vuitton",
    "Dior",
    "Lattafa Perfumes",
    "Prada",
    "Gucci",
    "Giorgio Armani",
]

# Fallback count when listing top brands by count (search dropdown initial view).
TOP_BRANDS_DEFAULT_COUNT = 10

# Perfumes shown per brand section, per page.
PER_BRAND_PAGE_SIZE = 12

# Max brands returned by the /api/brands/ search dropdown.
BRAND_SEARCH_LIMIT = 50


def brand_counts_qs(q: str | None = None) -> QuerySet:
    """Distinct brands annotated with their perfume count.

    This is the ONE place the ranking metric lives: perfume count, descending,
    then name. Swap the ordering / add a curated filter here to change how
    "top brands" is defined everywhere.
    """
    from .models import Perfume

    qs = (
        Perfume.objects.exclude(brand__isnull=True)
        .exclude(brand="")
    )
    if q:
        qs = qs.filter(brand__icontains=q)
    return (
        qs.values("brand")
        .annotate(perfume_count=Count("id"))
        .order_by("-perfume_count", "brand")
    )
