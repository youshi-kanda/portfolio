"""
Seed the Portfolio Demo database with synthetic data.

Usage:

    DJANGO_SETTINGS_MODULE=config.settings.demo \\
        python manage.py seed_demo

Reruns are idempotent — the demo owner and store slugs are looked up first
and only missing rows are created. Pass ``--reset`` to wipe the demo data and
recreate it from scratch.

All personal data (names, emails, phone numbers) is synthetic. No real
customer information is ever loaded.
"""
from __future__ import annotations

import random
import uuid
from datetime import date, datetime, time, timedelta
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils import timezone

from apps.ai_core.models import AgencyDiagnosisLog
from apps.campaigns.models import Campaign, CampaignContent
from apps.customers.models import Customer, CustomerConsent, CustomerProfile
from apps.insights.models import CustomerInsight
from apps.reports.models import Report
from apps.reservations.models import Reservation
from apps.sales.models import Sale
from apps.stores.models import Menu, Store, StoreSettings

User = get_user_model()

DEMO_OWNER_EMAIL = "demo@example.com"
DEMO_OWNER_PASSWORD = "DemoPass123!"

STORE_SPECS = [
    {
        "name": "デモ・ビューティサロン中目黒",
        "industry": Store.Industry.ESTHETIC,
        "prefecture": "東京都",
        "city": "目黒区",
        "area_label": "中目黒エリア",
    },
    {
        "name": "デモ・リラクゼーション整体院表参道",
        "industry": Store.Industry.BODYCARE,
        "prefecture": "東京都",
        "city": "港区",
        "area_label": "表参道エリア",
    },
]

MENU_SPECS = [
    ("フェイシャルベーシック", 6800, 60, True, False),
    ("プレミアムフェイシャル", 12800, 90, True, True),
    ("ボディケア60分", 7500, 60, False, False),
    ("整体ロング90分", 11000, 90, False, True),
]

RESERVATION_CHANNELS = [
    Reservation.Channel.OFFICIAL_LINE,
    Reservation.Channel.HPB,
    Reservation.Channel.INSTAGRAM,
    Reservation.Channel.PHONE,
    Reservation.Channel.WEB,
]

CAMPAIGN_SPECS = [
    ("6月 再来店キャンペーン", Campaign.Purpose.REPEAT, Campaign.Channel.OFFICIAL_LINE),
    ("休眠復帰フォロー", Campaign.Purpose.DORMANT_REACTIVATION, Campaign.Channel.OFFICIAL_LINE),
    ("新規獲得（Instagram）", Campaign.Purpose.NEW_CUSTOMER, Campaign.Channel.INSTAGRAM),
    ("プレミアムコース案内", Campaign.Purpose.UPSELL, Campaign.Channel.EMAIL),
]

INSIGHT_STATES = [
    CustomerInsight.CustomerState.NEW_LEAD,
    CustomerInsight.CustomerState.FIRST_RESERVED,
    CustomerInsight.CustomerState.AFTER_FIRST_VISIT,
    CustomerInsight.CustomerState.REPEATER,
    CustomerInsight.CustomerState.VIP_CANDIDATE,
    CustomerInsight.CustomerState.PRE_DORMANT,
    CustomerInsight.CustomerState.DORMANT,
]


