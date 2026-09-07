import { useEffect, useRef, useState, type ReactNode } from 'react';

type GateState = 'loading' | 'installing' | 'ready';

type DepItem = { ready: boolean; label: string };
type CompItem = { id: string; name: string; status: 'ready' | 'installing' | 'needed' };

function softStage(err: unknown): string {
  let raw = err instanceof Error ? err.message : String(err || '');
  raw = raw
    .replace(/^Error invoking remote method '[^']+':\s*/i, '')
    .replace(/^Error:\s*/i, '')
    .trim();
  if (/reinstall|fresh install|engine missing/i.test(raw)) {
    return 'Rebuilding system components from the installer…';
  }
  if (
    /ENOTFOUND|ECONNREFUSED|ECONNRESET|ETIMEDOUT|EAI_AGAIN|getaddrinfo|socket hang up|Internet connection failed|Waiting for connection/i.test(
      raw,
    )
  ) {
    return 'Waiting for connection… repair continues automatically.';
  }
  return 'Preparing Omni… repair continues automatically.';
}

function statusLabel(status: CompItem['status']) {
  if (status === 'ready') return 'Ready';
  if (status === 'installing') return '…';
  return 'Repairing';
}

const DEFAULT_COMPONENTS: CompItem[] = [
  { id: 'runtime', name: 'NFC-01', status: 'needed' },
  { id: 'packages', name: 'NFC-02', status: 'needed' },
  { id: 'media', name: 'NFC-03', status: 'needed' },
  { id: 'video', name: 'NFC-04', status: 'needed' },
];

