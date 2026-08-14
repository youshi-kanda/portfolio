/**
 * Common TypeScript types for AI Consult CRM.
 * Follows the unified API response format from CLAUDE.md section 9.
 * Domain types (Customer, Store, etc.) are defined in their feature directories.
 */

export interface ApiMeta {
  request_id: string
}

export interface ApiListMeta extends ApiMeta {
  page: number
  per_page: number
  total: number
}

export interface ApiResponse<T> {
  data: T
  meta: ApiMeta
}

export interface ApiListResponse<T> {
  data: T[]
  meta: ApiListMeta
}

export interface ApiErrorDetail {
  field: string
  message: string
}

export interface ApiErrorResponse {
  error: {
    code: string
    message: string
    details: ApiErrorDetail[]
  }
  meta: ApiMeta
}

export type CustomerState =
  | 'new_lead'
  | 'first_booked'
  | 'first_visited'
  | 'before_second_visit'
  | 'repeater'
  | 'pre_dormant'
  | 'dormant'
  | 'vip_candidate'

export type CustomerPriority = 'high' | 'medium' | 'low'

export type ImportJobStatus =
  | 'uploaded'
  | 'mapped'
  | 'validated'
  | 'failed'
  | 'completed'
