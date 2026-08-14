import uuid

from django.contrib.auth.models import AbstractBaseUser, BaseUserManager, PermissionsMixin
from django.db import models


class UserManager(BaseUserManager):
    def create_user(self, email: str, name: str, password: str | None = None, **extra_fields):
        if not email:
            raise ValueError("メールアドレスは必須です。")
        email = self.normalize_email(email)
        user = self.model(email=email, name=name, **extra_fields)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_superuser(self, email: str, name: str, password: str, **extra_fields):
        extra_fields.setdefault("is_staff", True)
        extra_fields.setdefault("is_superuser", True)
        extra_fields.setdefault("status", User.Status.ACTIVE)
        return self.create_user(email, name, password, **extra_fields)


class User(AbstractBaseUser, PermissionsMixin):
    class Status(models.TextChoices):
        INVITED = "invited", "招待済み"
        ACTIVE = "active", "アクティブ"
        SUSPENDED = "suspended", "停止中"

    class Role(models.TextChoices):
        OWNER = "owner", "オーナー"
        SUPPORTER = "supporter", "外部支援者"
        AGENCY_ADMIN = "agency_admin", "代理店管理者"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    email = models.EmailField(unique=True, verbose_name="メールアドレス")
    name = models.CharField(max_length=100, verbose_name="氏名")
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.ACTIVE,
        verbose_name="ステータス",
    )
    role = models.CharField(
        max_length=20,
        choices=Role.choices,
        default=Role.OWNER,
        verbose_name="ロール",
    )
    is_active = models.BooleanField(default=True)
    is_staff = models.BooleanField(default=False)
    token_version = models.PositiveIntegerField(default=1, verbose_name="トークンバージョン")
    last_login_at = models.DateTimeField(null=True, blank=True, verbose_name="最終ログイン日時")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    USERNAME_FIELD = "email"
    REQUIRED_FIELDS = ["name"]

    objects = UserManager()

    class Meta:
        db_table = "users"
        verbose_name = "ユーザー"
        verbose_name_plural = "ユーザー"

    def __str__(self) -> str:
        return self.email
