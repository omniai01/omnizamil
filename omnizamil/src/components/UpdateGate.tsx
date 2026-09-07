import { useControl } from '@/lib/control';
import { bumpAnalytics } from '@/lib/telemetry';

/** Omni-branded update prompt when admin pushes a new build. */
export function UpdateGate() {
  const { updateNeeded, settings, dismissUpdate } = useControl();

  if (!updateNeeded || !settings?.force_update) return null;

  const url = (settings.update_url || '').trim();
  const version = settings.latest_version || 'new';

  const openDownload = () => {
    if (!url) return;
    void bumpAnalytics('update_click');
    void bumpAnalytics('download');
    if (window.omni?.openExternal) void window.omni.openExternal(url);
    else window.open(url, '_blank', 'noopener,noreferrer');
  };

  const openUninstall = () => {
    if (window.omni?.runUninstaller) {
      void window.omni.runUninstaller();
      return;
    }
    if (window.omni?.openExternal) {
      void window.omni.openExternal('ms-settings:appsfeatures');
    } else {
      window.open('ms-settings:appsfeatures', '_blank');
    }
  };

  const restart = () => {
    void window.omni?.relaunch?.();
  };

  return (
    <div className="update-gate-overlay" role="dialog" aria-modal="true">
      <div className="update-gate-card">
        <div className="deps-mark" aria-hidden />
        <h2>New software update available</h2>
        <p className="update-gate-lead">
          {settings.update_message ||
            'A new Omni-Removal update is available. Download and install it to continue.'}
        </p>
        <p className="update-gate-ver">Version {version}</p>
        <div className="update-gate-actions">
          <button className="btn btn-primary" type="button" onClick={openDownload} disabled={!url}>
            Download update
          </button>
          <button className="btn btn-secondary" type="button" onClick={openUninstall}>
            Uninstall old build
          </button>
          <button className="btn btn-secondary" type="button" onClick={restart}>
            I&apos;ve installed — Restart
          </button>
          <button className="btn btn-ghost" type="button" onClick={dismissUpdate}>
            Later
          </button>
        </div>
        {!url && (
          <p className="update-gate-warn">Admin has not set a download link yet.</p>
        )}
      </div>
    </div>
  );
}
