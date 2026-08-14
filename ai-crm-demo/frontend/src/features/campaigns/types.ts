export type CampaignPurpose =
  | 'new_customer'
  | 'repeat'
  | 'first_followup'
  | 'dormant_reactivation'
  | 'upsell'
  | 'renewal'
  | 'awareness'
  | 'custom'

export type ContentApprovalStatus = 'draft' | 'pending' | 'approval_pending' | 'approved' | 'rejected'
export type ContentRiskLevel = 'none' | 'low' | 'medium' | 'high' | 'review_required'

export interface CampaignContent {
  id: string
  content_type: string
  title: string | null
  body: string
  cta: string | null
  tone: string | null
  generated_by_ai: boolean
  expression_risk_level: ContentRiskLevel | null
  expression_check_result: {
    reasoning?: string
    cautions?: string[]
    confidence?: number
    issues?: string[]
    overall_comment?: string
    rejection_reason?: string
  } | null
  approval_status: ContentApprovalStatus
  approved_at: string | null
  created_at: string
  updated_at: string
}

export interface CampaignContentSummary {
  id: string
  campaign_id: string | null
  campaign_title: string | null
  title: string | null
  channel: CampaignChannel | null
  approval_status: ContentApprovalStatus
  expression_risk_level: ContentRiskLevel | null
  content_text: string
  created_at: string
  updated_at: string
}

export type CampaignChannel =
  | 'official_line'
  | 'lstep'
  | 'instagram'
  | 'google_business'
  | 'email'
  | 'sms'
  | 'phone'
  | 'in_store'
  | 'flyer'

export type CampaignStatus =
  | 'proposed'
  | 'draft'
  | 'approval_pending'
  | 'approved'
  | 'executed'
  | 'result_pending'
  | 'reviewed'
  | 'on_hold'

export interface Campaign {
  id: string
  name: string
  purpose: CampaignPurpose
  channel: CampaignChannel
  status: CampaignStatus
  scheduled_at: string | null
  executed_at: string | null
  target_count: number | null
  caution_summary: string | null
  created_at: string
  updated_at: string
}

export interface CampaignCreatePayload {
  name: string
  purpose: CampaignPurpose
  channel: CampaignChannel
  scheduled_at?: string
}

export interface CampaignPatchPayload {
  name?: string
  status?: CampaignStatus
  scheduled_at?: string | null
}

export const PURPOSE_LABELS: Record<CampaignPurpose, string> = {
  new_customer: '新規獲得',
  repeat: '再来店',
  first_followup: '初回フォロー',
  dormant_reactivation: '休眠復帰',
  upsell: 'アップセル',
  renewal: '更新・回数券',
  awareness: '認知拡大',
  custom: 'カスタム',
}

export const CHANNEL_LABELS: Record<CampaignChannel, string> = {
  official_line: '公式LINE',
  lstep: 'Lステップ',
  instagram: 'Instagram',
  google_business: 'Googleビジネス',
  email: 'メール',
  sms: 'SMS',
  phone: '電話',
  in_store: '店頭',
  flyer: 'チラシ',
}

export const STATUS_LABELS: Record<CampaignStatus, string> = {
  proposed: '提案',
  draft: '下書き',
  approval_pending: '承認待ち',
  approved: '承認済み',
  executed: '実行済み',
  result_pending: '結果入力待ち',
  reviewed: '振り返り完了',
  on_hold: '保留',
}

export const CONTENT_APPROVAL_STATUS_LABELS: Record<ContentApprovalStatus, string> = {
  draft: '下書き',
  pending: '下書き',
  approval_pending: '承認待ち',
  approved: '承認済み',
  rejected: '差戻し',
}

export const CONTENT_APPROVAL_STATUS_COLORS: Record<ContentApprovalStatus, { bg: string; text: string }> = {
  draft: { bg: '#f3f4f6', text: '#374151' },
  pending: { bg: '#f3f4f6', text: '#374151' },
  approval_pending: { bg: '#fef3c7', text: '#92400e' },
  approved: { bg: '#d1fae5', text: '#065f46' },
  rejected: { bg: '#fee2e2', text: '#991b1b' },
}

export const CONTENT_RISK_LEVEL_LABELS: Record<ContentRiskLevel, string> = {
  none: 'なし',
  low: '低',
  medium: '中',
  high: '高',
  review_required: '要確認',
}

export const CONTENT_RISK_LEVEL_COLORS: Record<ContentRiskLevel, { bg: string; text: string }> = {
  none: { bg: '#d1fae5', text: '#065f46' },
  low: { bg: '#fef3c7', text: '#92400e' },
  medium: { bg: '#fed7aa', text: '#9a3412' },
  high: { bg: '#fee2e2', text: '#991b1b' },
  review_required: { bg: '#fee2e2', text: '#7f1d1d' },
}

export const CONTENT_RISK_LEVEL_FALLBACK = {
  label: '要確認',
  colors: { bg: '#fee2e2', text: '#7f1d1d' },
}

export const PURPOSE_HINTS: Record<CampaignPurpose, {
  description: string
  recommendedChannel: CampaignChannel
  placeholder: string
}> = {
  new_customer: {
    description: '新規顧客の初来店を促します。認知から来店につなげる訴求が重要です。',
    recommendedChannel: 'instagram',
    placeholder: '例：6月 新規集客Instagram投稿',
  },
  repeat: {
    description: '既存顧客の再来店を促します。「次回予約を」という一押しが効果的です。',
    recommendedChannel: 'official_line',
    placeholder: '例：6月 再来店促進施策',
  },
  first_followup: {
    description: '初回来店後のお客様に2回目予約を促します。来店後1週間以内が効果的です。',
    recommendedChannel: 'official_line',
    placeholder: '例：初回フォロー配信（来店後1週間）',
  },
  dormant_reactivation: {
    description: '3〜6ヶ月来店がない休眠顧客の再来店を促します。特別オファーが有効です。',
    recommendedChannel: 'official_line',
    placeholder: '例：6月 休眠復帰キャンペーン',
  },
  upsell: {
    description: '既存顧客により高単価なメニューやコースを提案します。',
    recommendedChannel: 'official_line',
    placeholder: '例：コースアップセル提案',
  },
  renewal: {
    description: '回数券・コース終了時の継続・更新を促します。期限2週間前が効果的です。',
    recommendedChannel: 'official_line',
    placeholder: '例：コース更新案内',
  },
  awareness: {
    description: '新サービス・新メニューの認知を広げます。SNS投稿・拡散が有効です。',
    recommendedChannel: 'instagram',
    placeholder: '例：新メニュー告知Instagram',
  },
  custom: {
    description: '上記以外の施策です。目的を明確にしてから文案を作成してください。',
    recommendedChannel: 'official_line',
    placeholder: '例：6月 カスタム施策',
  },
}

export const STATUS_COLORS: Record<CampaignStatus, { bg: string; text: string }> = {
  proposed: { bg: '#ede9fe', text: '#5b21b6' },
  draft: { bg: '#f3f4f6', text: '#374151' },
  approval_pending: { bg: '#fef3c7', text: '#92400e' },
  approved: { bg: '#d1fae5', text: '#065f46' },
  executed: { bg: '#dbeafe', text: '#1e40af' },
  result_pending: { bg: '#fce7f3', text: '#9d174d' },
  reviewed: { bg: '#d1fae5', text: '#065f46' },
  on_hold: { bg: '#f3f4f6', text: '#6b7280' },
}
