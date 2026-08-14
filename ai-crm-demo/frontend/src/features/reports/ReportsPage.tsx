import { useMemo, useState } from 'react'
import { FileText, RefreshCw } from 'lucide-react'
import { useParams } from 'react-router-dom'
import { REPORT_STATUS_LABELS, REPORT_TYPE_LABELS, type Report } from './types'
import { useGenerateMonthlyReport, useReport, useReports } from './useReports'

function monthRange() {
  const now = new Date()
  const first = new Date(now.getFullYear(), now.getMonth(), 1)
  const last = new Date(now.getFullYear(), now.getMonth() + 1, 0)
  return {
    start: first.toISOString().slice(0, 10),
    end: last.toISOString().slice(0, 10),
  }
}

function ReportBadge({ report }: { report: Report }) {
  return (
    <span style={{ background: '#e0f2fe', color: '#0369a1', padding: '2px 8px', borderRadius: 4, fontSize: 12, fontWeight: 700 }}>
      {REPORT_TYPE_LABELS[report.report_type]}
    </span>
  )
}

function MarkdownPreview({ text }: { text: string }) {
  const lines = text.split('\n').filter(Boolean)
  return (
    <div style={{ lineHeight: 1.75, color: '#334155', whiteSpace: 'pre-wrap' }}>
      {lines.length ? lines.join('\n') : '本文はまだありません。'}
    </div>
  )
}

export function ReportsPage() {
  const { storeId } = useParams<{ storeId: string }>()
  const initialRange = useMemo(() => monthRange(), [])
  const [periodStart, setPeriodStart] = useState(initialRange.start)
  const [periodEnd, setPeriodEnd] = useState(initialRange.end)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const reportsQuery = useReports(storeId)
  const selectedReportQuery = useReport(storeId, selectedId)
  const generate = useGenerateMonthlyReport(storeId ?? '')

  const reports = reportsQuery.data?.data ?? []
  const selected = selectedReportQuery.data ?? reports[0] ?? null

  async function handleGenerate() {
    if (!storeId) return
    setError(null)
    if (!periodStart || !periodEnd) {
      setError('対象期間を入力してください。')
      return
    }
    try {
      const report = await generate.mutateAsync({ period_start: periodStart, period_end: periodEnd })
      setSelectedId(report.id)
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { error?: { message?: string } } } })
          ?.response?.data?.error?.message ?? '月次レポートの生成に失敗しました。'
      setError(msg)
    }
  }

  if (!storeId) return <div>店舗IDが指定されていません。</div>

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>レポート</h1>
        <button
          onClick={() => reportsQuery.refetch()}
          style={{ display: 'flex', alignItems: 'center', gap: 6, border: '1px solid #cbd5e1', background: '#fff', borderRadius: 6, padding: '8px 12px', cursor: 'pointer' }}
        >
          <RefreshCw size={14} />
          更新
        </button>
      </div>

      <section style={{ background: '#fff', borderRadius: 8, padding: 18, boxShadow: 'var(--card-shadow)', marginBottom: 18 }}>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 12, flexWrap: 'wrap' }}>
          <label style={fieldLabelStyle}>
            開始日
            <input type="date" value={periodStart} onChange={(e) => setPeriodStart(e.target.value)} style={inputStyle} />
          </label>
          <label style={fieldLabelStyle}>
            終了日
            <input type="date" value={periodEnd} onChange={(e) => setPeriodEnd(e.target.value)} style={inputStyle} />
          </label>
          <button
            onClick={handleGenerate}
            disabled={generate.isPending}
            style={{
              height: 38,
              padding: '0 16px',
              border: 'none',
              borderRadius: 6,
              background: generate.isPending ? '#9ca3af' : 'var(--brand)',
              color: '#fff',
              fontWeight: 700,
              cursor: generate.isPending ? 'default' : 'pointer',
            }}
          >
            {generate.isPending ? '生成中…' : '月次レポート生成'}
          </button>
        </div>
        {error && <div style={{ color: 'var(--danger)', fontSize: 13, marginTop: 10 }}>{error}</div>}
      </section>

      <div style={{ display: 'grid', gridTemplateColumns: '320px minmax(0, 1fr)', gap: 18, alignItems: 'start' }}>
        <section style={{ background: '#fff', borderRadius: 8, boxShadow: 'var(--card-shadow)', overflow: 'hidden' }}>
          <div style={{ padding: '12px 14px', borderBottom: '1px solid #e5e7eb', fontWeight: 700 }}>レポート一覧</div>
          {reportsQuery.isLoading ? (
            <div style={{ padding: 18, color: '#9ca3af' }}>読み込み中…</div>
          ) : reports.length === 0 ? (
            <div style={{ padding: 24, color: '#6b7280', textAlign: 'center' }}>
              <FileText size={32} strokeWidth={1.4} style={{ opacity: 0.45, marginBottom: 8 }} />
              <div>レポートはまだありません。</div>
            </div>
          ) : (
            reports.map((report) => {
              const active = (selected?.id ?? reports[0]?.id) === report.id
              return (
                <button
                  key={report.id}
                  onClick={() => setSelectedId(report.id)}
                  style={{
                    width: '100%',
                    textAlign: 'left',
                    border: 'none',
                    borderBottom: '1px solid #f1f5f9',
                    background: active ? '#f8fafc' : '#fff',
                    padding: 14,
                    cursor: 'pointer',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginBottom: 7 }}>
                    <ReportBadge report={report} />
                    <span style={{ fontSize: 12, color: '#64748b' }}>{REPORT_STATUS_LABELS[report.status]}</span>
                  </div>
                  <div style={{ fontWeight: 700, marginBottom: 5 }}>{report.title}</div>
                  <div style={{ color: '#64748b', fontSize: 12 }}>
                    {report.period_start ?? '—'} 〜 {report.period_end ?? '—'}
                  </div>
                </button>
              )
            })
          )}
        </section>

        <section style={{ background: '#fff', borderRadius: 8, padding: 22, boxShadow: 'var(--card-shadow)', minHeight: 360 }}>
          {selectedReportQuery.isLoading && selectedId ? (
            <div style={{ color: '#9ca3af' }}>読み込み中…</div>
          ) : selected ? (
            <>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 10 }}>
                <ReportBadge report={selected} />
                <span style={{ color: '#64748b', fontSize: 12 }}>
                  {selected.period_start ?? '—'} 〜 {selected.period_end ?? '—'}
                </span>
              </div>
              <h2 style={{ fontSize: 20, margin: '0 0 12px' }}>{selected.title}</h2>
              {selected.summary && (
                <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 6, padding: 12, marginBottom: 18, lineHeight: 1.7 }}>
                  {selected.summary}
                </div>
              )}
              <MarkdownPreview text={selected.body_markdown} />
            </>
          ) : (
            <div style={{ color: '#64748b' }}>左の一覧からレポートを選択してください。</div>
          )}
        </section>
      </div>
    </div>
  )
}

const fieldLabelStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 5,
  color: '#475569',
  fontSize: 12,
  fontWeight: 700,
}

const inputStyle: React.CSSProperties = {
  height: 38,
  border: '1px solid #cbd5e1',
  borderRadius: 6,
  padding: '0 10px',
  fontSize: 14,
}
