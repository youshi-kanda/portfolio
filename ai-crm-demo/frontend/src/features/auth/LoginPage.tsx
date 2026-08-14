import { useState, FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import apiClient from '../../lib/apiClient'

const DEMO_EMAIL = 'demo@example.com'
const DEMO_PASSWORD = 'DemoPass123!'

export function LoginPage() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const res = await apiClient.post('/auth/login', { email, password })
      const { access_token, refresh_token } = res.data.data
      localStorage.setItem('access_token', access_token)
      if (refresh_token) {
        localStorage.setItem('refresh_token', refresh_token)
      }

      const meRes = await apiClient.get('/auth/me')
      const stores: { id: string }[] = meRes.data.data.stores
      if (stores.length > 0) {
        navigate(`/stores/${stores[0].id}/dashboard`)
      } else {
        setError('デモ店舗が見つかりません。backend で `python manage.py seed_demo` を実行してください。')
      }
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { error?: { message?: string } } } })
          ?.response?.data?.error?.message ?? 'ログインに失敗しました'
      setError(msg)
    } finally {
      setLoading(false)
    }
  }

  function fillDemoCredentials() {
    setEmail(DEMO_EMAIL)
    setPassword(DEMO_PASSWORD)
  }

  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', background: '#f5f5f5' }}>
      <div style={{ background: '#fff', padding: '2rem', borderRadius: '8px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)', width: '380px' }}>
        <h1 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '0.5rem', textAlign: 'center' }}>AI CRM Demo</h1>
        <p style={{ fontSize: '0.75rem', color: '#64748B', textAlign: 'center', marginBottom: '1.25rem' }}>
          Portfolio Demo / Development Snapshot
        </p>

        <div
          style={{
            background: '#EFF6FF',
            border: '1px solid #BFDBFE',
            borderRadius: '6px',
            padding: '0.75rem 1rem',
            marginBottom: '1.25rem',
            fontSize: '0.8rem',
            color: '#1E40AF',
          }}
        >
          <div style={{ fontWeight: 700, marginBottom: 4 }}>Demo Account</div>
          <div>Email: <code>{DEMO_EMAIL}</code></div>
          <div>Password: <code>{DEMO_PASSWORD}</code></div>
          <button
            type="button"
            onClick={fillDemoCredentials}
            style={{
              marginTop: 8,
              padding: '0.35rem 0.75rem',
              background: '#2563EB',
              color: '#fff',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '0.75rem',
              fontWeight: 600,
            }}
          >
            デモアカウントを入力
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', fontSize: '0.875rem', marginBottom: '0.25rem' }}>メールアドレス</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              style={{ width: '100%', padding: '0.5rem', border: '1px solid #ccc', borderRadius: '4px', boxSizing: 'border-box' }}
            />
          </div>
          <div style={{ marginBottom: '1.5rem' }}>
            <label style={{ display: 'block', fontSize: '0.875rem', marginBottom: '0.25rem' }}>パスワード</label>
            <div style={{ position: 'relative' }}>
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                style={{ width: '100%', padding: '0.5rem 2.25rem 0.5rem 0.5rem', border: '1px solid #ccc', borderRadius: '4px', boxSizing: 'border-box' }}
              />
              <button
                type="button"
                onClick={() => setShowPassword(v => !v)}
                aria-label={showPassword ? 'パスワードを非表示' : 'パスワードを表示'}
                style={{ position: 'absolute', right: '0.5rem', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: '#666', display: 'flex', alignItems: 'center' }}
              >
                {showPassword ? (
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
                    <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
                    <line x1="1" y1="1" x2="23" y2="23" />
                  </svg>
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                )}
              </button>
            </div>
          </div>
          {error && (
            <div style={{ color: '#c00', fontSize: '0.875rem', marginBottom: '1rem' }}>{error}</div>
          )}
          <button
            type="submit"
            disabled={loading}
            style={{ width: '100%', padding: '0.625rem', background: '#2563eb', color: '#fff', border: 'none', borderRadius: '4px', fontSize: '1rem', cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1 }}
          >
            {loading ? 'ログイン中...' : 'ログイン'}
          </button>
        </form>
      </div>
    </div>
  )
}
