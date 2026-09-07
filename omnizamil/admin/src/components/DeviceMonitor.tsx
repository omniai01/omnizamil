import React, { useMemo, useState } from 'react';
import type { DeviceInfo } from '../types';
import { sendNotification } from '../lib/supabaseAdmin';
import type { AdminProduct } from '../lib/product';

function exportDevicesExcel(rows: DeviceInfo[], product: AdminProduct = 'omni') {
  const isGrab = product === 'omnigrab';
  const header = [
    'User',
    'Hardware ID',
    'Status',
    'Device check',
    'Country',
    'CPU',
    'GPU',
    isGrab ? 'Downloads' : 'Images',
    'Videos',
    'Fails',
    'Process ms',
    ...(isGrab ? ['YouTube linked'] : []),
    'Registered',
    'Last ping',
  ];
  const lines = [
    header.join(','),
    ...rows.map((d) =>
      [
        d.userAlias,
        d.hwid,
        d.status,
        d.status === 'active' ? 'active' : 'inactive',
        d.country,
        d.cpu,
        d.gpu,
        d.imageCount,
        d.videoCount,
        d.failCount ?? 0,
        d.totalProcessMs ?? 0,
        ...(isGrab ? [d.youtubeLinked ? 'linked' : 'not linked'] : []),
        d.firstSeen,
        d.lastPing,
      ]
        .map((v) => `"${String(v ?? '').replace(/"/g, '""')}"`)
        .join(','),
    ),
  ];
  const bom = '\uFEFF';
  const blob = new Blob([bom + lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${isGrab ? 'omnigrab' : 'omni'}-devices-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

type CheckMap = Record<string, 'active' | 'inactive' | 'unchecked'>;

export const DeviceMonitor: React.FC<{
  devices: DeviceInfo[];
  product?: AdminProduct;
  onDelete?: (hwid: string) => void;
  onRefresh?: () => void;
}> = ({ devices, product = 'omni', onDelete, onRefresh }) => {
  const [q, setQ] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [checkMsg, setCheckMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const [checks, setChecks] = useState<CheckMap>({});

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    const list = !s
      ? devices
      : devices.filter(
          (d) =>
            d.hwid.toLowerCase().includes(s) ||
            d.userAlias.toLowerCase().includes(s) ||
            d.country.toLowerCase().includes(s),
        );
    const rank = (status: string) => (status === 'active' ? 0 : status === 'choked' ? 1 : 2);
    return [...list].sort((a, b) => {
      const r = rank(a.status) - rank(b.status);
      if (r !== 0) return r;
      return a.userAlias.localeCompare(b.userAlias);
    });
  }, [devices, q]);

  const allFilteredSelected =
    filtered.length > 0 && filtered.every((d) => selected.has(d.hwid));

  const toggle = (hwid: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(hwid)) next.delete(hwid);
      else next.add(hwid);
      return next;
    });
  };

  const selectAll = () => {
    if (allFilteredSelected) {
      setSelected(new Set());
      return;
    }
    setSelected(new Set(filtered.map((d) => d.hwid)));
  };

  const selectInactive = () => {
    setSelected(new Set(filtered.filter((d) => d.status !== 'active').map((d) => d.hwid)));
  };

  const checkDevices = () => {
    onRefresh?.();
    const pool = selected.size ? filtered.filter((d) => selected.has(d.hwid)) : filtered;
    const next: CheckMap = { ...checks };
    for (const d of pool) {
      next[d.hwid] = d.status === 'active' ? 'active' : 'inactive';
    }
    setChecks(next);
    const active = pool.filter((d) => d.status === 'active').length;
    const inactive = pool.length - active;
    setCheckMsg(
      `Device check done on ${pool.length}: ${active} active · ${inactive} inactive.`,
    );
  };

  const notifySelected = async () => {
    const targets = filtered.filter((d) => selected.has(d.hwid));
    if (!targets.length) {
      setCheckMsg('Select one or more devices first.');
      return;
    }
    setBusy(true);
    setCheckMsg('');
    try {
      const appName = product === 'omnigrab' ? 'OmniGrab' : 'Omni-Removal';
      for (const d of targets) {
        await sendNotification(product, {
          title: `Please open ${appName}`,
          body: `Hi ${d.userAlias || 'there'} — your device looks inactive. Open ${appName} so we can keep you connected and ready.`,
          targetHwid: d.hwid,
        });
      }
      setCheckMsg(`Sent activation message to ${targets.length} device(s).`);
    } catch (err) {
      setCheckMsg(err instanceof Error ? err.message : 'Notify failed');
    } finally {
      setBusy(false);
    }
  };

  const exportSelected = () => {
    const rows = selected.size ? filtered.filter((d) => selected.has(d.hwid)) : filtered;
    if (!rows.length) {
      setCheckMsg('No devices to export.');
      return;
    }
    exportDevicesExcel(rows, product);
    setCheckMsg(`Exported ${rows.length} row(s) to Excel-compatible CSV.`);
  };

  const isGrab = product === 'omnigrab';
  const appLabel = isGrab ? 'OmniGrab' : 'Omni-Removal';

  const checkLabel = (d: DeviceInfo) => {
    const c = checks[d.hwid];
    if (!c || c === 'unchecked') return { text: 'Not checked', cls: 'wait' };
    if (c === 'active') return { text: 'Active', cls: 'ok' };
    return { text: 'Inactive', cls: 'bad' };
  };

  return (
    <div className="panel-card">
      <div className="card-header-clean" style={{ flexWrap: 'wrap', gap: 10 }}>
        <h2>Bound devices</h2>
        <input
          className="search-input"
          placeholder="Search HWID, name, country…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>

      <div className="device-toolbar">
        <button type="button" className="btn btn-ghost" onClick={selectAll}>
          {allFilteredSelected ? 'Clear selection' : 'Select all'}
        </button>
        <button type="button" className="btn btn-ghost" onClick={selectInactive}>
          Select inactive
        </button>
        <button type="button" className="btn btn-secondary" onClick={checkDevices}>
          Device check
        </button>
        <button
          type="button"
          className="btn btn-primary"
          disabled={busy || !selected.size}
          onClick={() => void notifySelected()}
        >
          Notify selected
        </button>
        <button type="button" className="btn btn-secondary" onClick={exportSelected}>
          Export Excel
        </button>
        <span className="device-sel-count">{selected.size} selected</span>
      </div>
      {checkMsg && <p className="device-toolbar-msg">{checkMsg}</p>}

      {!filtered.length ? (
        <div className="empty-hint">
          No devices yet — open the {appLabel} desktop app and enter a name. Devices register
          automatically.
        </div>
      ) : (
        <div className="devices-table-wrap">
          <table className="data-table devices-table">
            <thead>
              <tr>
                <th className="col-check">
                  <input
                    type="checkbox"
                    checked={allFilteredSelected}
                    onChange={selectAll}
                    aria-label="Select all"
                  />
                </th>
                <th className="col-status">Status</th>
                <th className="col-dcheck">Device check</th>
                <th className="col-user">User</th>
                <th className="col-hwid">Hardware ID</th>
                {isGrab ? <th className="col-yt">YouTube</th> : null}
                <th className="col-country">Country</th>
                <th className="col-hw">Hardware</th>
                <th className="col-media">Media</th>
                <th className="col-time">Registered</th>
                <th className="col-time">Last ping</th>
                {onDelete ? <th className="col-actions" /> : null}
              </tr>
            </thead>
            <tbody>
              {filtered.map((d) => {
                const ck = checkLabel(d);
                return (
                  <tr key={d.hwid} className={selected.has(d.hwid) ? 'row-selected' : undefined}>
                    <td className="col-check">
                      <input
                        type="checkbox"
                        checked={selected.has(d.hwid)}
                        onChange={() => toggle(d.hwid)}
                        aria-label={`Select ${d.userAlias}`}
                      />
                    </td>
                    <td className="col-status">
                      <span className={`status-pill ${d.status}`}>{d.status}</span>
                    </td>
                    <td className="col-dcheck">
                      <span className={`dcheck-pill ${ck.cls}`}>{ck.text}</span>
                    </td>
                    <td className="col-user">
                      <strong>{d.userAlias}</strong>
                    </td>
                    <td className="col-hwid">{d.hwid}</td>
                    {isGrab ? (
                      <td className="col-yt">
                        <span className={`dcheck-pill ${d.youtubeLinked ? 'ok' : 'wait'}`}>
                          {d.youtubeLinked ? 'Linked' : 'Not linked'}
                        </span>
                      </td>
                    ) : null}
                    <td className="col-country">{d.country || '—'}</td>
                    <td className="col-hw">
                      <div className="hw-cell" title={`${d.cpu}\n${d.gpu}`}>
                        <div>{d.cpu}</div>
                        <div className="hw-cell-sub">{d.gpu}</div>
                      </div>
                    </td>
                    <td className="col-media">
                      {isGrab
                        ? `${d.imageCount} DL · ${d.videoCount} vid`
                        : `${d.imageCount} img · ${d.videoCount} vid`}
                    </td>
                    <td className="col-time">{d.firstSeen}</td>
                    <td className="col-time">{d.lastPing}</td>
                    {onDelete ? (
                      <td className="col-actions">
                        <button
                          type="button"
                          className="btn btn-ghost"
                          onClick={() => {
                            if (window.confirm(`Delete device ${d.userAlias} (${d.hwid})?`)) {
                              onDelete(d.hwid);
                            }
                          }}
                        >
                          Delete
                        </button>
                      </td>
                    ) : null}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
