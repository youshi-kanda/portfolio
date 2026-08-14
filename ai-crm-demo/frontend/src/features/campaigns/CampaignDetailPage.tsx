import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import type { AxiosError } from 'axios'
import type { ApiErrorResponse } from '../../types'
import {
  CHANNEL_LABELS,
  CONTENT_APPROVAL_STATUS_COLORS,
  CONTENT_APPROVAL_STATUS_LABELS,
  CONTENT_RISK_LEVEL_COLORS,
  CONTENT_RISK_LEVEL_FALLBACK,
  CONTENT_RISK_LEVEL_LABELS,
  PURPOSE_LABELS,
  STATUS_COLORS,
  STATUS_LABELS,
  type CampaignChannel,
  type CampaignContent,
  type CampaignPurpose,
  type CampaignStatus,
  type ContentApprovalStatus,
  type ContentRiskLevel,
} from './types'
import { useCampaignDetail, useDeleteCampaign, useUpdateCampaign } from './useCampaigns'
import {
  useApproveContent,
  useCampaignContents,
  useGenerateContent,
  useRejectContent,
  useSubmitContent,
} from './useCampaignContents'
import { useQuery } from '@tanstack/react-query'
import apiClient from '../../lib/apiClient'

interface MyStorePermissions {
  can_approve_contents: boolean
}

function useMyStorePermissions(storeId: string | undefined) {
  return useQuery<MyStorePermissions>({
    queryKey: ['store', storeId, 'my-permissions'],
    queryFn: async () =>
      (await apiClient.get(`/stores/${storeId}/my-permissions`)).data.data,
    enabled: !!storeId,
    staleTime: 60_000,
  })
}

// ─── card ─────────────────────────────────────────────────────────────────────

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div
      style={{
        border: '1px solid #e5e7eb',
        borderRadius: 8,
        marginBottom: 16,
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          background: '#f9fafb',
          padding: '10px 16px',
          borderBottom: '1px solid #e5e7eb',
        }}
      >
        <h2 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: '#374151' }}>{title}</h2>
      </div>
      <div style={{ padding: 16 }}>{children}</div>
    </div>
  )
}

function InfoRow({ label, value }: { label: string; value?: string | null }) {
  return (
    <div style={{ display: 'flex', gap: 12, marginBottom: 8, fontSize: 14 }}>
      <span style={{ width: 120, color: '#6b7280', flexShrink: 0 }}>{label}</span>
      <span style={{ color: value ? '#111' : '#9ca3af' }}>{value || '—'}</span>
    </div>
  )
}

function StatusBadge({ status }: { status: CampaignStatus }) {
  const { bg, text } = STATUS_COLORS[status]
  return (
    <span
      style={{
        background: bg,
        color: text,
        padding: '3px 10px',
        borderRadius: 4,
        fontSize: 13,
        fontWeight: 700,
      }}
    >
      {STATUS_LABELS[status]}
    </span>
  )
}

// ─── edit form ────────────────────────────────────────────────────────────────

