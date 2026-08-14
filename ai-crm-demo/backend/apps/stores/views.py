import uuid

from django.utils import timezone
from drf_spectacular.utils import OpenApiResponse, extend_schema
from rest_framework import status
from rest_framework.exceptions import NotFound, PermissionDenied
from rest_framework.permissions import IsAuthenticated
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.models import User
from apps.audit.models import AuditLog
from apps.audit.services import write_audit_log
from config.demo_guard import deny_if_demo

from .models import Menu, Store, StoreCollaborator, StoreSettings, StoreTool
from .serializers import (
    MenuCreateSerializer,
    MenuSerializer,
    MenuUpdateSerializer,
    StoreCollaboratorInviteSerializer,
    StoreCollaboratorSerializer,
    StoreCollaboratorUpdateSerializer,
    StoreCreateSerializer,
    StoreSerializer,
    StoreSettingsSerializer,
    StoreToolCreateSerializer,
    StoreToolSerializer,
    StoreToolUpdateSerializer,
    StoreUpdateSerializer,
)


def _request_id() -> str:
    return f"req_{uuid.uuid4().hex[:12]}"


def _ok(data: dict | list, http_status: int = status.HTTP_200_OK) -> Response:
    return Response({"data": data, "meta": {"request_id": _request_id()}}, status=http_status)


def _ok_list(data: list, total: int, page: int = 1, per_page: int = 50) -> Response:
    return Response(
        {
            "data": data,
            "meta": {
                "page": page,
                "per_page": per_page,
                "total": total,
                "request_id": _request_id(),
            },
        },
        status=status.HTTP_200_OK,
    )


def _get_store_or_404(store_id: uuid.UUID, user) -> Store:
    """Store取得 + オーナー権限チェック（既存の振る舞いを維持）。"""
    try:
        store = Store.objects.get(id=store_id, deleted_at__isnull=True)
    except Store.DoesNotExist:
        raise NotFound("店舗が見つかりません。") from None
    if store.created_by_id != user.id:
        raise PermissionDenied("この店舗へのアクセス権限がありません。")
    return store


def _get_store_or_404_with_collab(
    store_id: uuid.UUID,
    user,
    required_perm: str | None = None,
) -> tuple[Store, StoreCollaborator | None]:
    """Store取得。オーナーまたは collaborator（can_view=True）を許可する。
    required_perm を指定した場合、collaborator はその権限フィールドが True である必要がある。
    戻り値: (store, collab_or_None) — オーナーの場合 collab は None。
    """
    try:
        store = Store.objects.get(id=store_id, deleted_at__isnull=True)
    except Store.DoesNotExist:
        raise NotFound("店舗が見つかりません。") from None

    if store.created_by_id == user.id:
        return store, None

    try:
        collab = StoreCollaborator.objects.get(store=store, user=user)
    except StoreCollaborator.DoesNotExist:
        raise PermissionDenied("この店舗へのアクセス権限がありません。") from None

    if not collab.can_view:
        raise PermissionDenied("この店舗へのアクセス権限がありません。")
    if required_perm and not getattr(collab, required_perm, False):
        raise PermissionDenied("この操作を行う権限がありません。")

    return store, collab


def _require_store_owner(store: Store, user) -> None:
    """オーナー以外は PermissionDenied を発生させる。"""
    if store.created_by_id != user.id:
        raise PermissionDenied("この操作はオーナーのみ実行できます。")


class StoreListCreateView(APIView):
    permission_classes = [IsAuthenticated]

    @extend_schema(
        responses={200: StoreSerializer(many=True)},
        tags=["stores"],
        summary="店舗一覧取得",
    )
    def get(self, request: Request) -> Response:
        stores = Store.objects.filter(
            created_by=request.user, deleted_at__isnull=True
        ).order_by("created_at")
        return _ok_list(StoreSerializer(stores, many=True).data, total=stores.count())

    @extend_schema(
        request=StoreCreateSerializer,
        responses={201: StoreSerializer},
        tags=["stores"],
        summary="店舗作成",
    )
    def post(self, request: Request) -> Response:
        deny_if_demo()
        serializer = StoreCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        d = serializer.validated_data

        store = Store.objects.create(
            tenant_id=request.user.id,
            created_by=request.user,
            **d,
        )
        StoreSettings.objects.create(store=store)

        return _ok(StoreSerializer(store).data, http_status=status.HTTP_201_CREATED)


