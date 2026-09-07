import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import type {
  AppSettings,
  MediaInfo,
  QualityOption,
} from '../../electron/youtube/types'
import { PageHeader } from '../components/PageHeader'
import { PreviewRow } from '../components/PreviewRow'
import { formatAppError, formatDuration } from '../lib/format'
import { useJobs } from '../jobs/JobsContext'

type Mode = 'single' | 'bulk'

type BulkRow = {
  url: string
  title: string
  selected: boolean
  qualityId: string
  info?: MediaInfo
  error?: string
  loading?: boolean
}

const QUALITIES: QualityOption[] = [
  { id: 'best', label: 'Best', height: null, audioOnly: false },
  { id: '1080', label: '1080p', height: 1080, audioOnly: false },
  { id: '720', label: '720p', height: 720, audioOnly: false },
  { id: '480', label: '480p', height: 480, audioOnly: false },
  { id: 'audio', label: 'Audio (MP3)', height: null, audioOnly: true },
]

function qualityMeta(id: string) {
  return QUALITIES.find((q) => q.id === id) || QUALITIES[0]
}

export function VideoPage() {
  const navigate = useNavigate()
  const { refresh } = useJobs()
  const [mode, setMode] = useState<Mode>('single')
  const [settings, setSettings] = useState<AppSettings | null>(null)
  const [url, setUrl] = useState('')
  const [info, setInfo] = useState<MediaInfo | null>(null)
  const [qualityId, setQualityId] = useState('best')
  const [saveDir, setSaveDir] = useState('')
  const [loadingInfo, setLoadingInfo] = useState(false)
  const [fetchingAnim, setFetchingAnim] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [bulkText, setBulkText] = useState('')
  const [bulkRows, setBulkRows] = useState<BulkRow[]>([])
  const [resolvingBulk, setResolvingBulk] = useState(false)
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

  const selectedQuality = useMemo(() => qualityMeta(qualityId), [qualityId])

  async function goToJobs() {
    await refresh()
    navigate('/jobs')
  }

  async function inspectSingle() {
    setError(null)
    setMessage(null)
    setInfo(null)
    setLoadingInfo(true)
    setFetchingAnim(true)
    try {
      const data = await window.shiftgrab.getInfo(url)
      if (data.kind !== 'video') {
        setError('That looks like a playlist or channel. Use Channel instead.')
        return
      }
      setInfo(data)
    } catch (err) {
      setError(formatAppError(err))
    } finally {
      setLoadingInfo(false)
      setTimeout(() => setFetchingAnim(false), 400)
    }
  }

  async function queueSingle() {
    if (!info || !saveDir) {
      setError('Fetch a video and choose a save folder.')
      return
    }
    const created = await window.shiftgrab.enqueueJobs([
      {
        url: info.url,
        title: info.title,
        kind: 'video',
        qualityId: selectedQuality.id,
        height: selectedQuality.height,
        audioOnly: selectedQuality.audioOnly,
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
    await goToJobs()
  }

  async function resolveBulk() {
    const urls = bulkText
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean)
    if (urls.length === 0) {
      setError('Paste one URL per line.')
      return
    }
    setError(null)
    setMessage(null)
    setResolvingBulk(true)
    setFetchingAnim(true)
    const defaultQ = settings?.defaultQualityId || qualityId || 'best'
    const rows: BulkRow[] = urls.map((u) => ({
      url: u,
      title: u,
      selected: true,
      qualityId: defaultQ,
      loading: true,
    }))
    setBulkRows(rows)
    const next = [...rows]
    for (let i = 0; i < urls.length; i++) {
      try {
        const data = await window.shiftgrab.getInfo(urls[i])
        next[i] = {
          url: data.url || urls[i],
          title: data.title,
          selected: true,
          qualityId: defaultQ,
          info: data,
          loading: false,
        }
      } catch (err) {
        next[i] = {
          url: urls[i],
          title: urls[i],
          selected: false,
          qualityId: defaultQ,
          error: err instanceof Error ? err.message : String(err),
          loading: false,
        }
      }
      setBulkRows([...next])
    }
    setResolvingBulk(false)
    setFetchingAnim(false)
    setMessage(`${next.filter((r) => r.info).length} videos captured. Select quality per row, then queue.`)
  }

  function selectAllBulk(selected: boolean) {
    setBulkRows((prev) =>
      prev.map((r) => (r.info && !r.error ? { ...r, selected } : r)),
    )
  }

  function applyQualityToSelected(qid: string) {
    setBulkRows((prev) =>
      prev.map((r) => (r.selected && r.info ? { ...r, qualityId: qid } : r)),
    )
  }

  async function queueBulk() {
    const selected = bulkRows.filter((r) => r.selected && r.info && !r.error)
    if (selected.length === 0) {
      setError('Select at least one resolved video.')
      return
    }
    if (!saveDir) {
      setError('Choose a save folder.')
      return
    }
    const created = await window.shiftgrab.enqueueJobs(
      selected.map((r) => {
        const q = qualityMeta(r.qualityId)
        return {
          url: r.info!.url,
          title: r.info!.title,
          kind: 'bulk' as const,
          qualityId: q.id,
          height: q.height,
          audioOnly: q.audioOnly,
          saveDir,
          thumbnail: r.info!.thumbnail,
          extractTranscript,
          saveDescription,
        }
      }),
    )
    if (!created.length) {
      setError('Could not queue bulk jobs.')
      return
    }
    setMessage(`${created.length} jobs queued — opening Jobs → Processing.`)
    await goToJobs()
  }

  return (
    <PageHeader
      title="Video"
      subtitle="Single or bulk — every download appears in Jobs → Processing."
      actions={
        <Link className="btn btn-ghost" to="/jobs">
          Open Jobs
        </Link>
      }
    >
      <div className="tabs">
        <button
          className={mode === 'single' ? 'tab active' : 'tab'}
          onClick={() => setMode('single')}
        >
          Single
        </button>
        <button
          className={mode === 'bulk' ? 'tab active' : 'tab'}
          onClick={() => setMode('bulk')}
        >
          Bulk
        </button>
      </div>

      {fetchingAnim ? (
        <div className="preflight">
          <div className="preflight-spinner" />
          <div>
            <strong>Pre-processing</strong>
            <p className="muted">Resolving formats and metadata on-device…</p>
          </div>
        </div>
      ) : null}

      {error ? <p className="error">{error}</p> : null}
      {message ? <p className="hint ok-text">{message}</p> : null}

      <section className="controls">
        {mode === 'single' ? (
          <div className="field">
            <label htmlFor="vq">Quality</label>
            <select
              id="vq"
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
        ) : (
          <div className="field">
            <label htmlFor="bulk-q">Apply quality to selected</label>
            <select
              id="bulk-q"
              value={qualityId}
              onChange={(e) => {
                setQualityId(e.target.value)
                applyQualityToSelected(e.target.value)
              }}
            >
              {QUALITIES.map((q) => (
                <option key={q.id} value={q.id}>
                  {q.label}
                </option>
              ))}
            </select>
          </div>
        )}
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

      {mode === 'single' ? (
        <div className="tool-stack">
          <div className="url-row">
            <input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && url.trim() && !loadingInfo) void inspectSingle()
              }}
              placeholder="YouTube video URL"
              spellCheck={false}
            />
            <button
              className="btn btn-primary"
              disabled={!url.trim() || loadingInfo}
              onClick={() => void inspectSingle()}
            >
              {loadingInfo ? 'Reading…' : 'Fetch'}
            </button>
          </div>

          {info ? (
            <>
              <PreviewRow
                title={info.title}
                author={info.author}
                thumbnail={info.thumbnail}
                chips={[
                  'video',
                  ...(info.durationSeconds ? [formatDuration(info.durationSeconds)] : []),
                ]}
              />
              <div className="actions">
                <button className="btn btn-primary" onClick={() => void queueSingle()}>
                  Queue download
                </button>
              </div>
            </>
          ) : !loadingInfo ? (
            <div className="empty-panel">
              <h2>One link. One job.</h2>
              <p>Fetch, review the compact preview, then queue into Jobs.</p>
            </div>
          ) : null}
        </div>
      ) : (
        <div className="tool-stack">
          <div className="field">
            <label htmlFor="bulk">URLs (one per line)</label>
            <textarea
              id="bulk"
              className="bulk-area"
              rows={6}
              value={bulkText}
              onChange={(e) => setBulkText(e.target.value)}
              placeholder={
                'https://www.youtube.com/watch?v=...\nhttps://www.youtube.com/watch?v=...'
              }
            />
          </div>
          <div className="actions">
            <button
              className="btn btn-primary"
              disabled={resolvingBulk || !bulkText.trim()}
              onClick={() => void resolveBulk()}
            >
              {resolvingBulk ? 'Capturing…' : 'Capture all'}
            </button>
            <button
              className="btn btn-ghost"
              disabled={bulkRows.filter((r) => r.selected && r.info).length === 0}
              onClick={() => void queueBulk()}
            >
              Queue selected
            </button>
          </div>

          {bulkRows.length > 0 ? (
            <>
              <div className="list-toolbar">
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={() => selectAllBulk(true)}
                >
                  Select all
                </button>
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={() => selectAllBulk(false)}
                >
                  Select none
                </button>
                <span className="muted">
                  {bulkRows.filter((r) => r.selected && r.info).length} selected
                </span>
              </div>
              <div className="easy-list">
                {bulkRows.map((row, idx) => (
                  <div key={`${row.url}-${idx}`} className="easy-row">
                    <div className="easy-row-main">
                      <label className="check-row">
                        <input
                          type="checkbox"
                          checked={row.selected}
                          disabled={!row.info || Boolean(row.error)}
                          onChange={() => {
                            setBulkRows((prev) =>
                              prev.map((r, i) =>
                                i === idx ? { ...r, selected: !r.selected } : r,
                              ),
                            )
                          }}
                        />
                        <strong title={row.title}>{row.title}</strong>
                      </label>
                      <select
                        className="row-quality"
                        value={row.qualityId}
                        disabled={!row.info || Boolean(row.error)}
                        onChange={(e) => {
                          const qid = e.target.value
                          setBulkRows((prev) =>
                            prev.map((r, i) =>
                              i === idx ? { ...r, qualityId: qid } : r,
                            ),
                          )
                        }}
                      >
                        {QUALITIES.map((q) => (
                          <option key={q.id} value={q.id}>
                            {q.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    {row.error ? <p className="error tight">{row.error}</p> : null}
                    {row.loading ? <p className="muted">resolving…</p> : null}
                  </div>
                ))}
              </div>
            </>
          ) : null}
          <p className="hint">
            Each row has its own quality. Parallelism: Settings → max jobs (
            {settings?.maxParallelJobs ?? 2}).
          </p>
        </div>
      )}
    </PageHeader>
  )
}