function EditCard({
  storeId,
  campaignId,
  initial,
}: {
  storeId: string
  campaignId: string
  initial: {
    name: string
    status: CampaignStatus
    scheduled_at: string | null
  }
}) {
  const updateMutation = useUpdateCampaign(storeId, campaignId)
  const [name, setName] = useState(initial.name)
  const [status, setStatus] = useState<CampaignStatus>(initial.status)
  const [scheduledAt, setScheduledAt] = useState(initial.scheduled_at ?? '')
  const [saved, setSaved] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  async function handleSave() {
    setErrorMsg(null)
    setSaved(false)
    if (!name.trim()) {
      setErrorMsg('施策名を入力してください。')
      return
    }
    try {
      await updateMutation.mutateAsync({
        name: name.trim(),
        status,
        scheduled_at: scheduledAt || null,
      })
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch {
      setErrorMsg('更新に失敗しました。もう一度お試しください。')
    }
  }

  return (
    <Card title="施策情報を編集">
      <label style={labelStyle}>施策名</label>
      <input
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        style={inputStyle}
      />

      <label style={labelStyle}>ステータス</label>
      <select
        value={status}
        onChange={(e) => setStatus(e.target.value as CampaignStatus)}
        style={inputStyle}
      >
        {(Object.keys(STATUS_LABELS) as CampaignStatus[]).map((k) => (
          <option key={k} value={k}>
            {STATUS_LABELS[k]}
          </option>
        ))}
      </select>

      <label style={labelStyle}>実施予定日</label>
      <input
        type="date"
        value={scheduledAt}
        onChange={(e) => setScheduledAt(e.target.value)}
        style={inputStyle}
      />

      {errorMsg && (
        <div style={{ color: '#dc2626', fontSize: 13, marginTop: 8 }}>{errorMsg}</div>
      )}
      {saved && (
        <div style={{ color: '#065f46', fontSize: 13, marginTop: 8 }}>保存しました。</div>
      )}

      <div style={{ marginTop: 14 }}>
        <button
          onClick={handleSave}
          disabled={updateMutation.isPending}
          style={saveBtnStyle(updateMutation.isPending)}
        >
          {updateMutation.isPending ? '保存中…' : '保存する'}
        </button>
      </div>
    </Card>
  )
}

// ─── delete section ───────────────────────────────────────────────────────────

function DeleteSection({
  storeId,
  campaignId,
}: {
  storeId: string
  campaignId: string
}) {
  const navigate = useNavigate()
  const deleteMutation = useDeleteCampaign(storeId, campaignId)
  const [confirm, setConfirm] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  async function handleDelete() {
    setErrorMsg(null)
    try {
      await deleteMutation.mutateAsync()
      navigate(`/stores/${storeId}/campaigns`)
    } catch {
      setErrorMsg('削除に失敗しました。もう一度お試しください。')
    }
  }

  return (
    <div
      style={{
        marginTop: 24,
        padding: '16px',
        border: '1px solid #fecaca',
        borderRadius: 8,
        background: '#fff5f5',
      }}
    >
      <p style={{ margin: '0 0 10px', fontSize: 13, color: '#7f1d1d' }}>
        この施策を削除します。削除後は元に戻せません。
      </p>
      {errorMsg && (
        <div style={{ color: '#dc2626', fontSize: 13, marginBottom: 8 }}>{errorMsg}</div>
      )}
      {!confirm ? (
        <button
          onClick={() => setConfirm(true)}
          style={{
            padding: '7px 16px',
            border: '1px solid #fca5a5',
            borderRadius: 6,
            background: '#fff',
            color: '#dc2626',
            fontSize: 13,
            cursor: 'pointer',
            fontWeight: 600,
          }}
        >
          施策を削除する
        </button>
      ) : (
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <span style={{ fontSize: 13, color: '#7f1d1d' }}>本当に削除しますか？</span>
          <button
            onClick={handleDelete}
            disabled={deleteMutation.isPending}
            style={{
              padding: '7px 16px',
              border: 'none',
              borderRadius: 6,
              background: deleteMutation.isPending ? '#9ca3af' : '#dc2626',
              color: '#fff',
              fontSize: 13,
              cursor: deleteMutation.isPending ? 'default' : 'pointer',
              fontWeight: 600,
            }}
          >
            {deleteMutation.isPending ? '削除中…' : '削除する'}
          </button>
          <button
            onClick={() => setConfirm(false)}
            style={{
              padding: '7px 14px',
              border: '1px solid #d1d5db',
              borderRadius: 6,
              background: '#fff',
              color: '#374151',
              fontSize: 13,
              cursor: 'pointer',
            }}
          >
            キャンセル
          </button>
        </div>
      )}
    </div>
  )
}

// ─── content approval badge ───────────────────────────────────────────────────

function ApprovalBadge({ status }: { status: ContentApprovalStatus }) {
  const colors = CONTENT_APPROVAL_STATUS_COLORS[status] ?? { bg: '#f3f4f6', text: '#374151' }
  return (
    <span
      style={{
        background: colors.bg,
        color: colors.text,
        padding: '2px 8px',
        borderRadius: 4,
        fontSize: 12,
        fontWeight: 600,
        whiteSpace: 'nowrap',
      }}
    >
      {CONTENT_APPROVAL_STATUS_LABELS[status] ?? status}
    </span>
  )
}

function RiskBadge({ level }: { level: ContentRiskLevel | string }) {
  if (level === 'none') return null
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
        fontWeight: 600,
        whiteSpace: 'nowrap',
      }}
    >
      広告表現: {label}
    </span>
  )
}

