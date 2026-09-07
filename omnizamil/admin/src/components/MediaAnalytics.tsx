import React, { useMemo } from 'react';
import type { CountryStat, SystemMetrics } from '../types';
import type { AdminProduct } from '../lib/product';
import type { PlatformStat } from '../lib/supabaseAdmin';

const DEFAULT_PLATFORMS = ['youtube', 'instagram', 'tiktok', 'facebook'] as const;

function normalizePlatformName(raw: string): string {
  const key = raw.trim().toLowerCase();
  const map: Record<string, string> = {
    youtube: 'YouTube',
    yt: 'YouTube',
    instagram: 'Instagram',
    ig: 'Instagram',
    tiktok: 'TikTok',
    tt: 'TikTok',
    facebook: 'Facebook',
    fb: 'Facebook',
  };
  if (map[key]) return map[key];
  if (!raw) return 'Unknown';
  return raw.charAt(0).toUpperCase() + raw.slice(1);
}

function mergePlatforms(platforms: PlatformStat[] | undefined): PlatformStat[] {
  const byKey = new Map<string, PlatformStat>();

  for (const p of platforms || []) {
    const key = (p.platform || 'unknown').trim().toLowerCase();
    const prev = byKey.get(key);
    if (prev) {
      prev.downloads += Number(p.downloads) || 0;
      prev.fails += Number(p.fails) || 0;
    } else {
      byKey.set(key, {
        platform: key,
        downloads: Number(p.downloads) || 0,
        fails: Number(p.fails) || 0,
      });
    }
  }

  for (const key of DEFAULT_PLATFORMS) {
    if (!byKey.has(key)) {
      byKey.set(key, { platform: key, downloads: 0, fails: 0 });
    }
  }

  const defaults = DEFAULT_PLATFORMS.map((key) => {
    const row = byKey.get(key)!;
    return {
      platform: normalizePlatformName(row.platform),
      downloads: row.downloads,
      fails: row.fails,
    };
  });

  const extras = [...byKey.entries()]
    .filter(([key]) => !(DEFAULT_PLATFORMS as readonly string[]).includes(key))
    .map(([, row]) => ({
      platform: normalizePlatformName(row.platform),
      downloads: row.downloads,
      fails: row.fails,
    }))
    .sort((a, b) => b.downloads - a.downloads);

  return [...defaults, ...extras];
}

export const MediaAnalytics: React.FC<{
  metrics: SystemMetrics;
  countries: CountryStat[];
  product?: AdminProduct;
  platforms?: PlatformStat[];
}> = ({ metrics, countries, product = 'omni', platforms }) => {
  const isGrab = product === 'omnigrab';
  const peak = Math.max(1, ...countries.map((c) => c.images + c.videos));
  const platformRows = useMemo(
    () => (isGrab ? mergePlatforms(platforms) : []),
    [isGrab, platforms],
  );

  return (
    <div style={{ display: 'grid', gap: 18 }}>
      <div className="stat-grid" style={{ gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' }}>
        <div className="stat-tile">
          <div className="stat-top">
            <span>{isGrab ? 'Total downloads' : 'Total images cleaned'}</span>
          </div>
          <div className="stat-value">{metrics.totalImagesCleaned}</div>
        </div>
        <div className="stat-tile">
          <div className="stat-top">
            <span>{isGrab ? 'Videos downloaded' : 'Total videos cleaned'}</span>
          </div>
          <div className="stat-value">{metrics.totalVideosCleaned}</div>
        </div>
      </div>

      {isGrab && (
        <div className="panel-card">
          <div className="card-header-clean">
            <h2>Downloads by platform</h2>
          </div>
          {platformRows.map((p) => (
            <div key={p.platform} className="country-row">
              <div>
                <strong>{p.platform}</strong>
                <div style={{ color: 'var(--text-muted)', fontSize: 12 }}>
                  {p.downloads} downloads · {p.fails} fails
                </div>
              </div>
              <strong>{p.downloads}</strong>
            </div>
          ))}
        </div>
      )}

      <div className="panel-card">
        <div className="card-header-clean">
          <h2>Usage by country</h2>
        </div>
        {!countries.length ? (
          <div className="empty-hint">Country stats appear after devices register online.</div>
        ) : (
          countries.map((c) => {
            const total = c.images + c.videos;
            const pct = Math.round((total / peak) * 100);
            return (
              <div key={c.countryCode || c.country} className="country-row">
                <div>
                  <strong>
                    {c.country} {c.countryCode ? `(${c.countryCode})` : ''}
                  </strong>
                  <div style={{ color: 'var(--text-muted)', fontSize: 12 }}>
                    {c.devices} devices · {c.images} {isGrab ? 'downloads' : 'images'} ·{' '}
                    {c.videos} videos
                  </div>
                  <div className="progress-track" style={{ marginTop: 6 }}>
                    <div className="progress-fill" style={{ width: `${pct}%` }} />
                  </div>
                </div>
                <strong>{total}</strong>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
