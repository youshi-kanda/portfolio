from unittest.mock import patch

import pytest
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken

from apps.accounts.models import User
from apps.ai_core.models import AIGenerationLog, AIPromptTemplate
from apps.ai_core.services.copy_generator import GenerationResult, generate_copy
from apps.campaigns.models import Campaign, CampaignContent
from apps.stores.models import Store

# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


@pytest.fixture
def client() -> APIClient:
    return APIClient()


@pytest.fixture
def user(db) -> User:
    return User.objects.create_user(
        email="owner@example.com", name="オーナー", password="StrongPass123!"
    )


@pytest.fixture
def auth_client(client, user) -> APIClient:
    token = RefreshToken.for_user(user).access_token
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")
    return client


@pytest.fixture
def store(db, user) -> Store:
    return Store.objects.create(
        tenant_id=user.id,
        name="テスト店舗",
        industry=Store.Industry.ESTHETIC,
        area_label="梅田",
        created_by=user,
    )


@pytest.fixture
def campaign(store, user) -> Campaign:
    return Campaign.objects.create(
        store=store,
        owner_user=user,
        name="休眠復帰施策",
        purpose=Campaign.Purpose.DORMANT_REACTIVATION,
        channel=Campaign.Channel.OFFICIAL_LINE,
        target_count=10,
    )


def _generate_url(store_id, campaign_id):
    return reverse(
        "stores:campaigns:contents-generate",
        kwargs={"store_id": store_id, "campaign_id": campaign_id},
    )


# ---------------------------------------------------------------------------
# Unit tests: copy_generator service
# ---------------------------------------------------------------------------


class TestCopyGeneratorService:
    def test_mock_provider_returns_result(self, db, store, campaign):
        with patch("apps.ai_core.services.copy_generator.settings") as mock_settings:
            mock_settings.AI_PROVIDER = "mock"
            mock_settings.ANTHROPIC_API_KEY = ""
            result = generate_copy(campaign, store, tone="warm")

        assert result.body
        assert result.confidence in ("high", "medium", "low")
        assert result.model_used == "mock"
        assert result.expression_risk_level in ("none", "low", "medium", "high")
        assert len(result.cautions) > 0

    def test_unknown_provider_raises(self, db, store, campaign):
        with patch("apps.ai_core.services.copy_generator.settings") as mock_settings:
            mock_settings.AI_PROVIDER = "unknown_provider"
            with pytest.raises(RuntimeError, match="未対応"):
                generate_copy(campaign, store)

    def test_db_template_is_preferred(self, db, store, campaign):
        AIPromptTemplate.objects.create(
            name="custom_line_dormant",
            version=2,
            purpose="dormant_reactivation",
            channel="official_line",
            system_prompt="カスタムシステムプロンプト",
            user_prompt_template=(
                "業種:{industry} 目的:{purpose_label} セグメント:{target_segment} "
                "対象者:{target_count} 店舗:{store_name} エリア:{area_label} "
                "チャネル:{channel_label} トーン:{tone}"
            ),
            is_active=True,
        )
        with patch("apps.ai_core.services.copy_generator.settings") as mock_settings:
            mock_settings.AI_PROVIDER = "mock"
            result = generate_copy(campaign, store, tone="warm")

        assert result.template_name == "custom_line_dormant"
        assert result.template_version == 2

    def test_builtin_template_branches_by_industry(self, db, store, campaign):
        store.industry = Store.Industry.GYM
        store.save(update_fields=["industry"])

        with patch("apps.ai_core.services.copy_generator.settings") as mock_settings:
            mock_settings.AI_PROVIDER = "mock"
            result = generate_copy(campaign, store, tone="warm")

        assert result.template_name == "builtin_line_copy_gym"


# ---------------------------------------------------------------------------
# API tests: contents/generate endpoint
# ---------------------------------------------------------------------------


