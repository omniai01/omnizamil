import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  IconCheck,
  IconClock,
  IconDownloads,
  IconImage,
  IconVideo,
} from '@/components/Icons';
import { useApp } from '@/lib/store';
import type { ActivityItem } from '@/lib/types';

const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

type Period = 'daily' | 'weekly' | 'monthly' | 'yearly';

function niceChartScale(peak: number) {
  const raw = Math.max(4, Math.ceil(peak * 1.25));
  const step = raw <= 10 ? 2 : raw <= 25 ? 5 : raw <= 50 ? 10 : 20;
  const max = Math.ceil(raw / step) * step;
  const ticks: number[] = [];
  for (let t = 0; t <= max; t += step) ticks.push(t);
  return { max, ticks };
}

function inPeriod(ts: number, period: Period) {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  if (period === 'daily') return ts >= start.getTime();
  if (period === 'weekly') {
    const day = (start.getDay() + 6) % 7;
    start.setDate(start.getDate() - day);
    return ts >= start.getTime();
  }
  if (period === 'monthly') {
    start.setDate(1);
    return ts >= start.getTime();
  }
  start.setMonth(0, 1);
  return ts >= start.getTime();
}

export function DashboardPage() {
  const { state, successPct, avgSeconds, downloadHistoryItem } = useApp();
  const [period, setPeriod] = useState<Period>('weekly');
  const weekly = state.stats.weekly;
  const peak = Math.max(...weekly, 1);
  const { max, ticks } = niceChartScale(peak);

  const activity = useMemo(() => {
    return state.activity
      .filter((a: ActivityItem) => inPeriod(a.timestamp, period))
      .slice(0, 8);
  }, [state.activity, period]);

  return (
    <div className="page-wrap">
      <div className="page-header">
        <div>
          <h2>Dashboard</h2>
          <p>Omni-Removal local cleanup overview</p>
        </div>
      </div>

      <div className="metrics">
        <div className="metric-card" style={{ animationDelay: '0.02s' }}>
          <div>
            <div className="label">Images cleaned</div>
            <div className="value">{state.stats.imagesCleaned}</div>
          </div>
          <div className="icon">
            <IconImage width={20} height={20} />
          </div>
        </div>
        <div className="metric-card" style={{ animationDelay: '0.06s' }}>
          <div>
            <div className="label">Videos cleaned</div>
            <div className="value">{state.stats.videosCleaned}</div>
          </div>
          <div className="icon">
            <IconVideo width={20} height={20} />
          </div>
        </div>
        <div className="metric-card" style={{ animationDelay: '0.1s' }}>
          <div>
            <div className="label">Success rate</div>
            <div className="value">{successPct}%</div>
          </div>
          <div className="icon">
            <IconCheck width={20} height={20} />
          </div>
        </div>
        <div className="metric-card" style={{ animationDelay: '0.14s' }}>
          <div>
            <div className="label">Avg process time</div>
            <div className="value">{avgSeconds ? `${avgSeconds.toFixed(1)}s` : '—'}</div>
          </div>
          <div className="icon">
            <IconClock width={20} height={20} />
          </div>
        </div>
      </div>

      <div className="grid-2">
        <section className="panel">
          <div className="panel-head">
            <h3>Recent activity</h3>
            <Link className="linkish" to="/downloads">
              View all
            </Link>
          </div>
          <div className="period-filters">
            {(['daily', 'weekly', 'monthly', 'yearly'] as Period[]).map((p) => (
              <button
                key={p}
                type="button"
                className={`chip ${period === p ? 'active' : ''}`}
                onClick={() => setPeriod(p)}
              >
                {p[0]!.toUpperCase() + p.slice(1)}
              </button>
            ))}
          </div>
          {activity.length === 0 ? (
            <div className="empty">No activity in this period yet.</div>
          ) : (
            <div className="activity-card-list">
              {activity.map((item, index) => (
                <div key={item.id} className="activity-card">
                  <span className="activity-num">{index + 1}</span>
                  <span className="activity-icon">
                    {item.type === 'video' ? (
                      <IconVideo width={14} height={14} />
                    ) : (
                      <IconImage width={14} height={14} />
                    )}
                  </span>
                  <div className="activity-meta">
                    <span className="activity-name" title={item.name}>
                      {item.name}
                    </span>
                    <span className="activity-time">{item.time}</span>
                  </div>
                  <span className={`badge ${item.status}`}>
                    {item.status === 'cleaned' ? 'Cleaned' : 'Failed'}
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="panel">
          <div className="panel-head">
            <h3>Recent downloads</h3>
            <Link className="linkish" to="/downloads">
              Open
            </Link>
          </div>
          {state.downloads.length === 0 ? (
            <div className="empty">Cleaned files will appear here for quick re-download.</div>
          ) : (
            <div className="dash-dl-list">
              {state.downloads.slice(0, 6).map((item, index) => (
                <div key={item.id} className="dash-dl-card">
                  <span className="dash-dl-num">{index + 1}</span>
                  {item.blobUrl && item.type === 'image' ? (
                    <img className="dash-dl-thumb" src={item.blobUrl} alt="" />
                  ) : item.blobUrl && item.type === 'video' ? (
                    <video className="dash-dl-thumb" src={item.blobUrl} muted />
                  ) : (
                    <span className="dash-dl-thumb dash-dl-thumb-fallback" aria-hidden>
                      {item.type === 'video' ? (
                        <IconVideo width={16} height={16} />
                      ) : (
                        <IconImage width={16} height={16} />
                      )}
                    </span>
                  )}
                  <div className="dash-dl-meta">
                    <span className="dash-dl-name" title={item.name}>
                      {item.name}
                    </span>
                    <span className="dash-dl-type">
                      {item.type === 'video' ? 'Video' : 'Image'}
                      {item.sizeLabel ? ` · ${item.sizeLabel}` : ''}
                    </span>
                  </div>
                  <button
                    className="btn btn-easy btn-compact"
                    type="button"
                    onClick={() => downloadHistoryItem(item.id)}
                  >
                    <IconDownloads width={14} height={14} />
                    {item.filePath ? 'Open' : 'Save'}
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      <section className="panel chart-panel">
        <div className="panel-head">
          <h3>Weekly cleans</h3>
          <span className="chip active">This week</span>
        </div>
        <div className="chart-wrap">
          <svg className="chart-svg" viewBox="0 0 560 240" preserveAspectRatio="xMidYMid meet">
            {ticks.map((tick) => {
              const y = 40 + (1 - tick / max) * 150;
              return (
                <g key={tick}>
                  <line x1="48" y1={y} x2="530" y2={y} stroke="#edf1f3" strokeWidth="1" />
                  <text
                    x="36"
                    y={y + 4}
                    textAnchor="end"
                    fill="#1a2b32"
                    fontSize="11"
                    fontWeight="600"
                  >
                    {tick}
                  </text>
                </g>
              );
            })}
            {weekly.map((v, i) => {
              const x = 70 + i * 66;
              const barH = Math.max((v / max) * 150, v > 0 ? 14 : 10);
              const y = 190 - barH;
              return (
                <g key={days[i]}>
                  <rect
                    x={x - 16}
                    y={y}
                    width="32"
                    height={barH}
                    rx="8"
                    fill={v > 0 ? '#0b8f87' : '#d5e2e6'}
                  />
                  {v > 0 && (
                    <rect
                      x={x - 16}
                      y={y}
                      width="32"
                      height={Math.min(barH, 18)}
                      rx="8"
                      fill="#14c4ba"
                      opacity="0.55"
                    />
                  )}
                  {v > 0 && (
                    <text
                      x={x}
                      y={y - 10}
                      textAnchor="middle"
                      fill="#0a1a1f"
                      fontSize="12"
                      fontWeight="600"
                    >
                      {v}
                    </text>
                  )}
                  <text
                    x={x}
                    y="218"
                    textAnchor="middle"
                    fill="#12262e"
                    fontSize="11"
                    fontWeight="600"
                  >
                    {days[i]}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>
      </section>
    </div>
  );
}
