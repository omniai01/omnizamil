import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { DropZone } from '@/components/DropZone';
import { IconBulk, IconDrop, IconDownloads, IconPlay, IconRetry } from '@/components/Icons';
import { useApp } from '@/lib/store';
import { isVideoFile, warmEngine } from '@/lib/engine';

type Mode = 'image' | 'video';

export function SingleMediaPage({ mode }: { mode: Mode }) {
  const { state, processSingleFile, clearSingle, downloadSingle, addFilesToQueue } = useApp();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [localError, setLocalError] = useState('');
  const [showSuccess, setShowSuccess] = useState(false);
  const lastFile = useRef<File | null>(null);
  const bulkInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    void warmEngine();
  }, []);

  const isVideo = mode === 'video';
  const active =
    state.single && state.single.mediaType === mode ? state.single : null;
  const failed = Boolean(active && !active.applied);

  const runFile = async (file: File) => {
    if (mode === 'image' && isVideoFile(file)) {
      setLocalError('This page is images only. Use Single Video for MP4/WebM.');
      return;
    }
    if (mode === 'video' && !isVideoFile(file)) {
      setLocalError('This page is videos only. Use Single Image for PNG/JPG.');
      return;
    }
    setLocalError('');
    lastFile.current = file;
    setBusy(true);
    try {
      const result = await processSingleFile(file);
      if (result.ok) {
        setShowSuccess(true);
        window.setTimeout(() => setShowSuccess(false), 1600);
      }
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : 'Processing failed');
    } finally {
      setBusy(false);
    }
  };

  const onFiles = async (files: File[]) => {
    const file = files[0];
    if (!file) return;
    await runFile(file);
  };

  const onRetry = async () => {
    if (!lastFile.current) return;
    await runFile(lastFile.current);
  };

  const onBulkPick = (list: FileList | null) => {
    if (!list?.length) return;
    const files = Array.from(list);
    addFilesToQueue(files, mode);
    navigate(isVideo ? '/bulk-video' : '/bulk-image');
  };

  return (
    <div className="page-wrap">
      {showSuccess && (
        <div className="success-toast" role="status">
          <div className="success-toast-inner">
            <span className="success-ring" />
            <strong>Clean success</strong>
            <p>Your file is ready on this page. Use Download anytime.</p>
          </div>
        </div>
      )}

      <div className="page-header compact">
        <div>
          <h2>{isVideo ? 'Single Video' : 'Single Image'}</h2>
        </div>
        {active && (
          <div className="header-actions">
            {failed && (
              <button className="btn btn-secondary" disabled={busy} onClick={onRetry}>
                <IconRetry width={14} height={14} />
                Retry
              </button>
            )}
            <button className="btn btn-easy" onClick={downloadSingle}>
              <IconDownloads width={14} height={14} />
              Download
            </button>
            <button className="btn btn-ghost" onClick={clearSingle}>
              Clear
            </button>
          </div>
        )}
      </div>

      {!active && (
        <div className="page-lead-block">
          <p className="page-lead">
            {isVideo
              ? 'Drop or choose a video here. Omni-Removal removes the watermark in this screen — no extra desktop window.'
              : 'Drop or choose an image here. Omni-Removal cleans the watermark on this device.'}
          </p>
          <p className="page-lead sub">
            {isVideo
              ? 'Need many files? Use Bulk select or open Bulk Video.'
              : 'Need many files? Use Bulk select or open Bulk Image.'}
          </p>
        </div>
      )}

      {!active && (
        <>
          <DropZone
            title={
              busy
                ? 'Processing with Omni-Removal engine…'
                : isVideo
                  ? 'Upload a video'
                  : 'Upload an image'
            }
            subtitle={
              isVideo
                ? 'MP4, WebM, MOV. Watermark removal starts automatically in this UI.'
                : 'PNG, JPG, WebP. Auto-clean starts instantly.'
            }
            icon={<IconDrop width={54} height={54} />}
            accept={
              isVideo
                ? 'video/mp4,video/webm,video/quicktime'
                : 'image/png,image/jpeg,image/webp'
            }
            onFiles={onFiles}
          />

          <div className="step-cards">
            <article className="step-card">
              <span className="step-num">1</span>
              <h4>Upload</h4>
              <p>Select or drop your {isVideo ? 'video' : 'image'} here.</p>
            </article>
            <article className="step-card">
              <span className="step-num">2</span>
              <h4>Auto process</h4>
              <p>
                {isVideo
                  ? 'Omni-Removal engine cleans the watermark in the background.'
                  : 'Cleaning starts right away. No extra Process click needed.'}
              </p>
            </article>
            <article className="step-card">
              <span className="step-num">3</span>
              <h4>Download</h4>
              <p>Preview original vs cleaned, then save with one easy tap.</p>
            </article>
          </div>

          <div className="single-actions-bar">
            <button
              className="btn btn-secondary"
              type="button"
              onClick={() => bulkInputRef.current?.click()}
            >
              <IconBulk width={14} height={14} />
              Bulk select
            </button>
            <Link className="btn btn-easy" to={isVideo ? '/bulk-video' : '/bulk-image'}>
              Open {isVideo ? 'Bulk Video' : 'Bulk Image'}
            </Link>
            <input
              ref={bulkInputRef}
              type="file"
              hidden
              multiple
              accept={
                isVideo
                  ? 'video/mp4,video/webm,video/quicktime'
                  : 'image/png,image/jpeg,image/webp'
              }
              onChange={(e) => {
                onBulkPick(e.target.files);
                e.currentTarget.value = '';
              }}
            />
          </div>
        </>
      )}

      {busy && (
        <div className="process-strip">
          <IconPlay width={14} height={14} />
          <span>
            {isVideo
              ? 'Omni-Removal engine removing watermark… stay on this page.'
              : 'Cleaning watermark… pixels stay intact.'}
          </span>
          <div className="process-strip-bar">
            <div className="process-strip-fill" />
          </div>
        </div>
      )}
      {localError && <p className="status-line error-line">{localError}</p>}

      {active && (
        <>
          {failed && (
            <>
              <p className="status-line error-line">{active.message}</p>
              <div className="result-actions">
                {lastFile.current && (
                  <button className="btn btn-secondary" disabled={busy} onClick={onRetry}>
                    <IconRetry width={14} height={14} />
                    Retry
                  </button>
                )}
              </div>
            </>
          )}
          <div className="compare">
            <div className="compare-card">
              <div className="label">Original</div>
              <div className="media-frame">
                {isVideo ? (
                  <video src={active.originalUrl} controls playsInline />
                ) : (
                  <img src={active.originalUrl} alt="Original" />
                )}
              </div>
            </div>
            <div className="compare-card">
              <div className="label">Cleaned</div>
              <div className="media-frame">
                {isVideo ? (
                  <video src={active.resultUrl} controls playsInline />
                ) : (
                  <img src={active.resultUrl} alt="Cleaned" />
                )}
              </div>
            </div>
          </div>
          <DropZone
            title="Replace with another file"
            subtitle={isVideo ? 'Video only' : 'Image only'}
            icon={<IconDrop width={28} height={28} />}
            accept={
              isVideo
                ? 'video/mp4,video/webm,video/quicktime'
                : 'image/png,image/jpeg,image/webp'
            }
            onFiles={onFiles}
            compact
          />
        </>
      )}
    </div>
  );
}