class Command(BaseCommand):
    help = "Seed the Portfolio Demo database with synthetic AI CRM data."

    def add_arguments(self, parser):
        parser.add_argument(
            "--reset",
            action="store_true",
            help="Delete existing demo data before reseeding.",
        )
        parser.add_argument(
            "--customers",
            type=int,
            default=50,
            help="Number of synthetic customers per store (default: 50).",
        )
        parser.add_argument(
            "--seed",
            type=int,
            default=42,
            help="Random seed for reproducible generation (default: 42).",
        )

    def handle(self, *args, **opts):
        random.seed(opts["seed"])
        with transaction.atomic():
            if opts["reset"]:
                self._reset()
            owner = self._ensure_owner()
            stores = [self._ensure_store(owner, spec) for spec in STORE_SPECS]
            counts = {"customers": 0, "reservations": 0, "sales": 0, "campaigns": 0}
            for store in stores:
                per_store = self._seed_store(store, owner, opts["customers"])
                for k, v in per_store.items():
                    counts[k] += v

        self.stdout.write(self.style.SUCCESS(
            "Portfolio demo seeded: "
            f"owner={DEMO_OWNER_EMAIL}, stores={len(stores)}, "
            f"customers={counts['customers']}, reservations={counts['reservations']}, "
            f"sales={counts['sales']}, campaigns={counts['campaigns']}"
        ))
        self.stdout.write("Login with: {} / {}".format(DEMO_OWNER_EMAIL, DEMO_OWNER_PASSWORD))

    # ---- helpers ----------------------------------------------------------

    def _reset(self):
        # Only wipe rows attached to demo stores so unrelated fixtures survive.
        demo_stores = Store.objects.filter(name__startswith="デモ・")
        for s in demo_stores:
            Sale.objects.filter(store=s).delete()
            Reservation.objects.filter(store=s).delete()
            CampaignContent.objects.filter(store=s).delete()
            Campaign.objects.filter(store=s).delete()
            CustomerInsight.objects.filter(store_id=s.id).delete()
            AgencyDiagnosisLog.objects.filter(store_id=s.id).delete()
            Report.objects.filter(store=s).delete()
            for c in Customer.objects.filter(store=s):
                CustomerConsent.objects.filter(customer=c).delete()
                CustomerProfile.objects.filter(customer=c).delete()
                c.delete()
            Menu.objects.filter(store=s).delete()
            StoreSettings.objects.filter(store=s).delete()
            s.delete()

    def _ensure_owner(self) -> "User":
        user, created = User.objects.get_or_create(
            email=DEMO_OWNER_EMAIL,
            defaults={
                "name": "デモオーナー",
                "role": User.Role.OWNER,
                "status": User.Status.ACTIVE,
                "is_active": True,
            },
        )
        # Always reset the password so recruiters can log in even if the DB
        # persisted from a previous run.
        user.set_password(DEMO_OWNER_PASSWORD)
        user.save(update_fields=["password"])
        if created:
            self.stdout.write("  created demo owner")
        return user

    def _ensure_store(self, owner, spec) -> Store:
        store, created = Store.objects.get_or_create(
            name=spec["name"],
            defaults={
                "tenant_id": owner.id,
                "industry": spec["industry"],
                "prefecture": spec["prefecture"],
                "city": spec["city"],
                "area_label": spec["area_label"],
                "created_by": owner,
                "status": Store.Status.ACTIVE,
            },
        )
        StoreSettings.objects.get_or_create(store=store)
        if created:
            for name, price, minutes, is_main, is_high in MENU_SPECS:
                Menu.objects.create(
                    store=store,
                    name=name,
                    price=price,
                    duration_minutes=minutes,
                    is_main=is_main,
                    is_high_value=is_high,
                    status=Menu.Status.ACTIVE,
                )
            self.stdout.write(f"  created store: {store.name}")
        return store

    def _seed_store(self, store: Store, owner, customer_count: int) -> dict:
        menus = list(Menu.objects.filter(store=store))
        customers = self._seed_customers(store, customer_count)
        reservations = self._seed_reservations(store, customers, menus)
        sales = self._seed_sales(store, customers, reservations, menus)
        campaigns = self._seed_campaigns(store, owner)
        self._seed_insights(store, customers)
        self._seed_reports(store, owner)
        self._seed_agency_diagnosis(store, owner)
        return {
            "customers": len(customers),
            "reservations": len(reservations),
            "sales": len(sales),
            "campaigns": len(campaigns),
        }

    def _seed_customers(self, store: Store, count: int):
        existing = list(Customer.objects.filter(store=store).order_by("created_at"))
        needed = max(0, count - len(existing))
        for i in range(len(existing), len(existing) + needed):
            c = Customer.objects.create(
                store=store,
                external_customer_id=f"DEMO-{store.id.hex[:6]}-{i:04d}",
                full_name=f"デモ顧客{i + 1:03d}",
                kana=f"デモコキャク{i + 1:03d}",
                phone=f"090-0000-{i + 1:04d}",
                email=f"demo{i + 1:03d}@example.com",
                first_contact_date=date.today() - timedelta(days=random.randint(30, 400)),
                status=Customer.Status.ACTIVE,
            )
            CustomerProfile.objects.create(
                customer=c,
                store_id=store.id,
                visit_count=random.randint(0, 12),
                total_sales=random.randint(0, 200000),
                last_visit_date=date.today() - timedelta(days=random.randint(1, 180)),
            )
            CustomerConsent.objects.create(
                customer=c,
                store_id=store.id,
                contact_line_allowed=random.random() < 0.6,
                contact_email_allowed=random.random() < 0.4,
                consent_source="demo_seed",
                consented_at=timezone.now(),
            )
        return list(Customer.objects.filter(store=store).order_by("created_at"))

    def _seed_reservations(self, store, customers, menus):
        existing = Reservation.objects.filter(store=store).count()
        target = 120
        needed = max(0, target - existing)
        created = []
        for _ in range(needed):
            customer = random.choice(customers)
            menu = random.choice(menus) if menus else None
            offset_days = random.randint(-180, 30)
            scheduled_start = timezone.make_aware(datetime.combine(
                date.today() + timedelta(days=offset_days),
                time(hour=random.randint(10, 19), minute=random.choice([0, 30])),
            ))
            visited_at = scheduled_start if offset_days < 0 and random.random() < 0.85 else None
            status = (
                Reservation.Status.VISITED
                if visited_at
                else (Reservation.Status.NO_SHOW if offset_days < 0 else Reservation.Status.RESERVED)
            )
            r = Reservation.objects.create(
                store=store,
                customer=customer,
                external_reservation_id=f"R-{uuid.uuid4().hex[:8]}",
                reservation_created_at=scheduled_start - timedelta(days=random.randint(1, 14)),
                scheduled_start_at=scheduled_start,
                scheduled_end_at=scheduled_start + timedelta(minutes=(menu.duration_minutes if menu else 60)),
                visited_at=visited_at,
                menu=menu,
                menu_name_snapshot=(menu.name if menu else "デモコース"),
                channel=random.choice(RESERVATION_CHANNELS),
                status=status,
            )
            created.append(r)
        return list(Reservation.objects.filter(store=store))

    def _seed_sales(self, store, customers, reservations, menus):
        existing = Sale.objects.filter(store=store).count()
        target = 130
        needed = max(0, target - existing)
        visited = [r for r in reservations if r.visited_at]
        for _ in range(needed):
            reservation = random.choice(visited) if visited and random.random() < 0.8 else None
            customer = reservation.customer if reservation else random.choice(customers)
            menu = reservation.menu if reservation and reservation.menu else (random.choice(menus) if menus else None)
            sale_date = (reservation.visited_at.date() if reservation and reservation.visited_at
                         else date.today() - timedelta(days=random.randint(1, 180)))
            amount = Decimal(str(menu.price if menu else random.choice([5000, 8000, 12000])))
            Sale.objects.create(
                store=store,
                customer=customer,
                reservation=reservation,
                sale_date=sale_date,
                amount=amount,
                menu=menu,
                item_name_snapshot=(menu.name if menu else "デモ商品"),
                payment_method="cash",
            )
        return list(Sale.objects.filter(store=store))

    def _seed_campaigns(self, store, owner):
        existing = {c.name for c in Campaign.objects.filter(store=store)}
        created = []
        for name, purpose, channel in CAMPAIGN_SPECS:
            if name in existing:
                continue
            camp = Campaign.objects.create(
                store=store,
                name=name,
                purpose=purpose,
                channel=channel,
                status=Campaign.Status.DRAFT,
                owner_user=owner,
                target_count=random.randint(20, 80),
            )
            CampaignContent.objects.create(
                campaign=camp,
                store=store,
                content_type=CampaignContent.ContentType.LINE,
                title=f"[Demo] {name} 提案文案",
                body="この文案はモックAIによって生成されたポートフォリオ用サンプルです。",
                cta="ご予約はこちらから",
                tone=CampaignContent.Tone.FRIENDLY,
                generated_by_ai=True,
                expression_risk_level="none",
                approval_status="draft",
            )
            created.append(camp)
        return created

    def _seed_insights(self, store, customers):
        for c in customers[:30]:
            existing = CustomerInsight.objects.filter(customer=c).count()
            if existing:
                continue
            CustomerInsight.objects.create(
                store_id=store.id,
                customer=c,
                insight_date=date.today(),
                customer_state=random.choice(INSIGHT_STATES),
                inferred_needs="デモ用サンプルの推定ニーズ",
                blocking_factors="デモ用サンプルの阻害要因",
                recommended_action="次回来店の目安を提示",
                priority=random.choice([
                    CustomerInsight.Priority.LOW,
                    CustomerInsight.Priority.MEDIUM,
                    CustomerInsight.Priority.HIGH,
                ]),
                evidence_summary="mock evidence",
                ai_confidence="medium",
                created_by_ai=True,
            )

    def _seed_reports(self, store, owner):
        today = date.today()
        first_of_month = today.replace(day=1)
        prev_end = first_of_month - timedelta(days=1)
        prev_start = prev_end.replace(day=1)
        existing = Report.objects.filter(
            store=store, report_type=Report.ReportType.MONTHLY, period_start=prev_start
        ).exists()
        if existing:
            return
        Report.objects.create(
            store=store,
            report_type=Report.ReportType.MONTHLY,
            title=f"{prev_start.strftime('%Y年%m月')} 月次レポート (Demo)",
            period_start=prev_start,
            period_end=prev_end,
            body_markdown=(
                "## 概要\n\n"
                "このレポートはポートフォリオデモ用にモックAIが生成した架空のレポートです。\n\n"
                "- 新規顧客: 5名\n- 再来率: 62%\n- 売上構成上位: プレミアムフェイシャル\n"
            ),
            summary="モックAIによる月次サマリ（デモ用）",
            generated_by_ai=True,
            status=Report.Status.SHARED,
            created_by=owner,
        )

    def _seed_agency_diagnosis(self, store, owner):
        if AgencyDiagnosisLog.objects.filter(store_id=store.id).exists():
            return
        AgencyDiagnosisLog.objects.create(
            store_id=store.id,
            performed_by=owner,
            overall_score=random.randint(55, 82),
            issues_count=random.randint(2, 5),
            model_used="mock",
        )
