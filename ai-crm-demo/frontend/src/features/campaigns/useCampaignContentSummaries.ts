import { useQuery } from '@tanstack/react-query'
import apiClient from '../../lib/apiClient'
import type { CampaignContentSummary, ContentApprovalStatus } from './types'

interface CampaignContentSummaryResponse {
  data: CampaignContentSummary[]
  meta: {
    page: number
    per_page: number
    total: number
  }
}

interface UseCampaignContentSummariesParams {
  storeId: string
  approvalStatus?: ContentApprovalStatus
  perPage?: number
}

export function useCampaignContentSummaries({
  storeId,
  approvalStatus,
  perPage = 10,
}: UseCampaignContentSummariesParams) {
  return useQuery<CampaignContentSummaryResponse>({
    queryKey: ['campaign-content-summaries', storeId, approvalStatus, perPage],
    queryFn: async () => {
      const params = new URLSearchParams({ per_page: String(perPage) })
      if (approvalStatus) params.set('approval_status', approvalStatus)
      return (await apiClient.get(`/stores/${storeId}/campaign-contents/?${params.toString()}`)).data
    },
    enabled: !!storeId,
  })
}
