import React, { useMemo, useState } from 'react';
import type { DeviceInfo } from '../types';
import type { AdminProduct } from '../lib/product';

function formatMs(ms: number) {
  if (!ms) return '0s';
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function formatBytes(bytes: number) {
  if (!bytes) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export const LiveAnalytics: React.FC<{ devices: DeviceInfo[]; product?: AdminProduct }> = ({
  devices,
  product = 'omni',
}) => {
  const isGrab = product === 'omnigrab';
  const isVoice = product === 'shiftvoice';
  const [q, setQ] = useState('');

  const list = useMemo(() => {
    const s = q.trim().toLowerCase();
    const filtered = !s
      ? devices
      : devices.filter(
          (d) =>
            d.hwid.toLowerCase().includes(s) ||
            d.userAlias.toLowerCase().includes(s) ||
            d.country.toLowerCase().includes(s),
        );
    return [...filtered].sort((a, b) => {
      const rank = (status: string) => (status === 'active' ? 0 : status === 'choked' ? 1 : 2);
      const r = rank(a.status) - rank(b.status);
      if (r !== 0) return r;
      return b.imageCount + b.videoCount - (a.imageCount + a.videoCount);
    });
  }, [devices, q]);

  const totals = useMemo(() => {
    return list.reduce(
      (acc, d) => {
        acc.images += d.imageCount;
        acc.videos += d.videoCount;
        acc.fails += d.failCount || 0;
        acc.ms += d.totalProcessMs || 0;
        acc.bytes += d.bytesProcessed || 0;
        return acc;
      },
      { images: 0, videos: 0, fails: 0, ms: 0, bytes: 0 },
    );
  }, [list]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div className="stat-grid">
        <div className="stat-tile">
          <div className="stat-top">
            <span>{isGrab ? 'Total downloads' : isVoice ? 'Characters' : 'Images processed'}</span>
          </div>
          <div className="stat-value">{totals.images}</div>
          <div className="stat-footer">Across {list.length} device(s)</div>
        </div>
        <div className="stat-tile">
          <div className="stat-top">
            <span>{isGrab ? 'Videos downloaded' : isVoice ? 'Exports' : 'Videos processed'}</span>
          </div>
          <div className="stat-value">{totals.videos}</div>
          <div className="stat-footer">{isGrab ? 'Successful downloads' : isVoice ? 'Successful exports' : 'Successful cleans'}</div>
        </div>
        <div className="stat-tile">
          <div className="stat-top">
            <span>{isGrab ? 'Failed downloads' : isVoice ? 'Failed jobs' : 'Failed jobs'}</span>
          </div>
          <div className="stat-value">{totals.fails}</div>
          <div className="stat-footer">{isGrab ? 'Errors during download' : isVoice ? 'Errors during TTS' : 'Errors during clean'}</div>
        </div>
        <div className="stat-tile">
          <div className="stat-top">
            <span>Total process time</span>
          </div>
          <div className="stat-value">{formatMs(totals.ms)}</div>
          <div className="stat-footer">Data weight {formatBytes(totals.bytes)}</div>
        </div>
      </div>

      <div className="panel-card">
        <div className="card-header-clean" style={{ flexWrap: 'wrap', gap: 10 }}>
          <h2>Live analytics by device</h2>
          <input
            className="search-input"
            placeholder="Search user / HWID…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        {!list.length ? (
          <div className="empty-hint">No device analytics yet.</div>
        ) : (
          <div className="live-table-wrap">
            <table className="data-table live-table">
              <thead>
                <tr>
                  <th className="lt-num">#</th>
                  <th className="lt-user">User</th>
                  <th className="lt-hwid">Device ID</th>
                  <th className="lt-status">Status</th>
                  <th className="lt-num">{isGrab ? 'DL' : isVoice ? 'Chars' : 'Img'}</th>
                  <th className="lt-num">Vid</th>
                  <th className="lt-num">Fail</th>
                  <th className="lt-time">Process</th>
                  <th className="lt-bytes">Weight</th>
                  <th className="lt-country">Country</th>
                </tr>
              </thead>
              <tbody>
                {list.map((d, i) => (
                  <tr key={d.hwid}>
                    <td className="lt-num">{i + 1}</td>
                    <td className="lt-user">
                      <strong>{d.userAlias}</strong>
                    </td>
                    <td className="lt-hwid" title={d.hwid}>
                      {d.hwid}
                    </td>
                    <td className="lt-status">
                      <span className={`status-pill ${d.status}`}>{d.status}</span>
                    </td>
                    <td className="lt-num">{d.imageCount}</td>
                    <td className="lt-num">{d.videoCount}</td>
                    <td className="lt-num">{d.failCount || 0}</td>
                    <td className="lt-time">{formatMs(d.totalProcessMs || 0)}</td>
                    <td className="lt-bytes">{formatBytes(d.bytesProcessed || 0)}</td>
                    <td className="lt-country">{d.country || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
