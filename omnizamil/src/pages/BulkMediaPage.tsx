import { useEffect, useMemo, useRef, useState } from 'react';
import { DropZone } from '@/components/DropZone';
import { IconDownloads, IconDrop, IconPlay, IconTrash } from '@/components/Icons';
import { useApp } from '@/lib/store';
import { warmEngine } from '@/lib/engine';
import type { MediaType } from '@/lib/types';

export function BulkMediaPage({ mode }: { mode: MediaType }) {
  const {
    queueFor,
    addFilesToQueue,
    processQueue,
    clearQueue,
    downloadQueueItem,
    downloadAllAsZip,
    state,
  } = useApp();
  const [busy, setBusy] = useState(false);
  const [zipping, setZipping] = useState(false);
  const autoStarted = useRef(false);
  const queue = queueFor(mode);

  useEffect(() => {
    void warmEngine();
  }, []);

  const onFiles = (files: File[]) => {
    addFilesToQueue(files, mode);
    autoStarted.current = false;
  };

  useEffect(() => {
    if (!state.settings.autoProcess) return;
    if (busy) return;
    if (autoStarted.current) return;
    const hasQueued = queue.some((q) => q.status === 'queued');
    if (!hasQueued) return;
    autoStarted.current = true;
    void (async () => {
      setBusy(true);
      try {
        await processQueue(mode);
      } finally {
        setBusy(false);
      }
    })();
  }, [queue, state.settings.autoProcess, busy, processQueue, mode]);

  const runProcess = async () => {
    setBusy(true);
    try {
      await processQueue(mode);
    } finally {
      setBusy(false);
    }
  };

  const hasDone = useMemo(() => queue.some((q) => q.status === 'done'), [queue]);
  const hasQueued = useMemo(
    () => queue.some((q) => q.status === 'queued' || q.status === 'failed'),
    [queue],
  );

  const onZip = async () => {
    setZipping(true);
    try {
      await downloadAllAsZip(mode);
    } finally {
      setZipping(false);
    }
  };

  const isVideo = mode === 'video';

  return (
    <div className="page-wrap">
      <div className="page-header compact">
        <div>
          <h2>{isVideo ? 'Bulk Video' : 'Bulk Image'}</h2>
        </div>
        <div className="header-actions">
          <button className="btn btn-primary" disabled={busy || !hasQueued} onClick={runProcess}>
            <IconPlay width={14} height={14} />
            Process all
          </button>
          <button className="btn btn-secondary" disabled={!hasDone || zipping} onClick={onZip}>
            <IconDownloads width={14} height={14} />
            {zipping ? 'Zipping…' : 'Download ZIP'}
          </button>
          <button
            className="btn btn-ghost"
            disabled={!queue.length}
            onClick={() => clearQueue(mode)}
          >
            <IconTrash width={14} height={14} />
            Clear queue
          </button>
        </div>
      </div>

      <DropZone
        title={isVideo ? 'Drop multiple videos' : 'Drop multiple images'}
        subtitle={
          isVideo
            ? 'MP4 / WebM / MOV. Parallel cleans follow Settings → Bulk concurrency.'
            : 'PNG / JPG / WebP. Parallel cleans follow Settings → Bulk concurrency.'
        }
        icon={<IconDrop width={54} height={54} />}
        multiple
        accept={
          isVideo
            ? 'video/mp4,video/webm,video/quicktime'
            : 'image/png,image/jpeg,image/webp'
        }
        onFiles={onFiles}
      />

      <section className="panel queue-panel">
        {queue.length === 0 ? null : (
          <div className="queue-card-list">
            {queue.map((item, index) => (
              <div key={item.id} className="queue-card">
                <span className="queue-num">{index + 1}</span>
                {item.mediaType === 'video' ? (
                  <video className="queue-thumb" src={item.resultUrl || item.previewUrl} muted />
                ) : (
                  <img className="queue-thumb" src={item.resultUrl || item.previewUrl} alt="" />
                )}
                <div className="queue-meta">
                  <span className="queue-name" title={item.name}>
                    {item.name}
                  </span>
                  <span className="queue-sub">{item.sizeLabel}</span>
                </div>
                <span className={`badge ${item.status}`}>
                  {item.status === 'done'
                    ? 'Done'
                    : item.status === 'processing'
                      ? 'Processing'
                      : item.status === 'failed'
                        ? 'Failed'
                        : 'Queued'}
                </span>
                <div className="mini-progress">
                  <div className="meta">
                    <span>{item.progress}%</span>
                  </div>
                  <div className="progress-track">
                    <div
                      className={`progress-fill ${item.status === 'done' ? 'done' : 'processing'}`}
                      style={{ width: `${item.progress}%` }}
                    />
                  </div>
                </div>
                <button
                  className="icon-btn"
                  disabled={item.status !== 'done'}
                  onClick={() => downloadQueueItem(item.id)}
                  title="Download one"
                >
                  <IconDownloads width={18} height={18} />
                </button>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
