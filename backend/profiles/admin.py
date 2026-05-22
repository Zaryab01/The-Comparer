from django.contrib import admin
from django.db.models import Count

from .models import Profile, ProfileGroup, ProfileNote


class ProfileNoteInline(admin.TabularInline):
    model               = ProfileNote
    extra               = 3
    autocomplete_fields = ["note"]
    fields              = ["layer", "note"]
    ordering            = ["layer", "note__name"]


@admin.register(ProfileGroup)
class ProfileGroupAdmin(admin.ModelAdmin):
    list_display  = ["name", "profile_count", "description", "created_at"]
    search_fields = ["name"]
    readonly_fields = ["created_at"]

    def get_queryset(self, request):
        return super().get_queryset(request).annotate(_cnt=Count("profiles"))

    @admin.display(description="Profiles ♯", ordering="_cnt")
    def profile_count(self, obj):
        return obj._cnt


@admin.register(Profile)
class ProfileAdmin(admin.ModelAdmin):
    list_display    = ["name", "brand", "group", "created_at"]
    list_filter     = ["group"]
    search_fields   = ["name", "brand"]
    list_select_related = ["group"]
    inlines         = [ProfileNoteInline]
    save_on_top     = True
