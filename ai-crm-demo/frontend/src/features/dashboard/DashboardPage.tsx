import { useParams } from 'react-router-dom'
import { KpiCard } from './components/KpiCard'
import { MonthlyFocusCard } from './components/MonthlyFocusCard'
import { useDashboard } from './hooks/useDashboard'
import type { AiDiagnosis, WeeklyAction } from './types'

function fmt(n: number): string {
  return n.toLocaleString('ja-JP')
}

function labelForLevel(level: AiDiagnosis['priority'] | WeeklyAction['priority']): string {
  if (level === 'high') return '高'
  if (level === 'medium') return '中'
  return '低'
}

function colorForLevel(level: AiDiagnosis['priority'] | WeeklyAction['priority']): string {
  if (level === 'high') return '#DC2626'
  if (level === 'medium') return '#F5A623'
  return '#64748B'
}

export function DashboardPage() {
  const { storeId } = useParams<{ storeId: string }>()
  const { data, isLoading, isError } = useDashboard(storeId)

  if (isLoading) {
    return <div>読み込み中...</div>
  }

  if (isError || !data) {
    return (
      <div style={{ color: 'var(--danger)' }}>
        データの取得に失敗しました。再度お試しください。
      </div>
    )
  }

  return (
    <div>
      <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 24, color: 'var(--text-primary)' }}>
        ダッシュボード
      </h1>

      {/* 今月の重点目的カード */}
      <section style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 15, fontWeight: 600, color: '#374151', marginBottom: 12 }}>
          今月の重点目的
        </h2>
        <MonthlyFocusCard focus={data.monthly_focus} />
      </section>

      {/* AI診断カード */}
      <section style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 15, fontWeight: 600, color: '#374151', marginBottom: 12 }}>
          AI診断モック
        </h2>
        <div
          style={{
            background: 'var(--card-bg)',
            borderRadius: 8,
            padding: 20,
            boxShadow: 'var(--card-shadow)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
            <div>
              <div style={{ fontSize: 13, color: '#6b7280', marginBottom: 6 }}>
                {data.ai_diagnosis.main_issue}
              </div>
              <div style={{ fontSize: 16, fontWeight: 700, color: '#111827', marginBottom: 8 }}>
                {data.ai_diagnosis.summary}
              </div>
            </div>
            <div
              style={{
                alignSelf: 'flex-start',
                color: colorForLevel(data.ai_diagnosis.priority),
                background: 'var(--app-bg)',
                borderRadius: 999,
                padding: '4px 10px',
                fontSize: 12,
                fontWeight: 700,
                whiteSpace: 'nowrap',
              }}
            >
              優先度 {labelForLevel(data.ai_diagnosis.priority)}
            </div>
          </div>
          <p style={{ fontSize: 14, color: '#374151', margin: '8px 0 12px' }}>
            {data.ai_diagnosis.hypothesis}
          </p>
          <div style={{ fontSize: 13, color: '#6b7280', marginBottom: 8 }}>
            信頼度: {labelForLevel(data.ai_diagnosis.confidence)}
          </div>
          {data.ai_diagnosis.reasons.length > 0 && (
            <ul style={{ margin: '8px 0 0', paddingLeft: 20, color: '#374151', fontSize: 13 }}>
              {data.ai_diagnosis.reasons.map((reason) => (
                <li key={reason}>{reason}</li>
              ))}
            </ul>
          )}
          {data.ai_diagnosis.cautions.length > 0 && (
            <div style={{ marginTop: 12, color: '#92400e', fontSize: 13 }}>
              {data.ai_diagnosis.cautions.join(' / ')}
            </div>
          )}
          {data.ai_diagnosis.missing_data.length > 0 && (
            <div style={{ marginTop: 8, color: '#6b7280', fontSize: 13 }}>
              不足データ: {data.ai_diagnosis.missing_data.join('、')}
            </div>
          )}
        </div>
      </section>

      {/* 今週のアクション */}
      <section style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 15, fontWeight: 600, color: '#374151', marginBottom: 12 }}>
          今週のアクション
        </h2>
        {data.weekly_actions.length > 0 ? (
          <div style={{ display: 'grid', gap: 12 }}>
            {data.weekly_actions.map((action) => (
              <div
                key={action.id}
                style={{
                  background: 'var(--card-bg)',
                  borderRadius: 8,
                  padding: 18,
                  boxShadow: 'var(--card-shadow)',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                  <div>
                    <div style={{ fontSize: 15, fontWeight: 700, color: '#111827' }}>
                      {action.title}
                    </div>
                    <div style={{ fontSize: 13, color: '#6b7280', marginTop: 4 }}>
                      {action.target} / {action.due_label} / 目安 {fmt(action.estimated_minutes)}分
                    </div>
                  </div>
                  <div
                    style={{
                      color: colorForLevel(action.priority),
                      fontSize: 12,
                      fontWeight: 700,
                      whiteSpace: 'nowrap',
                    }}
                  >
                    優先度 {labelForLevel(action.priority)}
                  </div>
                </div>
                <div style={{ fontSize: 13, color: '#374151', marginTop: 10 }}>
                  目的: {action.purpose}
                </div>
                <div style={{ fontSize: 13, color: '#374151', marginTop: 6 }}>
                  成果指標: {action.success_metric}
                </div>
                {action.steps.length > 0 && (
                  <ul style={{ margin: '10px 0 0', paddingLeft: 20, color: '#374151', fontSize: 13 }}>
                    {action.steps.map((step) => (
                      <li key={step}>{step}</li>
                    ))}
                  </ul>
                )}
                {action.cautions.length > 0 && (
                  <div style={{ marginTop: 10, color: '#92400e', fontSize: 13 }}>
                    {action.cautions.join(' / ')}
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div
            style={{
              background: 'var(--card-bg)',
              borderRadius: 8,
              padding: '16px 20px',
              boxShadow: 'var(--card-shadow)',
              color: 'var(--text-secondary)',
              fontSize: 14,
            }}
          >
            今週のアクション候補はありません。
          </div>
        )}
      </section>

      {/* 顧客数KPI */}
      <section style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 12 }}>
          顧客状況
        </h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 12 }}>
          <KpiCard label="総顧客数" value={fmt(data.total_customers)} accent />
          <KpiCard label="今月の新規" value={fmt(data.new_customers_this_month)} sub="人" accent />
        </div>
      </section>

      {/* 顧客状態内訳 */}
      <section style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 12 }}>
          顧客状態内訳
        </h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 12 }}>
          <KpiCard label="アクティブ" value={fmt(data.active_customers)} sub="人" />
          <KpiCard label="リスク" value={fmt(data.at_risk_customers)} sub="人" />
          <KpiCard label="休眠予備軍" value={fmt(data.pre_dormant_customers)} sub="人" />
          <KpiCard label="休眠" value={fmt(data.dormant_customers)} sub="人" />
          <KpiCard label="リピーター" value={fmt(data.repeat_customers)} sub="人" />
          <KpiCard
            label="初回来店後フォロー対象"
            value={fmt(data.after_first_visit_follow_targets)}
            sub="人"
          />
        </div>
      </section>

      {/* 今月の実績 */}
      <section style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 12 }}>
          今月の実績
        </h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 12 }}>
          <KpiCard
            label="売上合計"
            value={`¥${fmt(data.total_sales_this_month)}`}
          />
          <KpiCard label="来店件数" value={fmt(data.visit_count_this_month)} sub="件" />
          <KpiCard
            label="客単価"
            value={`¥${fmt(data.average_spend_per_visit)}`}
          />
        </div>
      </section>

      {/* 人気メニュー */}
      <section>
        <h2 style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 12 }}>
          今月の人気メニュー
        </h2>
        {data.top_menus.length > 0 ? (
          <div
            style={{
              background: 'var(--card-bg)',
              borderRadius: 8,
              overflow: 'hidden',
              boxShadow: 'var(--card-shadow)',
            }}
          >
            {data.top_menus.map((m, i) => (
              <div
                key={m.name}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '12px 20px',
                  borderBottom: i < data.top_menus.length - 1 ? '1px solid #f3f4f6' : 'none',
                }}
              >
                <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span
                    style={{
                      fontSize: 12,
                      fontWeight: 700,
                      color: '#6b7280',
                      width: 20,
                      textAlign: 'center',
                    }}
                  >
                    {i + 1}
                  </span>
                  <span style={{ fontSize: 14, color: '#111827' }}>{m.name}</span>
                </span>
                <span style={{ fontSize: 14, fontWeight: 600, color: '#374151' }}>
                  {fmt(m.count)}件
                </span>
              </div>
            ))}
          </div>
        ) : (
          <div
            style={{
              background: 'var(--card-bg)',
              borderRadius: 8,
              padding: '16px 20px',
              boxShadow: 'var(--card-shadow)',
              color: 'var(--text-secondary)',
              fontSize: 14,
            }}
          >
            データなし
          </div>
        )}
      </section>
    </div>
  )
}
