import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import type { AppSettings, MediaInfo, QualityOption } from '../../electron/youtube/types'
import { PageHeader } from '../components/PageHeader'
import { PreviewRow } from '../components/PreviewRow'
import { formatAppError, formatDuration } from '../lib/format'
import { youtubeThumb } from '../lib/media'
import { useJobs } from '../jobs/JobsContext'

const QUALITIES: QualityOption[] = [
  { id: 'best', label: 'Best', height: null, audioOnly: false },
  { id: '1080', label: '1080p', height: 1080, audioOnly: false },
  { id: '720', label: '720p', height: 720, audioOnly: false },
  { id: '480', label: '480p', height: 480, audioOnly: false },
  { id: 'audio', label: 'Audio (MP3)', height: null, audioOnly: true },
]

type Mode = 'single' | 'bulk'

type BulkRow = {
  id: string
  url: string
  status: 'pending' | 'loading' | 'ok' | 'error'
  error?: string
  info?: MediaInfo
}

function splitUrls(text: string): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const line of text.split(/[\n\r]+/)) {
    const u = line.trim()
    if (!u || seen.has(u)) continue
    seen.add(u)
    out.push(u)
  }
  return out
}

function platformLabel(url: string): string {
  if (/tiktok\.com/i.test(url)) return 'TikTok'
  if (/instagram\.com/i.test(url)) return 'Instagram'
  if (/facebook\.com|fb\.watch/i.test(url)) return 'Facebook'
  if (/youtube\.com|youtu\.be/i.test(url)) return 'YouTube'
  if (/x\.com|twitter\.com/i.test(url)) return 'X'
  if (/vimeo\.com/i.test(url)) return 'Vimeo'
  return 'Social'
}

