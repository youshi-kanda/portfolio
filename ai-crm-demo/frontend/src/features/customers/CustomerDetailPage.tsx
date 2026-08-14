import { Link, useParams } from 'react-router-dom'
import {
  CUSTOMER_STATE_COLORS,
  CUSTOMER_STATE_LABELS,
  PRIORITY_COLORS,
  PRIORITY_LABELS,
  type CustomerInsight,
  type CustomerPriority,
  type CustomerState,
  type ReservationItem,
  type SaleItem,
} from './types'
import { useCustomerDetail } from './useCustomerDetail'
import { useCustomerReservations, useCustomerSales } from './useCustomerHistory'
import { useCustomerInsights, useRecalculateInsight } from './useCustomerInsights'

// ─── shared badge components ─────────────────────────────────────────────────

function StateBadge({ state }: { state: CustomerState }) {
  const { bg, text } = CUSTOMER_STATE_COLORS[state]
  return (
    <span style={{ background: bg, color: text, padding: '3px 10px', borderRadius: 4, fontSize: 13, fontWeight: 700 }}>
      {CUSTOMER_STATE_LABELS[state]}
    </span>
  )
}

function PriorityBadge({ priority }: { priority: CustomerPriority }) {
  const { bg, text } = PRIORITY_COLORS[priority]
  return (
    <span style={{ background: bg, color: text, padding: '3px 10px', borderRadius: 4, fontSize: 13, fontWeight: 700 }}>
      優先度：{PRIORITY_LABELS[priority]}
    </span>
  )
}

// ─── card wrapper ─────────────────────────────────────────────────────────────

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ border: '1px solid #e5e7eb', borderRadius: 8, marginBottom: 16, overflow: 'hidden' }}>
      <div style={{ background: '#f9fafb', padding: '10px 16px', borderBottom: '1px solid #e5e7eb' }}>
        <h2 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: '#374151' }}>{title}</h2>
      </div>
      <div style={{ padding: 16 }}>{children}</div>
    </div>
  )
}

function InfoRow({ label, value }: { label: string; value?: string | null }) {
  return (
    <div style={{ display: 'flex', gap: 12, marginBottom: 8, fontSize: 14 }}>
      <span style={{ width: 100, color: '#6b7280', flexShrink: 0 }}>{label}</span>
      <span style={{ color: value ? '#111' : '#9ca3af' }}>{value || '—'}</span>
    </div>
  )
}

// ─── insight section ──────────────────────────────────────────────────────────

const CONFIDENCE_LABELS: Record<string, string> = {
  high: '高',
  medium: '中',
  low: '低',
}

const REVIEW_STATUS_LABELS: Record<string, string> = {
  unreviewed: '未確認',
  confirmed: '確認済み',
  modified: '修正済み',
}

function InsightCard({
  storeId,
  customerId,
}: {
  storeId: string
  customerId: string
}) {
  const { data, isLoading } = useCustomerInsights(storeId, customerId)
  const recalculate = useRecalculateInsight(storeId, customerId)

  const latest: CustomerInsight | undefined = data?.data[0]

  return (
    <Card title="最新インサイト">
      {isLoading ? (
        <span style={{ color: '#9ca3af', fontSize: 14 }}>読み込み中…</span>
      ) : !latest ? (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ color: '#9ca3af', fontSize: 14 }}>まだ分析されていません。</span>
          <RecalcButton recalculate={recalculate} />
        </div>
      ) : (
        <>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
            <StateBadge state={latest.customer_state} />
            <PriorityBadge priority={latest.priority} />
            <span style={{ fontSize: 12, color: '#6b7280', alignSelf: 'center' }}>
              信頼度：{CONFIDENCE_LABELS[latest.ai_confidence] ?? latest.ai_confidence}
              {REVIEW_STATUS_LABELS[latest.review_status] ?? latest.review_status}
              {latest.insight_date}
            </span>
          </div>

          {latest.evidence_summary && (
            <div style={{ fontSize: 13, color: '#374151', background: '#f9fafb', padding: '8px 12px', borderRadius: 6, marginBottom: 12, lineHeight: 1.6 }}>
              {latest.evidence_summary}
            </div>
          )}

          {latest.recommended_action && (
            <InfoRow label="推奨アクション" value={latest.recommended_action} />
          )}

          {latest.inferred_needs.length > 0 && (
            <div style={{ marginBottom: 8 }}>
              <span style={{ fontSize: 12, color: '#6b7280' }}>推定ニーズ：</span>
              {latest.inferred_needs.map((n) => (
                <span key={n} style={{ marginLeft: 6, fontSize: 12, background: '#e0f2fe', color: '#0369a1', padding: '1px 6px', borderRadius: 3 }}>
                  {n}
                </span>
              ))}
            </div>
          )}

          {latest.blocking_factors.length > 0 && (
            <div style={{ marginBottom: 8 }}>
              <span style={{ fontSize: 12, color: '#6b7280' }}>阻害要因：</span>
              {latest.blocking_factors.map((b) => (
                <span key={b} style={{ marginLeft: 6, fontSize: 12, background: '#fef3c7', color: '#92400e', padding: '1px 6px', borderRadius: 3 }}>
                  {b}
                </span>
              ))}
            </div>
          )}

          <div style={{ marginTop: 12 }}>
            <RecalcButton recalculate={recalculate} />
          </div>
        </>
      )}
    </Card>
  )
}

