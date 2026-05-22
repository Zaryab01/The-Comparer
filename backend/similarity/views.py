import hashlib
import time

from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.throttling import AnonRateThrottle
from rest_framework.views import APIView

from core.models import ComparisonLog
from similarity.engine import compare, compare_against_group
from similarity.serializers import CompareInputSerializer, CompareOutputSerializer


class CompareThrottle(AnonRateThrottle):
    scope = "compare"


class CompareView(APIView):
    """POST /api/compare/

    Body:
        {
            "top":    [note_ids],
            "middle": [note_ids],
            "base":   [note_ids],
            "target": "main" | "group",   // default "main"
            "group_id": <int> | null       // required when target == "group"
        }

    Returns the top 3 closest matches with per-layer breakdown.
    When target == "main"  → searches the full perfume database (~31k perfumes).
    When target == "group" → searches profiles inside the specified ProfileGroup.
    Logs every request in ComparisonLog (IP SHA-256 hashed, never stored raw).
    """

    throttle_classes = [CompareThrottle]

    def post(self, request: Request) -> Response:
        serializer = CompareInputSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        top_ids:    list[str] = serializer.validated_data["top"]
        middle_ids: list[str] = serializer.validated_data["middle"]
        base_ids:   list[str] = serializer.validated_data["base"]
        target:     str       = serializer.validated_data["target"]
        group_id:   int | None = serializer.validated_data.get("group_id")

        t0 = time.perf_counter()

        if target == "group" and group_id is not None:
            results = compare_against_group(top_ids, middle_ids, base_ids, group_id)
        else:
            results = compare(top_ids, middle_ids, base_ids)

        duration_ms = int((time.perf_counter() - t0) * 1000)

        payload = CompareOutputSerializer({"results": results}).data

        ComparisonLog.objects.create(
            top_notes=top_ids,
            middle_notes=middle_ids,
            base_notes=base_ids,
            results=payload["results"],
            duration_ms=duration_ms,
            ip_hash=_hash_ip(request),
        )

        return Response(payload)


def _hash_ip(request: Request) -> str:
    forwarded = request.META.get("HTTP_X_FORWARDED_FOR", "")
    ip = forwarded.split(",")[0].strip() if forwarded else request.META.get("REMOTE_ADDR", "")
    return hashlib.sha256(ip.encode()).hexdigest()
