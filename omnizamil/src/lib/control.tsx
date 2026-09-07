import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { useApp } from '@/lib/store';
import {
  fetchRemoteStatus,
  getTelemetryError,
  heartbeatDevice,
  registerDevice,
  type RemoteAppSettings,
} from '@/lib/telemetry';
import { detectSystemCaps } from '@/lib/systemCaps';
import { setProcessingBlocked } from '@/lib/remoteLock';

type ControlState = {
  locked: boolean;
  updateNeeded: boolean;
  settings: RemoteAppSettings | null;
  telemetryError: string;
  dismissUpdate: () => void;
  reopenUpdate: () => Promise<boolean>;
  refreshRemote: () => Promise<void>;
  processingBlocked: boolean;
};

const ControlContext = createContext<ControlState | null>(null);

/** 100k-safe: register once, slim heartbeat, slow status poll */
const HEARTBEAT_MS = 90_000;
const STATUS_POLL_MS = 60_000;

export function ControlProvider({ children }: { children: ReactNode }) {
  const { state } = useApp();
  const [locked, setLocked] = useState(false);
  const [updateNeeded, setUpdateNeeded] = useState(false);
  const [settings, setSettings] = useState<RemoteAppSettings | null>(null);
  const [telemetryError, setTelemetryError] = useState('');
  const updateDismissedRef = useRef(false);

  const refreshRemote = useCallback(async () => {
    const hwid = state.profile.hardwareId;
    if (!hwid) return;
    const status = await fetchRemoteStatus(hwid);
    setTelemetryError(getTelemetryError());
    if (!status) return;
    setSettings(status.settings);
    const isLocked = status.locked || status.deviceStatus === 'banned';
    setLocked(isLocked);
    setProcessingBlocked(isLocked);
    setUpdateNeeded(status.updateNeeded && !updateDismissedRef.current);
  }, [state.profile.hardwareId]);

  useEffect(() => {
    const hwid = state.profile.hardwareId;
    const name = state.profile.displayName;
    if (!hwid || !state.profile.nameSet || !name) return;

    const caps = detectSystemCaps();
    void (async () => {
      const res = await registerDevice({
        hwid,
        displayName: name,
        os: navigator.platform || 'Windows',
        cpu: caps.summary,
        ramGb: caps.ramGb,
        gpu: caps.gpuLabel,
        appVersion: '1.0.0',
      });
      setTelemetryError(res.error || getTelemetryError());
      // Do NOT bumpAnalytics('view') here — that hot-row kills scale at 100k
      await refreshRemote();
    })();

    const hb = window.setInterval(() => {
      void heartbeatDevice(hwid, name).then(() => refreshRemote());
    }, HEARTBEAT_MS);

    const poll = window.setInterval(() => void refreshRemote(), STATUS_POLL_MS);
    const onFocus = () => void refreshRemote();
    const onVis = () => {
      if (document.visibilityState === 'visible') void refreshRemote();
    };
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVis);
    return () => {
      window.clearInterval(hb);
      window.clearInterval(poll);
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [
    state.profile.hardwareId,
    state.profile.nameSet,
    state.profile.displayName,
    refreshRemote,
  ]);

  const dismissUpdate = useCallback(() => {
    updateDismissedRef.current = true;
    setUpdateNeeded(false);
  }, []);

  const reopenUpdate = useCallback(async () => {
    updateDismissedRef.current = false;
    const hwid = state.profile.hardwareId;
    if (!hwid) return false;
    const status = await fetchRemoteStatus(hwid);
    setTelemetryError(getTelemetryError());
    if (!status) return false;
    setSettings(status.settings);
    const isLocked = status.locked || status.deviceStatus === 'banned';
    setLocked(isLocked);
    setProcessingBlocked(isLocked);
    const show = Boolean(status.updateNeeded);
    setUpdateNeeded(show);
    return show;
  }, [state.profile.hardwareId]);

  const value: ControlState = {
    locked,
    updateNeeded,
    settings,
    telemetryError,
    dismissUpdate,
    reopenUpdate,
    refreshRemote,
    processingBlocked: locked,
  };

  return <ControlContext.Provider value={value}>{children}</ControlContext.Provider>;
}

export function useControl() {
  const ctx = useContext(ControlContext);
  if (!ctx) throw new Error('useControl must be used within ControlProvider');
  return ctx;
}
