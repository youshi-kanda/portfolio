import { useQuery } from '@tanstack/react-query'
import apiClient from '../../../lib/apiClient'
import type { ApiResponse } from '../../../types'
import type { DashboardData } from '../types'

async function fetchDashboard(storeId: string): Promise<DashboardData> {
  const { data } = await apiClient.get<ApiResponse<DashboardData>>(
    `/stores/${storeId}/dashboard/`,
  )
  return data.data
}

export function useDashboard(storeId: string | undefined) {
  return useQuery({
    queryKey: ['dashboard', storeId],
    queryFn: () => fetchDashboard(storeId!),
    enabled: !!storeId,
  })
}
