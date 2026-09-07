import { useEffect, useState } from 'react'
import type { ActiveJob } from '../../electron/youtube/types'
import { PageHeader } from '../components/PageHeader'
import { ProgressBar } from '../components/ProgressBar'
import { formatDate } from '../lib/format'
import { youtubeThumb } from '../lib/media'
import { useJobs } from '../jobs/JobsContext'

type Tab = 'processing' | 'finished'

export function JobsPage() {
  const { processing, finished, refresh } = useJobs()
  const [tab, setTab] = useState<Tab>('processing')

  useEffect(() => {
    void refresh()
  }, [refresh])

  useEffect(() => {
    if (processing.length > 0) setTab('processing')
  }, [processing.length])

  const list: ActiveJob[] = tab === 'processing' ? processing : finished
  const activeProcessing = processing.filter((j) => j.status === 'processing').length
  const finalizing = processing.filter((j) => j.phase === 'finalizing').length

  return (
    <PageHeader
      title="Jobs"
      subtitle="Active downloads stay here even if you leave — Processing shows live work, then Finished."
      actions={
        <div className="inline-actions">
          <button className="btn btn-ghost" onClick={() => void refresh()}>
            Refresh
          </button>
          {tab === 'processing' && processing.length > 0 ? (
            <button
              className="btn btn-danger"
              onClick={() => void window.shiftgrab.cancelAllJobs()}
            >
              Cancel all
            </button>
          ) : null}
          {tab === 'finished' ? (
            <button
              className="btn btn-ghost"
              onClick={() => void window.shiftgrab.clearFinishedJobs()}
            >
              Clear finished
            </button>
          ) : null}
        </div>
      }
    >
      <div className="tabs">
        <button
          className={tab === 'processing' ? 'tab active' : 'tab'}
          onClick={() => setTab('processing')}
        >
          Processing ({processing.length})
        </button>
        <button
          className={tab === 'finished' ? 'tab active' : 'tab'}
          onClick={() => setTab('finished')}
        >
          Finished ({finished.length})
        </button>
      </div>

      <div className="stat-grid stat-grid-3">
        <div className="stat-card">
          <div className="stat-label">Active now</div>
          <div className="stat-value">{activeProcessing}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Finalizing</div>
          <div className="stat-value">{finalizing}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">In this tab</div>
          <div className="stat-value">{list.length}</div>
        </div>
      </div>

      {list.length === 0 ? (
        <div className="empty-panel">
          <h2>{tab === 'processing' ? 'Nothing processing' : 'No finished jobs yet'}</h2>
          <p>
            {tab === 'processing'
              ? finished.length > 0
                ? 'No active jobs — check the Finished tab for completed or failed ones.'
                : 'Queue downloads from Video, Bulk, Channel, or All-in-one.'
              : 'Finished and failed jobs appear here with thumbnails.'}
          </p>
          {tab === 'processing' && finished.length > 0 ? (
            <button className="btn btn-ghost" onClick={() => setTab('finished')}>
              View Finished ({finished.length})
            </button>
          ) : null}
        </div>
      ) : (
        <div className="easy-list">
          {list.map((job) => {
            const phaseLabel =
              job.phase === 'finalizing'
                ? 'Finalizing'
                : job.phase === 'queued' || job.status === 'queued'
                  ? 'Queued'
                  : 'Downloading'
            return (
              <div key={job.id} className="easy-row job-row">
                <div className="easy-row-main job-main-with-thumb">
                  {(() => {
                    const thumb = youtubeThumb(job.thumbnail || job.url)
                    return thumb ? (
                      <img className="job-thumb" src={thumb} alt="" loading="lazy" />
                    ) : (
                      <div className="job-thumb job-thumb-empty" />
                    )
                  })()}
                  <div className="job-title-block">
                    <strong title={job.title}>{job.title}</strong>
                    <span className="muted">
                      {job.kind} · {job.qualityId}
                    </span>
                  </div>
                  <span
                    className={`status status-${
                      job.status === 'done'
                        ? 'success'
                        : job.status === 'processing' || job.status === 'queued'
                          ? 'success'
                          : job.status === 'failed'
                            ? 'failed'
                            : 'cancelled'
                    }`}
                  >
                    {job.status === 'processing' && job.phase === 'finalizing'
                      ? 'finalizing'
                      : job.status}
                  </span>
                </div>
                {(job.status === 'processing' || job.status === 'queued') && (
                  <ProgressBar
                    percent={job.percent}
                    label={phaseLabel}
                    detail={`${Math.round(job.percent)}%${job.speed ? ` · ${job.speed}` : ''}${
                      job.currentItem && job.totalItems
                        ? ` · ${job.currentItem}/${job.totalItems}`
                        : ''
                    }`}
                  />
                )}
                {job.error ? <p className="error tight">{job.error}</p> : null}
                <div className="easy-row-actions">
                  <span className="muted">{formatDate(job.updatedAt)}</span>
                  {(job.status === 'queued' || job.status === 'processing') && (
                    <button
                      className="btn btn-danger btn-sm"
                      onClick={() => void window.shiftgrab.cancelJob(job.id)}
                    >
                      Cancel
                    </button>
                  )}
                  {job.filePath && job.status === 'done' ? (
                    <button
                      className="btn btn-ghost btn-sm"
                      onClick={() => void window.shiftgrab.reveal(job.filePath!)}
                    >
                      Reveal
                    </button>
                  ) : null}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </PageHeader>
  )
}
