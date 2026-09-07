import { NavLink } from 'react-router-dom';
import {
  IconBell,
  IconBulk,
  IconDashboard,
  IconDownloads,
  IconSettings,
  IconShield,
  IconShiftZero,
  IconSingle,
  IconVideo,
} from './Icons';
import { useApp } from '@/lib/store';

const links = [
  { to: '/', label: 'Dashboard', icon: IconDashboard, end: true },
  { to: '/single-image', label: 'Single Image', icon: IconSingle },
  { to: '/bulk-image', label: 'Bulk Image', icon: IconBulk },
  { to: '/single-video', label: 'Single Video', icon: IconVideo },
  { to: '/bulk-video', label: 'Bulk Video', icon: IconBulk },
  { to: '/downloads', label: 'Downloads', icon: IconDownloads },
  { to: '/notifications', label: 'Notifications', icon: IconBell },
  { to: '/settings', label: 'Settings', icon: IconSettings },
  { to: '/shiftzero', label: 'ShiftZero', icon: IconShiftZero },
  { to: '/support', label: 'Support', icon: IconShield },
];

function OmniMark() {
  return (
    <svg className="brand-mark" viewBox="0 0 36 36" fill="none" aria-hidden>
      <circle cx="18" cy="18" r="16" stroke="#5fd4cb" strokeWidth="2.2" />
      <circle cx="18" cy="18" r="9" stroke="#fff" strokeWidth="2" />
      <circle cx="18" cy="18" r="3.2" fill="#5fd4cb" />
      <path
        d="M18 2v4M18 30v4M2 18h4M30 18h4"
        stroke="#5fd4cb"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function Sidebar() {
  const { queueProgress } = useApp();
  const total = queueProgress.total || 0;
  const done = queueProgress.done;
  const pct = queueProgress.pct;

  return (
    <aside className="sidebar">
      <div className="brand">
        <OmniMark />
        <div className="brand-text">
          <h1>Omni-Removal</h1>
          <p>Watermark cleanup</p>
        </div>
      </div>

      <nav className="nav">
        {links.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
          >
            <Icon />
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>

      <div className="sidebar-foot glass-card">
        <div className="queue-meta">
          <div className="row">
            <span>
              {done} of {total || 0} done
            </span>
          </div>
          <div className="progress-track">
            <div className="progress-fill" style={{ width: `${pct}%` }} />
          </div>
          <div className="row" style={{ marginTop: 8, marginBottom: 0 }}>
            <span>{pct}% complete</span>
          </div>
        </div>
      </div>
    </aside>
  );
}