class TestCampaignContentGenerate:
    def test_generate_creates_content(self, auth_client, store, campaign):
        res = auth_client.post(_generate_url(store.id, campaign.id))

        assert res.status_code == status.HTTP_201_CREATED
        data = res.data["data"]
        assert data["generated_by_ai"] is True
        assert data["approval_status"] == "draft"
        assert data["body"]
        assert "generation" in data
        assert "reasoning" in data["generation"]
        assert "confidence" in data["generation"]
        assert "cautions" in data["generation"]

    def test_generate_saves_to_db(self, auth_client, store, campaign):
        auth_client.post(_generate_url(store.id, campaign.id))

        assert CampaignContent.objects.filter(campaign=campaign, generated_by_ai=True).count() == 1

    @pytest.mark.parametrize(
        ("ai_value", "expected"),
        [
            ("safe", "none"),
            ("caution", "medium"),
            ("high_risk", "high"),
            ("low", "low"),
            ("unknown", "medium"),
        ],
    )
    def test_generate_normalizes_expression_risk_level(self, auth_client, store, campaign, ai_value, expected):
        result = GenerationResult(
            title="テスト文案",
            body="テスト本文",
            cta="予約する",
            reasoning="テスト理由",
            confidence="medium",
            cautions=[],
            expression_risk_level=ai_value,
            template_name="test_template",
            template_version=1,
            model_used="mock",
            input_tokens=None,
            output_tokens=None,
        )
        with patch("apps.ai_core.services.copy_generator.generate_copy", return_value=result):
            res = auth_client.post(_generate_url(store.id, campaign.id))

        assert res.status_code == status.HTTP_201_CREATED
        content = CampaignContent.objects.get(campaign=campaign)
        assert content.expression_risk_level == expected
        assert res.data["data"]["expression_risk_level"] == expected

    def test_generate_creates_log(self, auth_client, store, campaign):
        auth_client.post(_generate_url(store.id, campaign.id))

        log = AIGenerationLog.objects.get(campaign=campaign)
        assert log.success is True
        assert log.model_used == "mock"

    def test_generate_with_tone(self, auth_client, store, campaign):
        res = auth_client.post(_generate_url(store.id, campaign.id), data={"tone": "professional"})

        assert res.status_code == status.HTTP_201_CREATED
        content = CampaignContent.objects.get(campaign=campaign)
        assert content.tone == "professional"

    def test_generate_ai_error_creates_failure_log(self, auth_client, store, campaign):
        with patch("apps.ai_core.services.copy_generator.generate_copy", side_effect=RuntimeError("API接続エラー")):
            res = auth_client.post(_generate_url(store.id, campaign.id))

        assert res.status_code == 502
        assert CampaignContent.objects.filter(campaign=campaign).count() == 0
        log = AIGenerationLog.objects.get(campaign=campaign)
        assert log.success is False
        assert "API接続エラー" in log.error_message

    def test_generate_sets_correct_content_type_for_line(self, auth_client, store, campaign):
        # campaign channel は official_line → content_type は "line"
        auth_client.post(_generate_url(store.id, campaign.id))
        content = CampaignContent.objects.get(campaign=campaign)
        assert content.content_type == "line"

    def test_401_unauthenticated(self, client, store, campaign):
        assert client.post(_generate_url(store.id, campaign.id)).status_code == status.HTTP_401_UNAUTHORIZED

    def test_403_other_store(self, auth_client, db):
        other_user = User.objects.create_user(
            email="other@example.com", name="他", password="StrongPass123!"
        )
        other_store = Store.objects.create(
            tenant_id=other_user.id, name="他店舗",
            industry=Store.Industry.HAIR, area_label="難波", created_by=other_user,
        )
        other_campaign = Campaign.objects.create(
            store=other_store, owner_user=other_user,
            name="他施策", purpose="repeat", channel="in_store",
        )
        url = _generate_url(other_store.id, other_campaign.id)
        assert auth_client.post(url).status_code == status.HTTP_403_FORBIDDEN
