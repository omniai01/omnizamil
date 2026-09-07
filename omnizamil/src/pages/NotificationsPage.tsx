import { useEffect, useMemo, useState } from 'react';
import { useApp } from '@/lib/store';
import {
  DEFAULT_SOCIAL_LINKS,
  fetchClientNotifications,
  fetchSocialLinks,
  type ClientNotification,
  type SocialLinks,
} from '@/lib/telemetry';

const SOCIAL_META: { key: keyof SocialLinks; label: string; className: string }[] = [
  { key: 'youtube', label: 'YouTube', className: 'social-yt' },
  { key: 'twitter', label: 'Twitter', className: 'social-tw' },
  { key: 'facebook', label: 'Facebook', className: 'social-fb' },
  { key: 'instagram', label: 'Instagram', className: 'social-ig' },
  { key: 'whatsapp', label: 'WhatsApp', className: 'social-wa' },
  { key: 'discord', label: 'Discord', className: 'social-dc' },
];

const READ_KEY = 'omni-notif-read';

function loadRead(): Set<string> {
  try {
    const raw = localStorage.getItem(READ_KEY);
    const arr = raw ? (JSON.parse(raw) as string[]) : [];
    return new Set(Array.isArray(arr) ? arr : []);
  } catch {
    return new Set();
  }
}

function saveRead(ids: Set<string>) {
  localStorage.setItem(READ_KEY, JSON.stringify([...ids]));
}

export function NotificationsPage() {
  const { state } = useApp();
  const [items, setItems] = useState<ClientNotification[]>([]);
  const [links, setLinks] = useState<SocialLinks>(DEFAULT_SOCIAL_LINKS);
  const [loading, setLoading] = useState(true);
  const [readIds, setReadIds] = useState<Set<string>>(() => loadRead());

  useEffect(() => {
    void fetchSocialLinks().then(setLinks);
  }, []);

  useEffect(() => {
    const hwid = state.profile.hardwareId;
    if (!hwid) return;
    let cancelled = false;
    const load = async () => {
      const { items: list } = await fetchClientNotifications(hwid);
      if (cancelled) return;
      setItems(list);
      setLoading(false);
    };
    void load();
    const t = window.setInterval(() => void load(), 45_000);
    return () => {
      cancelled = true;
      window.clearInterval(t);
    };
  }, [state.profile.hardwareId]);

  // Unread first (1,2,3…), then read ones stay listed above the fold as “Read”
  const ordered = useMemo(() => {
    const unread = items.filter((n) => !readIds.has(n.id));
    const read = items.filter((n) => readIds.has(n.id));
    // Read stay on top as requested; unread below as new
    return [...read, ...unread];
  }, [items, readIds]);

  const markRead = (id: string) => {
    setReadIds((prev) => {
      const next = new Set(prev);
      next.add(id);
      saveRead(next);
      return next;
    });
  };

  return (
    <div className="page-wrap">
      <div className="page-header">
        <div>
          <h2>Notifications</h2>
          <p>Messages from Omni-Removal admin</p>
        </div>
      </div>

      {loading && !ordered.length ? (
        <div className="notif-empty premium-empty">
          <div className="notif-empty-orb" aria-hidden />
          <p>Loading messages…</p>
        </div>
      ) : !ordered.length ? (
        <div className="notif-empty premium-empty">
          <div className="notif-empty-orb" aria-hidden />
          <h3>You&apos;re all caught up</h3>
          <p>When admin sends a broadcast or a private note, it will appear here.</p>
        </div>
      ) : (
        <div className="notif-stack">
          {ordered.map((n, index) => {
            const isBroadcast = !n.target_hwid;
            const isRead = readIds.has(n.id);
            return (
              <article
                key={n.id}
                className={`notif-full-card${isRead ? ' is-read' : ''}`}
              >
                <div className="notif-card-top">
                  <div className="notif-top-left">
                    <span className="notif-index">{index + 1}</span>
                    <span className={`notif-badge ${isBroadcast ? 'super' : 'private'}`}>
                      {isBroadcast ? 'Super Broadcast' : 'Private'}
                    </span>
                    {isRead && <span className="notif-read-pill">Read</span>}
                  </div>
                  <time dateTime={n.created_at}>{new Date(n.created_at).toLocaleString()}</time>
                </div>

                <p className="notif-field-label">Title</p>
                <p className="notif-title">{n.title || 'Announcement'}</p>

                <p className="notif-field-label">Message</p>
                <p className="notif-body">{n.body}</p>

                <div className="notif-follow">
                  <p className="notif-follow-title">Follow Omni-Removal</p>
                  <p className="notif-follow-sub">Stay connected on social</p>
                  <div className="social-row">
                    {SOCIAL_META.map((s) => (
                      <a
                        key={s.key}
                        className={`social-btn ${s.className}`}
                        href={links[s.key] || '#'}
                        target="_blank"
                        rel="noreferrer"
                      >
                        {s.label}
                      </a>
                    ))}
                  </div>
                </div>

                {!isRead && (
                  <button
                    type="button"
                    className="btn notif-dismiss-btn"
                    onClick={() => markRead(n.id)}
                  >
                    Mark as read
                  </button>
                )}
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
