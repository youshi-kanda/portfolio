import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import apiClient from '../../lib/apiClient'
import type { ApiListResponse, ApiResponse } from '../../types'
import type { CustomerInsight } from './types'

async function fetchInsights(
  storeId: string,
  customerId: string,
): Promise<ApiListResponse<CustomerInsight>> {
  const { data } = await apiClient.get<ApiListResponse<CustomerInsight>>(
    `/stores/${storeId}/customers/${customerId}/insights/`,
  )
  return data
}

export function useCustomerInsights(storeId: string, customerId: string) {
  return useQuery({
    queryKey: ['customer-insights', storeId, customerId],
    queryFn: () => fetchInsights(storeId, customerId),
    enabled: !!storeId && !!customerId,
  })
}

export function useRecalculateInsight(storeId: string, customerId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async () => {
      const { data } = await apiClient.post<ApiResponse<CustomerInsight>>(
        `/stores/${storeId}/customers/${customerId}/insights/recalculate/`,
      )
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customer-insights', storeId, customerId] })
    },
  })
}
