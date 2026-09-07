import React, { useState } from 'react';
import type { ErrorLog } from '../types';

function safeText(value: unknown, fallback = '—') {
  if (value == null) return fallback;
  if (typeof value === 'string') return value || fallback;
  try {
    return String(value);
  } catch {
    return fallback;
  }
}

export const ErrorLogs: React.FC<{
  logs: ErrorLog[];
  onResolveLog: (id: string) => void;
}> = ({ logs, onResolveLog }) => {
  const [selected, setSelected] = useState<ErrorLog | null>(null);
  const rows = Array.isArray(logs) ? logs : [];

  return (
    <div style={{ display: 'grid', gap: 18, gridTemplateColumns: selected ? '1.2fr 1fr' : '1fr' }}>
      <div className="panel-card">
        <div className="card-header-clean">
          <h2>Error feed</h2>
        </div>
        {!rows.length ? (
          <div className="empty-hint">No errors reported yet.</div>
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Severity</th>
                  <th>User</th>
                  <th>Type</th>
                  <th>When</th>
                  <th>Status</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {rows.map((log) => (
                  <tr key={log.id}>
                    <td>{safeText(log.severity)}</td>
                    <td>{safeText(log.userAlias)}</td>
                    <td>{safeText(log.errorType)}</td>
                    <td>{safeText(log.timestamp)}</td>
                    <td>{safeText(log.status)}</td>
                    <td>
                      <button className="btn btn-ghost" type="button" onClick={() => setSelected(log)}>
                        View
                      </button>
                      {log.status !== 'resolved' && (
                        <button
                          className="btn btn-primary"
                          type="button"
                          onClick={() => onResolveLog(log.id)}
                        >
                          Resolve
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {selected && (
        <div className="panel-card">
          <div className="card-header-clean">
            <h2>Detail</h2>
            <button className="btn btn-ghost" type="button" onClick={() => setSelected(null)}>
              Close
            </button>
          </div>
          <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>
            {safeText(selected.userAlias)} · {safeText(selected.timestamp)}
          </p>
          <p style={{ fontWeight: 600 }}>{safeText(selected.message, '(no message)')}</p>
          <pre
            style={{
              whiteSpace: 'pre-wrap',
              background: '#f3f7f8',
              borderRadius: 10,
              padding: 12,
              fontSize: 11,
              overflow: 'auto',
              maxHeight: 280,
            }}
          >
            {safeText(selected.stackTrace, 'No stack trace')}
          </pre>
        </div>
      )}
    </div>
  );
};
