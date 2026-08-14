from django.urls import path

from .views import ImportJobDetailView, ImportJobErrorListView, ImportJobExecuteView, ImportJobListCreateView

app_name = "imports"

urlpatterns = [
    path("", ImportJobListCreateView.as_view(), name="list-create"),
    path("<uuid:job_id>/", ImportJobDetailView.as_view(), name="detail"),
    path("<uuid:job_id>/execute/", ImportJobExecuteView.as_view(), name="execute"),
    path("<uuid:job_id>/errors/", ImportJobErrorListView.as_view(), name="errors"),
]
