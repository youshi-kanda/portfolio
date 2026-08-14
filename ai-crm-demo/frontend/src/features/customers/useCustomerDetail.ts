import { useQuery } from '@tanstack/react-query'
import apiClient from '../../lib/apiClient'
import type { ApiResponse } from '../../types'
import type { CustomerDetail } from './types'

async function fetchCustomerDetail(
  storeId: string,
  customerId: string,
): Promise<ApiResponse<CustomerDetail>> {
  const { data } = await apiClient.get<ApiResponse<CustomerDetail>>(
    `/stores/${storeId}/customers/${customerId}`,
  )
  return data
}

export function useCustomerDetail(storeId: string, customerId: string) {
  return useQuery({
    queryKey: ['customer', storeId, customerId],
    queryFn: () => fetchCustomerDetail(storeId, customerId),
    enabled: !!storeId && !!customerId,
  })
}
