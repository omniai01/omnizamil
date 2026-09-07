import React, { useMemo } from 'react';
import type { CountryStat, SystemMetrics } from '../types';
import type { AdminProduct } from '../lib/product';
import type { PlatformStat, VoiceStat, VoiceTodayStats } from '../lib/supabaseAdmin';

const GRAB_DEFAULT_PLATFORMS = ['youtube', 'instagram', 'tiktok', 'facebook'] as const;
const VOICE_DEFAULT_KINDS = ['studio', 'podcast', 'silence', 'batch', 'tts'] as const;

function normalizePlatformName(raw: string, isVoice: boolean): string {
  const key = raw.trim().toLowerCase();
  if (isVoice) {
    const voiceMap: Record<string, string> = {
      studio: 'Studio',
      podcast: 'Podcast',
      silence: 'Silence removed',
      batch: 'Batch',
      tts: 'TTS',
      export: 'Export',
    };
    if (voiceMap[key]) return voiceMap[key];
  }
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

function mergePlatforms(
  platforms: PlatformStat[] | undefined,
  isVoice: boolean,
): PlatformStat[] {
  const byKey = new Map<string, PlatformStat>();
  const defaults = isVoice ? VOICE_DEFAULT_KINDS : GRAB_DEFAULT_PLATFORMS;

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

  for (const key of defaults) {
    if (!byKey.has(key)) {
      byKey.set(key, { platform: key, downloads: 0, fails: 0 });
    }
  }

  const defaultRows = defaults.map((key) => {
    const row = byKey.get(key)!;
    return {
      platform: normalizePlatformName(row.platform, isVoice),
      downloads: row.downloads,
      fails: row.fails,
    };
  });

  const extras = [...byKey.entries()]
    .filter(([key]) => !(defaults as readonly string[]).includes(key))
    .map(([, row]) => ({
      platform: normalizePlatformName(row.platform, isVoice),
      downloads: row.downloads,
      fails: row.fails,
    }))
    .sort((a, b) => b.downloads - a.downloads);

  return [...defaultRows, ...extras];
}

function formatMs(ms: number): string {
  const n = Math.max(0, Math.round(ms));
  if (n < 1000) return `${n} ms`;
  const sec = n / 1000;
  if (sec < 60) return `${sec.toFixed(1)} s`;
  const min = Math.floor(sec / 60);
  const rem = Math.round(sec % 60);
  return `${min}m ${rem}s`;
}

export const MediaAnalytics: React.FC<{
  metrics: SystemMetrics;
  countries: CountryStat[];
  product?: AdminProduct;
  platforms?: PlatformStat[];
  voices?: VoiceStat[];
  voiceToday?: VoiceTodayStats;
}> = ({ metrics, countries, product = 'omni', platforms, voices, voiceToday }) => {
  const isGrab = product === 'omnigrab';
  const isVoice = product === 'shiftvoice';
  const peak = Math.max(1, ...countries.map((c) => c.images + c.videos));
  const platformRows = useMemo(
    () => (isGrab || isVoice ? mergePlatforms(platforms, isVoice) : []),
    [isGrab, isVoice, platforms],
  );
  const voiceRows = useMemo(() => (isVoice ? voices || [] : []), [isVoice, voices]);

  return (
    <div style={{ display: 'grid', gap: 18 }}>
      <div className="stat-grid" style={{ gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' }}>
        <div className="stat-tile">
          <div className="stat-top">
            <span>{isGrab ? 'Total downloads' : isVoice ? 'Characters generated' : 'Total images cleaned'}</span>
          </div>
          <div className="stat-value">{metrics.totalImagesCleaned.toLocaleString()}</div>
        </div>
        <div className="stat-tile">
          <div className="stat-top">
            <span>{isGrab ? 'Videos downloaded' : isVoice ? 'Exports' : 'Total videos cleaned'}</span>
          </div>
          <div className="stat-value">{metrics.totalVideosCleaned.toLocaleString()}</div>
        </div>
      </div>

      {isVoice && voiceToday && (
        <div className="stat-grid" style={{ gridTemplateColumns: 'repeat(3, minmax(0, 1fr))' }}>
          <div className="stat-tile">
            <div className="stat-top">
              <span>Process time today</span>
            </div>
            <div className="stat-value" style={{ fontSize: 22 }}>
              {formatMs(voiceToday.processMs)}
            </div>
          </div>
          <div className="stat-tile">
            <div className="stat-top">
              <span>Chars today</span>
            </div>
            <div className="stat-value">{voiceToday.chars.toLocaleString()}</div>
          </div>
          <div className="stat-tile">
            <div className="stat-top">
              <span>Pending jobs</span>
            </div>
            <div className="stat-value">{voiceToday.pendingJobs.toLocaleString()}</div>
          </div>
        </div>
      )}

      {(isGrab || isVoice) && (
        <div className="panel-card">
          <div className="card-header-clean">
            <h2>{isVoice ? 'Jobs by kind' : 'Downloads by platform'}</h2>
          </div>
          {platformRows.map((p) => (
            <div key={p.platform} className="country-row">
              <div>
                <strong>{p.platform}</strong>
                <div style={{ color: 'var(--text-muted)', fontSize: 12 }}>
                  {p.downloads} {isVoice ? 'ok' : 'downloads'} · {p.fails} fails
                </div>
              </div>
              <strong>{p.downloads}</strong>
            </div>
          ))}
        </div>
      )}

      {isVoice && (
        <div className="panel-card">
          <div className="card-header-clean">
            <h2>Top voices</h2>
          </div>
          {!voiceRows.length ? (
            <div className="empty-hint">Voice usage appears after Studio / Podcast generates sync.</div>
          ) : (
            voiceRows.map((v) => (
              <div key={v.voice} className="country-row">
                <div>
                  <strong>{v.voice}</strong>
                  <div style={{ color: 'var(--text-muted)', fontSize: 12 }}>
                    {v.chars.toLocaleString()} chars · {v.ok} ok · {v.fails} fails
                  </div>
                </div>
                <strong>{v.events}</strong>
              </div>
            ))
          )}
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
                    {c.devices} devices · {c.images.toLocaleString()}{' '}
                    {isGrab ? 'downloads' : isVoice ? 'chars' : 'images'} ·{' '}
                    {c.videos.toLocaleString()} {isVoice ? 'exports' : 'videos'}
                  </div>
                  <div className="progress-track" style={{ marginTop: 6 }}>
                    <div className="progress-fill" style={{ width: `${pct}%` }} />
                  </div>
                </div>
                <strong>{total.toLocaleString()}</strong>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
