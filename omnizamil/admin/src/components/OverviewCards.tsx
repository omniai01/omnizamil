import React, { useMemo } from 'react';
import { Cpu, Flame, Image, Link2, Unlink, Video } from 'lucide-react';
import type { DeviceInfo, SystemMetrics } from '../types';
import type { AdminProduct } from '../lib/product';

export const OverviewCards: React.FC<{
  metrics: SystemMetrics;
  product?: AdminProduct;
  devices?: DeviceInfo[];
}> = ({ metrics, product = 'omni', devices = [] }) => {
  const isGrab = product === 'omnigrab';
  const imagePercent = Math.min(
    100,
    Math.round((metrics.totalImagesCleaned / Math.max(1, metrics.targetImageGoal)) * 100),
  );
  const videoPercent = Math.min(
    100,
    Math.round((metrics.totalVideosCleaned / Math.max(1, metrics.targetVideoGoal)) * 100),
  );

  const ytStats = useMemo(() => {
    if (!isGrab) return null;
    const linked = devices.filter((d) => d.youtubeLinked).length;
    const notLinked = Math.max(0, devices.length - linked);
    return { linked, notLinked, total: devices.length };
  }, [devices, isGrab]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <div className="stat-grid">
        <div className="stat-tile">
          <div className="stat-top">
            <span>Total bound devices</span>
            <Cpu size={18} color="var(--accent)" />
          </div>
          <div className="stat-value">{metrics.totalDevices}</div>
          <div className="stat-footer">
            <span style={{ color: 'var(--success)', fontWeight: 600 }}>
              {metrics.activeDevicesCount} active
            </span>
            <span>·</span>
            <span>{metrics.offlineDevicesCount} inactive</span>
          </div>
        </div>
        <div className="stat-tile">
          <div className="stat-top">
            <span>Inactive (not using)</span>
            <Cpu size={18} color="var(--text-muted)" />
          </div>
          <div className="stat-value">{metrics.offlineDevicesCount}</div>
          <div className="stat-footer">Registered but no recent ping</div>
        </div>
        <div className="stat-tile">
          <div className="stat-top">
            <span>Choked devices</span>
            <Flame size={18} color="var(--warning)" />
          </div>
          <div className="stat-value">{metrics.chokedDevicesCount}</div>
          <div className="stat-footer">High load / thermal</div>
        </div>
        <div className="stat-tile">
          <div className="stat-top">
            <span>{isGrab ? 'Total downloads' : 'Images cleaned'}</span>
            <Image size={18} color="var(--accent)" />
          </div>
          <div className="stat-value">{metrics.totalImagesCleaned}</div>
          <div className="stat-footer">Target {metrics.targetImageGoal.toLocaleString()}</div>
        </div>
        <div className="stat-tile">
          <div className="stat-top">
            <span>{isGrab ? 'Videos downloaded' : 'Videos cleaned'}</span>
            <Video size={18} color="var(--accent)" />
          </div>
          <div className="stat-value">{metrics.totalVideosCleaned}</div>
          <div className="stat-footer">Target {metrics.targetVideoGoal.toLocaleString()}</div>
        </div>
        {ytStats ? (
          <>
            <div className="stat-tile">
              <div className="stat-top">
                <span>YouTube linked</span>
                <Link2 size={18} color="var(--success)" />
              </div>
              <div className="stat-value">{ytStats.linked}</div>
              <div className="stat-footer">Local session on device (no passwords stored)</div>
            </div>
            <div className="stat-tile">
              <div className="stat-top">
                <span>YouTube not linked</span>
                <Unlink size={18} color="var(--text-muted)" />
              </div>
              <div className="stat-value">{ytStats.notLinked}</div>
              <div className="stat-footer">Of {ytStats.total} listed devices</div>
            </div>
          </>
        ) : null}
      </div>

      {ytStats ? (
        <div className="panel-card">
          <div className="card-header-clean">
            <h2>YouTube link (privacy)</h2>
          </div>
          <p style={{ margin: 0, fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.5 }}>
            Devices only report <strong>linked</strong> or <strong>not linked</strong>. ShiftGrab keeps
            Google email, password, and cookies on the user’s PC — admin never receives credentials.
          </p>
        </div>
      ) : null}

      <div className="panel-card">
        <div className="card-header-clean">
          <h2>Targets (1,000,000)</h2>
        </div>
        <div style={{ display: 'grid', gap: 14 }}>
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 6 }}>
              <span>{isGrab ? 'Download progress' : 'Image progress'}</span>
              <strong>
                {metrics.totalImagesCleaned.toLocaleString()} /{' '}
                {metrics.targetImageGoal.toLocaleString()} ({imagePercent}%)
              </strong>
            </div>
            <div className="progress-track">
              <div className="progress-fill" style={{ width: `${imagePercent}%` }} />
            </div>
          </div>
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 6 }}>
              <span>Video progress</span>
              <strong>
                {metrics.totalVideosCleaned.toLocaleString()} /{' '}
                {metrics.targetVideoGoal.toLocaleString()} ({videoPercent}%)
              </strong>
            </div>
            <div className="progress-track">
              <div className="progress-fill" style={{ width: `${videoPercent}%` }} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
