from django.contrib import admin
from django.db import models
from django.db.models import Count, Q
from django.utils.html import format_html

from .models import Accord, AccordNote, Note, NoteAlias, Perfume, PerfumeNote

# ── Site branding ──────────────────────────────────────────────────────────────
admin.site.site_header = "Fragrance Comparer"
admin.site.site_title  = "Fragrance Comparer Admin"
admin.site.index_title = "Dashboard"


# ── Inlines ────────────────────────────────────────────────────────────────────

class PerfumeNoteInline(admin.TabularInline):
    model               = PerfumeNote
    extra               = 3
    max_num             = 60
    autocomplete_fields = ["note"]
    fields              = ["layer", "note"]
    ordering            = ["layer", "note__name"]
    verbose_name        = "Note"
    verbose_name_plural = "Layered Notes"
    show_change_link    = True


class AccordNoteInline(admin.TabularInline):
    model               = AccordNote
    extra               = 1
    autocomplete_fields = ["accord"]
    fields              = ["accord", "mapping_source"]
    verbose_name        = "Accord mapping"
    verbose_name_plural = "Accord mappings"


class NoteAliasInline(admin.TabularInline):
    model               = NoteAlias
    extra               = 1
    fields              = ["alias_name", "source"]
    verbose_name        = "Alias"
    verbose_name_plural = "Aliases (synonyms)"


# ── Perfume ────────────────────────────────────────────────────────────────────

@admin.register(Perfume)
class PerfumeAdmin(admin.ModelAdmin):
    list_display    = ["name", "brand", "concentration",
                       "top_count", "mid_count", "base_count", "parfumo_link"]
    list_filter     = ["concentration"]
    search_fields   = ["name", "brand", "perfume_id"]
    readonly_fields = ["perfume_id", "parfumo_link"]
    inlines         = [PerfumeNoteInline]
    list_per_page   = 50
    save_on_top     = True

    fieldsets = [
        ("Identity", {
            "fields": ["perfume_id", "name", "brand"],
        }),
        ("Details", {
            "fields": ["concentration", "url", "parfumo_link"],
        }),
    ]

    def get_queryset(self, request):
        return (
            super()
            .get_queryset(request)
            .annotate(
                _top_count  = Count("perfume_notes", filter=Q(perfume_notes__layer="top")),
                _mid_count  = Count("perfume_notes", filter=Q(perfume_notes__layer="middle")),
                _base_count = Count("perfume_notes", filter=Q(perfume_notes__layer="base")),
            )
        )

    @admin.display(description="Top ♯", ordering="_top_count")
    def top_count(self, obj):
        return obj._top_count

    @admin.display(description="Mid ♯", ordering="_mid_count")
    def mid_count(self, obj):
        return obj._mid_count

    @admin.display(description="Base ♯", ordering="_base_count")
    def base_count(self, obj):
        return obj._base_count

    @admin.display(description="Parfumo")
    def parfumo_link(self, obj):
        if obj.url:
            return format_html('<a href="{}" target="_blank">View ↗</a>', obj.url)
        return "—"


# ── Note ───────────────────────────────────────────────────────────────────────

@admin.register(Note)
class NoteAdmin(admin.ModelAdmin):
    list_display    = ["note_id", "name", "accord_list", "alias_count", "perfume_count"]
    search_fields   = ["name", "note_id"]
    inlines         = [NoteAliasInline, AccordNoteInline]
    list_per_page   = 100
    readonly_fields = ["note_id"]
    save_on_top     = True

    fieldsets = [
        (None, {"fields": ["note_id", "name"]}),
    ]

    def get_queryset(self, request):
        return (
            super()
            .get_queryset(request)
            .prefetch_related("accord_notes__accord")
            .annotate(
                _perfume_count=Count("perfume_notes", distinct=True),
                _alias_count=Count("aliases", distinct=True),
            )
        )

    @admin.display(description="Accords")
    def accord_list(self, obj):
        names = [an.accord.name for an in obj.accord_notes.all()]
        return ", ".join(names) if names else "—"

    @admin.display(description="Aliases ♯", ordering="_alias_count")
    def alias_count(self, obj):
        return obj._alias_count

    @admin.display(description="Used in ♯ perfumes", ordering="_perfume_count")
    def perfume_count(self, obj):
        return obj._perfume_count


# ── Accord ─────────────────────────────────────────────────────────────────────

@admin.register(Accord)
class AccordAdmin(admin.ModelAdmin):
    list_display  = ["accord_id", "name", "note_count"]
    search_fields = ["name", "accord_id"]
    list_per_page = 50
    readonly_fields = ["accord_id"]

    fieldsets = [
        (None, {"fields": ["accord_id", "name"]}),
    ]

    def get_queryset(self, request):
        return (
            super()
            .get_queryset(request)
            .annotate(_note_count=Count("accord_notes"))
        )

    @admin.display(description="Notes ♯", ordering="_note_count")
    def note_count(self, obj):
        return obj._note_count


# ── AccordNote ─────────────────────────────────────────────────────────────────

@admin.register(AccordNote)
class AccordNoteAdmin(admin.ModelAdmin):
    list_display        = ["note", "accord", "mapping_source"]
    list_filter         = ["mapping_source", "accord"]
    search_fields       = ["note__name", "accord__name"]
    autocomplete_fields = ["note", "accord"]
    list_per_page       = 100
    list_select_related = ["note", "accord"]


# ── PerfumeNote ────────────────────────────────────────────────────────────────

@admin.register(PerfumeNote)
class PerfumeNoteAdmin(admin.ModelAdmin):
    list_display        = ["perfume", "layer", "note"]
    list_filter         = ["layer"]
    search_fields       = ["perfume__name", "note__name"]
    autocomplete_fields = ["perfume", "note"]
    list_per_page       = 100
    list_select_related = ["perfume", "note"]


# ── NoteAlias ──────────────────────────────────────────────────────────────────

@admin.register(NoteAlias)
class NoteAliasAdmin(admin.ModelAdmin):
    """View / add / update synonym → canonical-note mappings."""

    list_display        = ["alias_name", "canonical_note", "source"]
    list_filter         = ["source"]
    search_fields       = ["alias_name", "note__name", "note__note_id"]
    autocomplete_fields = ["note"]
    list_per_page       = 100
    list_select_related = ["note"]

    @admin.display(description="Canonical note", ordering="note__name")
    def canonical_note(self, obj):
        return obj.note.name