function RecalcButton({ recalculate }: { recalculate: ReturnType<typeof useRecalculateInsight> }) {
  return (
    <button
      onClick={() => recalculate.mutate()}
      disabled={recalculate.isPending}
      style={{
        padding: '6px 14px',
        border: '1px solid #d1d5db',
        borderRadius: 6,
        background: recalculate.isPending ? '#f9fafb' : '#fff',
        color: recalculate.isPending ? '#9ca3af' : '#374151',
        cursor: recalculate.isPending ? 'default' : 'pointer',
        fontSize: 13,
      }}
    >
      {recalculate.isPending ? '計算中…' : 'インサイト再計算'}
    </button>
  )
}

// ─── reservation status ───────────────────────────────────────────────────────

const RESERVATION_STATUS_LABELS: Record<string, string> = {
  reserved: '予約済み',
  visited: '来店済み',
  cancelled: 'キャンセル',
  no_show: '無断キャンセル',
}

function ReservationRow({ r }: { r: ReservationItem }) {
  const dateStr = r.visited_at
    ? r.visited_at.slice(0, 10)
    : r.scheduled_start_at.slice(0, 10)
  return (
    <tr>
      <td style={tdStyle}>{dateStr}</td>
      <td style={tdStyle}>{r.menu_name_snapshot || '—'}</td>
      <td style={tdStyle}>{RESERVATION_STATUS_LABELS[r.status] ?? r.status}</td>
    </tr>
  )
}

function SaleRow({ s }: { s: SaleItem }) {
  return (
    <tr>
      <td style={tdStyle}>{s.sale_date}</td>
      <td style={tdStyle}>{s.item_name_snapshot || '—'}</td>
      <td style={{ ...tdStyle, textAlign: 'right' }}>¥{s.amount.toLocaleString()}</td>
    </tr>
  )
}

const tdStyle: React.CSSProperties = {
  padding: '8px 12px',
  borderBottom: '1px solid #f3f4f6',
  fontSize: 13,
}

const thStyle: React.CSSProperties = {
  padding: '8px 12px',
  background: '#f9fafb',
  borderBottom: '1px solid #e5e7eb',
  fontSize: 12,
  fontWeight: 700,
  color: '#6b7280',
  textAlign: 'left',
}

function HistoryTable<T>({
  rows,
  isLoading,
  headers,
  renderRow,
  empty,
}: {
  rows: T[]
  isLoading: boolean
  headers: string[]
  renderRow: (item: T, i: number) => React.ReactNode
  empty: string
}) {
  if (isLoading) return <p style={{ color: '#9ca3af', fontSize: 14 }}>読み込み中…</p>
  if (rows.length === 0) return <p style={{ color: '#9ca3af', fontSize: 14 }}>{empty}</p>
  return (
    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
      <thead>
        <tr>
          {headers.map((h) => (
            <th key={h} style={thStyle}>{h}</th>
          ))}
        </tr>
      </thead>
      <tbody>{rows.map(renderRow)}</tbody>
    </table>
  )
}

// ─── main page ────────────────────────────────────────────────────────────────

