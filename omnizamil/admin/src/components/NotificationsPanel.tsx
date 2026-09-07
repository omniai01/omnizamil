import React, { useEffect, useState } from 'react';
import {
  deleteNotification,
  loadNotifications,
  sendNotification,
  type AdminNotification,
} from '../lib/supabaseAdmin';
import type { AdminProduct } from '../lib/product';

export const NotificationsPanel: React.FC<{
  deviceHwids: string[];
  product?: AdminProduct;
}> = ({ deviceHwids, product = 'omni' }) => {
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [target, setTarget] = useState('');
  const [items, setItems] = useState<AdminNotification[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const refresh = async () => {
    try {
      setItems(await loadNotifications(product));
      setErr('');
    } catch (e) {
      setErr(
        e instanceof Error
          ? /notifications|schema cache|does not exist/i.test(e.message)
            ? 'Run supabase/schema-delta.sql in Supabase SQL Editor once, then Sync.'
            : e.message
          : 'Failed to load notifications',
      );
    }
  };

  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reload when product switches
  }, [product]);

  const onSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !body.trim()) return;
    setBusy(true);
    setErr('');
    try {
      await sendNotification(product, {
        title,
        body,
        targetHwid: target.trim() || null,
      });
      setTitle('');
      setBody('');
      setTarget('');
      await refresh();
    } catch (e2) {
      setErr(
        e2 instanceof Error
          ? /notifications|schema cache|does not exist/i.test(e2.message)
            ? 'Run supabase/schema-delta.sql in Supabase SQL Editor once, then try again.'
            : e2.message
          : 'Send failed',
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <form className="panel-card form-grid" onSubmit={onSend}>
        <div className="card-header-clean">
          <h2>Send notification</h2>
        </div>
        <p style={{ margin: 0, fontSize: 13, color: 'var(--text-muted)' }}>
          Posts appear in the desktop app Notifications page. Leave HWID empty to broadcast to
          everyone.
        </p>
        <label>
          Title
          <input value={title} onChange={(e) => setTitle(e.target.value)} required />
        </label>
        <label>
          Content
          <textarea rows={4} value={body} onChange={(e) => setBody(e.target.value)} required />
        </label>
        <label>
          Target HWID (optional)
          <input
            list="hwid-targets"
            placeholder="All users if empty"
            value={target}
            onChange={(e) => setTarget(e.target.value)}
          />
          <datalist id="hwid-targets">
            {deviceHwids.map((h) => (
              <option key={h} value={h} />
            ))}
          </datalist>
        </label>
        {err && <p className="admin-sync-error">{err}</p>}
        <button className="btn btn-primary" type="submit" disabled={busy}>
          {busy ? 'Sending…' : 'Send notification'}
        </button>
      </form>

      <div className="panel-card">
        <div className="card-header-clean">
          <h2>Recent posts</h2>
        </div>
        {!items.length ? (
          <div className="empty-hint">No notifications yet.</div>
        ) : (
          <div className="notif-admin-list">
            {items.map((n) => (
              <article key={n.id} className="notif-admin-card">
                <h3>{n.title}</h3>
                <p className="body">{n.body}</p>
                <div className="notif-admin-meta">
                  <span>{n.targetHwid || 'All devices'}</span>
                  <span>·</span>
                  <span>{n.createdAt}</span>
                  <button
                    type="button"
                    className="btn btn-danger"
                    style={{ marginLeft: 'auto' }}
                    onClick={() => void deleteNotification(product, n.id).then(() => refresh())}
                  >
                    Delete
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