// ─── content item ─────────────────────────────────────────────────────────────

function ContentItem({
  content,
  storeId,
  campaignId,
  canApprove,
  permsLoading,
}: {
  content: CampaignContent
  storeId: string
  campaignId: string
  canApprove: boolean
  permsLoading: boolean
}) {
  const [showRejectForm, setShowRejectForm] = useState(false)
  const [rejectReason, setRejectReason] = useState('')
  const [actionError, setActionError] = useState<string | null>(null)

  const submitMutation = useSubmitContent(storeId, campaignId)
  const approveMutation = useApproveContent(storeId, campaignId)
  const rejectMutation = useRejectContent(storeId, campaignId)

  const isDraft = content.approval_status === 'draft' || content.approval_status === 'pending'
  const isPending = content.approval_status === 'approval_pending'
  const isApproved = content.approval_status === 'approved'

  const cautions = content.expression_check_result?.cautions ?? []
  const rejectionReason = content.expression_check_result?.rejection_reason

  async function handleSubmit() {
    setActionError(null)
    try {
      await submitMutation.mutateAsync(content.id)
    } catch (err) {
      const msg = (err as AxiosError<ApiErrorResponse>)?.response?.data?.error?.message
      setActionError(msg ?? '承認申請に失敗しました。')
    }
  }

  async function handleApprove() {
    setActionError(null)
    try {
      await approveMutation.mutateAsync(content.id)
    } catch (err) {
      const msg = (err as AxiosError<ApiErrorResponse>)?.response?.data?.error?.message
      setActionError(msg ?? '承認に失敗しました。')
    }
  }

  async function handleReject() {
    setActionError(null)
    if (!rejectReason.trim()) {
      setActionError('差戻し理由を入力してください。')
      return
    }
    try {
      await rejectMutation.mutateAsync({ contentId: content.id, reason: rejectReason.trim() })
      setShowRejectForm(false)
      setRejectReason('')
    } catch (err) {
      const msg = (err as AxiosError<ApiErrorResponse>)?.response?.data?.error?.message
      setActionError(msg ?? '差戻しに失敗しました。')
    }
  }

  return (
    <div
      style={{
        border: '1px solid #e5e7eb',
        borderRadius: 8,
        marginBottom: 12,
        overflow: 'hidden',
      }}
    >
      {/* header row */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '10px 14px',
          background: '#f9fafb',
          borderBottom: '1px solid #e5e7eb',
          flexWrap: 'wrap',
        }}
      >
        <span style={{ fontWeight: 600, fontSize: 14, color: '#111827', flexGrow: 1 }}>
          {content.title || '(タイトルなし)'}
          {content.generated_by_ai && (
            <span style={{ marginLeft: 8, fontSize: 11, color: '#6b7280', fontWeight: 400 }}>
              AI生成
            </span>
          )}
        </span>
        <ApprovalBadge status={content.approval_status} />
        {content.expression_risk_level && (
          <RiskBadge level={content.expression_risk_level} />
        )}
      </div>

      {/* body */}
      <div style={{ padding: '12px 14px' }}>
        <div
          style={{
            background: '#f9fafb',
            border: '1px solid #e5e7eb',
            borderRadius: 6,
            padding: '10px 12px',
            fontSize: 14,
            color: '#374151',
            whiteSpace: 'pre-wrap',
            lineHeight: 1.7,
            maxHeight: 160,
            overflowY: 'auto',
            marginBottom: 8,
          }}
        >
          {content.body}
        </div>

        {content.cta && (
          <div style={{ fontSize: 13, color: '#6b7280', marginBottom: 8 }}>
            CTA: {content.cta}
          </div>
        )}

        {/* 広告表現チェック注意事項 */}
        {content.expression_risk_level && content.expression_risk_level !== 'none' && cautions.length > 0 && (
          <div
            style={{
              padding: '8px 12px',
              background: '#fffbeb',
              border: '1px solid #fde68a',
              borderRadius: 6,
              fontSize: 13,
              color: '#78350f',
              marginBottom: 8,
            }}
          >
            <div style={{ fontWeight: 600, marginBottom: 4 }}>⚠️ 広告表現の注意事項</div>
            <ul style={{ margin: 0, paddingLeft: 18, lineHeight: 1.7 }}>
              {cautions.map((c, i) => (
                <li key={i}>{c}</li>
              ))}
            </ul>
          </div>
        )}

        {/* 差戻し理由 */}
        {content.approval_status === 'rejected' && rejectionReason && (
          <div
            style={{
              padding: '8px 12px',
              background: '#fef2f2',
              border: '1px solid #fecaca',
              borderRadius: 6,
              fontSize: 13,
              color: '#991b1b',
              marginBottom: 8,
            }}
          >
            <div style={{ fontWeight: 600, marginBottom: 4 }}>差戻し理由</div>
            {rejectionReason}
          </div>
        )}

        {/* 承認済み → 外部配信への連携ポイント（Portfolio Demo版はUIのみ） */}
        {isApproved && (
          <div
            style={{
              padding: '8px 12px',
              background: '#f0fdf4',
              border: '1px solid #bbf7d0',
              borderRadius: 6,
              fontSize: 13,
              color: '#065f46',
              marginBottom: 8,
            }}
          >
            この文案は承認済みです。実サービスでは承認後に外部配信機能（LINE / メール等）へ連携します。
          </div>
        )}

        {actionError && (
          <div style={{ color: '#dc2626', fontSize: 13, marginBottom: 8 }}>{actionError}</div>
        )}

        {/* アクションボタン */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 4 }}>
          {isDraft && (
            <button
              onClick={handleSubmit}
              disabled={submitMutation.isPending}
              style={actionBtnStyle(submitMutation.isPending, 'primary')}
            >
              {submitMutation.isPending ? '申請中…' : '承認申請する'}
            </button>
          )}

          {isPending && permsLoading && (
            <span style={{ fontSize: 12, color: '#9ca3af' }}>権限確認中...</span>
          )}
          {isPending && !permsLoading && canApprove && (
            <>
              <button
                onClick={handleApprove}
                disabled={approveMutation.isPending}
                style={actionBtnStyle(approveMutation.isPending, 'success')}
              >
                {approveMutation.isPending ? '承認中…' : '承認する'}
              </button>
              <button
                onClick={() => { setShowRejectForm(!showRejectForm); setActionError(null) }}
                disabled={rejectMutation.isPending}
                style={actionBtnStyle(false, 'danger')}
              >
                差戻し
              </button>
            </>
          )}
          {isPending && !permsLoading && !canApprove && (
            <span style={{ fontSize: 12, color: '#9ca3af' }}>承認権限がありません</span>
          )}
        </div>

        {/* 差戻しフォーム */}
        {showRejectForm && (
          <div style={{ marginTop: 10 }}>
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="差戻し理由を入力してください（必須）"
              rows={3}
              style={{
                display: 'block',
                width: '100%',
                boxSizing: 'border-box',
                padding: '8px 10px',
                border: '1px solid #d1d5db',
                borderRadius: 6,
                fontSize: 13,
                resize: 'vertical',
              }}
            />
            <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
              <button
                onClick={handleReject}
                disabled={rejectMutation.isPending}
                style={actionBtnStyle(rejectMutation.isPending, 'danger')}
              >
                {rejectMutation.isPending ? '差戻し中…' : '差戻しを確定'}
              </button>
              <button
                onClick={() => { setShowRejectForm(false); setRejectReason(''); setActionError(null) }}
                style={actionBtnStyle(false, 'secondary')}
              >
                キャンセル
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── contents section ─────────────────────────────────────────────────────────

function ContentsSection({ storeId, campaignId }: { storeId: string; campaignId: string }) {
  const { data, isLoading, isError } = useCampaignContents(storeId, campaignId)
  const generateMutation = useGenerateContent(storeId, campaignId)
  const [generateError, setGenerateError] = useState<string | null>(null)
  const [generatedMsg, setGeneratedMsg] = useState<string | null>(null)
  const { data: myPerms, isLoading: permsLoading } = useMyStorePermissions(storeId)
  const canApprove = myPerms?.can_approve_contents ?? false

  const contents = data?.data ?? []

  async function handleGenerate() {
    setGenerateError(null)
    setGeneratedMsg(null)
    try {
      await generateMutation.mutateAsync('warm')
      setGeneratedMsg('AI文案を生成しました。内容を確認して承認申請してください。')
    } catch (err) {
      const msg = (err as AxiosError<ApiErrorResponse>)?.response?.data?.error?.message
      setGenerateError(msg ?? 'AI文案の生成に失敗しました。')
    }
  }

  return (
    <Card title="文案一覧（承認フロー）">
      {/* 承認フローの説明 */}
      <div
        style={{
          padding: '10px 12px',
          background: '#eff6ff',
          border: '1px solid #bfdbfe',
          borderRadius: 6,
          fontSize: 13,
          color: '#1e40af',
          marginBottom: 14,
          lineHeight: 1.6,
        }}
      >
        <strong>承認フロー：</strong>
        下書き → 承認申請 → 承認 → 配信（デモでは無効）<br />
        実サービスでは、承認済み文案のみが外部配信チャネルへ連携されます。
      </div>

      {isLoading && <div style={{ color: '#6b7280', fontSize: 14 }}>読み込み中…</div>}
      {isError && (
        <div style={{ color: '#dc2626', fontSize: 13 }}>文案の取得に失敗しました。</div>
      )}

      {!isLoading && !isError && contents.length === 0 && (
        <div
          style={{
            padding: '16px',
            background: '#f9fafb',
            borderRadius: 6,
            fontSize: 13,
            color: '#6b7280',
            marginBottom: 12,
          }}
        >
          文案がまだありません。「AI文案を生成」から配信用の文案を自動作成できます。
        </div>
      )}

      {contents.map((c) => (
        <ContentItem key={c.id} content={c} storeId={storeId} campaignId={campaignId} canApprove={canApprove} permsLoading={permsLoading} />
      ))}

      <div style={{ marginTop: 8, display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <button
          onClick={handleGenerate}
          disabled={generateMutation.isPending}
          style={{
            padding: '8px 16px',
            background: generateMutation.isPending ? '#9ca3af' : 'var(--brand)',
            color: '#fff',
            border: 'none',
            borderRadius: 6,
            fontSize: 13,
            fontWeight: 600,
            cursor: generateMutation.isPending ? 'default' : 'pointer',
          }}
        >
          {generateMutation.isPending ? 'AI生成中…' : 'AI文案を生成'}
        </button>
        <span style={{ fontSize: 12, color: '#9ca3af' }}>
          AIがこの施策の目的・チャネルに合わせて文案を生成します
        </span>
      </div>

      {generateError && (
        <div style={{ color: '#dc2626', fontSize: 13, marginTop: 8 }}>{generateError}</div>
      )}
      {generatedMsg && (
        <div style={{ color: '#065f46', fontSize: 13, marginTop: 8 }}>{generatedMsg}</div>
      )}
    </Card>
  )
}

// ─── main page ────────────────────────────────────────────────────────────────

export default function CampaignDetailPage() {
  const { storeId, campaignId } = useParams<{ storeId: string; campaignId: string }>()
  const { data, isLoading, isError } = useCampaignDetail(storeId ?? '', campaignId ?? '')

  if (!storeId || !campaignId) return <div>パラメータが不正です。</div>

  if (isLoading) {
    return <div style={{ color: 'var(--text-secondary)' }}>読み込み中…</div>
  }

  if (isError || !data?.data) {
    return (
      <div style={{ color: 'var(--danger)' }}>
        施策情報の取得に失敗しました。
        <Link
          to={`/stores/${storeId}/campaigns`}
          style={{ marginLeft: 12, color: 'var(--brand)' }}
        >
          一覧へ戻る
        </Link>
      </div>
    )
  }

  const c = data.data

  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <Link
          to={`/stores/${storeId}/campaigns`}
          style={{ fontSize: 13, color: '#6b7280', textDecoration: 'none' }}
        >
          ← 施策管理
        </Link>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 6 }}>
          <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0, color: '#111' }}>{c.name}</h1>
          <StatusBadge status={c.status} />
        </div>
      </div>

      {/* 基本情報 */}
      <Card title="基本情報">
        <InfoRow label="目的" value={PURPOSE_LABELS[c.purpose as CampaignPurpose]} />
        <InfoRow label="チャネル" value={CHANNEL_LABELS[c.channel as CampaignChannel]} />
        <InfoRow label="実施予定日" value={c.scheduled_at ? c.scheduled_at.slice(0, 10) : null} />
        <InfoRow label="実施日" value={c.executed_at ? c.executed_at.slice(0, 10) : null} />
        <InfoRow label="対象者数" value={c.target_count != null ? `${c.target_count} 名` : null} />
        <InfoRow label="作成日" value={c.created_at.slice(0, 10)} />
        <InfoRow label="更新日" value={c.updated_at.slice(0, 10)} />
        {c.caution_summary && (
          <div
            style={{
              marginTop: 10,
              padding: '10px 12px',
              background: '#fefce8',
              border: '1px solid #fde68a',
              borderRadius: 6,
              fontSize: 13,
              color: '#78350f',
              lineHeight: 1.6,
            }}
          >
            <strong>注意事項：</strong>
            {c.caution_summary}
          </div>
        )}
      </Card>

      {/* 文案一覧 */}
      <ContentsSection storeId={storeId} campaignId={campaignId} />

      {/* 編集フォーム */}
      <EditCard
        storeId={storeId}
        campaignId={campaignId}
        initial={{ name: c.name, status: c.status, scheduled_at: c.scheduled_at }}
      />

      {/* 削除 */}
      <DeleteSection storeId={storeId} campaignId={campaignId} />
    </div>
  )
}

// ─── styles ───────────────────────────────────────────────────────────────────

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

type BtnVariant = 'primary' | 'success' | 'danger' | 'secondary'

function actionBtnStyle(disabled: boolean, variant: BtnVariant): React.CSSProperties {
  const bgMap: Record<BtnVariant, string> = {
    primary: 'var(--brand)',
    success: '#065f46',
    danger: '#dc2626',
    secondary: '#fff',
  }
  return {
    padding: '6px 14px',
    background: disabled ? '#9ca3af' : bgMap[variant],
    color: variant === 'secondary' ? '#374151' : '#fff',
    border: variant === 'secondary' ? '1px solid #d1d5db' : 'none',
    borderRadius: 6,
    fontSize: 13,
    fontWeight: 600,
    cursor: disabled ? 'default' : 'pointer',
  }
}

function saveBtnStyle(disabled: boolean): React.CSSProperties {
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
