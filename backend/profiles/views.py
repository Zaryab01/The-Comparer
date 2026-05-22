from django.db.models import Count
from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import Profile, ProfileGroup
from .serializers import ProfileGroupSerializer, ProfileSerializer


def _annotated_groups():
    return ProfileGroup.objects.annotate(profile_count=Count("profiles")).order_by("name")


def _full_profile(pk: int) -> Profile | None:
    try:
        return (
            Profile.objects
            .select_related("group")
            .prefetch_related("profile_notes__note")
            .get(pk=pk)
        )
    except Profile.DoesNotExist:
        return None


# ── Groups ─────────────────────────────────────────────────────────────────────

class GroupListView(APIView):
    """GET /api/groups/  —  list all groups with profile count.
       POST /api/groups/ —  create a new group."""

    def get(self, request):
        groups = _annotated_groups()
        return Response(ProfileGroupSerializer(groups, many=True).data)

    def post(self, request):
        serializer = ProfileGroupSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        group = serializer.save()
        # Re-fetch with annotation so profile_count is present
        group = _annotated_groups().get(pk=group.pk)
        return Response(ProfileGroupSerializer(group).data, status=status.HTTP_201_CREATED)


class GroupDetailView(APIView):
    """GET/PUT/DELETE /api/groups/<pk>/"""

    def _get(self, pk):
        try:
            return _annotated_groups().get(pk=pk)
        except ProfileGroup.DoesNotExist:
            return None

    def get(self, request, pk):
        group = self._get(pk)
        if group is None:
            return Response({"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND)
        return Response(ProfileGroupSerializer(group).data)

    def put(self, request, pk):
        group = self._get(pk)
        if group is None:
            return Response({"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND)
        serializer = ProfileGroupSerializer(group, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(ProfileGroupSerializer(self._get(pk)).data)

    def delete(self, request, pk):
        try:
            ProfileGroup.objects.get(pk=pk).delete()
        except ProfileGroup.DoesNotExist:
            return Response({"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND)
        return Response(status=status.HTTP_204_NO_CONTENT)


# ── Profiles ───────────────────────────────────────────────────────────────────

class ProfileListView(APIView):
    """GET /api/profiles/?group=<id>  —  list profiles (optionally filtered by group).
       POST /api/profiles/            —  create a profile."""

    def get(self, request):
        qs = (
            Profile.objects
            .select_related("group")
            .prefetch_related("profile_notes__note")
        )
        group_id = request.query_params.get("group")
        if group_id:
            qs = qs.filter(group_id=group_id)
        return Response(ProfileSerializer(qs, many=True).data)

    def post(self, request):
        serializer = ProfileSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        profile = serializer.save()
        return Response(
            ProfileSerializer(_full_profile(profile.pk)).data,
            status=status.HTTP_201_CREATED,
        )


class ProfileDetailView(APIView):
    """GET/PUT/DELETE /api/profiles/<pk>/"""

    def get(self, request, pk):
        profile = _full_profile(pk)
        if profile is None:
            return Response({"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND)
        return Response(ProfileSerializer(profile).data)

    def put(self, request, pk):
        profile = _full_profile(pk)
        if profile is None:
            return Response({"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND)
        serializer = ProfileSerializer(profile, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        updated = serializer.save()
        return Response(ProfileSerializer(_full_profile(updated.pk)).data)

    def delete(self, request, pk):
        try:
            Profile.objects.get(pk=pk).delete()
        except Profile.DoesNotExist:
            return Response({"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND)
        return Response(status=status.HTTP_204_NO_CONTENT)