export function SocialPage() {
  const navigate = useNavigate()
  const { refresh } = useJobs()
  const [settings, setSettings] = useState<AppSettings | null>(null)
  const [mode, setMode] = useState<Mode>('single')
  const [url, setUrl] = useState('')
  const [bulkText, setBulkText] = useState('')
  const [info, setInfo] = useState<MediaInfo | null>(null)
  const [rows, setRows] = useState<BulkRow[]>([])
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [qualityId, setQualityId] = useState('best')
  const [saveDir, setSaveDir] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [extractTranscript, setExtractTranscript] = useState(false)
  const [saveDescription, setSaveDescription] = useState(false)

  useEffect(() => {
    void window.shiftgrab.getSettings().then((s) => {
      setSettings(s)
      setSaveDir(s.defaultSaveDir)
      setQualityId(s.defaultQualityId || 'best')
      setExtractTranscript(Boolean(s.extractTranscript))
      setSaveDescription(Boolean(s.saveDescription))
    })
  }, [])

  const quality = useMemo(
    () => QUALITIES.find((q) => q.id === qualityId) || QUALITIES[0],
    [qualityId],
  )

  const okRows = rows.filter((r) => r.status === 'ok' && r.info)
  const selectedOk = okRows.filter((r) => selected.has(r.id))

  async function fetchAny() {
    setError(null)
    setMessage(null)
    setInfo(null)
    setLoading(true)
    try {
      const data = await window.shiftgrab.getInfo(url, { social: true })
      setInfo(data)
    } catch (err) {
      setError(formatAppError(err))
    } finally {
      setLoading(false)
    }
  }

  async function fetchBulk() {
    const urls = splitUrls(bulkText)
    if (!urls.length) {
      setError('Paste at least one URL (one per line).')
      return
    }
    setError(null)
    setMessage(null)
    setLoading(true)
    const next: BulkRow[] = urls.map((u, i) => ({
      id: `${i}-${u.slice(0, 48)}`,
      url: u,
      status: 'loading',
    }))
    setRows(next)
    setSelected(new Set())

    const settled: BulkRow[] = []
    for (let i = 0; i < next.length; i++) {
      const row = next[i]
      try {
        const data = await window.shiftgrab.getInfo(row.url, { social: true })
        settled.push({ ...row, status: 'ok', info: data })
      } catch (err) {
        settled.push({
          ...row,
          status: 'error',
          error: err instanceof Error ? err.message : String(err),
        })
      }
      setRows([...settled, ...next.slice(i + 1)])
    }

    const okIds = settled.filter((r) => r.status === 'ok').map((r) => r.id)
    setSelected(new Set(okIds))
    setMessage(
      `${okIds.length} ready · ${settled.length - okIds.length} failed · mixed platforms OK.`,
    )
    setLoading(false)
  }

  async function queueSingle() {
    if (!info || !saveDir) {
      setError('Fetch media and choose a save folder.')
      return
    }
    const created = await window.shiftgrab.enqueueJobs([
      {
        url: info.url,
        title: info.title,
        kind: 'social',
        qualityId: quality.id,
        height: quality.height,
        audioOnly: quality.audioOnly || Boolean(info.isImage),
        saveDir,
        thumbnail: info.thumbnail,
        extractTranscript,
        saveDescription,
      },
    ])
    if (!created.length) {
      setError('Could not queue this job.')
      return
    }
    setMessage('Queued — opening Jobs → Processing.')
    await refresh()
    navigate('/jobs')
  }

  async function queueBulk() {
    if (!saveDir) {
      setError('Choose a save folder first.')
      return
    }
    if (!selectedOk.length) {
      setError('Select at least one ready item.')
      return
    }
    const created = await window.shiftgrab.enqueueJobs(
      selectedOk.map((r) => ({
        url: r.info!.url,
        title: r.info!.title,
        kind: 'social' as const,
        qualityId: quality.id,
        height: quality.height,
        audioOnly: quality.audioOnly || Boolean(r.info!.isImage),
        saveDir,
        thumbnail: r.info!.thumbnail,
        extractTranscript,
        saveDescription,
      })),
    )
    if (!created.length) {
      setError('Could not queue jobs.')
      return
    }
    setMessage(`Queued ${created.length} — opening Jobs → Processing.`)
    await refresh()
    navigate('/jobs')
  }

  function toggle(id: string) {
    setSelected((prev) => {
      const n = new Set(prev)
      if (n.has(id)) n.delete(id)
      else n.add(id)
      return n
    })
  }

  return (
    <PageHeader
      title="All-in-one"
      subtitle="Single or bulk — paste TikTok, Instagram, Facebook, YouTube, and more."
      actions={
        <Link className="btn btn-ghost" to="/jobs">
          Open Jobs
        </Link>
      }
    >
      <div className="tool-stack">
        <div className="tabs">
          <button
            type="button"
            className={mode === 'single' ? 'tab active' : 'tab'}
            onClick={() => setMode('single')}
          >
            Single
          </button>
          <button
            type="button"
            className={mode === 'bulk' ? 'tab active' : 'tab'}
            onClick={() => setMode('bulk')}
          >
            Bulk
          </button>
        </div>

        {mode === 'single' ? (
          <div className="url-row">
            <input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && url.trim() && !loading) void fetchAny()
              }}
              placeholder="https://www.tiktok.com/@user/video/… or Instagram reel / Facebook / …"
              spellCheck={false}
            />
            <button
              className="btn btn-primary"
              disabled={!url.trim() || loading}
              onClick={() => void fetchAny()}
            >
              {loading ? 'Detecting…' : 'Auto-fetch'}
            </button>
          </div>
        ) : (
          <div className="bulk-box">
            <textarea
              value={bulkText}
              onChange={(e) => setBulkText(e.target.value)}
              rows={6}
              placeholder={'Paste multiple links (one per line)\nhttps://www.tiktok.com/@…\nhttps://www.instagram.com/reel/…\nhttps://www.facebook.com/…'}
              spellCheck={false}
            />
            <div className="actions" style={{ marginTop: 8 }}>
              <button
                className="btn btn-primary"
                disabled={!bulkText.trim() || loading}
                onClick={() => void fetchBulk()}
              >
                {loading ? 'Fetching…' : 'Fetch all'}
              </button>
            </div>
          </div>
        )}

        {loading && mode === 'single' ? (
          <div className="preflight">
            <div className="preflight-spinner" />
            <div>
              <strong>Detecting media</strong>
              <p className="muted">Resolving formats with the downloading engine…</p>
            </div>
          </div>
        ) : null}

        {error ? <p className="error">{error}</p> : null}
        {message ? <p className="hint ok-text">{message}</p> : null}

        <section className="controls">
          <div className="field">
            <label htmlFor="sq">Quality</label>
            <select
              id="sq"
              value={qualityId}
              onChange={(e) => setQualityId(e.target.value)}
            >
              {QUALITIES.map((q) => (
                <option key={q.id} value={q.id}>
                  {q.label}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>Save to</label>
            <div className="path">
              <span title={saveDir}>{saveDir || 'No folder'}</span>
              <button
                className="btn btn-ghost btn-sm"
                onClick={async () => {
                  const dir = await window.shiftgrab.chooseDirectory()
                  if (dir) setSaveDir(dir)
                }}
              >
                Browse
              </button>
            </div>
          </div>
        </section>

        <div className="meta-toggles">
          <label className="check-row">
            <input
              type="checkbox"
              checked={extractTranscript}
              onChange={(e) => setExtractTranscript(e.target.checked)}
            />
            Extract timed transcript
          </label>
          <label className="check-row">
            <input
              type="checkbox"
              checked={saveDescription}
              onChange={(e) => setSaveDescription(e.target.checked)}
            />
            Save description
          </label>
        </div>

        {mode === 'single' && info ? (
          <>
            <div className="list-toolbar">
              <span className="muted">1 item ready</span>
              <button className="btn btn-primary btn-sm" onClick={() => void queueSingle()}>
                Queue download
              </button>
            </div>
            <PreviewRow
              title={info.title}
              author={info.author}
              thumbnail={info.thumbnail}
              chips={[
                info.isImage ? 'image' : 'video',
                platformLabel(info.url),
                ...(info.durationSeconds ? [formatDuration(info.durationSeconds)] : []),
              ]}
            />
          </>
        ) : null}

        {mode === 'bulk' && rows.length > 0 ? (
          <>
            <div className="list-toolbar">
              <button
                className="btn btn-ghost btn-sm"
                onClick={() => setSelected(new Set(okRows.map((r) => r.id)))}
              >
                Select all
              </button>
              <button className="btn btn-ghost btn-sm" onClick={() => setSelected(new Set())}>
                Select none
              </button>
              <span className="muted">
                {selectedOk.length} selected · {okRows.length} ready
              </span>
              <button
                className="btn btn-primary btn-sm"
                style={{ marginLeft: 'auto' }}
                disabled={!saveDir || selectedOk.length === 0}
                onClick={() => void queueBulk()}
              >
                Queue selected ({selectedOk.length})
              </button>
            </div>
            <div className="media-list">
              {rows.map((row) => {
                const thumb = row.info
                  ? youtubeThumb(row.info.thumbnail || row.info.url)
                  : ''
                return (
                  <label key={row.id} className="media-row">
                    <input
                      type="checkbox"
                      disabled={row.status !== 'ok'}
                      checked={selected.has(row.id)}
                      onChange={() => toggle(row.id)}
                    />
                    {thumb ? (
                      <img className="media-thumb" src={thumb} alt="" loading="lazy" />
                    ) : (
                      <div className="media-thumb media-thumb-empty" />
                    )}
                    <div className="media-body">
                      <strong title={row.info?.title || row.url}>
                        {row.status === 'loading'
                          ? 'Fetching…'
                          : row.info?.title || row.url}
                      </strong>
                      <span className="media-meta">
                        <span>{platformLabel(row.url)}</span>
                        <span>·</span>
                        <span>
                          {row.status === 'ok'
                            ? 'ready'
                            : row.status === 'loading'
                              ? '…'
                              : 'failed'}
                        </span>
                        {row.error ? (
                          <>
                            <span>·</span>
                            <span className="error" title={row.error}>
                              {row.error.slice(0, 60)}
                            </span>
                          </>
                        ) : null}
                      </span>
                    </div>
                  </label>
                )
              })}
            </div>
          </>
        ) : null}

        {mode === 'single' && !info && !loading ? (
          <div className="empty-panel">
            <h2>One link. Any platform.</h2>
            <p>
              Or switch to Bulk to paste many links at once. Defaults follow Settings (
              {settings?.maxParallelJobs ?? 2} parallel jobs).
            </p>
          </div>
        ) : null}
      </div>
    </PageHeader>
  )
}
