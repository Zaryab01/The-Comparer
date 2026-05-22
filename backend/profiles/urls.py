from django.urls import path

from .views import GroupDetailView, GroupListView, ProfileDetailView, ProfileListView

urlpatterns = [
    path("groups/",          GroupListView.as_view()),
    path("groups/<int:pk>/", GroupDetailView.as_view()),
    path("profiles/",          ProfileListView.as_view()),
    path("profiles/<int:pk>/", ProfileDetailView.as_view()),
]
