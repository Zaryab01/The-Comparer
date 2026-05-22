from rest_framework import serializers

from catalog.models import Note
from .models import Profile, ProfileGroup, ProfileNote


# ── Group ──────────────────────────────────────────────────────────────────────

class ProfileGroupSerializer(serializers.ModelSerializer):
    profile_count = serializers.IntegerField(read_only=True, default=0)

    class Meta:
        model  = ProfileGroup
        fields = ["id", "name", "description", "profile_count", "created_at"]
        read_only_fields = ["id", "created_at"]


# ── Profile ────────────────────────────────────────────────────────────────────

class NoteRefSerializer(serializers.Serializer):
    note_id = serializers.CharField()
    name    = serializers.CharField(read_only=True)


class ProfileNoteInputSerializer(serializers.Serializer):
    note_id = serializers.CharField()
    layer   = serializers.ChoiceField(choices=["top", "middle", "base"])


class ProfileSerializer(serializers.ModelSerializer):
    group    = ProfileGroupSerializer(read_only=True)
    group_id = serializers.PrimaryKeyRelatedField(
        queryset=ProfileGroup.objects.all(),
        source="group",
        write_only=True,
    )
    # Write: flat list of {note_id, layer}
    notes_input = ProfileNoteInputSerializer(many=True, write_only=True, required=False)
    # Read: notes grouped by layer
    notes_by_layer = serializers.SerializerMethodField()

    class Meta:
        model  = Profile
        fields = [
            "id", "name", "brand", "link",
            "group", "group_id",
            "notes_input", "notes_by_layer",
            "created_at", "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]

    def get_notes_by_layer(self, obj) -> dict:
        result: dict = {"top": [], "middle": [], "base": []}
        for pn in obj.profile_notes.select_related("note").all():
            result[pn.layer].append({"note_id": pn.note.note_id, "name": pn.note.name})
        return result

    def validate_notes_input(self, value):
        if not value:
            raise serializers.ValidationError("At least one note is required.")
        note_ids = [item["note_id"] for item in value]
        existing = set(
            Note.objects.filter(note_id__in=note_ids).values_list("note_id", flat=True)
        )
        missing = set(note_ids) - existing
        if missing:
            raise serializers.ValidationError(
                f"Unknown note ID(s): {', '.join(sorted(missing))}"
            )
        return value

    def _save_notes(self, profile: Profile, notes_input: list) -> None:
        note_ids = [item["note_id"] for item in notes_input]
        note_map = {
            n.note_id: n
            for n in Note.objects.filter(note_id__in=note_ids)
        }
        ProfileNote.objects.bulk_create([
            ProfileNote(
                profile=profile,
                note=note_map[item["note_id"]],
                layer=item["layer"],
            )
            for item in notes_input
            if item["note_id"] in note_map
        ])

    def create(self, validated_data: dict) -> Profile:
        notes_input = validated_data.pop("notes_input", [])
        profile = Profile.objects.create(**validated_data)
        self._save_notes(profile, notes_input)
        return profile

    def update(self, instance: Profile, validated_data: dict) -> Profile:
        notes_input = validated_data.pop("notes_input", None)
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()
        if notes_input is not None:
            instance.profile_notes.all().delete()
            self._save_notes(instance, notes_input)
        return instance
