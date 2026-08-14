import type { MonthlyFocus } from '../types'

const PURPOSE_COLORS: Record<string, string> = {
  second_visit: '#2563EB',
  dormant_reactivation: '#DC2626',
  pre_dormant_prevention: '#F5A623',
  new_customer_acquisition: '#059669',
  repeat_upsell: '#7C3AED',
  data_maintenance: '#64748B',
  data_setup: '#64748B',
}

const CONFIDENCE_LABEL: Record<MonthlyFocus['confidence'], string> = {
  high: '高',
  medium: '中',
  low: '低',
}

interface Props {
  focus: MonthlyFocus
}

export function MonthlyFocusCard({ focus }: Props) {
  const accentColor = PURPOSE_COLORS[focus.purpose_code] ?? '#64748B'

  return (
    <div
      style={{
        background: 'var(--card-bg)',
        borderRadius: 8,
        boxShadow: 'var(--card-shadow)',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          background: accentColor,
          padding: '10px 20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <span style={{ color: '#fff', fontWeight: 700, fontSize: 15 }}>
          {focus.purpose}
        </span>
        <span
          style={{
            color: '#fff',
            fontSize: 12,
            background: 'rgba(255,255,255,0.2)',
            borderRadius: 999,
            padding: '2px 10px',
          }}
        >
          信頼度 {CONFIDENCE_LABEL[focus.confidence]}
        </span>
      </div>

      <div style={{ padding: '16px 20px' }}>
        <p style={{ fontSize: 14, color: '#374151', margin: '0 0 12px', lineHeight: 1.7 }}>
          {focus.reason}
        </p>

        {focus.cautions.length > 0 && (
          <div
            style={{
              borderTop: '1px solid #f3f4f6',
              paddingTop: 10,
              display: 'flex',
              flexDirection: 'column',
              gap: 4,
            }}
          >
            {focus.cautions.map((c) => (
              <div key={c} style={{ fontSize: 12, color: '#92400e', display: 'flex', gap: 6 }}>
                <span>⚠</span>
                <span>{c}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
