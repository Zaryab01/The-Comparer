"""Auth-gated admin dashboard API (token auth + staff-only).

Public endpoints elsewhere stay open; everything here requires a staff user's
token. Login issues a DRF token; the React admin stores it and sends it as
``Authorization: Token <key>``.
"""

from __future__ import annotations

from django.contrib.auth import authenticate
from django.core.paginator import Paginator
from django.db.models import Avg, Count
from django.utils import timezone
from datetime import timedelta

from rest_framework import status
from rest_framework.authentication import TokenAuthentication
from rest_framework.authtoken.models import Token
from rest_framework.exceptions import NotFound
from rest_framework.permissions import AllowAny, IsAdminUser
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.throttling import AnonRateThrottle
from rest_framework.views import APIView

from catalog.models import NoteAlias, Perfume
from core.models import ComparisonLog
from similarity.engine import load_cache

from .serializers import (
    AdminAliasSerializer,
    AdminLogSerializer,
    AdminNoteSerializer,
    AdminPerfumeSerializer,
)


class _AdminLoginThrottle(AnonRateThrottle):
    scope = "admin_login"


# ── Auth ─────────────────────────────────────────────────────────────────────────

class LoginView(APIView):
    """POST /api/admin/login/ — {username, password} → {token, username}."""

    authentication_classes: list = []
    permission_classes = [AllowAny]
    throttle_classes = [_AdminLoginThrottle]

    def post(self, request: Request) -> Response:
        username = (request.data.get("username") or "").strip()
        password = request.data.get("password") or ""
        user = authenticate(username=username, password=password)
        if user is None or not user.is_staff:
            return Response(
                {"detail": "Invalid credentials or not a staff account."},
                status=status.HTTP_401_UNAUTHORIZED,
            )
        token, _ = Token.objects.get_or_create(user=user)
        return Response({"token": token.key, "username": user.username})


class AdminBaseView(APIView):
    """Token auth + staff-only base for every protected endpoint."""

    authentication_classes = [TokenAuthentication]
    permission_classes = [IsAdminUser]


class MeView(AdminBaseView):
    """GET /api/admin/me/ — validate the current token."""

    def get(self, request: Request) -> Response:
        return Response({"username": request.user.username, "is_staff": request.user.is_staff})


class LogoutView(AdminBaseView):
    """POST /api/admin/logout/ — invalidate the current token."""

    def post(self, request: Request) -> Response:
        Token.objects.filter(user=request.user).delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


# ── Perfumes ─────────────────────────────────────────────────────────────────────

class AdminPerfumeListView(AdminBaseView):
    """POST /api/admin/perfumes/ — create a perfume + layered notes."""

    def post(self, request: Request) -> Response:
        serializer = AdminPerfumeSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        perfume = serializer.save()
        load_cache()  # make the new perfume immediately comparable
        return Response(
            AdminPerfumeSerializer(perfume).data, status=status.HTTP_201_CREATED
        )


class AdminPerfumeDetailView(AdminBaseView):
    """GET/PUT/DELETE /api/admin/perfumes/<perfume_id>/."""

    def _get(self, perfume_id: str) -> Perfume:
        try:
            return Perfume.objects.get(perfume_id=perfume_id)
        except Perfume.DoesNotExist:
            raise NotFound(f"Perfume '{perfume_id}' not found.")

    def get(self, request: Request, perfume_id: str) -> Response:
        return Response(AdminPerfumeSerializer(self._get(perfume_id)).data)

    def put(self, request: Request, perfume_id: str) -> Response:
        perfume = self._get(perfume_id)
        serializer = AdminPerfumeSerializer(perfume, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        perfume = serializer.save()
        load_cache()
        return Response(AdminPerfumeSerializer(perfume).data)

    def delete(self, request: Request, perfume_id: str) -> Response:
        self._get(perfume_id).delete()
        load_cache()
        return Response(status=status.HTTP_204_NO_CONTENT)


# ── Notes & aliases ──────────────────────────────────────────────────────────────

class AdminNoteCreateView(AdminBaseView):
    """POST /api/admin/notes/ — add a canonical note."""

    def post(self, request: Request) -> Response:
        serializer = AdminNoteSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        note = serializer.save()
        return Response(
            {"note_id": note.note_id, "name": note.name},
            status=status.HTTP_201_CREATED,
        )


class AdminAliasView(AdminBaseView):
    """GET /api/admin/aliases/?note_id= — list; POST — add alias→note mapping."""

    def get(self, request: Request) -> Response:
        qs = NoteAlias.objects.select_related("note")
        note_id = request.query_params.get("note_id")
        if note_id:
            qs = qs.filter(note__note_id=note_id)
        qs = qs.order_by("alias_name")[:200]
        return Response(AdminAliasSerializer(qs, many=True).data)

    def post(self, request: Request) -> Response:
        serializer = AdminAliasSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        alias = serializer.save()
        return Response(AdminAliasSerializer(alias).data, status=status.HTTP_201_CREATED)


# ── Logs / monitoring ────────────────────────────────────────────────────────────

class AdminLogsView(AdminBaseView):
    """GET /api/admin/logs/?page=<n> — paginated ComparisonLog feed + stats."""

    PAGE_SIZE = 25

    def get(self, request: Request) -> Response:
        qs = ComparisonLog.objects.all()  # default ordering: -created_at
        paginator = Paginator(qs, self.PAGE_SIZE)
        try:
            page = int(request.query_params.get("page", 1))
        except (TypeError, ValueError):
            page = 1
        page = max(1, min(page, paginator.num_pages or 1))
        page_obj = paginator.get_page(page)

        since = timezone.now() - timedelta(days=7)
        stats = {
            "total": qs.count(),
            "last_7_days": qs.filter(created_at__gte=since).count(),
            "avg_duration_ms": round(
                (qs.aggregate(a=Avg("duration_ms"))["a"] or 0), 1
            ),
        }

        return Response({
            "page": page,
            "num_pages": paginator.num_pages,
            "count": paginator.count,
            "stats": stats,
            "results": AdminLogSerializer(page_obj.object_list, many=True).data,
        })
