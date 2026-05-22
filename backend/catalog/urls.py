from django.urls import path

from .views import NoteAutocompleteView, NoteDetailView, PerfumeDetailView

urlpatterns = [
    path("notes/", NoteAutocompleteView.as_view(), name="note-autocomplete"),
    path("notes/<str:note_id>/", NoteDetailView.as_view(), name="note-detail"),
    path("perfumes/<str:perfume_id>/", PerfumeDetailView.as_view(), name="perfume-detail"),
]
