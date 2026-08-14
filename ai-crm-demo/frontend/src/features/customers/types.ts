export type CustomerState =
  | 'new_lead'
  | 'first_reserved'
  | 'after_first_visit'
  | 'repeater'
  | 'pre_dormant'
  | 'dormant'
  | 'vip_candidate'
  | 'high_risk'

export type CustomerPriority = 'high' | 'medium' | 'low'

export interface CustomerListItem {
  id: string
  display_name: string | null
  full_name: string | null
  status: 'active' | 'inactive'
  customer_state: CustomerState | null
  priority: CustomerPriority | null
  next_action: string | null
  last_visit_date: string | null
  visit_count: number
  ltv: number
  contact_line_allowed: boolean | null
  is_unsubscribed: boolean
}

export const CUSTOMER_STATE_LABELS: Record<CustomerState, string> = {
  new_lead: '新規リード',
  first_reserved: '初回予約済',
  after_first_visit: '初回来店後',
  repeater: 'リピーター',
  pre_dormant: '休眠予備軍',
  dormant: '休眠顧客',
  vip_candidate: 'VIP候補',
  high_risk: '離脱リスク高',
}

export const CUSTOMER_STATE_COLORS: Record<CustomerState, { bg: string; text: string }> = {
  new_lead: { bg: '#e8e8e8', text: '#555' },
  first_reserved: { bg: '#dbeafe', text: '#1d4ed8' },
  after_first_visit: { bg: '#e0f2fe', text: '#0369a1' },
  repeater: { bg: '#dcfce7', text: '#166534' },
  pre_dormant: { bg: '#fef3c7', text: '#92400e' },
  dormant: { bg: '#fee2e2', text: '#991b1b' },
  vip_candidate: { bg: '#f3e8ff', text: '#6b21a8' },
  high_risk: { bg: '#fecaca', text: '#7f1d1d' },
}

export const PRIORITY_LABELS: Record<CustomerPriority, string> = {
  high: '高',
  medium: '中',
  low: '低',
}

export const PRIORITY_COLORS: Record<CustomerPriority, { bg: string; text: string }> = {
  high: { bg: '#fee2e2', text: '#991b1b' },
  medium: { bg: '#fef3c7', text: '#92400e' },
  low: { bg: '#f3f4f6', text: '#6b7280' },
}

export interface CustomerProfile {
  gender: string | null
  age_group: string | null
  residential_area: string | null
  occupation: string | null
  preferences: unknown
}

export interface CustomerConsent {
  id: string
  contact_line_allowed: boolean
  contact_email_allowed: boolean
  contact_sms_allowed: boolean
  analysis_allowed: boolean
  external_integration_allowed: boolean
  is_unsubscribed: boolean
  unsubscribed_at: string | null
  consent_source: string | null
  consented_at: string | null
  updated_at: string
}

export interface CustomerDetail {
  id: string
  store_id: string
  display_name: string | null
  full_name: string | null
  phone: string | null
  email: string | null
  first_contact_date: string | null
  acquisition_channel: string | null
  status: 'active' | 'inactive'
  profile: CustomerProfile | null
  consent: CustomerConsent | null
  created_at: string
  updated_at: string
}

export interface CustomerInsight {
  id: string
  customer_state: CustomerState
  priority: CustomerPriority
  inferred_needs: string[]
  blocking_factors: string[]
  recommended_action: string | null
  evidence_summary: string
  ai_confidence: 'high' | 'medium' | 'low'
  review_status: 'unreviewed' | 'confirmed' | 'modified'
  insight_date: string
  created_by_ai: boolean
  created_at: string
}

export interface ReservationItem {
  id: string
  scheduled_start_at: string
  visited_at: string | null
  menu_name_snapshot: string | null
  status: string
  channel: string | null
}

export interface SaleItem {
  id: string
  sale_date: string
  amount: number
  item_name_snapshot: string | null
  item_category: string | null
  payment_method: string | null
}
