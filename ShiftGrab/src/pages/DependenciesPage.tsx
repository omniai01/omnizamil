import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import type { DepsReport } from '../../electron/youtube/types'
import { PageHeader } from '../components/PageHeader'
import { formatAppError, formatDate } from '../lib/format'
import { displayVersion } from '../lib/depsDisplay'
import { useJobs } from '../jobs/JobsContext'

const AUTO_MS = 60_000

export function DependenciesPage() {
  const [report, setReport] = useState<DepsReport | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { processing } = useJobs()
  const [historyCount, setHistoryCount] = useState(0)

  async function check(silent = false) {
    if (!silent) setBusy(true)
    setError(null)
    try {
      setReport(await window.shiftgrab.checkDeps())
      const hist = await window.shiftgrab.listHistory()
      setHistoryCount(hist.filter((h) => h.status === 'success').length)
    } catch (err) {
      setError(formatAppError(err))
    } finally {
      if (!silent) setBusy(false)
    }
  }

  async function repair() {
    setBusy(true)
    setError(null)
    try {
      setReport(await window.shiftgrab.repairDeps())
    } catch (err) {
      setError(formatAppError(err))
    } finally {
      setBusy(false)
    }
  }

  useEffect(() => {
    void check()
    const t = window.setInterval(() => void check(true), AUTO_MS)
    return () => window.clearInterval(t)
  }, [])

  const unhealthy = report?.items.filter((i) => !i.ok).length ?? 0

  return (
    <PageHeader
      title="Dependencies"
      subtitle="Engines run locally. Auto-checked every minute — repair if anything goes invalid."
      actions={
        <div className="inline-actions">
          <button className="btn btn-ghost" disabled={busy} onClick={() => void check()}>
            Re-check
          </button>
          <button className="btn btn-primary" disabled={busy} onClick={() => void repair()}>
            {busy ? 'Working…' : unhealthy > 0 ? 'Reinstall / Repair' : 'Update engines'}
          </button>
        </div>
      }
    >
      {error ? <p className="error">{error}</p> : null}

      <div className="stat-grid stat-grid-3">
        <div className="stat-card">
          <div className="stat-label">Engine health</div>
          <div className="stat-value">
            {report ? `${report.items.filter((i) => i.ok).length}/${report.items.length}` : '—'}
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Jobs processing</div>
          <div className="stat-value">{processing.length}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Library successes</div>
          <div className="stat-value">{historyCount}</div>
        </div>
      </div>

      {report ? (
        <p className="hint">
          Last checked {formatDate(report.checkedAt)} · auto every 60s
          {unhealthy > 0 ? ` · ${unhealthy} need attention` : ' · all running'}
        </p>
      ) : (
        <p className="hint">Checking…</p>
      )}

      <div className="easy-list">
        {(report?.items || []).map((item) => (
          <div key={item.id} className={`easy-row dep-row ${item.ok ? 'ok' : 'bad'}`}>
            <div className="easy-row-main">
              <div className="dep-copy">
                <strong>{item.label}</strong>
                <span className="muted">{item.detail || (item.ok ? 'Running' : 'Invalid')}</span>
              </div>
              <span className={`status ${item.ok ? 'status-success' : 'status-failed'}`}>
                {item.ok ? 'healthy' : 'invalid'}
              </span>
            </div>
            <div className="easy-row-meta mono">
              <span>{displayVersion(item)}</span>
              <span>{item.locationHint}</span>
            </div>
            {!item.ok && item.id !== 'app' ? (
              <div className="easy-row-actions">
                <button
                  className="btn btn-ghost btn-sm"
                  disabled={busy}
                  onClick={() => void repair()}
                >
                  Reinstall
                </button>
              </div>
            ) : null}
          </div>
        ))}
      </div>

      <p className="hint">
        Full analytics live on <Link to="/dashboard">Dashboard</Link> and{' '}
        <Link to="/reports">Reports</Link>.
      </p>
    </PageHeader>
  )
}
