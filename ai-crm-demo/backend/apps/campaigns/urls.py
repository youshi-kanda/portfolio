from django.urls import path

from .views import (
    CampaignContentApproveView,
    CampaignContentGenerateView,
    CampaignContentListView,
    CampaignContentRejectView,
    CampaignContentSubmitView,
    CampaignDetailView,
    CampaignImprovementView,
    CampaignListCreateView,
    CampaignResultView,
    CampaignTargetExportExcludedView,
    CampaignTargetExportView,
    CampaignTargetGenerateView,
    CampaignTargetListView,
)

app_name = "campaigns"

urlpatterns = [
    path("", CampaignListCreateView.as_view(), name="list-create"),
    path("<uuid:campaign_id>/", CampaignDetailView.as_view(), name="detail"),
    path("<uuid:campaign_id>/contents/", CampaignContentListView.as_view(), name="contents-list"),
    path("<uuid:campaign_id>/contents/generate/", CampaignContentGenerateView.as_view(), name="contents-generate"),
    path("<uuid:campaign_id>/contents/<uuid:content_id>/submit/", CampaignContentSubmitView.as_view(), name="contents-submit"),
    path("<uuid:campaign_id>/contents/<uuid:content_id>/approve/", CampaignContentApproveView.as_view(), name="contents-approve"),
    path("<uuid:campaign_id>/contents/<uuid:content_id>/reject/", CampaignContentRejectView.as_view(), name="contents-reject"),
    path("<uuid:campaign_id>/targets/", CampaignTargetListView.as_view(), name="targets-list"),
    path("<uuid:campaign_id>/targets/generate/", CampaignTargetGenerateView.as_view(), name="targets-generate"),
    path("<uuid:campaign_id>/targets/export/", CampaignTargetExportView.as_view(), name="targets-export"),
    path("<uuid:campaign_id>/targets/export-excluded/", CampaignTargetExportExcludedView.as_view(), name="targets-export-excluded"),
    path("<uuid:campaign_id>/result/", CampaignResultView.as_view(), name="result"),
    path("<uuid:campaign_id>/improvement/", CampaignImprovementView.as_view(), name="improvement"),
]