class StoreDetailView(APIView):
    permission_classes = [IsAuthenticated]

    @extend_schema(
        responses={200: StoreSerializer},
        tags=["stores"],
        summary="店舗詳細取得",
    )
    def get(self, request: Request, store_id: uuid.UUID) -> Response:
        store = _get_store_or_404(store_id, request.user)
        return _ok(StoreSerializer(store).data)

    @extend_schema(
        request=StoreUpdateSerializer,
        responses={200: StoreSerializer},
        tags=["stores"],
        summary="店舗更新",
    )
    def patch(self, request: Request, store_id: uuid.UUID) -> Response:
        store = _get_store_or_404(store_id, request.user)
        serializer = StoreUpdateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        changed_fields = sorted(serializer.validated_data.keys())
        for field, value in serializer.validated_data.items():
            setattr(store, field, value)
        store.save()
        if changed_fields:
            write_audit_log(
                request=request,
                store=store,
                action=AuditLog.Action.STORE_UPDATED,
                target_type="store",
                target_id=store.id,
                before_snapshot={"changed_fields": changed_fields},
                after_snapshot={"changed_fields": changed_fields},
            )

        return _ok(StoreSerializer(store).data)

    @extend_schema(
        responses={200: OpenApiResponse(description="論理削除成功")},
        tags=["stores"],
        summary="店舗削除（論理削除）",
    )
    def delete(self, request: Request, store_id: uuid.UUID) -> Response:
        deny_if_demo()
        store = _get_store_or_404(store_id, request.user)
        store.deleted_at = timezone.now()
        store.save(update_fields=["deleted_at"])
        return _ok({"message": "店舗を削除しました。"})


