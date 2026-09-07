import React, { useState } from 'react';
import { Eye, Download, MousePointerClick } from 'lucide-react';

export type SiteAnalytics = {
  siteViews: number;
  downloadClicks: number;
  updateClicks: number;
};

export const WebsiteAnalytics: React.FC<{
  stats: SiteAnalytics;
  onSave: (next: SiteAnalytics) => Promise<void>;
}> = ({ stats, onSave }) => {
  const [draft, setDraft] = useState(stats);
  const [msg, setMsg] = useState('');

  React.useEffect(() => {
    setDraft(stats);
  }, [stats]);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg('');
    try {
      await onSave(draft);
      setMsg('Analytics saved.');
    } catch (err) {
      setMsg(err instanceof Error ? err.message : 'Save failed');
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <div className="stat-grid">
        <div className="stat-tile">
          <div className="stat-top">
            <span>Site / app views</span>
            <Eye size={18} color="var(--accent)" />
          </div>
          <div className="stat-value">{stats.siteViews.toLocaleString()}</div>
          <div className="stat-footer">Opens + page views</div>
        </div>
        <div className="stat-tile">
          <div className="stat-top">
            <span>Download clicks</span>
            <Download size={18} color="var(--accent)" />
          </div>
          <div className="stat-value">{stats.downloadClicks.toLocaleString()}</div>
          <div className="stat-footer">Installer / update downloads</div>
        </div>
        <div className="stat-tile">
          <div className="stat-top">
            <span>Update button clicks</span>
            <MousePointerClick size={18} color="var(--accent)" />
          </div>
          <div className="stat-value">{stats.updateClicks.toLocaleString()}</div>
          <div className="stat-footer">In-app Download update</div>
        </div>
      </div>

      <form className="panel-card form-grid" onSubmit={save}>
        <div className="card-header-clean">
          <h2>Website analytics</h2>
        </div>
        <p style={{ margin: 0, fontSize: 13, color: 'var(--text-muted)' }}>
          Counters sync from the desktop app (views + update downloads). You can adjust manually or
          wire your website download button later to the same fields.
        </p>
        <label>
          Site / app views
          <input
            type="number"
            min={0}
            value={draft.siteViews}
            onChange={(e) => setDraft((d) => ({ ...d, siteViews: Number(e.target.value) || 0 }))}
          />
        </label>
        <label>
          Download clicks
          <input
            type="number"
            min={0}
            value={draft.downloadClicks}
            onChange={(e) =>
              setDraft((d) => ({ ...d, downloadClicks: Number(e.target.value) || 0 }))
            }
          />
        </label>
        <label>
          Update button clicks
          <input
            type="number"
            min={0}
            value={draft.updateClicks}
            onChange={(e) => setDraft((d) => ({ ...d, updateClicks: Number(e.target.value) || 0 }))}
          />
        </label>
        <button className="btn btn-primary" type="submit">
          Save analytics
        </button>
        {msg && <p style={{ margin: 0, fontSize: 12, color: 'var(--text-muted)' }}>{msg}</p>}
      </form>
    </div>
  );
};
