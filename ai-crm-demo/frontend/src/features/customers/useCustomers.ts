import { useQuery } from '@tanstack/react-query'
import apiClient from '../../lib/apiClient'
import type { ApiListResponse } from '../../types'
import type { CustomerListItem } from './types'

export interface CustomersQueryParams {
  storeId: string
  q?: string
  customerState?: string
  isUnsubscribed?: 'true' | 'false' | ''
  page?: number
}

async function fetchCustomers(
  params: CustomersQueryParams,
): Promise<ApiListResponse<CustomerListItem>> {
  const sp = new URLSearchParams()
  if (params.q) sp.set('q', params.q)
  if (params.customerState) sp.set('customer_state', params.customerState)
  if (params.isUnsubscribed) sp.set('is_unsubscribed', params.isUnsubscribed)
  if (params.page && params.page > 1) sp.set('page', String(params.page))

  const { data } = await apiClient.get<ApiListResponse<CustomerListItem>>(
    `/stores/${params.storeId}/customers?${sp.toString()}`,
  )
  return data
}

export function useCustomers(params: CustomersQueryParams) {
  return useQuery({
    queryKey: ['customers', params],
    queryFn: () => fetchCustomers(params),
    enabled: !!params.storeId,
    placeholderData: (prev) => prev,
  })
}
