import { useState } from 'react'
import { NavLink, useParams } from 'react-router-dom'
import { FileText, LayoutDashboard, Megaphone, Users, type LucideIcon } from 'lucide-react'

interface NavSection {
  sectionLabel?: string
  items: { label: string; icon: LucideIcon; path: string }[]
}

const NAV_SECTIONS: NavSection[] = [
  {
    sectionLabel: 'メニュー',
    items: [
      { label: 'ダッシュボード', icon: LayoutDashboard, path: 'dashboard' },
      { label: '顧客一覧', icon: Users, path: 'customers' },
      { label: '施策管理', icon: Megaphone, path: 'campaigns' },
      { label: 'レポート', icon: FileText, path: 'reports' },
    ],
  },
]

export function Sidebar() {
  const { storeId } = useParams<{ storeId: string }>()
  const [hoveredPath, setHoveredPath] = useState<string | null>(null)

  return (
    <aside
      className="app-sidebar"
      style={{
        width: 220,
        height: '100%',
        background: 'var(--sidebar-bg)',
        display: 'flex',
        flexDirection: 'column',
        flexShrink: 0,
        overflowY: 'auto',
      }}
    >
      <nav className="app-sidebar-nav" style={{ flex: 1 }}>
        {NAV_SECTIONS.map((section, si) => (
          <div key={si}>
            {section.sectionLabel && (
              <div
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  color: 'rgba(148,163,184,0.6)',
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                  padding: '16px 20px 6px',
                }}
              >
                {section.sectionLabel}
              </div>
            )}
            {section.items.map((item) => {
              const Icon = item.icon
              return (
                <NavLink
                  key={item.path}
                  className="app-sidebar-link"
                  to={`/stores/${storeId}/${item.path}`}
                  onMouseEnter={() => setHoveredPath(item.path)}
                  onMouseLeave={() => setHoveredPath(null)}
                  style={({ isActive }) => ({
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    padding: '10px 20px',
                    fontSize: 14,
                    fontWeight: isActive ? 600 : 400,
                    color: isActive ? 'var(--sidebar-text-active)' : 'var(--sidebar-text)',
                    borderLeft: isActive
                      ? '3px solid var(--sidebar-active-border)'
                      : '3px solid transparent',
                    background: isActive
                      ? 'rgba(245, 166, 35, 0.08)'
                      : hoveredPath === item.path
                        ? 'var(--sidebar-hover)'
                        : 'transparent',
                    transition: 'background 0.15s, color 0.15s',
                    cursor: 'pointer',
                  })}
                >
                  {({ isActive }) => (
                    <>
                      <Icon size={16} strokeWidth={isActive ? 2.5 : 1.75} />
                      {item.label}
                    </>
                  )}
                </NavLink>
              )
            })}
          </div>
        ))}
      </nav>
    </aside>
  )
}
