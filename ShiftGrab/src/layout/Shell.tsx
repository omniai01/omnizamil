import { NavLink, Outlet } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { Mark } from '../Mark'
import { JobsProvider, useJobs } from '../jobs/JobsContext'
import { useControl } from '../lib/control'
import { fetchClientNotifications } from '../lib/telemetry'
import { startOfWeek } from '../lib/format'
import type { HistoryRecord } from '../../electron/youtube/types'

const groups = [
  {
    label: 'Overview',
    items: [
      { to: '/dashboard', label: 'Dashboard' },
      { to: '/jobs', label: 'Jobs' },
    ],
  },
  {
    label: 'Tools',
    items: [
      { to: '/video', label: 'Video' },
      { to: '/channel', label: 'Channel' },
      { to: '/social', label: 'All-in-one' },
    ],
  },
  {
    label: 'Data',
    items: [
      { to: '/library', label: 'Library' },
      { to: '/reports', label: 'Reports' },
      { to: '/notifications', label: 'Notifications' },
    ],
  },
  {
    label: 'System',
    items: [
      { to: '/dependencies', label: 'Dependencies' },
      { to: '/settings', label: 'Settings' },
      { to: '/about', label: 'About' },
    ],
  },
]

function SidebarNotifBadge() {
  const [n, setN] = useState(0)
  const { hwid } = useControl()
  useEffect(() => {
    if (!hwid) return
    let cancelled = false
    const tick = async () => {
      try {
        const res = await fetchClientNotifications(hwid)
        const raw = localStorage.getItem('sg-notif-read')
        const read = new Set(raw ? (JSON.parse(raw) as string[]) : [])
        if (!cancelled) setN(res.items.filter((i) => !read.has(i.id)).length)
      } catch {
        /* ignore */
      }
    }
    void tick()
    const t = window.setInterval(() => void tick(), 12_000)
    return () => {
      cancelled = true
      window.clearInterval(t)
    }
  }, [hwid])
  if (n <= 0) return null
  return <span className="nav-badge">{n}</span>
}

function SidebarJobsBadge() {
  const { processing } = useJobs()
  if (processing.length === 0) return null
  return <span className="nav-badge">{processing.length}</span>
}

function BootSplash({ onDone }: { onDone: () => void }) {
  const { processing } = useJobs()
  const [week, setWeek] = useState(0)
  const [success, setSuccess] = useState(0)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    let cancelled = false
    const minMs = 900
    const started = Date.now()

    async function load() {
      try {
        const history: HistoryRecord[] = await window.shiftgrab.listHistory()
        const weekStart = startOfWeek().getTime()
        if (!cancelled) {
          setWeek(history.filter((h) => new Date(h.finishedAt).getTime() >= weekStart).length)
          setSuccess(history.filter((h) => h.status === 'success').length)
        }
        await window.shiftgrab.checkDeps().catch(() => null)
      } finally {
        const wait = Math.max(0, minMs - (Date.now() - started))
        window.setTimeout(() => {
          if (!cancelled) setReady(true)
        }, wait)
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!ready) return
    const t = window.setTimeout(onDone, 280)
    return () => window.clearTimeout(t)
    // intentionally only when ready flips
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready])

  return (
    <div className={`boot-splash ${ready ? 'boot-splash-out' : ''}`}>
      <div className="boot-splash-inner">
        <Mark className="boot-mark" grab />
        <strong className="boot-brand">ShiftGrab</strong>
        <span className="boot-tag">by ShiftZero</span>
        <div className="boot-stats">
          <div>
            <em>{week}</em>
            <span>This week</span>
          </div>
          <div>
            <em>{success}</em>
            <span>Succeeded</span>
          </div>
          <div>
            <em>{processing.length}</em>
            <span>Processing</span>
          </div>
        </div>
      </div>
    </div>
  )
}

function ShellInner() {
  const [version, setVersion] = useState('1.0.0')
  const [showSplash, setShowSplash] = useState(true)

  useEffect(() => {
    void window.shiftgrab.getVersion().then(setVersion)
  }, [])

  return (
    <div className="shell">
      {showSplash ? <BootSplash onDone={() => setShowSplash(false)} /> : null}
      <aside className="sidebar">
        <div className="sidebar-brand">
          <Mark className="mark" grab />
          <div className="brand-text">
            <strong>ShiftGrab</strong>
            <span>by ShiftZero</span>
          </div>
        </div>

        <nav className="sidebar-nav">
          {groups.map((group) => (
            <div key={group.label} className="nav-group">
              <div className="nav-group-label">{group.label}</div>
              {group.items.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) =>
                    isActive ? 'nav-link active' : 'nav-link'
                  }
                >
                  <span>{item.label}</span>
                  {item.to === '/jobs' ? <SidebarJobsBadge /> : null}
                  {item.to === '/notifications' ? <SidebarNotifBadge /> : null}
                </NavLink>
              ))}
            </div>
          ))}
        </nav>

        <div className="sidebar-foot">
          <span className="pill">v{version}</span>
          <span className="muted">Local downloads · OmniGrab cloud</span>
        </div>
      </aside>

      <div className="shell-main">
        <Outlet />
      </div>
    </div>
  )
}

export function Shell() {
  return (
    <JobsProvider>
      <ShellInner />
    </JobsProvider>
  )
}
