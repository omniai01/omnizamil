import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import type { DepsReport, HistoryRecord } from '../../electron/youtube/types'
import { PageHeader } from '../components/PageHeader'
import { StatCard } from '../components/StatCard'
import { formatDate, startOfWeek } from '../lib/format'
import { useJobs } from '../jobs/JobsContext'

export function DashboardPage() {
  const [history, setHistory] = useState<HistoryRecord[]>([])
  const [deps, setDeps] = useState<DepsReport | null>(null)
  const { processing } = useJobs()

  useEffect(() => {
    void window.shiftgrab.listHistory().then(setHistory)
    void window.shiftgrab.checkDeps().then(setDeps).catch(() => setDeps(null))
  }, [])
  const stats = useMemo(() => {
    const weekStart = startOfWeek().getTime()
    const week = history.filter((h) => new Date(h.finishedAt).getTime() >= weekStart)
    const success = history.filter((h) => h.status === 'success').length
    const failed = history.filter((h) => h.status === 'failed').length
    const videos = history.filter((h) => h.kind === 'video' || h.kind === 'bulk').length
    const channels = history.filter(
      (h) => h.kind === 'channel' || h.kind === 'playlist',
    ).length
    return {
      all: history.length,
      week: week.length,
      success,
      failed,
      videos,
      channels,
      recent: history.slice(0, 8),
    }
  }, [history])

  const depsOk = deps?.items.every((i) => i.ok) ?? null

  return (
    <PageHeader
      title="Dashboard"
      subtitle="Analytics, dependency health, and live job processing."
      actions={
        <div className="inline-actions">
          <Link className="btn btn-primary" to="/video">
            Video
          </Link>
          <Link className="btn btn-ghost" to="/jobs">
            Jobs
          </Link>
        </div>
      }
    >
      <div className="stat-grid">
        <StatCard label="This week" value={stats.week} hint="Finished jobs" />
        <StatCard label="All time" value={stats.all} />
        <StatCard label="Succeeded" value={stats.success} hint={`${stats.failed} failed`} />
        <StatCard
          label="Processing now"
          value={processing.length}
          hint={`${processing.filter((j) => j.status === 'processing').length} active`}
        />
      </div>

      <div className="panel deps-strip">
        <div>
          <strong>Dependencies</strong>
          <p className="muted">
            {depsOk == null
              ? 'Checking…'
              : depsOk
                ? 'Downloading Engine, Processing Studio, Challenge Runtime, and App Core look healthy.'
                : 'One or more engines need attention.'}
          </p>
        </div>
        <Link className="btn btn-ghost" to="/dependencies">
          Open check
        </Link>
      </div>

      <div className="panel">
        <div className="panel-head">
          <h3>Active jobs</h3>
          <Link className="btn btn-ghost btn-sm" to="/jobs">
            Open Processing
          </Link>
        </div>
        {processing.length === 0 ? (
          <p className="muted empty-inline">No active jobs. Queue something from Video or Channel.</p>
        ) : (
          <div className="easy-list">
            {processing.slice(0, 5).map((job) => (
              <div key={job.id} className="easy-row">
                <div className="easy-row-main">
                  <strong title={job.title}>{job.title}</strong>
                  <span className="status status-success">{job.status}</span>
                </div>
                <div className="easy-row-meta muted">
                  {Math.round(job.percent)}%
                  {job.speed ? ` · ${job.speed}` : ''}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="panel">
        <div className="panel-head">
          <h3>Recent history</h3>
          <Link to="/reports">Reports</Link>
        </div>
        {stats.recent.length === 0 ? (
          <p className="muted empty-inline">No downloads yet.</p>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Title</th>
                <th>Type</th>
                <th>Status</th>
                <th>When</th>
              </tr>
            </thead>
            <tbody>
              {stats.recent.map((row) => (
                <tr key={row.id}>
                  <td title={row.title}>{row.title}</td>
                  <td>{row.kind}</td>
                  <td>
                    <span className={`status status-${row.status}`}>{row.status}</span>
                  </td>
                  <td>{formatDate(row.finishedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </PageHeader>
  )
}
