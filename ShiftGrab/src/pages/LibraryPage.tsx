import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import type { HistoryRecord } from '../../electron/youtube/types'
import { PageHeader } from '../components/PageHeader'
import { formatDate, formatDuration } from '../lib/format'
import { youtubeThumb } from '../lib/media'

export function LibraryPage() {
  const [rows, setRows] = useState<HistoryRecord[]>([])
  const [query, setQuery] = useState('')

  async function refresh() {
    setRows(await window.shiftgrab.listHistory())
  }

  useEffect(() => {
    void refresh()
  }, [])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    const success = rows.filter((r) => r.status === 'success')
    if (!q) return success
    return success.filter(
      (r) =>
        r.title.toLowerCase().includes(q) ||
        r.url.toLowerCase().includes(q) ||
        r.kind.toLowerCase().includes(q),
    )
  }, [rows, query])

  return (
    <PageHeader
      title="Library"
      subtitle="Finished downloads saved on this machine."
      actions={
        <button className="btn btn-ghost" onClick={() => void refresh()}>
          Refresh
        </button>
      }
    >
      <div className="toolbar-row">
        <input
          className="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search title, URL, type…"
        />
      </div>

      {filtered.length === 0 ? (
        <div className="empty-panel">
          <h2>Nothing here yet</h2>
          <p>
            Successful downloads appear here.{' '}
            <Link to="/video">Grab a video</Link>.
          </p>
        </div>
      ) : (
        <div className="media-list">
          {filtered.map((row) => {
            const thumb = youtubeThumb(row.thumbnail || row.url)
            return (
              <div key={row.id} className="media-row media-row-static">
                {thumb ? (
                  <img className="media-thumb" src={thumb} alt="" loading="lazy" />
                ) : (
                  <div className="media-thumb media-thumb-empty" />
                )}
                <div className="media-body">
                  <strong title={row.title}>{row.title}</strong>
                  <span className="media-meta">
                    <span>{row.kind}</span>
                    <span>·</span>
                    <span>{row.quality}</span>
                    {row.mediaDurationSeconds ? (
                      <>
                        <span>·</span>
                        <span>{formatDuration(row.mediaDurationSeconds)}</span>
                      </>
                    ) : null}
                    <span>·</span>
                    <span>{formatDate(row.finishedAt)}</span>
                  </span>
                </div>
                <div className="media-actions">
                  {row.filePath ? (
                    <button
                      className="btn btn-ghost btn-sm"
                      onClick={() => void window.shiftgrab.reveal(row.filePath!)}
                    >
                      Reveal
                    </button>
                  ) : null}
                  <Link
                    className="btn btn-ghost btn-sm"
                    to={row.kind === 'channel' || row.kind === 'playlist' ? '/channel' : '/video'}
                  >
                    Re-open
                  </Link>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </PageHeader>
  )
}
