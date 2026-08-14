from unittest.mock import MagicMock, patch

import pytest
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken

from apps.accounts.models import User
from apps.ai_core.models import AIExpressionCheckLog
from apps.ai_core.services.expression_checker import (
    check_expression,
)
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
        name="テストサロン",
        industry=Store.Industry.ESTHETIC,
        area_label="梅田",
        created_by=user,
    )


def _check_url(store_id):
    return reverse("stores:ai-expression-check", kwargs={"store_id": store_id})


# ---------------------------------------------------------------------------
# Unit tests: expression_checker service
# ---------------------------------------------------------------------------


class TestExpressionCheckerService:
    def test_mock_provider_returns_none_risk(self, db):
        with patch("apps.ai_core.services.expression_checker.settings") as mock_settings:
            mock_settings.AI_PROVIDER = "mock"
            result = check_expression(
                body="いつもありがとうございます。お気軽にご相談ください。",
                industry="esthetic",
                content_type="line",
            )

        assert result.risk_level == "none"
        assert result.risk_score == 0
        assert result.issues == []
        assert result.model_used == "mock"
        assert result.requires_human_approval is True

    def test_unknown_provider_raises(self, db):
        with patch("apps.ai_core.services.expression_checker.settings") as mock_settings:
            mock_settings.AI_PROVIDER = "unknown_provider"
            with pytest.raises(RuntimeError, match="未対応"):
                check_expression(body="テスト", industry="esthetic", content_type="line")

    def test_anthropic_provider_parses_response(self, db):
        mock_message = MagicMock()
        mock_message.content = [MagicMock(text='{"risk_score": 45, "issues": [{"text": "必ず痩せます", "category": "effect_guarantee", "reason": "効果保証表現", "severity": "high", "suggestion": "目標に合わせてサポートします"}], "overall_comment": "効果断定表現が含まれます"}')]
        mock_message.usage = MagicMock(input_tokens=100, output_tokens=50)

        with patch("apps.ai_core.services.expression_checker.settings") as mock_settings:
            mock_settings.AI_PROVIDER = "anthropic"
            mock_settings.ANTHROPIC_API_KEY = "test-key"
            mock_settings.ANTHROPIC_MODEL = "claude-sonnet-4-6"
            with patch("anthropic.Anthropic") as mock_anthropic_cls:
                mock_client = MagicMock()
                mock_anthropic_cls.return_value = mock_client
                mock_client.messages.create.return_value = mock_message

                result = check_expression(
                    body="必ず痩せます。",
                    industry="esthetic",
                    content_type="line",
                )

        assert result.risk_level == "medium"
        assert result.risk_score == 45
        assert len(result.issues) == 1
        assert result.issues[0].category == "effect_guarantee"
        assert result.requires_human_approval is True
        assert result.model_used == "claude-sonnet-4-6"

    def test_anthropic_no_api_key_raises(self, db):
        with patch("apps.ai_core.services.expression_checker.settings") as mock_settings:
            mock_settings.AI_PROVIDER = "anthropic"
            mock_settings.ANTHROPIC_API_KEY = ""
            with pytest.raises(RuntimeError, match="ANTHROPIC_API_KEY"):
                check_expression(body="テスト", industry="esthetic", content_type="line")


# ---------------------------------------------------------------------------
# API tests: expression-check endpoint
# ---------------------------------------------------------------------------


class TestExpressionCheckAPI:
    def test_200_clean_text(self, auth_client, store):
        res = auth_client.post(
            _check_url(store.id),
            data={"content_type": "line", "body": "いつもありがとうございます。", "industry": "esthetic"},
            format="json",
        )
        assert res.status_code == status.HTTP_200_OK
        data = res.data["data"]
        assert "risk_level" in data
        assert "risk_score" in data
        assert "issues" in data
        assert "overall_comment" in data
        assert "requires_human_approval" in data

    def test_200_saves_log(self, auth_client, store):
        auth_client.post(
            _check_url(store.id),
            data={"content_type": "line", "body": "いつもありがとうございます。", "industry": "esthetic"},
            format="json",
        )
        log = AIExpressionCheckLog.objects.get(store_id=store.id)
        assert log.content_type == "line"
        assert log.industry == "esthetic"
        assert log.body_length > 0
        assert log.model_used == "mock"

    def test_400_missing_body(self, auth_client, store):
        res = auth_client.post(
            _check_url(store.id),
            data={"content_type": "line", "industry": "esthetic"},
            format="json",
        )
        assert res.status_code == status.HTTP_400_BAD_REQUEST
        assert res.data["error"]["code"] == "VALIDATION_ERROR"

    def test_400_invalid_content_type(self, auth_client, store):
        res = auth_client.post(
            _check_url(store.id),
            data={"content_type": "invalid", "body": "テスト", "industry": "esthetic"},
            format="json",
        )
        assert res.status_code == status.HTTP_400_BAD_REQUEST

    def test_400_invalid_industry(self, auth_client, store):
        res = auth_client.post(
            _check_url(store.id),
            data={"content_type": "line", "body": "テスト", "industry": "unknown"},
            format="json",
        )
        assert res.status_code == status.HTTP_400_BAD_REQUEST

    def test_401_unauthenticated(self, client, store):
        res = client.post(
            _check_url(store.id),
            data={"content_type": "line", "body": "テスト", "industry": "esthetic"},
            format="json",
        )
        assert res.status_code == status.HTTP_401_UNAUTHORIZED

    def test_403_other_store(self, auth_client, db):
        other_user = User.objects.create_user(
            email="other@example.com", name="他", password="StrongPass123!"
        )
        other_store = Store.objects.create(
            tenant_id=other_user.id,
            name="他サロン",
            industry=Store.Industry.HAIR,
            area_label="難波",
            created_by=other_user,
        )
        res = auth_client.post(
            _check_url(other_store.id),
            data={"content_type": "line", "body": "テスト", "industry": "esthetic"},
            format="json",
        )
        assert res.status_code == status.HTTP_403_FORBIDDEN

    def test_502_ai_failure(self, auth_client, store):
        with patch(
            "apps.ai_core.views.check_expression",
            side_effect=RuntimeError("API接続エラー"),
        ):
            res = auth_client.post(
                _check_url(store.id),
                data={"content_type": "line", "body": "テスト", "industry": "esthetic"},
                format="json",
            )
        assert res.status_code == 502
        assert res.data["error"]["code"] == "AI_PROVIDER_ERROR"
