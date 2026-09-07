import { useEffect, useState } from 'react'
import { useControl } from '../lib/control'

function formatRemain(ms: number) {
  if (ms <= 0) return '00:00'
  const sec = Math.ceil(ms / 1000)
  const h = Math.floor(sec / 3600)
  const m = Math.floor((sec % 3600) / 60)
  const s = sec % 60
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

export function MaintenanceGate({ children }: { children: React.ReactNode }) {
  const { locked, settings, refreshRemote } = useControl()
  const [timer, setTimer] = useState('00:00')
  const [mode, setMode] = useState<'remain' | 'elapsed'>('elapsed')

  useEffect(() => {
    if (!locked) {
      setTimer('00:00')
      return
    }
    const mins = Number(settings?.maintenance_duration_minutes) || 0
    const started = settings?.maintenance_started_at
      ? new Date(settings.maintenance_started_at).getTime()
      : 0
    const endsAt = mins > 0 && started > 0 ? started + mins * 60_000 : 0
    setMode(endsAt ? 'remain' : 'elapsed')
    const origin = Date.now()
    const tick = () => {
      if (endsAt) {
        const left = endsAt - Date.now()
        setTimer(formatRemain(left))
        if (left <= 0) void refreshRemote()
      } else {
        setTimer(formatRemain(Date.now() - origin))
      }
    }
    tick()
    const t = window.setInterval(tick, 500)
    const poll = window.setInterval(() => void refreshRemote(), 30_000)
    return () => {
      window.clearInterval(t)
      window.clearInterval(poll)
    }
  }, [locked, settings?.maintenance_duration_minutes, settings?.maintenance_started_at, refreshRemote])

  if (!locked) return <>{children}</>

  return (
    <div className="sg-gate sg-maint">
      <div className="sg-gate-card">
        <p className="sg-gate-brand">ShiftGrab</p>
        <h1>Under maintenance</h1>
        <p>
          {settings?.maintenance_message ||
            'OmniGrab is under maintenance. Please try again later.'}
        </p>
        <div className="sg-gate-timer">{timer}</div>
        <p className="muted" style={{ fontSize: 12 }}>
          {mode === 'remain' ? 'Time remaining' : 'Time under maintenance'}
        </p>
        <button type="button" className="btn" onClick={() => void refreshRemote()}>
          Check again
        </button>
      </div>
    </div>
  )
}
