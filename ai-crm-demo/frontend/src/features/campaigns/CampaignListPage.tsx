import { useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import {
  CHANNEL_LABELS,
  CONTENT_APPROVAL_STATUS_LABELS,
  CONTENT_RISK_LEVEL_COLORS,
  CONTENT_RISK_LEVEL_FALLBACK,
  CONTENT_RISK_LEVEL_LABELS,
  PURPOSE_HINTS,
  PURPOSE_LABELS,
  STATUS_COLORS,
  STATUS_LABELS,
  type Campaign,
  type CampaignChannel,
  type CampaignContentSummary,
  type CampaignCreatePayload,
  type CampaignPurpose,
  type CampaignStatus,
  type ContentRiskLevel,
} from './types'
import { useCampaignContentSummaries } from './useCampaignContentSummaries'
import { useCampaigns, useCreateCampaign } from './useCampaigns'

// ─── badge ────────────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: CampaignStatus }) {
  const { bg, text } = STATUS_COLORS[status]
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
      {STATUS_LABELS[status]}
    </span>
  )
}

function RiskBadge({ level }: { level: ContentRiskLevel | string | null }) {
  if (!level) return <span style={{ color: '#9ca3af' }}>未判定</span>
  const colors = CONTENT_RISK_LEVEL_COLORS[level as ContentRiskLevel] ?? CONTENT_RISK_LEVEL_FALLBACK.colors
  const label = CONTENT_RISK_LEVEL_LABELS[level as ContentRiskLevel] ?? CONTENT_RISK_LEVEL_FALLBACK.label
  return (
    <span
      style={{
        background: colors.bg,
        color: colors.text,
        padding: '2px 8px',
        borderRadius: 4,
        fontSize: 12,
        fontWeight: 700,
        whiteSpace: 'nowrap',
      }}
    >
      {label}
    </span>
  )
}

// ─── create modal ─────────────────────────────────────────────────────────────

