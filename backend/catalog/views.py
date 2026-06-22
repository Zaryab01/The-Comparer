from django.contrib.postgres.search import TrigramSimilarity
from rest_framework import generics
from rest_framework.exceptions import NotFound
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.throttling import AnonRateThrottle
from rest_framework.views import APIView

from django.db.models import Q

from .constants import (
    BRAND_SEARCH_LIMIT,
    FEATURED_BRANDS,
    PER_BRAND_PAGE_SIZE,
    brand_counts_qs,
)
from .models import Note, NoteAlias, Perfume
from .serializers import (
    NoteDetailSerializer,
    PerfumeCardSerializer,
    PerfumeDetailSerializer,
    PerfumeSearchSerializer,
)

AUTOCOMPLETE_LIMIT = 20
AUTOCOMPLETE_MIN_SIMILARITY = 0.1

PERFUME_SEARCH_LIMIT = 10
PERFUME_SEARCH_MIN_SIMILARITY = 0.1


class NoteAutocompleteThrottle(AnonRateThrottle):
    scope = "notes"


class PerfumeSearchThrottle(AnonRateThrottle):
    scope = "perfumes"


class NoteAutocompleteView(APIView):
    """GET /api/notes/?q=<query>  — trigram autocomplete over canonical note
    names AND their aliases (synonyms).

    Always returns canonical notes: [{note_id, name, matched_alias?}]. When the
    match came via an alias rather than the canonical name, ``matched_alias`` is
    the alias text (so the UI can hint e.g. "Agarwood → Oud"). Capped at 20.
    """

    throttle_classes = [NoteAutocompleteThrottle]

    def get(self, request: Request) -> Response:
        q = request.query_params.get("q", "").strip()
        if not q:
            return Response([])

        # Canonical name matches
        note_matches = (
            Note.objects.annotate(similarity=TrigramSimilarity("name", q))
            .filter(similarity__gte=AUTOCOMPLETE_MIN_SIMILARITY)
            .order_by("-similarity")
            .values_list("note_id", "name", "similarity")[:AUTOCOMPLETE_LIMIT]
        )

        # Alias matches → resolve to the canonical note
        alias_matches = (
            NoteAlias.objects.annotate(similarity=TrigramSimilarity("alias_name", q))
            .filter(similarity__gte=AUTOCOMPLETE_MIN_SIMILARITY)
            .order_by("-similarity")
            .values_list(
                "note__note_id", "note__name", "alias_name", "similarity"
            )[:AUTOCOMPLETE_LIMIT]
        )

        # Merge, deduping by canonical note_id and keeping the strongest match.
        # A direct canonical-name hit always wins over an alias hit.
        best: dict[str, dict] = {}
        for note_id, name, sim in note_matches:
            best[note_id] = {
                "note_id": note_id,
                "name": name,
                "matched_alias": None,
                "_sim": sim,
            }
        for note_id, name, alias_name, sim in alias_matches:
            existing = best.get(note_id)
            if existing is None or (
                existing["matched_alias"] is not None and sim > existing["_sim"]
            ):
                best[note_id] = {
                    "note_id": note_id,
                    "name": name,
                    "matched_alias": alias_name,
                    "_sim": sim,
                }

        ranked = sorted(best.values(), key=lambda r: r["_sim"], reverse=True)[
            :AUTOCOMPLETE_LIMIT
        ]
        for r in ranked:
            r.pop("_sim", None)
        return Response(ranked)


class NoteDetailView(APIView):
    """GET /api/notes/<note_id>/  — single note with accord(s)."""

    def get(self, request: Request, note_id: str) -> Response:
        try:
            note = Note.objects.prefetch_related("accords").get(note_id=note_id)
        except Note.DoesNotExist:
            raise NotFound(f"Note '{note_id}' not found.")
        return Response(NoteDetailSerializer(note).data)


class PerfumeSearchView(APIView):
    """GET /api/perfumes/?q=<query>  — search perfumes by name or brand.

    Returns up to 10 lightweight results [{perfume_id, name, brand}].
    Combines trigram similarity on name with ILIKE fallback on brand so users can
    search either by fragrance name ("Aventus") or house ("Creed").
    """

    throttle_classes = [PerfumeSearchThrottle]

    def get(self, request: Request) -> Response:
        q = request.query_params.get("q", "").strip()
        if len(q) < 2:
            return Response([])

        qs = (
            Perfume.objects
            .annotate(sim=TrigramSimilarity("name", q))
            .filter(
                Q(sim__gte=PERFUME_SEARCH_MIN_SIMILARITY)
                | Q(name__icontains=q)
                | Q(brand__icontains=q)
            )
            .order_by("-sim", "name")[:PERFUME_SEARCH_LIMIT]
        )
        return Response(PerfumeSearchSerializer(qs, many=True).data)


class PerfumeDetailView(APIView):
    """GET /api/perfumes/<perfume_id>/  — perfume detail with notes by layer."""

    def get(self, request: Request, perfume_id: str) -> Response:
        try:
            perfume = Perfume.objects.get(perfume_id=perfume_id)
        except Perfume.DoesNotExist:
            raise NotFound(f"Perfume '{perfume_id}' not found.")
        return Response(PerfumeDetailSerializer(perfume).data)


class BrandListView(APIView):
    """GET /api/brands/?q=<query>  — brands with perfume counts, ranked by count.

    With ?q= it searches brand names (for the multi-select dropdown); without it
    returns the top brands. Ranking metric lives in catalog.constants.
    Returns [{name, perfume_count}], capped at BRAND_SEARCH_LIMIT.
    """

    def get(self, request: Request) -> Response:
        q = request.query_params.get("q", "").strip()
        rows = brand_counts_qs(q or None)[:BRAND_SEARCH_LIMIT]
        data = [{"name": r["brand"], "perfume_count": r["perfume_count"]} for r in rows]
        return Response(data)


class CatalogView(APIView):
    """GET /api/catalog/?brands=<name,name,...>&page=<n>

    Perfumes grouped by brand. With no `brands`, defaults to the curated
    FEATURED_BRANDS. Each brand section is paginated uniformly by `page` at
    PER_BRAND_PAGE_SIZE. Returns:
        { page, page_size, groups: [{ brand, total, has_more, perfumes: [...] }] }
    """

    def get(self, request: Request) -> Response:
        brands_param = request.query_params.get("brands", "").strip()
        try:
            page = max(1, int(request.query_params.get("page", 1)))
        except (TypeError, ValueError):
            page = 1

        if brands_param:
            brand_names = [b.strip() for b in brands_param.split(",") if b.strip()]
        else:
            brand_names = list(FEATURED_BRANDS)

        offset = (page - 1) * PER_BRAND_PAGE_SIZE
        groups = []
        for name in brand_names:
            qs = Perfume.objects.filter(brand=name).order_by("name")
            total = qs.count()
            perfumes = qs[offset:offset + PER_BRAND_PAGE_SIZE]
            groups.append({
                "brand": name,
                "total": total,
                "has_more": offset + PER_BRAND_PAGE_SIZE < total,
                "perfumes": PerfumeCardSerializer(perfumes, many=True).data,
            })

        return Response({
            "page": page,
            "page_size": PER_BRAND_PAGE_SIZE,
            "groups": groups,
        })
