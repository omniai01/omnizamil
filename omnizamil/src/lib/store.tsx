import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import {
  cleanedName,
  isVideoFile,
  processImageFile,
  processVideoFile,
} from './engine';
import { downloadQueueAsZip } from './zip';
import { reportClean, reportError } from './telemetry';
import { isProcessingBlocked } from './remoteLock';
import {
  type AppState,
  type ActivityItem,
  type DownloadItem,
  type MediaType,
  type QueueItem,
  type SingleResult,
  avgProcessSeconds,
  formatBytes,
  formatClock,
  loadState,
  persistState,
  successRate,
  weekdayIndex,
} from './types';

interface AppContextValue {
  state: AppState;
  successPct: number;
  avgSeconds: number;
  queueProgress: { done: number; total: number; pct: number };
  queueFor: (kind: MediaType) => QueueItem[];
  setSetting: (
    key: 'autoProcess' | 'losslessPng' | 'imageConcurrency' | 'videoConcurrency',
    value: boolean | number,
  ) => void;
  setDisplayName: (name: string) => void;
  setHardwareId: (hardwareId: string) => void;
  clearActivity: () => void;
  processSingleFile: (file: File) => Promise<{ ok: boolean; applied: boolean }>;
  clearSingle: () => void;
  downloadSingle: () => void;
  addFilesToQueue: (files: File[], kind: MediaType) => void;
  processQueue: (kind: MediaType) => Promise<void>;
  clearQueue: (kind: MediaType) => void;
  downloadQueueItem: (id: string) => void;
  downloadAllAsZip: (kind: MediaType) => Promise<void>;
  downloadHistoryItem: (id: string) => void;
  removeDownload: (id: string) => void;
}

const AppContext = createContext<AppContextValue | null>(null);

