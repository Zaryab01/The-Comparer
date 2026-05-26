from rest_framework import serializers

from .models import Accord, Note, Perfume, PerfumeNote


class AccordSerializer(serializers.ModelSerializer):
    class Meta:
        model = Accord
        fields = ["accord_id", "name"]


class NoteSerializer(serializers.ModelSerializer):
    """Lightweight — used for autocomplete responses."""

    class Meta:
        model = Note
        fields = ["note_id", "name"]


class NoteDetailSerializer(serializers.ModelSerializer):
    """Full note detail including mapped accords."""

    accords = AccordSerializer(many=True, read_only=True)

    class Meta:
        model = Note
        fields = ["note_id", "name", "accords"]


class PerfumeNoteSerializer(serializers.ModelSerializer):
    note_id = serializers.CharField(source="note.note_id")
    name = serializers.CharField(source="note.name")

    class Meta:
        model = PerfumeNote
        fields = ["note_id", "name"]


class PerfumeSearchSerializer(serializers.ModelSerializer):
    """Lightweight — used for perfume search / autocomplete responses."""

    class Meta:
        model = Perfume
        fields = ["perfume_id", "name", "brand", "release_year"]


class PerfumeDetailSerializer(serializers.ModelSerializer):
    """Perfume with notes grouped by layer."""

    notes = serializers.SerializerMethodField()

    class Meta:
        model = Perfume
        fields = [
            "perfume_id",
            "name",
            "brand",
            "release_year",
            "concentration",
            "url",
            "notes",
        ]

    def get_notes(self, obj: Perfume) -> dict:
        by_layer: dict[str, list] = {"top": [], "middle": [], "base": []}
        for pn in obj.perfume_notes.select_related("note").all():
            by_layer[pn.layer].append({"note_id": pn.note.note_id, "name": pn.note.name})
        return by_layer
