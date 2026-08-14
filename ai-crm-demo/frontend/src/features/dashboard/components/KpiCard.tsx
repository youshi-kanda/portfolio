interface KpiCardProps {
  label: string
  value: string | number
  sub?: string
  accent?: boolean
}

export function KpiCard({ label, value, sub, accent }: KpiCardProps) {
  return (
    <div
      style={{
        background: 'var(--card-bg)',
        borderRadius: 8,
        padding: '14px 18px',
        boxShadow: 'var(--card-shadow)',
        minWidth: 130,
        flex: '1 1 130px',
        borderTop: accent ? '3px solid var(--brand)' : '3px solid transparent',
      }}
    >
      <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4, whiteSpace: 'nowrap' }}>
        {label}
      </div>
      <div
        style={{
          fontSize: 24,
          fontWeight: 700,
          color: accent ? 'var(--brand-dark)' : 'var(--text-primary)',
          lineHeight: 1.2,
        }}
      >
        {value}
      </div>
      {sub && (
        <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>{sub}</div>
      )}
    </div>
  )
}