function CampaignCreateModal({
  storeId,
  onClose,
}: {
  storeId: string
  onClose: () => void
}) {
  const createMutation = useCreateCampaign(storeId)
  const [form, setForm] = useState<CampaignCreatePayload>({
    name: '',
    purpose: 'dormant_reactivation',
    channel: PURPOSE_HINTS['dormant_reactivation'].recommendedChannel,
  })
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const purposeHint = PURPOSE_HINTS[form.purpose]

  function set<K extends keyof CampaignCreatePayload>(key: K, value: CampaignCreatePayload[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  function handlePurposeChange(p: CampaignPurpose) {
    setForm((prev) => ({
      ...prev,
      purpose: p,
      channel: PURPOSE_HINTS[p].recommendedChannel,
    }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setErrorMsg(null)
    if (!form.name.trim()) {
      setErrorMsg('施策名を入力してください。')
      return
    }
    try {
      await createMutation.mutateAsync({ ...form, name: form.name.trim() })
      onClose()
    } catch {
      setErrorMsg('施策の作成に失敗しました。もう一度お試しください。')
    }
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.4)',
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        style={{
          background: '#fff',
          borderRadius: 10,
          padding: '28px 32px',
          width: 480,
          boxShadow: '0 8px 30px rgba(0,0,0,0.12)',
        }}
      >
        <h2 style={{ margin: '0 0 20px', fontSize: 18, fontWeight: 700 }}>施策を作成</h2>

        <form onSubmit={handleSubmit}>
          <label style={labelStyle}>目的</label>
          <select
            value={form.purpose}
            onChange={(e) => handlePurposeChange(e.target.value as CampaignPurpose)}
            style={inputStyle}
          >
            {(Object.keys(PURPOSE_LABELS) as CampaignPurpose[]).map((k) => (
              <option key={k} value={k}>
                {PURPOSE_LABELS[k]}
              </option>
            ))}
          </select>
          {purposeHint && (
            <div
              style={{
                marginTop: 6,
                padding: '8px 10px',
                background: '#eff6ff',
                border: '1px solid #bfdbfe',
                borderRadius: 6,
                fontSize: 12,
                color: '#1e40af',
                lineHeight: 1.5,
              }}
            >
              {purposeHint.description}
            </div>
          )}

          <label style={labelStyle}>
            施策名 <span style={{ color: '#dc2626' }}>*</span>
          </label>
          <input
            type="text"
            value={form.name}
            onChange={(e) => set('name', e.target.value)}
            placeholder={purposeHint?.placeholder ?? '例：6月 再来店施策'}
            style={inputStyle}
            autoFocus
          />

          <label style={labelStyle}>チャネル</label>
          <select
            value={form.channel}
            onChange={(e) => set('channel', e.target.value as CampaignChannel)}
            style={inputStyle}
          >
            {(Object.keys(CHANNEL_LABELS) as CampaignChannel[]).map((k) => (
              <option key={k} value={k}>
                {CHANNEL_LABELS[k]}
              </option>
            ))}
          </select>

          <label style={labelStyle}>実施予定日（任意）</label>
          <input
            type="date"
            value={form.scheduled_at ?? ''}
            onChange={(e) => set('scheduled_at', e.target.value || undefined)}
            style={inputStyle}
          />

          {errorMsg && (
            <div style={{ color: '#dc2626', fontSize: 13, marginBottom: 12 }}>{errorMsg}</div>
          )}

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 8 }}>
            <button type="button" onClick={onClose} style={cancelBtnStyle}>
              キャンセル
            </button>
            <button
              type="submit"
              disabled={createMutation.isPending}
              style={submitBtnStyle(createMutation.isPending)}
            >
              {createMutation.isPending ? '作成中…' : '作成する'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── table row ────────────────────────────────────────────────────────────────

function CampaignRow({ campaign, storeId }: { campaign: Campaign; storeId: string }) {
  return (
    <tr>
      <td style={tdStyle}>
        <Link
          to={`/stores/${storeId}/campaigns/${campaign.id}`}
          style={{ fontWeight: 500, color: '#2563eb', textDecoration: 'none' }}
        >
          {campaign.name}
        </Link>
      </td>
      <td style={tdStyle}>{PURPOSE_LABELS[campaign.purpose]}</td>
      <td style={tdStyle}>{CHANNEL_LABELS[campaign.channel]}</td>
      <td style={tdStyle}>
        <StatusBadge status={campaign.status} />
      </td>
      <td style={{ ...tdStyle, color: campaign.scheduled_at ? '#111' : '#9ca3af' }}>
        {campaign.scheduled_at ? campaign.scheduled_at.slice(0, 10) : '—'}
      </td>
      <td style={{ ...tdStyle, color: '#6b7280' }}>{campaign.created_at.slice(0, 10)}</td>
    </tr>
  )
}

function ContentRiskRow({ content, storeId }: { content: CampaignContentSummary; storeId: string }) {
  const href = content.campaign_id ? `/stores/${storeId}/campaigns/${content.campaign_id}` : undefined
  return (
    <tr>
      <td style={tdStyle}>
        {href ? (
          <Link to={href} style={{ color: '#2563eb', fontWeight: 600 }}>
            {content.title || content.campaign_title || '無題の文案'}
          </Link>
        ) : (
          content.title || '無題の文案'
        )}
        <div style={{ color: '#6b7280', fontSize: 12, marginTop: 3 }}>
          {content.content_text.slice(0, 60)}
          {content.content_text.length > 60 ? '…' : ''}
        </div>
      </td>
      <td style={tdStyle}>{content.campaign_title ?? '—'}</td>
      <td style={tdStyle}>{content.channel ? CHANNEL_LABELS[content.channel] : '—'}</td>
      <td style={tdStyle}>{CONTENT_APPROVAL_STATUS_LABELS[content.approval_status]}</td>
      <td style={tdStyle}>
        <RiskBadge level={content.expression_risk_level} />
      </td>
      <td style={{ ...tdStyle, color: '#6b7280' }}>{content.updated_at.slice(0, 10)}</td>
    </tr>
  )
}

// ─── main page ────────────────────────────────────────────────────────────────

const PER_PAGE = 50

export default function CampaignListPage() {
  const { storeId } = useParams<{ storeId: string }>()
  const [searchParams, setSearchParams] = useSearchParams()
  const [showModal, setShowModal] = useState(false)

  const status = (searchParams.get('status') ?? '') as CampaignStatus | ''
  const page = Math.max(1, Number(searchParams.get('page') ?? '1'))

  const { data, isLoading, isError, isFetching } = useCampaigns({
    storeId: storeId ?? '',
    status: status || undefined,
    page,
  })
  const { data: contentData, isLoading: isLoadingContents } = useCampaignContentSummaries({
    storeId: storeId ?? '',
    perPage: 10,
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

  const campaigns = data?.data ?? []
  const total = data?.meta.total ?? 0
  const totalPages = Math.ceil(total / PER_PAGE)

  if (!storeId) return <div>店舗IDが指定されていません。</div>

  return (
    <div>
      <div
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}
      >
        <h1 style={{ fontSize: 22, fontWeight: 700, color: '#111', margin: 0 }}>
          施策管理
          {total > 0 && (
            <span style={{ marginLeft: 10, fontSize: 14, fontWeight: 400, color: '#6b7280' }}>
              {total} 件
            </span>
          )}
        </h1>
        <button onClick={() => setShowModal(true)} style={primaryBtnStyle}>
          ＋ 施策を作成
        </button>
      </div>

      {/* フィルタバー */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 16, alignItems: 'center' }}>
        <select
          value={status}
          onChange={(e) => setParam('status', e.target.value)}
          style={{
            padding: '7px 10px',
            border: '1px solid #d1d5db',
            borderRadius: 6,
            fontSize: 14,
            background: '#fff',
          }}
        >
          <option value="">すべてのステータス</option>
          {(Object.keys(STATUS_LABELS) as CampaignStatus[]).map((k) => (
            <option key={k} value={k}>
              {STATUS_LABELS[k]}
            </option>
          ))}
        </select>
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
      ) : campaigns.length === 0 ? (
        <div
          style={{
            padding: '32px 24px',
            textAlign: 'center',
            border: '1px dashed #d1d5db',
            borderRadius: 8,
            background: '#fafafa',
          }}
        >
          <div style={{ fontSize: 15, fontWeight: 600, color: '#374151', marginBottom: 16 }}>
            施策がまだありません
          </div>
          <div style={{ fontSize: 13, color: '#6b7280', marginBottom: 20, lineHeight: 1.8 }}>
            施策は3ステップで完了します:
          </div>
          <div
            style={{
              display: 'flex',
              gap: 12,
              justifyContent: 'center',
              flexWrap: 'wrap',
              marginBottom: 24,
            }}
          >
            {[
              { step: '1', title: '施策を作成', desc: '目的・チャネルを選択' },
              { step: '2', title: 'AI文案を生成・承認', desc: '文案を確認して承認申請' },
              { step: '3', title: '配信（デモでは無効）', desc: '実サービスでは外部チャネルへ配信' },
            ].map(({ step, title, desc }) => (
              <div
                key={step}
                style={{
                  width: 140,
                  padding: '12px 10px',
                  background: '#fff',
                  border: '1px solid #e5e7eb',
                  borderRadius: 8,
                  textAlign: 'center',
                }}
              >
                <div
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: '50%',
                    background: 'var(--brand)',
                    color: '#fff',
                    fontSize: 13,
                    fontWeight: 700,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    margin: '0 auto 8px',
                  }}
                >
                  {step}
                </div>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 4 }}>{title}</div>
                <div style={{ fontSize: 12, color: '#9ca3af' }}>{desc}</div>
              </div>
            ))}
          </div>
          <button onClick={() => setShowModal(true)} style={primaryBtnStyle}>
            ＋ 最初の施策を作成する
          </button>
        </div>
      ) : (
        <div style={{ overflowX: 'auto', borderRadius: 8, boxShadow: 'var(--card-shadow)' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={thStyle}>施策名</th>
                <th style={thStyle}>目的</th>
                <th style={thStyle}>チャネル</th>
                <th style={thStyle}>ステータス</th>
                <th style={thStyle}>実施予定日</th>
                <th style={thStyle}>作成日</th>
              </tr>
            </thead>
            <tbody>
              {campaigns.map((c) => (
                <CampaignRow key={c.id} campaign={c} storeId={storeId} />
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

      <section style={{ marginTop: 28 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <h2 style={{ fontSize: 17, margin: 0 }}>文案リスク確認</h2>
          <span style={{ fontSize: 12, color: '#6b7280' }}>
            最新 {contentData?.data.length ?? 0} 件
          </span>
        </div>
        {isLoadingContents ? (
          <div style={{ padding: 24, color: '#9ca3af', background: '#fff', borderRadius: 8 }}>読み込み中…</div>
        ) : (contentData?.data.length ?? 0) === 0 ? (
          <div style={{ padding: 24, color: '#6b7280', background: '#fff', borderRadius: 8 }}>
            文案はまだありません。
          </div>
        ) : (
          <div style={{ overflowX: 'auto', borderRadius: 8, boxShadow: 'var(--card-shadow)' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={thStyle}>文案</th>
                  <th style={thStyle}>施策</th>
                  <th style={thStyle}>チャネル</th>
                  <th style={thStyle}>承認状態</th>
                  <th style={thStyle}>表現リスク</th>
                  <th style={thStyle}>更新日</th>
                </tr>
              </thead>
              <tbody>
                {contentData?.data.map((content) => (
                  <ContentRiskRow key={content.id} content={content} storeId={storeId} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {showModal && <CampaignCreateModal storeId={storeId} onClose={() => setShowModal(false)} />}
    </div>
  )
}

// ─── styles ───────────────────────────────────────────────────────────────────

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

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: 13,
  fontWeight: 600,
  color: '#374151',
  marginBottom: 4,
  marginTop: 14,
}

const inputStyle: React.CSSProperties = {
  display: 'block',
  width: '100%',
  padding: '8px 10px',
  border: '1px solid #d1d5db',
  borderRadius: 6,
  fontSize: 14,
  boxSizing: 'border-box',
  background: '#fff',
}

const primaryBtnStyle: React.CSSProperties = {
  padding: '8px 18px',
  background: 'var(--brand)',
  color: '#fff',
  border: 'none',
  borderRadius: 6,
  fontSize: 14,
  fontWeight: 600,
  cursor: 'pointer',
}

const cancelBtnStyle: React.CSSProperties = {
  padding: '8px 16px',
  border: '1px solid #d1d5db',
  borderRadius: 6,
  background: '#fff',
  color: '#374151',
  fontSize: 14,
  cursor: 'pointer',
}

function submitBtnStyle(disabled: boolean): React.CSSProperties {
  return {
    padding: '8px 20px',
    background: disabled ? '#9ca3af' : 'var(--brand)',
    color: '#fff',
    border: 'none',
    borderRadius: 6,
    fontSize: 14,
    fontWeight: 600,
    cursor: disabled ? 'default' : 'pointer',
  }
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
