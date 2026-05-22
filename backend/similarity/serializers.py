from rest_framework import serializers

from catalog.models import Note


class CompareInputSerializer(serializers.Serializer):
    top    = serializers.ListField(child=serializers.CharField(), default=list)
    middle = serializers.ListField(child=serializers.CharField(), default=list)
    base   = serializers.ListField(child=serializers.CharField(), default=list)

    # ── Target selection ───────────────────────────────────────────────────────
    # target: "main" (default) → search the main perfume database
    #         "group"          → search a profile group (group_id required)
    target   = serializers.ChoiceField(choices=["main", "group"], default="main")
    group_id = serializers.IntegerField(allow_null=True, required=False, default=None)

    def validate(self, data: dict) -> dict:
        all_ids = data["top"] + data["middle"] + data["base"]

        if not all_ids:
            raise serializers.ValidationError(
                "At least one note is required across top, middle, or base."
            )

        # Validate all submitted note_ids exist in one query
        existing = set(
            Note.objects.filter(note_id__in=all_ids).values_list("note_id", flat=True)
        )
        missing = [nid for nid in all_ids if nid not in existing]
        if missing:
            raise serializers.ValidationError(
                {"note_ids": f"Unknown note id(s): {', '.join(missing)}"}
            )

        # group_id is required when target == "group"
        if data["target"] == "group":
            if not data.get("group_id"):
                raise serializers.ValidationError(
                    {"group_id": "group_id is required when target is 'group'."}
                )
            from profiles.models import ProfileGroup
            if not ProfileGroup.objects.filter(pk=data["group_id"]).exists():
                raise serializers.ValidationError(
                    {"group_id": f"Profile group {data['group_id']} does not exist."}
                )

        return data


class LayerBreakdownSerializer(serializers.Serializer):
    score            = serializers.FloatField()
    matched_note_ids = serializers.ListField(child=serializers.CharField())


class MatchResultSerializer(serializers.Serializer):
    perfume_id    = serializers.CharField()
    perfume_name  = serializers.CharField()
    perfume_brand = serializers.CharField(allow_null=True)
    release_year  = serializers.IntegerField(allow_null=True)
    url           = serializers.URLField(allow_null=True, allow_blank=True)
    overall_score = serializers.FloatField()
    top           = LayerBreakdownSerializer(allow_null=True)
    middle        = LayerBreakdownSerializer(allow_null=True)
    base          = LayerBreakdownSerializer(allow_null=True)


class CompareOutputSerializer(serializers.Serializer):
    results = MatchResultSerializer(many=True)