export function DepsGate({ children }: { children: ReactNode }) {
  const [state, setState] = useState<GateState>('loading');
  const [message, setMessage] = useState('');
  const [percent, setPercent] = useState(0);
  const [stage, setStage] = useState('');
  const [image, setImage] = useState<DepItem | null>(null);
  const [video, setVideo] = useState<DepItem | null>(null);
  const [components, setComponents] = useState<CompItem[]>(DEFAULT_COMPONENTS);
  const [elapsedSec, setElapsedSec] = useState(0);
  const [targetPct, setTargetPct] = useState(0);
  const autoStarted = useRef(false);
  const installingRef = useRef(false);
  const unlockedOnce = useRef(false);

  const refreshStatus = async () => {
    if (!window.omni?.depsStatus) {
      setState('ready');
      return { ready: true, videoReady: true };
    }
    const status = await window.omni.depsStatus();
    setMessage(status.message);
    setImage(
      status.image
        ? { ready: status.image.ready, label: status.image.ready ? 'Ready' : 'Repairing' }
        : null,
    );
    setVideo(
      status.video
        ? { ready: status.video.ready, label: status.video.ready ? 'Ready' : 'Repairing' }
        : null,
    );
    if (status.components?.length) {
      setComponents(
        status.components.map((c) => ({
          id: c.id,
          name: c.name,
          status: c.status,
        })),
      );
    }
    const fullReady =
      Boolean(status.ready) &&
      Boolean(status.video?.ready ?? (status as { videoReady?: boolean }).videoReady);
    if (fullReady) {
      setState('ready');
      setPercent(100);
      unlockedOnce.current = true;
    } else if (!installingRef.current) {
      setState('installing');
    }
    return { ready: fullReady, videoReady: fullReady };
  };

  const install = async (opts?: { background?: boolean }) => {
    if (!window.omni?.depsEnsure) return;
    if (installingRef.current) return;
    const background = Boolean(opts?.background);
    installingRef.current = true;
    if (!background) {
      setState('installing');
      setPercent((p) => (p > 0 ? p : 0));
      setTargetPct(3);
      setElapsedSec(0);
      setStage('Installing system components from setup…');
      setComponents(DEFAULT_COMPONENTS.map((c) => ({ ...c, status: 'needed' })));
    }
    const off = window.omni.onDepsProgress?.((p) => {
      if (background && unlockedOnce.current) return;
      setStage(p.stage || 'Installing system components…');
      setTargetPct(Math.max(0, Math.min(100, Math.round(p.percent))));
      if (p.components?.length) {
        setComponents(
          p.components.map((c) => ({
            id: c.id,
            name: c.name,
            status: c.status,
          })),
        );
      }
      if (p.imageStatus) {
        setImage({
          ready: p.imageStatus === 'ready',
          label: p.imageStatus === 'ready' ? 'Ready' : p.imageStatus === 'installing' ? '…' : 'Repairing',
        });
      }
      if (p.videoStatus) {
        setVideo({
          ready: p.videoStatus === 'ready',
          label: p.videoStatus === 'ready' ? 'Ready' : p.videoStatus === 'installing' ? '…' : 'Repairing',
        });
      }
    });
    try {
      await window.omni.depsEnsure();
      const again = await refreshStatus();
      if (again?.ready) {
        if (!background) {
          setStage('Omni is ready');
          setPercent(100);
        }
        return;
      }
      if (!background) {
        setStage('Finishing setup… Omni continues automatically.');
        setState('installing');
      }
    } catch (err) {
      if (!background) {
        setStage(softStage(err));
        setState('installing');
      }
    } finally {
      installingRef.current = false;
      off?.();
    }
  };

  useEffect(() => {
    let cancelled = false;
    if (!window.omni?.depsStatus) {
      setState('ready');
      return;
    }
    void (async () => {
      try {
        const status = await refreshStatus();
        if (cancelled) return;
        if (!status?.ready && !autoStarted.current) {
          autoStarted.current = true;
          await install();
        }
      } catch {
        if (cancelled) return;
        setState('installing');
        setMessage('Preparing Omni from the installer…');
        if (!autoStarted.current) {
          autoStarted.current = true;
          void install();
        }
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Every 8s: if anything is missing, auto-heal (never asks the user).
  useEffect(() => {
    const tick = window.setInterval(() => {
      void (async () => {
        try {
          if (installingRef.current) return;
          const status = await window.omni?.depsStatus?.();
          if (!status) return;
          const fullReady =
            Boolean(status.ready) &&
            Boolean(status.video?.ready ?? (status as { videoReady?: boolean }).videoReady);
          if (fullReady) {
            if (state !== 'ready') {
              setState('ready');
              setPercent(100);
              unlockedOnce.current = true;
            }
            return;
          }
          if (unlockedOnce.current || state === 'ready') {
            await install({ background: true });
          } else {
            await install();
          }
        } catch {
          /* ignore */
        }
      })();
    }, 8_000);
    return () => window.clearInterval(tick);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  useEffect(() => {
    if (state !== 'installing') return;
    setElapsedSec(0);
    const clock = window.setInterval(() => setElapsedSec((s) => s + 1), 1000);
    const climb = window.setInterval(() => {
      setPercent((p) => {
        if (p >= 99) return p;
        if (p < targetPct) return Math.min(targetPct, p + 1);
        if (p < 96 && p >= 3) return Math.min(96, p + 1);
        return p;
      });
    }, 700);
    return () => {
      window.clearInterval(clock);
      window.clearInterval(climb);
    };
  }, [state, targetPct]);

  if (state === 'loading') {
    return (
      <div className="deps-gate">
        <div className="deps-card">
          <div className="deps-mark" aria-hidden />
          <h1>Omni-Removal</h1>
          <p>Starting…</p>
        </div>
      </div>
    );
  }

  if (state === 'ready') return <>{children}</>;

  return (
    <div className="deps-gate">
      <div className="deps-card">
        <div className="deps-mark" aria-hidden />
        <h1>Omni-Removal</h1>
        <p className="deps-lead">
          Everything comes from the setup file. Omni prepares and repairs system components
          automatically — no buttons to tap.
        </p>
        <p className="deps-sub">
          {message ||
            'This can take a few minutes. Progress stays on screen until the full system is Ready.'}
        </p>

        <ul className="deps-checklist">
          {components.map((c) => (
            <li key={c.id} className={c.status === 'ready' ? 'ok' : 'miss'}>
              <span>{c.name}</span>
              <span>{statusLabel(c.status)}</span>
            </li>
          ))}
        </ul>

        <ul className="deps-checklist" style={{ marginTop: 10 }}>
          <li className={image?.ready ? 'ok' : 'miss'}>
            <span>Image cleanup</span>
            <span>{image?.label ?? 'Repairing'}</span>
          </li>
          <li className={video?.ready ? 'ok' : 'miss'}>
            <span>Video cleanup</span>
            <span>{video?.label ?? 'Repairing'}</span>
          </li>
        </ul>

        <div className="deps-progress">
          <div className="deps-progress-meta">
            <span>{stage || 'Installing system components…'}</span>
            <span>{Math.min(100, Math.round(percent))}%</span>
          </div>
          <div className="progress-track">
            <div
              className="progress-fill progress-fill-animated"
              style={{ width: `${Math.min(100, percent)}%` }}
            />
          </div>
          <p className="deps-elapsed">
            Elapsed {String(Math.floor(elapsedSec / 60)).padStart(2, '0')}:
            {String(elapsedSec % 60).padStart(2, '0')}
          </p>
        </div>

        <p className="deps-wait">
          Omni unlocks by itself when every component is Ready. If something is missing later, it
          repairs in the background — you do not need to reinstall.
        </p>
      </div>
    </div>
  );
}
