import { useEffect, useState } from 'react';
import { useControl } from '@/lib/control';

function formatElapsed(ms: number) {
  const sec = Math.floor(ms / 1000);
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

/** Premium full-screen maintenance lock from admin. */
export function MaintenanceGate({ children }: { children: React.ReactNode }) {
  const { locked, settings, refreshRemote } = useControl();
  const [dots, setDots] = useState('');
  const [elapsed, setElapsed] = useState('00:00');
  const [startedAt, setStartedAt] = useState<number | null>(null);

  useEffect(() => {
    if (!locked) {
      setStartedAt(null);
      setElapsed('00:00');
      return;
    }
    const start = Date.now();
    setStartedAt(start);
    const t = window.setInterval(() => {
      setDots((d) => (d.length >= 3 ? '' : `${d}.`));
      setElapsed(formatElapsed(Date.now() - start));
    }, 450);
    const poll = window.setInterval(() => void refreshRemote(), 45_000);
    return () => {
      window.clearInterval(t);
      window.clearInterval(poll);
    };
  }, [locked, refreshRemote]);

  if (!locked) return <>{children}</>;

  return (
    <div className="maintenance-gate premium">
      <div className="maint-glow" aria-hidden />
      <div className="maintenance-card premium-card">
        <div className="maint-orb" aria-hidden>
          <span className="maint-ring" />
          <span className="maint-ring delay" />
          <span className="maint-core" />
        </div>
        <p className="maint-brand">Omni-Removal</p>
        <h1>Under maintenance</h1>
        <p className="maint-msg">
          {settings?.maintenance_message ||
            'Omni-Removal is under maintenance. Please try again later.'}
        </p>
        <div className="maint-timer" aria-live="polite">
          {startedAt ? elapsed : '00:00'}
        </div>
        <div className="maint-loader" aria-hidden>
          <span />
          <span />
          <span />
        </div>
        <p className="maintenance-hint">Waiting for admin to reopen the service{dots}</p>
      </div>
    </div>
  );
}
