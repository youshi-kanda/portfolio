import { Link, useParams, useSearchParams } from 'react-router-dom'
import {
  CUSTOMER_STATE_COLORS,
  CUSTOMER_STATE_LABELS,
  PRIORITY_COLORS,
  PRIORITY_LABELS,
  type CustomerListItem,
  type CustomerPriority,
  type CustomerState,
} from './types'
import { useCustomers } from './useCustomers'

const PER_PAGE = 50

function StateBadge({ state }: { state: CustomerState | null }) {
  if (!state) return <span style={{ color: '#9ca3af' }}>—</span>
  const { bg, text } = CUSTOMER_STATE_COLORS[state]
  return (
    <span
      style={{
        background: bg,
        color: text,
        padding: '2px 8px',
        borderRadius: 4,
        fontSize: 12,
        fontWeight: 600,
        whiteSpace: 'nowrap',
      }}
    >
      {CUSTOMER_STATE_LABELS[state]}
    </span>
  )
}

function PriorityBadge({ priority }: { priority: CustomerPriority | null }) {
  if (!priority) return <span style={{ color: '#9ca3af' }}>—</span>
  const { bg, text } = PRIORITY_COLORS[priority]
  return (
    <span
      style={{
        background: bg,
        color: text,
        padding: '2px 8px',
        borderRadius: 4,
        fontSize: 12,
        fontWeight: 600,
      }}
    >
      {PRIORITY_LABELS[priority]}
    </span>
  )
}

function LineBadge({ allowed }: { allowed: boolean | null }) {
  if (allowed === null) return <span style={{ color: '#9ca3af' }}>—</span>
  return allowed ? (
    <span style={{ color: '#166534', fontWeight: 600 }}>○</span>
  ) : (
    <span
      style={{
        background: '#fef3c7',
        color: '#92400e',
        padding: '2px 6px',
        borderRadius: 4,
        fontSize: 11,
        fontWeight: 600,
      }}
    >
      不可
    </span>
  )
}

function CustomerRow({
  customer,
  storeId,
}: {
  customer: CustomerListItem
  storeId: string
}) {
  const rowStyle: React.CSSProperties = {
    background: customer.is_unsubscribed ? '#fff5f5' : undefined,
  }
  const name = customer.display_name || customer.full_name || '（名前なし）'

  return (
    <tr style={rowStyle}>
      <td style={tdStyle}>
        <Link
          to={`/stores/${storeId}/customers/${customer.id}`}
          style={{ fontWeight: 500, color: '#2563eb', textDecoration: 'none' }}
        >
          {name}
        </Link>
        {customer.is_unsubscribed && (
          <span
            style={{
              marginLeft: 6,
              background: '#fee2e2',
              color: '#991b1b',
              padding: '1px 5px',
              borderRadius: 3,
              fontSize: 10,
              fontWeight: 700,
            }}
          >
            配信停止
          </span>
        )}
      </td>
      <td style={tdStyle}>
        <StateBadge state={customer.customer_state} />
      </td>
      <td style={tdStyle}>
        <PriorityBadge priority={customer.priority} />
      </td>
      <td style={{ ...tdStyle, color: customer.last_visit_date ? '#111' : '#9ca3af' }}>
        {customer.last_visit_date ?? '—'}
      </td>
      <td style={{ ...tdStyle, textAlign: 'right' }}>{customer.visit_count}</td>
      <td style={{ ...tdStyle, textAlign: 'right' }}>
        {customer.ltv > 0 ? `¥${customer.ltv.toLocaleString()}` : '—'}
      </td>
      <td style={{ ...tdStyle, textAlign: 'center' }}>
        <LineBadge allowed={customer.contact_line_allowed} />
      </td>
    </tr>
  )
}

const tdStyle: React.CSSProperties = {
  padding: '10px 12px',
  borderBottom: '1px solid #f0f0f0',
  fontSize: 14,
  verticalAlign: 'middle',
}

const thStyle: React.CSSProperties = {
  padding: '10px 12px',
  borderBottom: '2px solid #e5e7eb',
  fontSize: 12,
  fontWeight: 700,
  color: '#6b7280',
  textAlign: 'left',
  whiteSpace: 'nowrap',
  background: '#f9fafb',
}

