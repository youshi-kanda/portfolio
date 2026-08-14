import { Outlet } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { TopHeader } from './TopHeader'

export function Layout() {
  return (
    <div className="app-shell" style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      <TopHeader />
      <div
        className="app-body"
        style={{
          display: 'flex',
          marginTop: 52,
          height: 'calc(100vh - 52px)',
          overflow: 'hidden',
        }}
      >
        <Sidebar />
        <main
          className="app-main"
          style={{
            flex: 1,
            height: '100%',
            overflowY: 'auto',
            background: 'var(--app-bg)',
            padding: '28px 32px',
          }}
        >
          <div className="app-content" style={{ maxWidth: 1024, margin: '0 auto' }}>
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  )
}
