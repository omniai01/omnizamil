import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import {
  fetchRemoteStatus,
  getTelemetryError,
  heartbeatDevice,
  registerDevice,
  reportYoutubeLinked,
  type RemoteAppSettings,
} from './telemetry'

type ControlState = {
  hwid: string
  displayName: string
  locked: boolean
  updateNeeded: boolean
  settings: RemoteAppSettings | null
  telemetryError: string
  dismissUpdate: () => void
  reopenUpdate: () => Promise<boolean>
  refreshRemote: () => Promise<void>
  ready: boolean
}

const ControlContext = createContext<ControlState | null>(null)

const HEARTBEAT_MS = 90_000
/** Fast enough that admin maintenance / link changes show without manual restart */
const STATUS_POLL_MS = 12_000

export function ControlProvider({ children }: { children: ReactNode }) {
  const [hwid, setHwid] = useState('')
  const [displayName, setDisplayName] = useState('User')
  const [locked, setLocked] = useState(false)
  const [updateNeeded, setUpdateNeeded] = useState(false)
  const [settings, setSettings] = useState<RemoteAppSettings | null>(null)
  const [telemetryError, setTelemetryError] = useState('')
  const [ready, setReady] = useState(false)
  const updateDismissedRef = useRef(false)

  const refreshRemote = useCallback(async () => {
    if (!hwid) return
    const status = await fetchRemoteStatus(hwid)
    setTelemetryError(getTelemetryError())
    if (!status) return
    setSettings(status.settings)
    const isLocked = status.locked || status.deviceStatus === 'banned'
    setLocked(isLocked)
    setUpdateNeeded(status.updateNeeded && !updateDismissedRef.current)
  }, [hwid])

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const id = await window.shiftgrab.getHardwareId()
        const name = await window.shiftgrab.getOsUsername()
        const version = await window.shiftgrab.getVersion()
        if (cancelled) return
        setHwid(id)
        setDisplayName(name || 'User')
        const res = await registerDevice({
          hwid: id,
          displayName: name || 'User',
          os: navigator.platform || 'Windows',
          cpu: `${navigator.hardwareConcurrency || 0} cores`,
          appVersion: version || '1.1.0',
        })
        setTelemetryError(res.error || getTelemetryError())
        setReady(true)
      } catch (err) {
        setTelemetryError(err instanceof Error ? err.message : String(err))
        setReady(true)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!hwid || !ready) return
    void refreshRemote()

    const pushYtLink = async () => {
      try {
        const yt = await window.shiftgrab.youtubeAuthStatus()
        await reportYoutubeLinked(hwid, yt.signedIn)
      } catch {
        /* ignore */
      }
    }
    void pushYtLink()

    const hb = window.setInterval(() => {
      void (async () => {
        let linked: boolean | undefined
        try {
          linked = (await window.shiftgrab.youtubeAuthStatus()).signedIn
        } catch {
          linked = undefined
        }
        await heartbeatDevice(hwid, displayName, linked)
        await refreshRemote()
      })()
    }, HEARTBEAT_MS)
    const poll = window.setInterval(() => void refreshRemote(), STATUS_POLL_MS)
    const ytPoll = window.setInterval(() => void pushYtLink(), 45_000)
    const onFocus = () => {
      void refreshRemote()
      void pushYtLink()
    }
    const onVis = () => {
      if (document.visibilityState === 'visible') {
        void refreshRemote()
        void pushYtLink()
      }
    }
    window.addEventListener('focus', onFocus)
    document.addEventListener('visibilitychange', onVis)
    return () => {
      window.clearInterval(hb)
      window.clearInterval(poll)
      window.clearInterval(ytPoll)
      window.removeEventListener('focus', onFocus)
      document.removeEventListener('visibilitychange', onVis)
    }
  }, [hwid, displayName, ready, refreshRemote])

  const dismissUpdate = useCallback(() => {
    updateDismissedRef.current = true
    setUpdateNeeded(false)
  }, [])

  const reopenUpdate = useCallback(async () => {
    updateDismissedRef.current = false
    if (!hwid) return false
    const status = await fetchRemoteStatus(hwid)
    setTelemetryError(getTelemetryError())
    if (!status) return false
    setSettings(status.settings)
    setLocked(status.locked || status.deviceStatus === 'banned')
    const show = Boolean(status.updateNeeded)
    setUpdateNeeded(show)
    return show
  }, [hwid])

  const value: ControlState = {
    hwid,
    displayName,
    locked,
    updateNeeded,
    settings,
    telemetryError,
    dismissUpdate,
    reopenUpdate,
    refreshRemote,
    ready,
  }

  return <ControlContext.Provider value={value}>{children}</ControlContext.Provider>
}

export function useControl() {
  const ctx = useContext(ControlContext)
  if (!ctx) throw new Error('useControl must be used within ControlProvider')
  return ctx
}