export default function CustomerListPage() {
  const { storeId } = useParams<{ storeId: string }>()
  const [searchParams, setSearchParams] = useSearchParams()

  const q = searchParams.get('q') ?? ''
  const customerState = searchParams.get('customer_state') ?? ''
  const isUnsubscribed = (searchParams.get('is_unsubscribed') ?? '') as 'true' | 'false' | ''
  const page = Math.max(1, Number(searchParams.get('page') ?? '1'))

  const { data, isLoading, isError, isFetching } = useCustomers({
    storeId: storeId ?? '',
    q: q || undefined,
    customerState: customerState || undefined,
    isUnsubscribed: isUnsubscribed || undefined,
    page,
  })

  function setParam(key: string, value: string) {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev)
      if (value) {
        next.set(key, value)
      } else {
        next.delete(key)
      }
      if (key !== 'page') next.delete('page')
      return next
    })
  }

  const customers = data?.data ?? []
  const total = data?.meta.total ?? 0
  const totalPages = Math.ceil(total / PER_PAGE)

  if (!storeId) {
    return <div>店舗IDが指定されていません。</div>
  }

  return (
    <div>
      <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 20, color: '#111' }}>
        顧客一覧
        {total > 0 && (
          <span style={{ marginLeft: 10, fontSize: 14, fontWeight: 400, color: '#6b7280' }}>
            {total} 件
          </span>
        )}
      </h1>

      {/* フィルタバー */}
      <div
        style={{
          display: 'flex',
          gap: 12,
          marginBottom: 16,
          flexWrap: 'wrap',
          alignItems: 'center',
        }}
      >
        <input
          type="search"
          placeholder="氏名・電話・メール検索"
          value={q}
          onChange={(e) => setParam('q', e.target.value)}
          style={{
            padding: '7px 12px',
            border: '1px solid #d1d5db',
            borderRadius: 6,
            fontSize: 14,
            width: 220,
          }}
        />

        <select
          value={customerState}
          onChange={(e) => setParam('customer_state', e.target.value)}
          style={{
            padding: '7px 10px',
            border: '1px solid #d1d5db',
            borderRadius: 6,
            fontSize: 14,
            background: '#fff',
          }}
        >
          <option value="">すべての状態</option>
          <option value="new_lead">新規リード</option>
          <option value="first_reserved">初回予約済</option>
          <option value="after_first_visit">初回来店後</option>
          <option value="repeater">リピーター</option>
          <option value="pre_dormant">休眠予備軍</option>
          <option value="dormant">休眠顧客</option>
          <option value="vip_candidate">VIP候補</option>
          <option value="high_risk">離脱リスク高</option>
        </select>

        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 14 }}>
          <input
            type="checkbox"
            checked={isUnsubscribed === 'true'}
            onChange={(e) => setParam('is_unsubscribed', e.target.checked ? 'true' : '')}
          />
          配信停止のみ表示
        </label>

        {isFetching && !isLoading && (
          <span style={{ fontSize: 12, color: '#9ca3af' }}>更新中…</span>
        )}
      </div>

      {/* テーブル */}
      {isLoading ? (
        <div style={{ padding: 40, textAlign: 'center', color: '#9ca3af' }}>読み込み中…</div>
      ) : isError ? (
        <div style={{ padding: 40, textAlign: 'center', color: '#dc2626' }}>
          データの取得に失敗しました。ページを再読み込みしてください。
        </div>
      ) : customers.length === 0 ? (
        <div style={{ padding: 40, textAlign: 'center', color: '#9ca3af' }}>
          該当する顧客が見つかりません。
        </div>
      ) : (
        <div style={{ overflowX: 'auto', borderRadius: 8, boxShadow: 'var(--card-shadow)' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={thStyle}>顧客名</th>
                <th style={thStyle}>顧客状態</th>
                <th style={thStyle}>優先度</th>
                <th style={thStyle}>最終来店日</th>
                <th style={{ ...thStyle, textAlign: 'right' }}>来店回数</th>
                <th style={{ ...thStyle, textAlign: 'right' }}>累計売上</th>
                <th style={{ ...thStyle, textAlign: 'center' }}>LINE連絡</th>
              </tr>
            </thead>
            <tbody>
              {customers.map((c) => (
                <CustomerRow key={c.id} customer={c} storeId={storeId} />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ページネーション */}
      {totalPages > 1 && (
        <div style={{ display: 'flex', gap: 8, marginTop: 16, alignItems: 'center' }}>
          <button
            onClick={() => setParam('page', String(page - 1))}
            disabled={page <= 1}
            style={paginationBtnStyle(page <= 1)}
          >
            前へ
          </button>
          <span style={{ fontSize: 14, color: '#374151' }}>
            {page} / {totalPages} ページ
          </span>
          <button
            onClick={() => setParam('page', String(page + 1))}
            disabled={page >= totalPages}
            style={paginationBtnStyle(page >= totalPages)}
          >
            次へ
          </button>
        </div>
      )}
    </div>
  )
}

function paginationBtnStyle(disabled: boolean): React.CSSProperties {
  return {
    padding: '6px 16px',
    border: '1px solid #d1d5db',
    borderRadius: 6,
    background: disabled ? '#f9fafb' : '#fff',
    color: disabled ? '#9ca3af' : '#374151',
    cursor: disabled ? 'default' : 'pointer',
    fontSize: 14,
  }
}
