from django.urls import path

from .views import AgencyDiagnosisView, ExpressionCheckView

app_name = "ai_core"

urlpatterns = [
    path("stores/<uuid:store_id>/expression-check/", ExpressionCheckView.as_view(), name="expression-check"),
    path("stores/<uuid:store_id>/agency-diagnosis/", AgencyDiagnosisView.as_view(), name="agency-diagnosis"),
]
