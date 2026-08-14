import { useQuery } from '@tanstack/react-query'
import apiClient from '../../lib/apiClient'
import type { ApiListResponse } from '../../types'
import type { ReservationItem, SaleItem } from './types'

async function fetchReservations(
  storeId: string,
  customerId: string,
): Promise<ApiListResponse<ReservationItem>> {
  const { data } = await apiClient.get<ApiListResponse<ReservationItem>>(
    `/stores/${storeId}/reservations?customer_id=${customerId}`,
  )
  return data
}

async function fetchSales(
  storeId: string,
  customerId: string,
): Promise<ApiListResponse<SaleItem>> {
  const { data } = await apiClient.get<ApiListResponse<SaleItem>>(
    `/stores/${storeId}/sales?customer_id=${customerId}`,
  )
  return data
}

export function useCustomerReservations(storeId: string, customerId: string) {
  return useQuery({
    queryKey: ['customer-reservations', storeId, customerId],
    queryFn: () => fetchReservations(storeId, customerId),
    enabled: !!storeId && !!customerId,
    select: (data) => ({
      ...data,
      // API returns ASC; slice last 5 and reverse for most-recent-first display
      data: [...data.data].reverse().slice(0, 5),
    }),
  })
}

export function useCustomerSales(storeId: string, customerId: string) {
  return useQuery({
    queryKey: ['customer-sales', storeId, customerId],
    queryFn: () => fetchSales(storeId, customerId),
    enabled: !!storeId && !!customerId,
    select: (data) => ({
      ...data,
      data: [...data.data].reverse().slice(0, 5),
    }),
  })
}
