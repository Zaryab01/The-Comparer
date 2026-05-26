from django.contrib.postgres.search import TrigramSimilarity
from rest_framework import generics
from rest_framework.exceptions import NotFound
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.throttling import AnonRateThrottle
from rest_framework.views import APIView

from django.db.models import Q

from .models import Note, Perfume
from .serializers import (
    NoteDetailSerializer,
    NoteSerializer,
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
    """GET /api/notes/?q=<query>  — trigram autocomplete, capped at 20 results."""

    throttle_classes = [NoteAutocompleteThrottle]

    def get(self, request: Request) -> Response:
        q = request.query_params.get("q", "").strip()
        if not q:
            return Response([])

        qs = (
            Note.objects.annotate(similarity=TrigramSimilarity("name", q))
            .filter(similarity__gte=AUTOCOMPLETE_MIN_SIMILARITY)
            .order_by("-similarity")[:AUTOCOMPLETE_LIMIT]
        )
        return Response(NoteSerializer(qs, many=True).data)


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

    Returns up to 10 lightweight results [{perfume_id, name, brand, release_year}].
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