export default function CustomerDetailPage() {
  const { storeId, customerId } = useParams<{ storeId: string; customerId: string }>()

  const { data: detailData, isLoading, isError } = useCustomerDetail(
    storeId ?? '',
    customerId ?? '',
  )
  const { data: resData, isLoading: resLoading } = useCustomerReservations(
    storeId ?? '',
    customerId ?? '',
  )
  const { data: saleData, isLoading: saleLoading } = useCustomerSales(
    storeId ?? '',
    customerId ?? '',
  )

  if (!storeId || !customerId) {
    return <div>パラメータが不正です。</div>
  }

  if (isLoading) {
    return <div style={{ color: 'var(--text-secondary)' }}>読み込み中…</div>
  }

  if (isError || !detailData?.data) {
    return (
      <div style={{ color: 'var(--danger)' }}>
        顧客情報の取得に失敗しました。
        <Link to={`/stores/${storeId}/customers`} style={{ marginLeft: 12, color: 'var(--brand)' }}>
          一覧へ戻る
        </Link>
      </div>
    )
  }

  const c = detailData.data
  const name = c.display_name || c.full_name || '（名前なし）'

  return (
    <div>
      {/* ヘッダー */}
      <div style={{ marginBottom: 20 }}>
        <Link
          to={`/stores/${storeId}/customers`}
          style={{ fontSize: 13, color: '#6b7280', textDecoration: 'none' }}
        >
          ← 顧客一覧
        </Link>
        <h1 style={{ fontSize: 22, fontWeight: 700, margin: '6px 0 0', color: '#111' }}>
          {name}
          {c.status === 'inactive' && (
            <span style={{ marginLeft: 10, fontSize: 13, color: '#9ca3af', fontWeight: 400 }}>
              （無効）
            </span>
          )}
        </h1>
      </div>

      {/* 基本情報 */}
      <Card title="基本情報">
        <InfoRow label="電話番号" value={c.phone} />
        <InfoRow label="メール" value={c.email} />
        <InfoRow label="流入経路" value={c.acquisition_channel} />
        <InfoRow label="初回接触日" value={c.first_contact_date} />
        <InfoRow label="登録日" value={c.created_at.slice(0, 10)} />
        {c.profile && (
          <>
            <InfoRow label="性別" value={c.profile.gender} />
            <InfoRow label="年代" value={c.profile.age_group} />
            <InfoRow label="居住エリア" value={c.profile.residential_area} />
            <InfoRow label="職業" value={c.profile.occupation} />
          </>
        )}
      </Card>

      {/* 同意・配信状態 */}
      <Card title="同意・配信状態">
        {c.consent ? (
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <ConsentBadge
              label="LINE連絡"
              ok={c.consent.contact_line_allowed}
              okText="可"
              ngText="不可"
            />
            <ConsentBadge
              label="メール連絡"
              ok={c.consent.contact_email_allowed}
              okText="可"
              ngText="不可"
            />
            <ConsentBadge
              label="SMS連絡"
              ok={c.consent.contact_sms_allowed}
              okText="可"
              ngText="不可"
            />
            <ConsentBadge
              label="分析利用"
              ok={c.consent.analysis_allowed}
              okText="同意"
              ngText="未同意"
            />
            {c.consent.is_unsubscribed && (
              <span
                style={{
                  background: '#fee2e2',
                  color: '#991b1b',
                  padding: '4px 10px',
                  borderRadius: 4,
                  fontSize: 13,
                  fontWeight: 700,
                }}
              >
                配信停止中
              </span>
            )}
          </div>
        ) : (
          <span style={{ color: '#9ca3af', fontSize: 14 }}>同意情報が登録されていません。</span>
        )}
      </Card>

      {/* インサイト */}
      <InsightCard storeId={storeId} customerId={customerId} />

      {/* 来店履歴 */}
      <Card title="来店履歴（直近5件）">
        <HistoryTable<ReservationItem>
          rows={resData?.data ?? []}
          isLoading={resLoading}
          headers={['来店日', 'メニュー', 'ステータス']}
          renderRow={(r) => <ReservationRow key={r.id} r={r} />}
          empty="来店履歴がありません。"
        />
      </Card>

      {/* 売上履歴 */}
      <Card title="売上履歴（直近5件）">
        <HistoryTable<SaleItem>
          rows={saleData?.data ?? []}
          isLoading={saleLoading}
          headers={['売上日', '商品・メニュー', '金額']}
          renderRow={(s) => <SaleRow key={s.id} s={s} />}
          empty="売上履歴がありません。"
        />
      </Card>
    </div>
  )
}

function ConsentBadge({
  label,
  ok,
  okText,
  ngText,
}: {
  label: string
  ok: boolean
  okText: string
  ngText: string
}) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        border: '1px solid #e5e7eb',
        borderRadius: 4,
        padding: '3px 8px',
        fontSize: 13,
      }}
    >
      <span style={{ color: '#6b7280' }}>{label}</span>
      <span
        style={{
          fontWeight: 700,
          color: ok ? '#166534' : '#dc2626',
        }}
      >
        {ok ? okText : ngText}
      </span>
    </span>
  )
}
