import { useEffect, useMemo, useState } from 'react'
import type { HistoryRecord, HistoryStatus, MediaKind } from '../../electron/youtube/types'
import { PageHeader } from '../components/PageHeader'
import { StatCard } from '../components/StatCard'
import { formatAppError, formatDate } from '../lib/format'

function dayKey(iso: string) {
  return iso.slice(0, 10)
}

export function ReportsPage() {
  const [rows, setRows] = useState<HistoryRecord[]>([])
  const [kind, setKind] = useState<'all' | MediaKind>('all')
  const [status, setStatus] = useState<'all' | HistoryStatus>('all')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [exportPath, setExportPath] = useState<string | null>(null)

  useEffect(() => {
    void window.shiftgrab.listHistory().then(setRows)
  }, [])

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      if (kind !== 'all' && r.kind !== kind) return false
      if (status !== 'all' && r.status !== status) return false
      const t = new Date(r.finishedAt).getTime()
      if (from && t < new Date(from).getTime()) return false
      if (to) {
        const end = new Date(to)
        end.setHours(23, 59, 59, 999)
        if (t > end.getTime()) return false
      }
      return true
    })
  }, [rows, kind, status, from, to])

  const byDay = useMemo(() => {
    const map = new Map<string, number>()
    for (const r of filtered) {
      const k = dayKey(r.finishedAt)
      map.set(k, (map.get(k) || 0) + 1)
    }
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0])).slice(-14)
  }, [filtered])

  const maxDay = Math.max(1, ...byDay.map(([, n]) => n))

  const summary = useMemo(() => {
    const success = filtered.filter((r) => r.status === 'success').length
    const failed = filtered.filter((r) => r.status === 'failed').length
    const cancelled = filtered.filter((r) => r.status === 'cancelled').length
    return { total: filtered.length, success, failed, cancelled }
  }, [filtered])

  async function exportCsv() {
    const path = await window.shiftgrab.exportHistoryCsv()
    setExportPath(path)
  }

  return (
    <PageHeader
      title="Reports"
      subtitle="Filter local history and export a CSV."
      actions={
        <button className="btn btn-primary" onClick={() => void exportCsv()}>
          Export CSV
        </button>
      }
    >
      <div className="filters">
        <div className="field">
          <label>From</label>
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        </div>
        <div className="field">
          <label>To</label>
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </div>
        <div className="field">
          <label>Type</label>
          <select value={kind} onChange={(e) => setKind(e.target.value as typeof kind)}>
            <option value="all">All</option>
            <option value="video">Video</option>
            <option value="bulk">Bulk</option>
            <option value="playlist">Playlist</option>
            <option value="channel">Channel</option>
            <option value="social">Social</option>
          </select>
        </div>
        <div className="field">
          <label>Status</label>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as typeof status)}
          >
            <option value="all">All</option>
            <option value="success">Success</option>
            <option value="failed">Failed</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>
      </div>

      {exportPath ? <p className="hint ok-text">Saved report to {exportPath}</p> : null}

      <div className="stat-grid">
        <StatCard label="Jobs" value={summary.total} />
        <StatCard label="Success" value={summary.success} />
        <StatCard label="Failed" value={summary.failed} />
        <StatCard label="Cancelled" value={summary.cancelled} />
      </div>

      <div className="panel">
        <div className="panel-head">
          <h3>Last 14 active days</h3>
        </div>
        {byDay.length === 0 ? (
          <p className="muted empty-inline">No rows in this filter.</p>
        ) : (
          <div className="bar-chart">
            {byDay.map(([day, count]) => (
              <div key={day} className="bar-chart-row">
                <span className="bar-chart-label">{day}</span>
                <div className="bar-chart-track">
                  <i style={{ width: `${(count / maxDay) * 100}%` }} />
                </div>
                <span className="bar-chart-count">{count}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="panel">
        <div className="panel-head">
          <h3>Failed jobs (errors)</h3>
        </div>
        {filtered.filter((r) => r.status === 'failed' && r.error).length === 0 ? (
          <p className="muted empty-inline">No failed jobs in this filter.</p>
        ) : (
          <div className="easy-list">
            {filtered
              .filter((r) => r.status === 'failed' && r.error)
              .slice(0, 30)
              .map((row) => (
                <div key={`err-${row.id}`} className="easy-row" style={{ alignItems: 'flex-start' }}>
                  <div className="easy-row-main">
                    <strong title={row.title}>{row.title}</strong>
                    <span className="status status-failed">failed</span>
                  </div>
                  <p className="hint" style={{ margin: '6px 0 0', color: '#b42318' }}>
                    {formatAppError(row.error)}
                  </p>
                  <div className="easy-row-meta muted">{formatDate(row.finishedAt)}</div>
                </div>
              ))}
          </div>
        )}
      </div>

      <div className="panel">
        <div className="panel-head">
          <h3>Filtered rows</h3>
        </div>
        <table className="data-table">
          <thead>
            <tr>
              <th>Title</th>
              <th>Type</th>
              <th>Status</th>
              <th>Duration</th>
              <th>Error</th>
              <th>When</th>
            </tr>
          </thead>
          <tbody>
            {filtered.slice(0, 100).map((row) => (
              <tr key={row.id}>
                <td title={row.title}>{row.title}</td>
                <td>{row.kind}</td>
                <td>
                  <span className={`status status-${row.status}`}>{row.status}</span>
                </td>
                <td>{Math.round(row.durationMs / 1000)}s</td>
                <td className="error-cell" title={row.error || ''}>
                  {row.error ? formatAppError(row.error) : '—'}
                </td>
                <td>{formatDate(row.finishedAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </PageHeader>
  )
}
