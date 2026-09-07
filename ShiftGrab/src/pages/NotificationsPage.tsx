import { useCallback, useEffect, useState } from 'react'
import { PageHeader } from '../components/PageHeader'
import { useControl } from '../lib/control'
import { fetchClientNotifications, type ClientNotification } from '../lib/telemetry'

const READ_KEY = 'sg-notif-read'

function readSet(): Set<string> {
  try {
    const raw = localStorage.getItem(READ_KEY)
    return new Set(raw ? (JSON.parse(raw) as string[]) : [])
  } catch {
    return new Set()
  }
}

function writeSet(ids: Set<string>) {
  localStorage.setItem(READ_KEY, JSON.stringify([...ids]))
}

export function NotificationsPage() {
  const { hwid } = useControl()
  const [items, setItems] = useState<ClientNotification[]>([])
  const [read, setRead] = useState<Set<string>>(() => readSet())
  const [err, setErr] = useState('')

  const refresh = useCallback(async () => {
    if (!hwid) return
    const res = await fetchClientNotifications(hwid)
    setItems(res.items)
    setErr(res.setupNeeded ? 'Cloud notifications table missing — ask admin to run schema.' : '')
  }, [hwid])

  useEffect(() => {
    void refresh()
    const t = window.setInterval(() => void refresh(), 12_000)
    return () => window.clearInterval(t)
  }, [refresh])

  const markRead = (id: string) => {
    const next = new Set(read)
    next.add(id)
    setRead(next)
    writeSet(next)
  }

  const markAllRead = () => {
    const next = new Set(read)
    for (const n of items) next.add(n.id)
    setRead(next)
    writeSet(next)
  }

  const unread = items.filter((n) => !read.has(n.id)).length

  return (
    <PageHeader
      title="Notifications"
      subtitle="Messages from OmniGrab admin"
      actions={
        <div className="inline-actions">
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => void refresh()}>
            Refresh
          </button>
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={markAllRead}
            disabled={unread === 0}
          >
            Mark all read{unread ? ` (${unread})` : ''}
          </button>
        </div>
      }
    >
      {err && <p className="muted">{err}</p>}
      <div className="stack" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {items.length === 0 && <p className="muted">No notifications yet.</p>}
        {items.map((n) => {
          const isRead = read.has(n.id)
          return (
            <article
              key={n.id}
              className={`panel ${isRead ? '' : 'notif-unread'}`}
              style={{ padding: 16 }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start' }}>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <strong>{n.title}</strong>
                  <p style={{ margin: '8px 0 0', whiteSpace: 'pre-wrap' }}>{n.body}</p>
                  <span className="muted" style={{ fontSize: 12 }}>
                    {new Date(n.created_at).toLocaleString()}
                    {!isRead ? ' · New' : ' · Read'}
                  </span>
                </div>
                {!isRead ? (
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => markRead(n.id)}>
                    Mark as read
                  </button>
                ) : null}
              </div>
            </article>
          )
        })}
      </div>
    </PageHeader>
  )
}
