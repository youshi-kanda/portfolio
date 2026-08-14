import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import apiClient from '../../lib/apiClient'
import type { Report } from './types'

interface ListResponse {
  data: Report[]
  meta: {
    page: number
    per_page: number
    total: number
  }
}

interface GenerateMonthlyReportInput {
  period_start: string
  period_end: string
}

export function useReports(storeId: string | undefined) {
  return useQuery<ListResponse>({
    queryKey: ['stores', storeId, 'reports'],
    queryFn: async () => (await apiClient.get(`/stores/${storeId}/reports/?per_page=20`)).data,
    enabled: !!storeId,
  })
}

export function useReport(storeId: string | undefined, reportId: string | null) {
  return useQuery<Report>({
    queryKey: ['stores', storeId, 'reports', reportId],
    queryFn: async () => (await apiClient.get(`/stores/${storeId}/reports/${reportId}/`)).data.data,
    enabled: !!storeId && !!reportId,
  })
}

export function useGenerateMonthlyReport(storeId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (data: GenerateMonthlyReportInput) =>
      (await apiClient.post(`/stores/${storeId}/reports/monthly/generate/`, data)).data.data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['stores', storeId, 'reports'] })
    },
  })
}
