import React, { useState } from 'react';
import type { MaintenanceConfig } from '../types';

function formatEndTime(startedAt: string | null, durationMinutes: number): string | null {
  if (!startedAt || !durationMinutes || durationMinutes <= 0) return null;
  const start = new Date(startedAt).getTime();
  if (Number.isNaN(start)) return null;
  const end = new Date(start + durationMinutes * 60_000);
  return end.toLocaleString();
}

export const MaintenanceControl: React.FC<{
  config: MaintenanceConfig;
  onUpdateConfig: (c: MaintenanceConfig) => void;
}> = ({ config, onUpdateConfig }) => {
  const [draft, setDraft] = useState(config);

  React.useEffect(() => {
    setDraft(config);
  }, [config]);

  const apply = (next: MaintenanceConfig) => {
    setDraft(next);
    onUpdateConfig(next);
  };

  const toggleMaintenance = () => {
    const turningOn = !draft.isEnabled;
    apply({
      ...draft,
      isEnabled: turningOn,
      startedAt: turningOn ? new Date().toISOString() : null,
    });
  };

  const save = (e: React.FormEvent) => {
    e.preventDefault();
    onUpdateConfig(draft);
  };

  const endLabel = formatEndTime(draft.startedAt, draft.durationMinutes);

  return (
    <form className="panel-card form-grid" onSubmit={save}>
      <div className="card-header-clean">
        <h2>Maintenance & updates</h2>
      </div>

      <div className="toggle-row">
        <div>
          <strong>Maintenance mode</strong>
          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
            When ON, every desktop client (except allow-listed HWIDs) sees the premium maintenance
            screen and cannot use the app until you turn this OFF.
          </div>
        </div>
        <button
          type="button"
          className={`btn ${draft.isEnabled ? 'btn-warning' : 'btn-primary'}`}
          onClick={toggleMaintenance}
        >
          {draft.isEnabled ? 'ON' : 'OFF'}
        </button>
      </div>

      {draft.isEnabled && (
        <>
          <label>
            Timer (minutes, 0 = until I turn off)
            <input
              type="number"
              min={0}
              step={1}
              value={draft.durationMinutes}
              onChange={(e) => {
                const n = Math.max(0, Math.floor(Number(e.target.value) || 0));
                setDraft((d) => ({ ...d, durationMinutes: n }));
              }}
            />
          </label>
          {endLabel ? (
            <p style={{ margin: 0, fontSize: 12, color: 'var(--text-muted)' }}>
              Ends at {endLabel}
              {draft.startedAt ? ` (started ${new Date(draft.startedAt).toLocaleString()})` : ''}
            </p>
          ) : (
            <p style={{ margin: 0, fontSize: 12, color: 'var(--text-muted)' }}>
              No auto-end — stays on until you turn it off.
            </p>
          )}
        </>
      )}

      <label>
        Message shown on client
        <textarea
          rows={3}
          value={draft.message}
          onChange={(e) => setDraft((d) => ({ ...d, message: e.target.value }))}
        />
      </label>

      <label>
        Allowed HWIDs (comma-separated, skip lock)
        <input
          value={draft.allowedHwids.join(', ')}
          onChange={(e) =>
            setDraft((d) => ({
              ...d,
              allowedHwids: e.target.value
                .split(',')
                .map((s) => s.trim())
                .filter(Boolean),
            }))
          }
        />
      </label>

      <div className="toggle-row">
        <div>
          <strong>Lock engine while maintenance is on</strong>
        </div>
        <button
          type="button"
          className="btn"
          onClick={() => apply({ ...draft, lockEngine: !draft.lockEngine })}
        >
          {draft.lockEngine ? 'Locked' : 'Unlocked'}
        </button>
      </div>

      <hr style={{ border: 0, borderTop: '1px solid var(--border)', margin: '8px 0' }} />

      <div className="toggle-row">
        <div>
          <strong>Software update available</strong>
          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
            Clients get a download / uninstall / restart popup. Paste Drive or direct installer URL.
          </div>
        </div>
        <button
          type="button"
          className={`btn ${draft.forceUpdate ? 'btn-warning' : 'btn-primary'}`}
          onClick={() => apply({ ...draft, forceUpdate: !draft.forceUpdate })}
        >
          {draft.forceUpdate ? 'ON' : 'OFF'}
        </button>
      </div>

      <label>
        Latest version label
        <input
          value={draft.latestVersion}
          onChange={(e) => setDraft((d) => ({ ...d, latestVersion: e.target.value }))}
        />
      </label>

      <label>
        Download URL
        <input
          placeholder="https://drive.google.com/..."
          value={draft.updateUrl}
          onChange={(e) => setDraft((d) => ({ ...d, updateUrl: e.target.value }))}
        />
      </label>

      <label>
        Update message
        <textarea
          rows={3}
          value={draft.updateMessage}
          onChange={(e) => setDraft((d) => ({ ...d, updateMessage: e.target.value }))}
        />
      </label>

      <button className="btn btn-primary" type="submit">
        Save message & links
      </button>
      <p style={{ margin: 0, fontSize: 12, color: 'var(--text-muted)' }}>
        Last saved: {config.updatedAt}. Toggle ON/OFF saves immediately.
      </p>
    </form>
  );
};
