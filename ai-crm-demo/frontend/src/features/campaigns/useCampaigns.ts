import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import apiClient from '../../lib/apiClient'
import type { ApiListResponse, ApiResponse } from '../../types'
import type { Campaign, CampaignCreatePayload, CampaignPatchPayload, CampaignStatus } from './types'

export interface CampaignsQueryParams {
  storeId: string
  status?: CampaignStatus
  page?: number
}

async function fetchCampaigns(params: CampaignsQueryParams): Promise<ApiListResponse<Campaign>> {
  const sp = new URLSearchParams()
  if (params.status) sp.set('status', params.status)
  if (params.page && params.page > 1) sp.set('page', String(params.page))
  const { data } = await apiClient.get<ApiListResponse<Campaign>>(
    `/stores/${params.storeId}/campaigns?${sp.toString()}`,
  )
  return data
}

export function useCampaigns(params: CampaignsQueryParams) {
  return useQuery({
    queryKey: ['campaigns', params],
    queryFn: () => fetchCampaigns(params),
    enabled: !!params.storeId,
    placeholderData: (prev) => prev,
  })
}

export function useCreateCampaign(storeId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: CampaignCreatePayload) => {
      const { data } = await apiClient.post<ApiResponse<Campaign>>(
        `/stores/${storeId}/campaigns`,
        payload,
      )
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['campaigns'] })
    },
  })
}

export function useUpdateCampaign(storeId: string, campaignId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: CampaignPatchPayload) => {
      const { data } = await apiClient.patch<ApiResponse<Campaign>>(
        `/stores/${storeId}/campaigns/${campaignId}`,
        payload,
      )
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['campaigns'] })
      qc.invalidateQueries({ queryKey: ['campaign', storeId, campaignId] })
    },
  })
}

export function useDeleteCampaign(storeId: string, campaignId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async () => {
      await apiClient.delete(`/stores/${storeId}/campaigns/${campaignId}`)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['campaigns'] })
    },
  })
}

export function useCampaignDetail(storeId: string, campaignId: string) {
  return useQuery({
    queryKey: ['campaign', storeId, campaignId],
    queryFn: async () => {
      const { data } = await apiClient.get<ApiResponse<Campaign>>(
        `/stores/${storeId}/campaigns/${campaignId}`,
      )
      return data
    },
    enabled: !!storeId && !!campaignId,
  })
}
