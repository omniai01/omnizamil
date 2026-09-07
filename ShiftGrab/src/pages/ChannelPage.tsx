import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import type {
  AppSettings,
  ChannelLibrary,
  PlaylistItem,
  QualityOption,
} from '../../electron/youtube/types'
import { PageHeader } from '../components/PageHeader'
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

type LibTab = 'videos' | 'shorts'

export function ChannelPage() {
  const navigate = useNavigate()
  const { refresh } = useJobs()
  const [, setSettingsLocal] = useState<AppSettings | null>(null)
  const [url, setUrl] = useState('')
  const [library, setLibrary] = useState<ChannelLibrary | null>(null)
  const [tab, setTab] = useState<LibTab>('videos')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [qualityId, setQualityId] = useState('best')
  const [saveDir, setSaveDir] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [avatarBroken, setAvatarBroken] = useState(false)

  useEffect(() => {
    void window.shiftgrab.getSettings().then((s) => {
      setSettingsLocal(s)
      setSaveDir(s.defaultSaveDir)
      setQualityId(s.defaultQualityId || 'best')
    })
  }, [])

  useEffect(() => {
    setAvatarBroken(false)
  }, [library?.avatar])

  const quality = QUALITIES.find((q) => q.id === qualityId) || QUALITIES[0]

  const activeItems: PlaylistItem[] = useMemo(() => {
    if (!library) return []
    if (library.isPlaylist) return library.videos
    return tab === 'videos' ? library.videos : library.shorts
  }, [library, tab])

  async function loadList() {
    setError(null)
    setMessage(null)
    setLibrary(null)
    setSelected(new Set())
    setLoading(true)
    try {
      const data = await window.shiftgrab.getChannelLibrary(url)
      setLibrary(data)
      setTab('videos')
      const first = data.videos.length ? data.videos : data.shorts
      setSelected(new Set(first.map((i) => i.id)))
      if (!data.videos.length && data.shorts.length) setTab('shorts')
      setMessage(
        data.isPlaylist
          ? `${data.videos.length} playlist items captured.`
          : `${data.videos.length} videos · ${data.shorts.length} shorts captured.`,
      )
    } catch (err) {
      setError(formatAppError(err))
    } finally {
      setLoading(false)
    }
  }

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function selectAllOnTab(on: boolean) {
    setSelected((prev) => {
      const next = new Set(prev)
      for (const item of activeItems) {
        if (on) next.add(item.id)
        else next.delete(item.id)
      }
      return next
    })
  }

  async function startDownload() {
    if (!library) {
      setError('Load a channel or playlist first.')
      return
    }
    const pool = [...library.videos, ...library.shorts]
    const picks = pool.filter((item) => selected.has(item.id))
    if (picks.length === 0) {
      setError('Select at least one video.')
      return
    }
    if (!saveDir) {
      setError('Choose a save folder first.')
      return
    }
    setError(null)
    const kind = library.isPlaylist ? 'playlist' : 'channel'
    const created = await window.shiftgrab.enqueueJobs(
      picks.map((item) => ({
        url: item.url,
        title: item.title,
        kind,
        qualityId: quality.id,
        height: quality.height,
        audioOnly: quality.audioOnly,
        saveDir,
        thumbnail: youtubeThumb(item.thumbnail || item.id || item.url),
      })),
    )
    if (!created.length) {
      setError('Could not queue channel jobs.')
      return
    }
    setMessage(`${created.length} jobs queued — opening Jobs → Processing.`)
    await refresh()
    navigate('/jobs')
  }

  const selectedOnTab = activeItems.filter((i) => selected.has(i.id)).length
  const qualityLabel = quality.label

  return (
    <PageHeader
      title="Channel"
      subtitle="Load a channel — Videos and Shorts like YouTube, then queue into Jobs."
      actions={
        <Link className="btn btn-ghost" to="/jobs">
          Open Jobs
        </Link>
      }
    >
      <div className="tool-stack">
        <div className="url-row">
          <input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && url.trim() && !loading) void loadList()
            }}
            placeholder="Channel or playlist URL"
            spellCheck={false}
          />
          <button
            className="btn btn-primary"
            onClick={() => void loadList()}
            disabled={!url.trim() || loading}
          >
            {loading ? 'Loading…' : 'Load library'}
          </button>
        </div>

        {error ? <p className="error">{error}</p> : null}
        {message ? <p className="hint ok-text">{message}</p> : null}

        {!library && !loading ? (
          <div className="empty-panel">
            <h2>Channel library</h2>
            <p>Paste a channel link to fetch long videos and shorts into separate tabs.</p>
          </div>
        ) : null}

        {loading ? (
          <div className="preflight">
            <div className="preflight-spinner" />
            <div>
              <strong>Fetching library</strong>
              <p className="muted">Resolving Videos and Shorts on-device…</p>
            </div>
          </div>
        ) : null}

        {library ? (
          <>
            <div className="yt-channel-card">
              {library.banner ? (
                <div className="yt-banner">
                  <img
                    className="yt-banner-img"
                    src={library.banner}
                    alt=""
                    referrerPolicy="no-referrer"
                    loading="eager"
                  />
                </div>
              ) : (
                <div className="yt-banner yt-banner-empty" />
              )}
              <div className="yt-channel-meta">
                {library.avatar && !avatarBroken ? (
                  <img
                    className="yt-avatar"
                    src={library.avatar}
                    alt=""
                    referrerPolicy="no-referrer"
                    loading="eager"
                    onError={() => setAvatarBroken(true)}
                  />
                ) : (
                  <div className="yt-avatar yt-avatar-fallback" aria-hidden>
                    {(library.title || '?').trim().charAt(0).toUpperCase()}
                  </div>
                )}
                <div className="yt-channel-text">
                  <div className="yt-title-row">
                    <h2>{library.title}</h2>
                    <button
                      type="button"
                      className="btn btn-primary btn-sm yt-check-btn"
                      onClick={() => {
                        const target = library.url || url
                        const href = /^https?:\/\//i.test(target)
                          ? target
                          : `https://www.youtube.com/${target.replace(/^\/+/, '')}`
                        void window.shiftgrab.openExternal(href)
                      }}
                    >
                      Check on YouTube
                    </button>
                  </div>
                  <p className="muted tight">
                    {library.author}
                    {library.followerCount != null
                      ? ` · ${library.followerCount.toLocaleString()} followers`
                      : ''}
                    {` · ${library.videos.length} videos`}
                    {!library.isPlaylist ? ` · ${library.shorts.length} shorts` : ''}
                  </p>
                  {library.description ? (
                    <p className="yt-desc">{library.description}</p>
                  ) : null}
                </div>
              </div>
            </div>

            <section className="controls">
              <div className="field">
                <label htmlFor="c-quality">Quality</label>
                <select
                  id="c-quality"
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
                  <span title={saveDir || undefined}>{saveDir || 'No folder selected'}</span>
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

            {!library.isPlaylist ? (
              <div className="tabs">
                <button
                  className={tab === 'videos' ? 'tab active' : 'tab'}
                  onClick={() => setTab('videos')}
                >
                  Videos ({library.videos.length})
                </button>
                <button
                  className={tab === 'shorts' ? 'tab active' : 'tab'}
                  onClick={() => setTab('shorts')}
                >
                  Shorts ({library.shorts.length})
                </button>
              </div>
            ) : null}

            <div className="list-toolbar">
              <button className="btn btn-ghost btn-sm" onClick={() => selectAllOnTab(true)}>
                Select all
              </button>
              <button className="btn btn-ghost btn-sm" onClick={() => selectAllOnTab(false)}>
                Select none
              </button>
              <span className="muted">
                {selectedOnTab} selected · {selected.size} total
              </span>
              <button
                className="btn btn-primary btn-sm"
                style={{ marginLeft: 'auto' }}
                onClick={() => void startDownload()}
                disabled={!saveDir || selected.size === 0}
              >
                Queue selected ({selected.size})
              </button>
            </div>

            <div className="media-list">
              {activeItems.length === 0 ? (
                <div className="empty-panel">
                  <h2>No items in this tab</h2>
                  <p>Try the other tab or another channel URL.</p>
                </div>
              ) : (
                activeItems.map((item) => {
                  const thumb = youtubeThumb(item.thumbnail || item.id || item.url)
                  return (
                    <label key={item.id} className="media-row">
                      <input
                        type="checkbox"
                        checked={selected.has(item.id)}
                        onChange={() => toggle(item.id)}
                      />
                      {thumb ? (
                        <img className="media-thumb" src={thumb} alt="" loading="lazy" />
                      ) : (
                        <div className="media-thumb media-thumb-empty" />
                      )}
                      <div className="media-body">
                        <strong title={item.title}>{item.title}</strong>
                        <span className="media-meta">
                          <span>{formatDuration(item.durationSeconds) || '—'}</span>
                          <span>·</span>
                          <span>{qualityLabel}</span>
                          <span>·</span>
                          <span>#{item.index}</span>
                        </span>
                      </div>
                    </label>
                  )
                })
              )}
            </div>
          </>
        ) : null}
      </div>
    </PageHeader>
  )
}