class StoreSettingsView(APIView):
    permission_classes = [IsAuthenticated]

    @extend_schema(
        responses={200: StoreSettingsSerializer},
        tags=["stores"],
        summary="店舗設定取得",
    )
    def get(self, request: Request, store_id: uuid.UUID) -> Response:
        store = _get_store_or_404(store_id, request.user)
        settings, _ = StoreSettings.objects.get_or_create(store=store)
        return _ok(StoreSettingsSerializer(settings).data)

    @extend_schema(
        request=StoreSettingsSerializer,
        responses={200: StoreSettingsSerializer},
        tags=["stores"],
        summary="店舗設定更新",
    )
    def patch(self, request: Request, store_id: uuid.UUID) -> Response:
        store = _get_store_or_404(store_id, request.user)
        settings, _ = StoreSettings.objects.get_or_create(store=store)

        serializer = StoreSettingsSerializer(settings, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()

        return _ok(StoreSettingsSerializer(settings).data)


class StoreToolListCreateView(APIView):
    permission_classes = [IsAuthenticated]

    @extend_schema(
        responses={200: StoreToolSerializer(many=True)},
        tags=["stores"],
        summary="利用ツール一覧取得",
    )
    def get(self, request: Request, store_id: uuid.UUID) -> Response:
        store = _get_store_or_404(store_id, request.user)
        tools = StoreTool.objects.filter(store=store).order_by("created_at")
        return _ok_list(StoreToolSerializer(tools, many=True).data, total=tools.count())

    @extend_schema(
        request=StoreToolCreateSerializer,
        responses={201: StoreToolSerializer},
        tags=["stores"],
        summary="利用ツール登録",
    )
    def post(self, request: Request, store_id: uuid.UUID) -> Response:
        store = _get_store_or_404(store_id, request.user)
        serializer = StoreToolCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        tool = StoreTool.objects.create(store=store, **serializer.validated_data)
        return _ok(StoreToolSerializer(tool).data, http_status=status.HTTP_201_CREATED)


class StoreToolDetailView(APIView):
    permission_classes = [IsAuthenticated]

    @extend_schema(
        request=StoreToolUpdateSerializer,
        responses={200: StoreToolSerializer},
        tags=["stores"],
        summary="利用ツール更新",
    )
    def patch(self, request: Request, store_id: uuid.UUID, tool_id: uuid.UUID) -> Response:
        store = _get_store_or_404(store_id, request.user)
        try:
            tool = StoreTool.objects.get(id=tool_id, store=store)
        except StoreTool.DoesNotExist:
            raise NotFound("ツールが見つかりません。") from None

        serializer = StoreToolUpdateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        for field, value in serializer.validated_data.items():
            setattr(tool, field, value)
        tool.save()

        return _ok(StoreToolSerializer(tool).data)


class MenuListCreateView(APIView):
    permission_classes = [IsAuthenticated]

    @extend_schema(
        responses={200: MenuSerializer(many=True)},
        tags=["menus"],
        summary="メニュー一覧取得",
    )
    def get(self, request: Request, store_id: uuid.UUID) -> Response:
        store = _get_store_or_404(store_id, request.user)
        menus = Menu.objects.filter(store=store, deleted_at__isnull=True).order_by("created_at")
        return _ok_list(MenuSerializer(menus, many=True).data, total=menus.count())

    @extend_schema(
        request=MenuCreateSerializer,
        responses={201: MenuSerializer},
        tags=["menus"],
        summary="メニュー登録",
    )
    def post(self, request: Request, store_id: uuid.UUID) -> Response:
        store = _get_store_or_404(store_id, request.user)
        serializer = MenuCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        menu = Menu.objects.create(store=store, **serializer.validated_data)
        return _ok(MenuSerializer(menu).data, http_status=status.HTTP_201_CREATED)


class MenuDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def _get_menu_or_404(self, store: Store, menu_id: uuid.UUID) -> Menu:
        try:
            return Menu.objects.get(id=menu_id, store=store, deleted_at__isnull=True)
        except Menu.DoesNotExist:
            raise NotFound("メニューが見つかりません。") from None

    @extend_schema(
        responses={200: MenuSerializer},
        tags=["menus"],
        summary="メニュー詳細取得",
    )
    def get(self, request: Request, store_id: uuid.UUID, menu_id: uuid.UUID) -> Response:
        store = _get_store_or_404(store_id, request.user)
        menu = self._get_menu_or_404(store, menu_id)
        return _ok(MenuSerializer(menu).data)

    @extend_schema(
        request=MenuUpdateSerializer,
        responses={200: MenuSerializer},
        tags=["menus"],
        summary="メニュー更新",
    )
    def patch(self, request: Request, store_id: uuid.UUID, menu_id: uuid.UUID) -> Response:
        store = _get_store_or_404(store_id, request.user)
        menu = self._get_menu_or_404(store, menu_id)

        serializer = MenuUpdateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        for field, value in serializer.validated_data.items():
            setattr(menu, field, value)
        menu.save()

        return _ok(MenuSerializer(menu).data)

    @extend_schema(
        responses={200: OpenApiResponse(description="論理削除成功")},
        tags=["menus"],
        summary="メニュー削除（論理削除）",
    )
    def delete(self, request: Request, store_id: uuid.UUID, menu_id: uuid.UUID) -> Response:
        deny_if_demo()
        store = _get_store_or_404(store_id, request.user)
        menu = self._get_menu_or_404(store, menu_id)
        menu.deleted_at = timezone.now()
        menu.save(update_fields=["deleted_at"])
        return _ok({"message": "メニューを削除しました。"})


class CollaboratorListCreateView(APIView):
    permission_classes = [IsAuthenticated]

    @extend_schema(
        responses={200: StoreCollaboratorSerializer(many=True)},
        tags=["collaborators"],
        summary="協力者一覧取得（オーナーのみ）",
    )
    def get(self, request: Request, store_id: uuid.UUID) -> Response:
        store = _get_store_or_404(store_id, request.user)
        collabs = (
            StoreCollaborator.objects.filter(store=store)
            .select_related("user", "invited_by")
            .order_by("created_at")
        )
        return _ok_list(
            StoreCollaboratorSerializer(collabs, many=True).data,
            total=collabs.count(),
        )

    @extend_schema(
        request=StoreCollaboratorInviteSerializer,
        responses={201: StoreCollaboratorSerializer},
        tags=["collaborators"],
        summary="協力者招待（オーナーのみ）",
    )
    def post(self, request: Request, store_id: uuid.UUID) -> Response:
        deny_if_demo()
        store = _get_store_or_404(store_id, request.user)

        serializer = StoreCollaboratorInviteSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        d = serializer.validated_data

        try:
            target_user = User.objects.get(email=d["user_email"], is_active=True)
        except User.DoesNotExist:
            return Response(
                {
                    "error": {
                        "code": "NOT_FOUND",
                        "message": "指定されたメールアドレスのユーザーが見つかりません。",
                        "details": [{"field": "user_email", "message": "登録済みユーザーのメールアドレスを指定してください。"}],
                    },
                    "meta": {"request_id": _request_id()},
                },
                status=status.HTTP_404_NOT_FOUND,
            )

        if target_user.id == request.user.id:
            return Response(
                {
                    "error": {
                        "code": "BUSINESS_RULE_ERROR",
                        "message": "自分自身を協力者として招待することはできません。",
                        "details": [],
                    },
                    "meta": {"request_id": _request_id()},
                },
                status=status.HTTP_422_UNPROCESSABLE_ENTITY,
            )

        collab, created = StoreCollaborator.objects.get_or_create(
            store=store,
            user=target_user,
            defaults={
                "can_view": d["can_view"],
                "can_edit_campaigns": d["can_edit_campaigns"],
                "can_approve_contents": d["can_approve_contents"],
                "can_view_personal_info": d["can_view_personal_info"],
                "can_export_csv": d["can_export_csv"],
                "invited_by": request.user,
            },
        )

        if not created:
            return Response(
                {
                    "error": {
                        "code": "CONFLICT",
                        "message": "このユーザーはすでに協力者として登録されています。",
                        "details": [],
                    },
                    "meta": {"request_id": _request_id()},
                },
                status=status.HTTP_409_CONFLICT,
            )

        return _ok(StoreCollaboratorSerializer(collab).data, http_status=status.HTTP_201_CREATED)


class MyStorePermissionsView(APIView):
    """ログインユーザー自身の当該店舗における権限を返す（オーナー・コラボレーター共通）。"""

    permission_classes = [IsAuthenticated]

    @extend_schema(
        responses={200: OpenApiResponse(description="自己権限情報")},
        tags=["stores"],
        summary="自己権限確認",
    )
    def get(self, request: Request, store_id: uuid.UUID) -> Response:
        _store, collab = _get_store_or_404_with_collab(store_id, request.user)
        if collab is None:
            return _ok({"is_owner": True, "can_approve_contents": True})
        return _ok({
            "is_owner": False,
            "can_approve_contents": collab.can_approve_contents,
        })


class CollaboratorDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def _get_collab_or_404(self, store: Store, collab_id: uuid.UUID) -> StoreCollaborator:
        try:
            return StoreCollaborator.objects.select_related("user").get(
                id=collab_id, store=store
            )
        except StoreCollaborator.DoesNotExist:
            raise NotFound("協力者が見つかりません。") from None

    @extend_schema(
        request=StoreCollaboratorUpdateSerializer,
        responses={200: StoreCollaboratorSerializer},
        tags=["collaborators"],
        summary="協力者権限変更（オーナーのみ）",
    )
    def patch(self, request: Request, store_id: uuid.UUID, collab_id: uuid.UUID) -> Response:
        deny_if_demo()
        store = _get_store_or_404(store_id, request.user)
        collab = self._get_collab_or_404(store, collab_id)

        serializer = StoreCollaboratorUpdateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        for field, value in serializer.validated_data.items():
            setattr(collab, field, value)
        collab.save()

        return _ok(StoreCollaboratorSerializer(collab).data)

    @extend_schema(
        responses={200: OpenApiResponse(description="協力者削除成功")},
        tags=["collaborators"],
        summary="協力者削除（オーナーのみ）",
    )
    def delete(self, request: Request, store_id: uuid.UUID, collab_id: uuid.UUID) -> Response:
        deny_if_demo()
        store = _get_store_or_404(store_id, request.user)
        collab = self._get_collab_or_404(store, collab_id)
        collab.delete()
        return _ok({"message": "協力者を削除しました。"})
