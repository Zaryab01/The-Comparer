from django.urls import path

from .views import NoteAutocompleteView, NoteDetailView, PerfumeDetailView, PerfumeSearchView

urlpatterns = [
    path("notes/", NoteAutocompleteView.as_view(), name="note-autocomplete"),
    path("notes/<str:note_id>/", NoteDetailView.as_view(), name="note-detail"),
    # Perfume search must come before the <perfume_id> capture to avoid conflict
    path("perfumes/", PerfumeSearchView.as_view(), name="perfume-search"),
    path("perfumes/<str:perfume_id>/", PerfumeDetailView.as_view(), name="perfume-detail"),
]
