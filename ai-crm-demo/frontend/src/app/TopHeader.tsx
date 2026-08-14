import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { LogOut } from 'lucide-react'
import apiClient from '../lib/apiClient'

interface StoreBasic {
  id: string
  name: string
}

interface CurrentUser {
  id: string
  email: string
  name: string
  role: string
  status: string
}

interface MeResponse {
  user: CurrentUser
  stores: StoreBasic[]
}

function useCurrentUser() {
  return useQuery<CurrentUser>({
    queryKey: ['auth', 'me'],
    queryFn: async () => {
      const res = await apiClient.get<{ data: MeResponse }>('/auth/me')
      return res.data.data.user
    },
    staleTime: 10 * 60 * 1000,
  })
}

function useStoreName(storeId: string | undefined) {
  return useQuery<StoreBasic>({
    queryKey: ['store', storeId],
    queryFn: async () => (await apiClient.get(`/stores/${storeId}`)).data.data,
    enabled: !!storeId,
    staleTime: 10 * 60 * 1000,
  })
}

export function TopHeader() {
  const { storeId } = useParams<{ storeId: string }>()
  const navigate = useNavigate()
  const { data: user } = useCurrentUser()
  const { data: store } = useStoreName(storeId)
  const [logoutHovered, setLogoutHovered] = useState(false)

  function handleLogout() {
    const refreshToken = localStorage.getItem('refresh_token')
    if (refreshToken) {
      // best-effort blacklist: don't block navigation on failure
      apiClient.post('/auth/logout', { refresh: refreshToken }).catch(() => {})
    }
    localStorage.removeItem('access_token')
    localStorage.removeItem('refresh_token')
    navigate('/login')
  }

  return (
    <header
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        height: 52,
        zIndex: 100,
        background: 'var(--sidebar-bg)',
        boxShadow: '0 1px 3px rgba(0,0,0,0.25)',
        display: 'flex',
        alignItems: 'center',
        padding: '0 20px',
        gap: 12,
      }}
    >
      {/* 左: ブランドラベル + 店舗名 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span
          style={{
            background: 'var(--brand)',
            color: '#1E293B',
            padding: '4px 8px',
            borderRadius: 4,
            fontSize: 11,
            fontWeight: 800,
            letterSpacing: '0.02em',
            whiteSpace: 'nowrap',
          }}
        >
          AI CRM
        </span>

        <span
          style={{
            display: 'inline-block',
            width: 1,
            height: 20,
            background: 'rgba(255,255,255,0.12)',
          }}
        />

        <span
          style={{
            fontSize: 14,
            fontWeight: 600,
            color: '#F8FAFC',
            maxWidth: 200,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {store?.name ?? '読み込み中...'}
        </span>
      </div>

      {/* 右: ユーザーメール + ログアウト */}
      <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
        {user?.email && (
          <span
            style={{
              fontSize: 12,
              color: 'var(--sidebar-text)',
              maxWidth: 180,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {user.email}
          </span>
        )}

        <button
          onClick={handleLogout}
          onMouseEnter={() => setLogoutHovered(true)}
          onMouseLeave={() => setLogoutHovered(false)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '6px 10px',
            background: logoutHovered ? 'var(--sidebar-hover)' : 'transparent',
            border: 'none',
            color: logoutHovered ? '#F8FAFC' : 'var(--sidebar-text)',
            fontSize: 13,
            cursor: 'pointer',
            borderRadius: 6,
            transition: 'background 0.15s, color 0.15s',
          }}
        >
          <LogOut size={14} strokeWidth={1.75} />
          ログアウト
        </button>
      </div>
    </header>
  )
}