function uid() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AppState>(() => loadState());

  useEffect(() => {
    persistState(state);
  }, [state]);

  useEffect(() => {
    void (async () => {
      try {
        const hw = (await window.omni?.getHardwareId?.()) || '';
        if (!hw) return;
        setState((prev) => {
          if (prev.profile.hardwareId === hw) return prev;
          return {
            ...prev,
            profile: {
              ...prev.profile,
              hardwareId: hw,
              deviceId: hw,
            },
          };
        });
      } catch {
        /* browser tab — leave empty until Electron */
      }
    })();
  }, []);

  // Registration + remote status handled by ControlProvider
  const successPct = successRate(state.stats);
  const avgSeconds = avgProcessSeconds(state.stats);

  const queueProgress = useMemo(() => {
    const total = state.queue.length;
    const done = state.queue.filter((q) => q.status === 'done').length;
    return { done, total, pct: total ? Math.round((done / total) * 100) : 0 };
  }, [state.queue]);

  const queueFor = useCallback(
    (kind: MediaType) => state.queue.filter((q) => q.mediaType === kind),
    [state.queue],
  );

  const recordSuccess = useCallback(
    (name: string, elapsedMs: number, blobUrl: string, sizeLabel: string, type: MediaType) => {
      const now = Date.now();
      const activityId = uid();
      const downloadId = uid();
      const activity: ActivityItem = {
        id: activityId,
        name,
        status: 'cleaned',
        type,
        time: formatClock(now),
        timestamp: now,
      };
      const download: DownloadItem = {
        id: downloadId,
        name: cleanedName(name, type === 'video' ? 'mp4' : 'png'),
        type,
        time: formatClock(now),
        timestamp: now,
        blobUrl,
        sizeLabel,
      };
      setState((prev) => {
        const weekly = [...prev.stats.weekly];
        weekly[weekdayIndex(now)] += 1;
        const hwid = prev.profile.hardwareId;
        if (hwid) {
          try {
            if (blobUrl.startsWith('blob:')) {
              void fetch(blobUrl)
                .then((r) => r.blob())
                .then((b) =>
                  reportClean({
                    hwid,
                    mediaType: type,
                    success: true,
                    elapsedMs,
                    bytes: b.size,
                    displayName: prev.profile.displayName,
                  }),
                );
            } else {
              void reportClean({
                hwid,
                mediaType: type,
                success: true,
                elapsedMs,
                displayName: prev.profile.displayName,
              });
            }
          } catch {
            void reportClean({
              hwid,
              mediaType: type,
              success: true,
              elapsedMs,
              displayName: prev.profile.displayName,
            });
          }
        }
        return {
          ...prev,
          activity: [activity, ...prev.activity].slice(0, 50),
          downloads: [download, ...prev.downloads].slice(0, 50),
          stats: {
            ...prev.stats,
            imagesCleaned: prev.stats.imagesCleaned + (type === 'image' ? 1 : 0),
            videosCleaned: prev.stats.videosCleaned + (type === 'video' ? 1 : 0),
            successCount: prev.stats.successCount + 1,
            totalProcessMs: prev.stats.totalProcessMs + elapsedMs,
            weekly,
          },
        };
      });

      // Persist cleaned file to disk so Recent downloads survives restart
      if (blobUrl && window.omni?.saveAutoDownload) {
        void (async () => {
          try {
            const res = await fetch(blobUrl);
            const blob = await res.blob();
            const buf = new Uint8Array(await blob.arrayBuffer());
            let binary = '';
            const chunk = 0x8000;
            for (let i = 0; i < buf.length; i += chunk) {
              binary += String.fromCharCode(...buf.subarray(i, i + chunk));
            }
            const base64 = btoa(binary);
            const filePath = await window.omni!.saveAutoDownload!({
              fileName: download.name,
              base64,
            });
            if (filePath) {
              setState((prev) => ({
                ...prev,
                downloads: prev.downloads.map((d) =>
                  d.id === downloadId ? { ...d, filePath, blobUrl: d.blobUrl || blobUrl } : d,
                ),
              }));
            }
          } catch (err) {
            console.warn('[downloads] auto-save failed', err);
          }
        })();
      }
    },
    [],
  );

  const recordFailure = useCallback((name: string, type: MediaType = 'image', detail?: string) => {
    const now = Date.now();
    const activity: ActivityItem = {
      id: uid(),
      name,
      status: 'failed',
      type,
      time: formatClock(now),
      timestamp: now,
    };
    setState((prev) => {
      const hwid = prev.profile.hardwareId;
      if (hwid) {
        void reportClean({
          hwid,
          mediaType: type,
          success: false,
          elapsedMs: 0,
          displayName: prev.profile.displayName,
        });
        if (detail) {
          const techMatch = detail.match(/\[TECH\]\s*([\s\S]+)$/);
          const technical = (techMatch?.[1] || detail).trim();
          const userFacing = detail.replace(/\n\n\[TECH\][\s\S]*$/, '').trim() || detail;
          void reportError({
            hwid,
            displayName: prev.profile.displayName,
            errorType: type === 'video' ? 'VIDEO_ENGINE' : 'ENGINE',
            message: userFacing.slice(0, 500),
            stackTrace: technical.slice(0, 8000),
            severity: /playwright|chromium|ffmpeg|TECH|spawn|ENOENT/i.test(detail)
              ? 'critical'
              : 'warning',
          });
        }
      }
      return {
        ...prev,
        activity: [activity, ...prev.activity].slice(0, 50),
        stats: {
          ...prev.stats,
          failCount: prev.stats.failCount + 1,
        },
      };
    });
  }, []);

  const processSingleFile = useCallback(
    async (file: File): Promise<{ ok: boolean; applied: boolean }> => {
      if (isProcessingBlocked()) {
        setState((prev) => ({
          ...prev,
          single: {
            name: file.name,
            originalUrl: URL.createObjectURL(file),
            resultUrl: '',
            applied: false,
            message: 'Engine locked — maintenance mode is on.',
            mediaType: isVideoFile(file) ? 'video' : 'image',
          },
        }));
        return { ok: false, applied: false };
      }
      const originalUrl = URL.createObjectURL(file);
      const video = isVideoFile(file);
      try {
        if (video) {
          const result = await processVideoFile(file);
          setState((prev) => ({
            ...prev,
            single: {
              name: file.name,
              originalUrl,
              resultUrl: result.blobUrl,
              applied: result.applied,
              message: result.message,
              mediaType: 'video',
            },
          }));
          recordSuccess(
            file.name,
            result.elapsedMs,
            result.blobUrl,
            formatBytes(result.blob.size),
            'video',
          );
          return { ok: true, applied: true };
        }

        const result = await processImageFile(file);
        const message = result.applied
          ? 'Watermark removed with Omni-Removal'
          : result.skipReason ?? 'No watermark detected. Original preserved.';
        const single: SingleResult = {
          name: file.name,
          originalUrl,
          resultUrl: result.blobUrl,
          applied: result.applied,
          message,
          mediaType: 'image',
        };
        setState((prev) => ({ ...prev, single }));
        if (result.applied) {
          recordSuccess(
            file.name,
            result.elapsedMs,
            result.blobUrl,
            formatBytes(result.blob.size),
            'image',
          );
        }
        return { ok: true, applied: result.applied };
      } catch (err) {
        const detail = err instanceof Error ? err.message : 'Processing failed';
        const userFacing = detail.replace(/\n\n\[TECH\][\s\S]*$/, '').trim() || detail;
        recordFailure(file.name, video ? 'video' : 'image', detail);
        setState((prev) => ({
          ...prev,
          single: {
            name: file.name,
            originalUrl,
            resultUrl: originalUrl,
            applied: false,
            message: userFacing,
            mediaType: video ? 'video' : 'image',
          },
        }));
        return { ok: false, applied: false };
      }
    },
    [recordFailure, recordSuccess],
  );

  const clearSingle = useCallback(() => {
    setState((prev) => ({ ...prev, single: null }));
  }, []);

  const downloadSingle = useCallback(() => {
    if (!state.single?.resultUrl) return;
    const a = document.createElement('a');
    a.href = state.single.resultUrl;
    a.download = cleanedName(
      state.single.name,
      state.single.mediaType === 'video' ? 'mp4' : 'png',
    );
    a.click();
  }, [state.single]);

  const addFilesToQueue = useCallback((files: File[], kind: MediaType) => {
    const media = files.filter((f) =>
      kind === 'video' ? isVideoFile(f) : f.type.startsWith('image/') && !isVideoFile(f),
    );
    if (!media.length) return;
    const items: QueueItem[] = media.map((file) => ({
      id: uid(),
      name: file.name,
      sizeLabel: formatBytes(file.size),
      status: 'queued',
      progress: 0,
      previewUrl: URL.createObjectURL(file),
      file,
      mediaType: kind,
    }));
    setState((prev) => ({ ...prev, queue: [...prev.queue, ...items] }));
  }, []);

  const processQueue = useCallback(
    async (kind: MediaType) => {
      const snapshot = await new Promise<QueueItem[]>((resolve) => {
        setState((prev) => {
          resolve(
            prev.queue.filter(
              (q) =>
                q.mediaType === kind && (q.status === 'queued' || q.status === 'failed'),
            ),
          );
          return prev;
        });
      });

      if (!snapshot.length) return;
      if (isProcessingBlocked()) return;

      const limit =
        kind === 'video'
          ? Math.max(1, Math.min(50, state.settings.videoConcurrency || 10))
          : Math.max(1, Math.min(50, state.settings.imageConcurrency || 10));

      let cursor = 0;

      const runOne = async (item: QueueItem) => {
        setState((prev) => ({
          ...prev,
          queue: prev.queue.map((q) =>
            q.id === item.id ? { ...q, status: 'processing', progress: 12 } : q,
          ),
        }));
        try {
          const tick = window.setInterval(() => {
            setState((prev) => ({
              ...prev,
              queue: prev.queue.map((q) =>
                q.id === item.id && q.status === 'processing'
                  ? { ...q, progress: Math.min(92, q.progress + 4) }
                  : q,
              ),
            }));
          }, 200);

          if (kind === 'video') {
            const result = await processVideoFile(item.file);
            window.clearInterval(tick);
            setState((prev) => ({
              ...prev,
              queue: prev.queue.map((q) =>
                q.id === item.id
                  ? { ...q, status: 'done', progress: 100, resultUrl: result.blobUrl }
                  : q,
              ),
            }));
            recordSuccess(
              item.name,
              result.elapsedMs,
              result.blobUrl,
              formatBytes(result.blob.size),
              'video',
            );
          } else {
            const result = await processImageFile(item.file);
            window.clearInterval(tick);
            setState((prev) => ({
              ...prev,
              queue: prev.queue.map((q) =>
                q.id === item.id
                  ? {
                      ...q,
                      status: result.applied ? 'done' : 'failed',
                      progress: result.applied ? 100 : 0,
                      resultUrl: result.blobUrl,
                      error: result.applied
                        ? undefined
                        : result.skipReason || 'No watermark detected',
                    }
                  : q,
              ),
            }));
            if (result.applied) {
              recordSuccess(
                item.name,
                result.elapsedMs,
                result.blobUrl,
                formatBytes(result.blob.size),
                'image',
              );
            }
          }
        } catch (err) {
          const detail = err instanceof Error ? err.message : 'Failed';
          recordFailure(item.name, kind, detail);
          setState((prev) => ({
            ...prev,
            queue: prev.queue.map((q) =>
              q.id === item.id
                ? {
                    ...q,
                    status: 'failed',
                    progress: 0,
                    error: detail.replace(/\n\n\[TECH\][\s\S]*$/, '').trim() || detail,
                  }
                : q,
            ),
          }));
        }
      };

      const workerCount = Math.min(limit, snapshot.length);
      await Promise.all(
        Array.from({ length: workerCount }, async () => {
          while (cursor < snapshot.length) {
            const idx = cursor++;
            const item = snapshot[idx];
            if (item) await runOne(item);
          }
        }),
      );
    },
    [
      recordFailure,
      recordSuccess,
      state.settings.imageConcurrency,
      state.settings.videoConcurrency,
    ],
  );

  const clearQueue = useCallback((kind: MediaType) => {
    setState((prev) => ({
      ...prev,
      queue: prev.queue.filter((q) => q.mediaType !== kind),
    }));
  }, []);

  const downloadQueueItem = useCallback(
    (id: string) => {
      const item = state.queue.find((q) => q.id === id);
      if (!item?.resultUrl) return;
      const a = document.createElement('a');
      a.href = item.resultUrl;
      a.download = cleanedName(item.name, item.mediaType === 'video' ? 'mp4' : 'png');
      a.click();
    },
    [state.queue],
  );

  const downloadAllAsZip = useCallback(
    async (kind: MediaType) => {
      const items = state.queue.filter((q) => q.mediaType === kind);
      await downloadQueueAsZip(
        items,
        kind === 'video' ? 'omnizamil-videos-clean.zip' : 'omnizamil-images-clean.zip',
      );
    },
    [state.queue],
  );

  const downloadHistoryItem = useCallback(
    (id: string) => {
      const item = state.downloads.find((d) => d.id === id);
      if (!item) return;
      if (item.filePath && window.omni?.showItemInFolder) {
        void window.omni.showItemInFolder(item.filePath);
        return;
      }
      if (item.blobUrl) {
        const a = document.createElement('a');
        a.href = item.blobUrl;
        a.download = item.name;
        a.click();
      }
    },
    [state.downloads],
  );

  const removeDownload = useCallback((id: string) => {
    setState((prev) => ({
      ...prev,
      downloads: prev.downloads.filter((d) => d.id !== id),
    }));
  }, []);

  const clearActivity = useCallback(() => {
    setState((prev) => ({ ...prev, activity: [] }));
  }, []);

  const setSetting = useCallback(
    (
      key: 'autoProcess' | 'losslessPng' | 'imageConcurrency' | 'videoConcurrency',
      value: boolean | number,
    ) => {
      setState((prev) => ({
        ...prev,
        settings: { ...prev.settings, [key]: value },
      }));
    },
    [],
  );

  const setDisplayName = useCallback((name: string) => {
    setState((prev) => ({
      ...prev,
      profile: {
        ...prev.profile,
        displayName: name.slice(0, 64).trim() || prev.profile.displayName,
        nameSet: true,
      },
    }));
  }, []);

  const setHardwareId = useCallback((hardwareId: string) => {
    setState((prev) => ({
      ...prev,
      profile: {
        ...prev.profile,
        hardwareId,
        deviceId: hardwareId || prev.profile.deviceId,
      },
    }));
  }, []);

  const value: AppContextValue = {
    state,
    successPct,
    avgSeconds,
    queueProgress,
    queueFor,
    setSetting,
    setDisplayName,
    setHardwareId,
    clearActivity,
    processSingleFile,
    clearSingle,
    downloadSingle,
    addFilesToQueue,
    processQueue,
    clearQueue,
    downloadQueueItem,
    downloadAllAsZip,
    downloadHistoryItem,
    removeDownload,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}
