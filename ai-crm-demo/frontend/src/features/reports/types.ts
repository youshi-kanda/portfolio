export type ReportType =
  | 'initial_diagnosis'
  | 'monthly'
  | 'customer_state'
  | 'dormant'
  | 'campaign_result'
  | 'lstep_judgement'
  | 'agency_proposal'

export type ReportStatus = 'draft' | 'shared' | 'archived'

export interface Report {
  id: string
  report_type: ReportType
  title: string
  period_start: string | null
  period_end: string | null
  summary: string
  body_markdown: string
  generated_by_ai: boolean
  status: ReportStatus
  contains_personal_data: boolean
  created_by_id: string | null
  created_at: string
  updated_at: string
}

export const REPORT_TYPE_LABELS: Record<ReportType, string> = {
  initial_diagnosis: '初期診断',
  monthly: '月次レポート',
  customer_state: '顧客状態',
  dormant: '休眠分析',
  campaign_result: '施策結果',
  lstep_judgement: 'Lステップ要否診断',
  agency_proposal: '代理店提案',
}

export const REPORT_STATUS_LABELS: Record<ReportStatus, string> = {
  draft: '下書き',
  shared: '共有済み',
  archived: 'アーカイブ',
}
