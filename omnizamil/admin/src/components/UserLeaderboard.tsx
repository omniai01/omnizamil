import React from 'react';
import { Trophy } from 'lucide-react';
import type { UserMetric } from '../types';
import type { AdminProduct } from '../lib/product';

export const UserLeaderboard: React.FC<{ users: UserMetric[]; product?: AdminProduct }> = ({
  users,
  product = 'omni',
}) => {
  const isGrab = product === 'omnigrab';
  const sorted = [...users].sort(
    (a, b) =>
      b.totalImagesCleaned + b.totalVideosProcessed - (a.totalImagesCleaned + a.totalVideosProcessed),
  );

  return (
    <div className="panel-card">
      <div className="card-header-clean">
        <h2>
          <Trophy size={18} color="var(--accent)" /> Registered users
        </h2>
      </div>
      {!sorted.length ? (
        <div className="empty-hint">Users appear here when devices register.</div>
      ) : (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Name</th>
                <th>Hardware ID</th>
                <th>Country</th>
                <th>Joined</th>
                <th>{isGrab ? 'Downloads' : 'Images'}</th>
                <th>Videos</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((u) => (
                <tr key={u.id}>
                  <td>{u.rank}</td>
                  <td>
                    <strong>{u.username}</strong>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{u.badge}</div>
                  </td>
                  <td style={{ fontFamily: 'ui-monospace, monospace', fontSize: 11 }}>{u.deviceHwid}</td>
                  <td>{u.country}</td>
                  <td>{u.firstSeen}</td>
                  <td>{u.totalImagesCleaned}</td>
                  <td>{u.totalVideosProcessed}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
