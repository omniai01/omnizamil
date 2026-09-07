import { useEffect, useState } from 'react'
import type { AppSettings } from '../../electron/youtube/types'
import { PageHeader } from '../components/PageHeader'
import { useControl } from '../lib/control'
import { bumpAnalytics, reportYoutubeLinked } from '../lib/telemetry'

export function SettingsPage() {
  const [settings, setSettings] = useState<AppSettings | null>(null)
  const [ytSignedIn, setYtSignedIn] = useState(false)
  const [authBusy, setAuthBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [privacyOpen, setPrivacyOpen] = useState(false)
  const { reopenUpdate, settings: remote, hwid, telemetryError } = useControl()

  const cleanTelemetry =
    telemetryError && !/youtube_linked|schema cache/i.test(telemetryError) ? telemetryError : null

  async function refreshYtStatus() {
    const s = await window.shiftgrab.youtubeAuthStatus()
    setYtSignedIn(s.signedIn)
    if (hwid) void reportYoutubeLinked(hwid, s.signedIn)
    return s.signedIn
  }

  useEffect(() => {
    void window.shiftgrab.getSettings().then(setSettings)
    void refreshYtStatus()
    const t = window.setInterval(() => void refreshYtStatus(), 20_000)
    return () => window.clearInterval(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hwid])

  useEffect(() => {
    if (!privacyOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setPrivacyOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [privacyOpen])

  async function save(patch: Partial<AppSettings>) {
    const next = await window.shiftgrab.setSettings(patch)
    setSettings(next)
    setMessage('Saved.')
  }

  async function pickFolder() {
    const dir = await window.shiftgrab.chooseDirectory()
    if (dir) await save({ defaultSaveDir: dir })
  }

  async function clearHistory() {
    await window.shiftgrab.clearHistory()
    setMessage('History cleared.')
  }

  async function signInYouTube() {
    setAuthBusy(true)
    setMessage(null)
    try {
      const status = await window.shiftgrab.youtubeLogin()
      setYtSignedIn(status.signedIn)
      if (hwid) void reportYoutubeLinked(hwid, status.signedIn)
      setMessage(
        status.signedIn
          ? 'YouTube linked on this PC. Login window closed automatically.'
          : 'Sign-in window closed before a session was detected. Try again.',
      )
    } catch {
      setMessage('Could not open YouTube sign-in.')
    } finally {
      setAuthBusy(false)
    }
  }

  async function signOutYouTube() {
    setAuthBusy(true)
    try {
      const status = await window.shiftgrab.youtubeLogout()
      setYtSignedIn(status.signedIn)
      if (hwid) void reportYoutubeLinked(hwid, false)
      setMessage('YouTube signed out on this device.')
    } finally {
      setAuthBusy(false)
    }
  }

  async function checkUpdates() {
    const show = await reopenUpdate()
    if (show) {
      setMessage('Update available — see the popup.')
      return
    }
    const site = (remote?.brand_website_url || 'https://shiftzero.netlify.app').trim()
    const url = (remote?.update_url || '').trim()
    if (url) {
      void bumpAnalytics('update_click')
      void window.shiftgrab.openExternal(url)
      setMessage('Opened latest download link from admin.')
    } else {
      void window.shiftgrab.openExternal(site)
      setMessage('No forced update. Opened website.')
    }
  }

  if (!settings) {
    return (
      <PageHeader title="Settings" subtitle="Loading…">
        <p className="muted">Loading preferences…</p>
      </PageHeader>
    )
  }

  return (
    <PageHeader
      title="Settings"
      subtitle="Defaults stored on this device. Cloud controls from OmniGrab admin."
    >
      {message ? <p className="hint ok-text">{message}</p> : null}
      {cleanTelemetry ? <p className="hint">{cleanTelemetry}</p> : null}

      <div className="settings-stack">
        <div className="panel yt-panel">
          <div className="panel-head">
            <h3>YouTube account</h3>
            <span className={`yt-status-pill ${ytSignedIn ? 'on' : 'off'}`}>
              {ytSignedIn ? 'Linked' : 'Not linked'}
            </span>
          </div>

          <div className="yt-actions">
            <button
              className="btn"
              type="button"
              disabled={authBusy}
              onClick={() => void signInYouTube()}
            >
              Sign in to YouTube
            </button>
            <button
              className="btn btn-ghost"
              type="button"
              disabled={authBusy || !ytSignedIn}
              onClick={() => void signOutYouTube()}
            >
              Sign out
            </button>
            <button className="btn btn-ghost" type="button" onClick={() => setPrivacyOpen(true)}>
              Why link? Privacy
            </button>
          </div>

          <label className="check-row yt-check">
            <input
              type="checkbox"
              checked={settings.useBrowserCookiesFallback !== false}
              onChange={(e) => void save({ useBrowserCookiesFallback: e.target.checked })}
            />
            <span>Use Chrome cookies if app login is missing</span>
          </label>
        </div>

        <div className="panel">
          <h3>Updates & links</h3>
          <p className="muted">
            Device ID: <code>{hwid || '…'}</code>
          </p>
          <button className="btn" type="button" onClick={() => void checkUpdates()}>
            Check latest updates
          </button>
          <p className="hint">Uses OmniGrab admin force-update / download URL when set.</p>
        </div>

        <div className="panel">
          <h3>Downloads</h3>
          <div className="field">
            <label>Default save folder</label>
            <div className="path">
              <span title={settings.defaultSaveDir}>{settings.defaultSaveDir}</span>
              <button className="btn btn-ghost btn-sm" onClick={() => void pickFolder()}>
                Browse
              </button>
            </div>
          </div>
          <div className="field">
            <label htmlFor="def-q">Default quality</label>
            <select
              id="def-q"
              value={settings.defaultQualityId}
              onChange={(e) => void save({ defaultQualityId: e.target.value })}
            >
              <option value="best">Best</option>
              <option value="1080">1080p</option>
              <option value="720">720p</option>
              <option value="480">480p</option>
              <option value="audio">Audio (MP3)</option>
            </select>
          </div>
          <div className="field">
            <label htmlFor="frags">Concurrent fragments</label>
            <input
              id="frags"
              type="number"
              min={1}
              max={16}
              value={settings.concurrentFragments}
              onChange={(e) =>
                void save({
                  concurrentFragments: Math.max(
                    1,
                    Math.min(16, Number(e.target.value) || 5),
                  ),
                })
              }
            />
          </div>
          <div className="field">
            <label htmlFor="parallel">Max jobs at a time (1–50)</label>
            <input
              id="parallel"
              type="number"
              min={1}
              max={50}
              value={settings.maxParallelJobs ?? 2}
              onChange={(e) =>
                void save({
                  maxParallelJobs: Math.max(1, Math.min(50, Number(e.target.value) || 2)),
                })
              }
            />
            <p className="hint">How many videos can download in parallel on this machine.</p>
          </div>
        </div>

        <div className="panel">
          <h3>Metadata pack</h3>
          <label className="check-row">
            <input
              type="checkbox"
              checked={settings.extractTranscript}
              onChange={(e) => void save({ extractTranscript: e.target.checked })}
            />
            Extract timed transcript (sidecar next to file)
          </label>
          <label className="check-row">
            <input
              type="checkbox"
              checked={settings.saveDescription}
              onChange={(e) => void save({ saveDescription: e.target.checked })}
            />
            Save description text with downloads
          </label>
          <p className="hint">Defaults apply to Video and All-in-one; you can override per queue.</p>
        </div>

        <div className="panel">
          <h3>Binaries</h3>
          <label className="check-row">
            <input
              type="checkbox"
              checked={settings.autoUpdateBinaries}
              onChange={(e) => void save({ autoUpdateBinaries: e.target.checked })}
            />
            Auto-update engines on launch
          </label>
          <p className="hint">
            Off by default. Tick this only if you want engines refreshed when the app starts.
          </p>
        </div>

        <div className="panel">
          <h3>Data</h3>
          <p className="muted">Clears local analytics and library rows. Files on disk stay.</p>
          <button className="btn btn-danger" onClick={() => void clearHistory()}>
            Clear history
          </button>
        </div>
      </div>

      {privacyOpen ? (
        <div
          className="modal-backdrop"
          role="presentation"
          onClick={() => setPrivacyOpen(false)}
        >
          <div
            className="modal-card"
            role="dialog"
            aria-modal="true"
            aria-labelledby="yt-privacy-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-card-head">
              <h3 id="yt-privacy-title">YouTube link — privacy</h3>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => setPrivacyOpen(false)}
              >
                Close
              </button>
            </div>
            <div className="modal-card-body">
              <section>
                <h4>Why link?</h4>
                <p>
                  Google sometimes blocks downloads with a bot check. A local YouTube session on
                  this PC unlocks those fetches.
                </p>
              </section>
              <section>
                <h4>What stays on your PC only</h4>
                <p>
                  Email, password, and session cookies never leave this device. ShiftGrab does not
                  upload them.
                </p>
              </section>
              <section>
                <h4>What admin can see</h4>
                <p>
                  Only whether this device is “linked” or “not linked” (yes/no). No account secrets,
                  no cookie files.
                </p>
              </section>
            </div>
            <div className="modal-card-foot">
              <button type="button" className="btn" onClick={() => setPrivacyOpen(false)}>
                Got it
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </PageHeader>
  )
}
