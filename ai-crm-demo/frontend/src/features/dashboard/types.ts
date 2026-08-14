export interface MonthlyFocus {
  purpose: string
  purpose_code: string
  reason: string
  confidence: 'high' | 'medium' | 'low'
  cautions: string[]
}

export interface AiDiagnosis {
  summary: string
  main_issue: string
  hypothesis: string
  priority: 'high' | 'medium' | 'low'
  confidence: 'high' | 'medium' | 'low'
  reasons: string[]
  cautions: string[]
  missing_data: string[]
}

export interface WeeklyAction {
  id: string
  title: string
  purpose: string
  target: string
  priority: 'high' | 'medium' | 'low'
  channel: string
  due_label: string
  estimated_minutes: number
  steps: string[]
  success_metric: string
  cautions: string[]
}

export interface DashboardData {
  monthly_focus: MonthlyFocus
  total_customers: number
  active_customers: number
  at_risk_customers: number
  dormant_customers: number
  pre_dormant_customers: number
  repeat_customers: number
  after_first_visit_follow_targets: number
  new_customers_this_month: number
  total_sales_this_month: number
  visit_count_this_month: number
  average_spend_per_visit: number
  top_menus: { name: string; count: number }[]
  ai_diagnosis: AiDiagnosis
  weekly_actions: WeeklyAction[]
}
