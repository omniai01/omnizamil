import { useControl } from '../lib/control'
import { bumpAnalytics } from '../lib/telemetry'

export function UpdateGate() {
  const { updateNeeded, settings, dismissUpdate } = useControl()

  if (!updateNeeded || !settings?.force_update) return null

  const url = (settings.update_url || '').trim()
  const version = settings.latest_version || 'new'

  const openDownload = () => {
    if (!url) return
    void bumpAnalytics('update_click')
    void bumpAnalytics('download')
    void window.shiftgrab.openExternal(url)
  }

  return (
    <div className="sg-gate sg-update" role="dialog" aria-modal="true">
      <div className="sg-gate-card">
        <h2>New software update available</h2>
        <p>
          {settings.update_message ||
            'A new OmniGrab / ShiftGrab update is available. Download and install it to continue.'}
        </p>
        <p className="sg-gate-ver">Version {version}</p>
        <div className="sg-gate-actions">
          <button type="button" className="btn primary" onClick={openDownload} disabled={!url}>
            Download update
          </button>
          <button type="button" className="btn" onClick={dismissUpdate}>
            Later
          </button>
        </div>
        {!url && <p className="sg-gate-warn">Admin has not set a download link yet.</p>}
      </div>
    </div>
  )
}
