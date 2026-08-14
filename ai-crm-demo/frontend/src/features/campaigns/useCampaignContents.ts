import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import apiClient from '../../lib/apiClient'
import type { ApiListResponse, ApiResponse } from '../../types'
import type { CampaignContent } from './types'

function contentsKey(storeId: string, campaignId: string) {
  return ['campaign-contents', storeId, campaignId] as const
}

export function useCampaignContents(storeId: string, campaignId: string) {
  return useQuery({
    queryKey: contentsKey(storeId, campaignId),
    queryFn: async () => {
      const { data } = await apiClient.get<ApiListResponse<CampaignContent>>(
        `/stores/${storeId}/campaigns/${campaignId}/contents/`,
      )
      return data
    },
    enabled: !!storeId && !!campaignId,
  })
}

export function useGenerateContent(storeId: string, campaignId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (tone: string = 'warm') => {
      const { data } = await apiClient.post<ApiResponse<CampaignContent>>(
        `/stores/${storeId}/campaigns/${campaignId}/contents/generate/`,
        { tone },
      )
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: contentsKey(storeId, campaignId) })
    },
  })
}

export function useSubmitContent(storeId: string, campaignId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (contentId: string) => {
      const { data } = await apiClient.post<ApiResponse<CampaignContent>>(
        `/stores/${storeId}/campaigns/${campaignId}/contents/${contentId}/submit/`,
      )
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: contentsKey(storeId, campaignId) })
    },
  })
}

export function useApproveContent(storeId: string, campaignId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (contentId: string) => {
      const { data } = await apiClient.post<ApiResponse<CampaignContent>>(
        `/stores/${storeId}/campaigns/${campaignId}/contents/${contentId}/approve/`,
      )
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: contentsKey(storeId, campaignId) })
    },
  })
}

export function useRejectContent(storeId: string, campaignId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ contentId, reason }: { contentId: string; reason: string }) => {
      const { data } = await apiClient.post<ApiResponse<CampaignContent>>(
        `/stores/${storeId}/campaigns/${campaignId}/contents/${contentId}/reject/`,
        { reason },
      )
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: contentsKey(storeId, campaignId) })
    },
  })
}
