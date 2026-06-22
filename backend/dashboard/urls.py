from django.urls import path

from .views import (
    AdminAliasView,
    AdminLogsView,
    AdminNoteCreateView,
    AdminPerfumeDetailView,
    AdminPerfumeListView,
    LoginView,
    LogoutView,
    MeView,
)

urlpatterns = [
    path("admin/login/", LoginView.as_view(), name="admin-login"),
    path("admin/logout/", LogoutView.as_view(), name="admin-logout"),
    path("admin/me/", MeView.as_view(), name="admin-me"),
    path("admin/perfumes/", AdminPerfumeListView.as_view(), name="admin-perfume-create"),
    path("admin/perfumes/<str:perfume_id>/", AdminPerfumeDetailView.as_view(), name="admin-perfume-detail"),
    path("admin/notes/", AdminNoteCreateView.as_view(), name="admin-note-create"),
    path("admin/aliases/", AdminAliasView.as_view(), name="admin-alias"),
    path("admin/logs/", AdminLogsView.as_view(), name="admin-logs"),
]
