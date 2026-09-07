import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useApp } from '@/lib/store';
import { useControl } from '@/lib/control';
import { detectSystemCaps } from '@/lib/systemCaps';
import {
  DEFAULT_SOCIAL_LINKS,
  fetchSocialLinks,
  type SocialLinks,
} from '@/lib/telemetry';

const SOCIAL_META: { key: keyof SocialLinks; label: string; className: string }[] = [
  { key: 'youtube', label: 'YouTube', className: 'social-yt' },
  { key: 'twitter', label: 'Twitter', className: 'social-tw' },
  { key: 'facebook', label: 'Facebook', className: 'social-fb' },
  { key: 'instagram', label: 'Instagram', className: 'social-ig' },
  { key: 'whatsapp', label: 'WhatsApp', className: 'social-wa' },
  { key: 'discord', label: 'Discord', className: 'social-dc' },
];

type DepCheck = {
  id: string;
  name: string;
  ready: boolean;
  label: string;
  detail: string;
};

export function SettingsPage() {
  const { state, setSetting, clearActivity } = useApp();
  const { reopenUpdate } = useControl();
  const [privacyOpen, setPrivacyOpen] = useState(false);
  const [depsMsg, setDepsMsg] = useState('');
  const [depsBusy, setDepsBusy] = useState(false);
  const [depsPct, setDepsPct] = useState(0);
  const [checks, setChecks] = useState<DepCheck[]>([]);
  const [depsReady, setDepsReady] = useState<boolean | null>(null);
  const [updateMsg, setUpdateMsg] = useState(
    'Connected to Omni-Removal cloud. Admin panel shows live devices and usage.',
  );
  const [updateBusy, setUpdateBusy] = useState(false);
  const [socialLinks, setSocialLinks] = useState<SocialLinks>(DEFAULT_SOCIAL_LINKS);
  const caps = useMemo(() => detectSystemCaps(), []);

  useEffect(() => {
    if (!depsBusy) return;
    const t = window.setInterval(() => {
      setDepsPct((p) => {
        if (p >= 96 || p < 3) return p;
        return Math.min(96, p + 0.55);
      });
    }, 800);
    return () => window.clearInterval(t);
  }, [depsBusy]);

  useEffect(() => {
    const img = state.settings.imageConcurrency || 10;
    const vid = state.settings.videoConcurrency || 10;
    if (img < caps.minConcurrency) setSetting('imageConcurrency', caps.minConcurrency);
    if (img > caps.maxImages) setSetting('imageConcurrency', caps.maxImages);
    if (vid < caps.minConcurrency) setSetting('videoConcurrency', caps.minConcurrency);
    if (vid > caps.maxVideos) setSetting('videoConcurrency', caps.maxVideos);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [caps.maxImages, caps.maxVideos, caps.minConcurrency]);

  useEffect(() => {
    void fetchSocialLinks().then(setSocialLinks);
  }, []);

  const applyStatus = useCallback(
    (status: {
      ready: boolean;
      message: string;
      checks?: DepCheck[];
      image?: { ready: boolean; label: string };
      video?: { ready: boolean; label: string };
    }) => {
      setDepsReady(status.ready);
      setDepsMsg(status.message);
      if (status.checks?.length) {
        setChecks(status.checks);
      } else {
        setChecks([
          {
            id: 'image',
            name: 'Removal engine',
            ready: Boolean(status.image?.ready),
            label: status.image?.label || 'Unknown',
            detail: status.image?.ready ? 'Ready' : 'Needs install',
          },
          {
            id: 'video',
            name: 'Video rendering system',
            ready: Boolean(status.video?.ready),
            label: status.video?.label || 'Unknown',
            detail: status.video?.ready ? 'Ready' : 'Needs install',
          },
        ]);
      }
    },
    [],
  );

  const installDeps = useCallback(async () => {
    if (!window.omni?.depsEnsure) {
      setDepsMsg('Open Omni-Removal desktop app to finish setup.');
      return;
    }
    setDepsBusy(true);
    setDepsMsg('Repairing system components…');
    setDepsPct(0);
    const off = window.omni.onDepsProgress?.((p) => {
      setDepsMsg(p.stage || 'Repairing system components…');
      setDepsPct((prev) => Math.max(prev, p.percent));
      setChecks((prev) =>
        prev.map((c) => {
          if (c.id === 'image') {
            if (p.imageStatus === 'ready')
              return { ...c, ready: true, label: 'Ready', detail: 'Ready to clean images' };
            if (p.imageStatus === 'installing')
              return { ...c, ready: false, label: '…', detail: 'Repairing…' };
          }
          if (c.id === 'video') {
            if (p.videoStatus === 'ready')
              return { ...c, ready: true, label: 'Ready', detail: 'Ready to clean videos' };
            if (p.videoStatus === 'installing')
              return { ...c, ready: false, label: '…', detail: 'Repairing…' };
          }
          return c;
        }),
      );
    });
    try {
      await window.omni.depsEnsure();
      const status = await window.omni.depsStatus?.();
      if (status) applyStatus(status);
      if (status?.ready) {
        setDepsMsg('Omni is ready. Missing pieces were repaired automatically.');
        setDepsPct(100);
      } else {
        setDepsMsg('Repair continues automatically…');
      }
    } catch (err) {
      let raw = err instanceof Error ? err.message : String(err);
      raw = raw
        .replace(/^Error invoking remote method '[^']+':\s*/i, '')
        .replace(/^Error:\s*/i, '')
        .trim();
      if (/ENOTFOUND|ECONNREFUSED|ECONNRESET|ETIMEDOUT|EAI_AGAIN|getaddrinfo|socket hang up|Internet connection failed|Waiting for connection/i.test(raw)) {
        setDepsMsg('Waiting for connection… repair continues automatically.');
      } else if (/reinstall|fresh install|engine missing/i.test(raw)) {
        setDepsMsg('Rebuilding from the installer… repair continues automatically.');
      } else {
        setDepsMsg('Repair continues automatically…');
      }
    } finally {
      off?.();
      setDepsBusy(false);
    }
  }, [applyStatus]);

  const checkDeps = useCallback(async (opts?: { heal?: boolean }) => {
    if (!window.omni?.depsStatus) {
      setDepsMsg('Open Omni-Removal desktop app to manage setup.');
      return;
    }
    setDepsBusy(true);
    setDepsMsg('Checking Omni status…');
    setDepsPct(0);
    try {
      const status = await window.omni.depsStatus();
      applyStatus(status);
      setDepsPct(status.ready ? 100 : 0);
      if (!status.ready && opts?.heal !== false) {
        setDepsBusy(false);
        await installDeps();
        return;
      }
      setDepsMsg(status.ready ? 'Omni is ready.' : status.message || 'Repair needed — starting automatically…');
    } catch (err) {
      setDepsMsg(err instanceof Error ? err.message : 'Status check failed.');
    } finally {
      setDepsBusy(false);
    }
  }, [applyStatus, installDeps]);

  // On open: check immediately, then auto-heal anything missing.
  useEffect(() => {
    void checkDeps({ heal: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // While Settings is open: every 8s re-check and auto-heal (no user clicks).
  useEffect(() => {
    const tick = window.setInterval(() => {
      void (async () => {
        if (depsBusy) return;
        if (!window.omni?.depsStatus) return;
        try {
          const status = await window.omni.depsStatus();
          applyStatus(status);
          if (!status.ready) {
            await installDeps();
          } else {
            setDepsMsg('Omni is ready.');
            setDepsPct(100);
          }
        } catch {
          /* ignore */
        }
      })();
    }, 8_000);
    return () => window.clearInterval(tick);
  }, [applyStatus, depsBusy, installDeps]);

  const onCheckRowClick = (item: DepCheck) => {
    if (depsBusy) return;
    if (item.ready) return;
    void installDeps();
  };

  const checkUpdates = async () => {
    setUpdateBusy(true);
    try {
      const show = await reopenUpdate();
      if (show) {
        setUpdateMsg('Update available — popup opened. Download, uninstall old build, then restart.');
      } else {
        setUpdateMsg('Omni-Removal is up to date. Free & unlimited.');
      }
    } catch {
      setUpdateMsg('Could not reach the update server.');
    } finally {
      setUpdateBusy(false);
    }
  };

  return (
    <div className="page-wrap">
      <div className="page-header">
        <div>
          <h2>Settings</h2>
          <p>Local preferences for Omni-Removal</p>
        </div>
        <Link className="btn btn-secondary" to="/support">
          Support
        </Link>
      </div>

      <div className="settings-grid settings-wide">
        <div className="setting-row setting-block">
          <div>
            <h4>Device</h4>
            <p>This PC is linked to Omni-Removal automatically. Hardware ID is for support only.</p>
            <div className="id-block">
              <div>
                <span className="id-label">Hardware ID</span>
                <code className="hwid-code">
                  {state.profile.hardwareId || state.profile.deviceId || 'Linking…'}
                </code>
              </div>
            </div>
          </div>
        </div>

        <div className="setting-row setting-block">
          <div>
            <h4>Bulk concurrency</h4>
            <p>
              How many files Omni-Removal cleans at the same time in Bulk. Minimum 1, maximum 50 —
              pick what this PC can handle.
            </p>
            <p className="settings-note caps-line">
              Detected: {caps.summary}
              <br />
              <span className="caps-gpu">{caps.gpuLabel}</span>
            </p>
            <div className="concurrency-grid">
              <label className="settings-field">
                Images at once ({caps.minConcurrency}–{caps.maxImages})
                <input
                  type="range"
                  min={caps.minConcurrency}
                  max={caps.maxImages}
                  value={Math.min(
                    Math.max(state.settings.imageConcurrency || 10, caps.minConcurrency),
                    caps.maxImages,
                  )}
                  onChange={(e) => setSetting('imageConcurrency', Number(e.target.value))}
                />
                <span className="concurrency-value">
                  {Math.min(
                    Math.max(state.settings.imageConcurrency || 10, caps.minConcurrency),
                    caps.maxImages,
                  )}{' '}
                  parallel
                  {state.settings.imageConcurrency === caps.recommendedImages
                    ? ' · recommended'
                    : ''}
                </span>
              </label>
              <label className="settings-field">
                Videos at once ({caps.minConcurrency}–{caps.maxVideos})
                <input
                  type="range"
                  min={caps.minConcurrency}
                  max={caps.maxVideos}
                  value={Math.min(
                    Math.max(state.settings.videoConcurrency || 10, caps.minConcurrency),
                    caps.maxVideos,
                  )}
                  onChange={(e) => setSetting('videoConcurrency', Number(e.target.value))}
                />
                <span className="concurrency-value">
                  {Math.min(
                    Math.max(state.settings.videoConcurrency || 10, caps.minConcurrency),
                    caps.maxVideos,
                  )}{' '}
                  parallel
                  {state.settings.videoConcurrency === caps.recommendedVideos
                    ? ' · recommended'
                    : ''}
                </span>
              </label>
            </div>
            <button
              className="btn btn-ghost"
              type="button"
              onClick={() => {
                setSetting('imageConcurrency', caps.recommendedImages);
                setSetting('videoConcurrency', caps.recommendedVideos);
              }}
            >
              Use recommended for this PC
            </button>
          </div>
        </div>

        <div className="setting-row setting-block">
          <div className="deps-settings-block">
            <h4>Omni setup</h4>
            <p>
              System components stay hidden on this PC. Omni re-checks automatically and repairs
              anything missing — no manual steps.
            </p>
            <ul className="deps-checklist deps-checklist-settings">
              {checks.length === 0 ? (
                <li className="miss">
                  <span>Not checked yet</span>
                  <span>Check</span>
                </li>
              ) : (
                checks.map((c) => (
                  <li
                    key={c.id}
                    className={`${c.ready ? 'ok' : 'miss'}${!c.ready && !depsBusy ? ' clickable' : ''}`}
                    onClick={() => onCheckRowClick(c)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        onCheckRowClick(c);
                      }
                    }}
                    role={!c.ready ? 'button' : undefined}
                    tabIndex={!c.ready && !depsBusy ? 0 : undefined}
                  >
                    <span className="deps-check-main">
                      <span className="deps-check-mark" aria-hidden>
                        {c.ready ? '✓' : '○'}
                      </span>
                      <span>
                        <strong>{c.name}</strong>
                        <small>{c.detail}</small>
                      </span>
                    </span>
                    <span>{c.ready ? 'Ready' : depsBusy ? '…' : 'Needed'}</span>
                  </li>
                ))
              )}
            </ul>
            {depsBusy && (
              <div className="deps-progress">
                <div className="deps-progress-meta">
                  <span>{depsMsg || 'Setting up Omni…'}</span>
                  <span>{depsPct}%</span>
                </div>
                <div className="progress-track">
                  <div className="progress-fill progress-fill-animated" style={{ width: `${depsPct}%` }} />
                </div>
              </div>
            )}
            {!depsBusy && depsMsg && (
              <p className={`settings-note${depsReady === false ? ' deps-warn' : ''}`}>{depsMsg}</p>
            )}
            <div className="deps-actions">
              <button
                className="btn btn-secondary"
                type="button"
                disabled={depsBusy}
                onClick={() => void checkDeps({ heal: true })}
              >
                {depsBusy ? 'Repairing…' : 'Check & repair'}
              </button>
            </div>
          </div>
        </div>

        <div className="setting-row setting-block">
          <div>
            <h4>Check latest updates</h4>
            <p>
              Admin-panel updates will show here once connected. Until then this local build stays
              free and unlimited.
            </p>
            {updateMsg && <p className="settings-note">{updateMsg}</p>}
          </div>
          <button
            className="btn btn-secondary"
            type="button"
            disabled={updateBusy}
            onClick={checkUpdates}
          >
            {updateBusy ? 'Checking…' : 'Check latest updates'}
          </button>
        </div>

        <div className="setting-row setting-block">
          <div>
            <h4>Uninstall Omni-Removal</h4>
            <p>
              Opens the Windows uninstall wizard. Setup files on this PC stay so a fresh install can
              skip re-downloading system components.
            </p>
          </div>
          <button
            className="btn btn-secondary"
            type="button"
            onClick={() => void window.omni?.runUninstaller?.()}
          >
            Uninstall
          </button>
        </div>

        <div className="setting-row">
          <div>
            <h4>Auto-process on drop</h4>
            <p>Start cleaning as soon as files are added in Bulk.</p>
          </div>
          <button
            className={`toggle ${state.settings.autoProcess ? 'on' : ''}`}
            onClick={() => setSetting('autoProcess', !state.settings.autoProcess)}
            aria-label="Toggle auto process"
          >
            <span />
          </button>
        </div>

        <div className="setting-row">
          <div>
            <h4>Lossless PNG output</h4>
            <p>Export cleaned images as PNG to avoid compression artifacts.</p>
          </div>
          <button
            className={`toggle ${state.settings.losslessPng ? 'on' : ''}`}
            onClick={() => setSetting('losslessPng', !state.settings.losslessPng)}
            aria-label="Toggle lossless PNG"
          >
            <span />
          </button>
        </div>

        <div className="setting-row">
          <div>
            <h4>Clear activity log</h4>
            <p>Remove recent activity entries from the Dashboard.</p>
          </div>
          <button className="btn btn-ghost" onClick={clearActivity}>
            Clear
          </button>
        </div>

        <div className="setting-row setting-accordion">
          <button
            type="button"
            className="accordion-trigger"
            onClick={() => setPrivacyOpen((v) => !v)}
            aria-expanded={privacyOpen}
          >
            <div>
              <h4>Privacy policy</h4>
              <p>How Omni-Removal handles your files on this device.</p>
            </div>
            <span className={`chevron ${privacyOpen ? 'open' : ''}`}>▾</span>
          </button>
          {privacyOpen && (
            <div className="accordion-body">
              <p>
                All Omni-Removal watermark cleanup runs 100% on this device. Nothing is uploaded.
                Cleaned files stay local until you choose to save them.
              </p>
            </div>
          )}
        </div>

        <div className="setting-row setting-block">
          <div>
            <h4>License</h4>
            <p className="text-strong">Free of cost. Unlimited cleans.</p>
            <p>Omni-Removal is free for personal and project use.</p>
          </div>
          <div className="license-pills">
            <span className="license-pill">FREE</span>
            <span className="license-pill">UNLIMITED</span>
          </div>
        </div>

        <div className="setting-row setting-block">
          <div>
            <h4>Join our social</h4>
            <p>Follow for tips and updates.</p>
            <div className="social-row">
              {SOCIAL_META.map((s) => (
                <a
                  key={s.key}
                  className={`social-btn ${s.className}`}
                  href={socialLinks[s.key] || '#'}
                  target="_blank"
                  rel="noreferrer"
                >
                  {s.label}
                </a>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
