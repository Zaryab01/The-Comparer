"""Serializers for the auth-gated admin dashboard API."""

from __future__ import annotations

import uuid

from rest_framework import serializers

from catalog.models import Note, NoteAlias, Perfume, PerfumeNote


# ── Perfume add/edit ─────────────────────────────────────────────────────────────

class _NoteInputSerializer(serializers.Serializer):
    note_id = serializers.CharField()
    layer = serializers.ChoiceField(choices=["top", "middle", "base"])


class AdminPerfumeSerializer(serializers.ModelSerializer):
    """Create / edit a Perfume plus its layered notes.

    Write: notes_input = [{note_id, layer}]. Read: notes_by_layer + identity.
    """

    notes_input = _NoteInputSerializer(many=True, write_only=True, required=False)
    notes_by_layer = serializers.SerializerMethodField()

    class Meta:
        model = Perfume
        fields = [
            "perfume_id", "name", "brand", "concentration", "url",
            "notes_input", "notes_by_layer",
        ]
        read_only_fields = ["perfume_id"]

    def get_notes_by_layer(self, obj: Perfume) -> dict:
        result: dict = {"top": [], "middle": [], "base": []}
        for pn in obj.perfume_notes.select_related("note").all():
            result[pn.layer].append({"note_id": pn.note.note_id, "name": pn.note.name})
        return result

    def validate_notes_input(self, value):
        if not value:
            raise serializers.ValidationError("Add at least one note.")
        note_ids = [v["note_id"] for v in value]
        existing = set(
            Note.objects.filter(note_id__in=note_ids).values_list("note_id", flat=True)
        )
        missing = sorted(set(note_ids) - existing)
        if missing:
            raise serializers.ValidationError(f"Unknown note id(s): {', '.join(missing)}")
        return value

    def _save_notes(self, perfume: Perfume, notes_input: list) -> None:
        note_map = {
            n.note_id: n
            for n in Note.objects.filter(note_id__in=[v["note_id"] for v in notes_input])
        }
        PerfumeNote.objects.bulk_create(
            [
                PerfumeNote(perfume=perfume, note=note_map[v["note_id"]], layer=v["layer"])
                for v in notes_input
            ],
            ignore_conflicts=True,
        )

    def create(self, validated_data: dict) -> Perfume:
        notes_input = validated_data.pop("notes_input", [])
        validated_data["perfume_id"] = f"ADMIN-{uuid.uuid4().hex[:10].upper()}"
        perfume = Perfume.objects.create(**validated_data)
        self._save_notes(perfume, notes_input)
        return perfume

    def update(self, instance: Perfume, validated_data: dict) -> Perfume:
        notes_input = validated_data.pop("notes_input", None)
        for attr, val in validated_data.items():
            setattr(instance, attr, val)
        instance.save()
        if notes_input is not None:
            instance.perfume_notes.all().delete()
            self._save_notes(instance, notes_input)
        return instance


# ── Note create ──────────────────────────────────────────────────────────────────

class AdminNoteSerializer(serializers.Serializer):
    name = serializers.CharField(max_length=200)
    # read-only echo
    note_id = serializers.CharField(read_only=True)

    def validate_name(self, value: str) -> str:
        name = value.strip()
        if not name:
            raise serializers.ValidationError("Name is required.")
        if Note.objects.filter(name__iexact=name).exists():
            raise serializers.ValidationError(f"A note named '{name}' already exists.")
        if NoteAlias.objects.filter(alias_name__iexact=name).exists():
            raise serializers.ValidationError(f"'{name}' already exists as an alias.")
        return name

    def create(self, validated_data: dict) -> Note:
        return Note.objects.create(
            note_id=f"NOTE-ADMIN-{uuid.uuid4().hex[:8].upper()}",
            name=validated_data["name"],
        )


# ── Alias create ─────────────────────────────────────────────────────────────────

class AdminAliasSerializer(serializers.Serializer):
    alias_name = serializers.CharField(max_length=200)
    note_id = serializers.CharField()
    # read-only echo
    canonical_name = serializers.CharField(read_only=True)

    def validate(self, data: dict) -> dict:
        alias = data["alias_name"].strip()
        if not alias:
            raise serializers.ValidationError({"alias_name": "Alias is required."})
        try:
            note = Note.objects.get(note_id=data["note_id"].strip())
        except Note.DoesNotExist:
            raise serializers.ValidationError({"note_id": "Unknown note id."})
        if Note.objects.filter(name__iexact=alias).exists():
            raise serializers.ValidationError(
                {"alias_name": "Alias collides with a canonical note name."}
            )
        if NoteAlias.objects.filter(alias_name__iexact=alias).exists():
            raise serializers.ValidationError({"alias_name": "This alias already exists."})
        data["alias_name"] = alias
        data["_note"] = note
        return data

    def create(self, validated_data: dict) -> NoteAlias:
        return NoteAlias.objects.create(
            alias_name=validated_data["alias_name"],
            note=validated_data["_note"],
            source="admin",
        )

    def to_representation(self, instance: NoteAlias) -> dict:
        return {
            "id": instance.id,
            "alias_name": instance.alias_name,
            "note_id": instance.note.note_id,
            "canonical_name": instance.note.name,
            "source": instance.source,
        }


# ── Comparison log feed ──────────────────────────────────────────────────────────

class AdminLogSerializer(serializers.Serializer):
    """Read-only row for the monitoring feed."""

    created_at = serializers.DateTimeField()
    note_counts = serializers.SerializerMethodField()
    brand_filter = serializers.JSONField()
    duration_ms = serializers.IntegerField()
    top_result = serializers.SerializerMethodField()

    def get_note_counts(self, obj) -> dict:
        return {
            "top": len(obj.top_notes or []),
            "middle": len(obj.middle_notes or []),
            "base": len(obj.base_notes or []),
        }

    def get_top_result(self, obj) -> dict | None:
        results = obj.results or []
        if not results:
            return None
        r = results[0]
        return {
            "name": r.get("perfume_name"),
            "brand": r.get("perfume_brand"),
            "score": r.get("overall_score"),
        }
