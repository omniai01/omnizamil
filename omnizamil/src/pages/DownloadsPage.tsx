import { useEffect, useMemo, useState } from 'react';
import { IconDownloads, IconEye, IconTrash } from '@/components/Icons';
import { useApp } from '@/lib/store';
import { downloadHistoryAsZip } from '@/lib/zip';
import type { DownloadItem } from '@/lib/types';

type Filter = 'all' | 'image' | 'video';

export function DownloadsPage() {
  const { state, downloadHistoryItem, removeDownload } = useApp();
  const [filter, setFilter] = useState<Filter>('all');
  const [q, setQ] = useState('');
  const [preview, setPreview] = useState<DownloadItem | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [zipping, setZipping] = useState(false);

  const rows = useMemo(() => {
    return state.downloads.filter((d) => {
      if (filter !== 'all' && d.type !== filter) return false;
      if (q && !d.name.toLowerCase().includes(q.toLowerCase())) return false;
      return true;
    });
  }, [state.downloads, filter, q]);

  useEffect(() => {
    setSelected((prev) => {
      const next = new Set([...prev].filter((id) => rows.some((r) => r.id === id)));
      return next;
    });
  }, [rows]);

  const allSelected = rows.length > 0 && rows.every((r) => selected.has(r.id));

  const toggleOne = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (allSelected) setSelected(new Set());
    else setSelected(new Set(rows.map((r) => r.id)));
  };

  const zipSelected = async () => {
    const items = rows.filter((r) => selected.has(r.id));
    if (!items.length) return;
    setZipping(true);
    try {
      await downloadHistoryAsZip(items, 'omni-selected-clean.zip');
    } finally {
      setZipping(false);
    }
  };

  return (
    <div className="page-wrap">
      <div className="page-header">
        <div>
          <h2>Downloads</h2>
          <p>Local export history — preview, select, or save again</p>
        </div>
        {selected.size > 0 && (
          <div className="header-actions">
            <button className="btn btn-primary" disabled={zipping} onClick={zipSelected}>
              <IconDownloads width={14} height={14} />
              {zipping ? 'Zipping…' : `ZIP selected (${selected.size})`}
            </button>
          </div>
        )}
      </div>

      <p className="page-lead muted">
        Select files one by one or use Select all. Save writes to your OS Downloads folder.
      </p>

      <div className="toolbar-inline">
        <div className="filters">
          {(['all', 'image', 'video'] as Filter[]).map((f) => (
            <button
              key={f}
              className={`chip ${filter === f ? 'active' : ''}`}
              onClick={() => setFilter(f)}
            >
              {f === 'all' ? 'All' : f === 'image' ? 'Images' : 'Videos'}
            </button>
          ))}
          <button className="chip" type="button" onClick={toggleAll} disabled={!rows.length}>
            {allSelected ? 'Clear select' : 'Select all'}
          </button>
        </div>
        <input
          className="search"
          placeholder="Search files…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>

      <section className="panel downloads-panel">
        {rows.length === 0 ? (
          <div className="empty">No downloads yet. Clean files from Single or Bulk first.</div>
        ) : (
          <div className="dl-list">
            {rows.map((item) => (
              <div key={item.id} className={`dl-row light-card ${selected.has(item.id) ? 'selected' : ''}`}>
                <label className="dl-check">
                  <input
                    type="checkbox"
                    checked={selected.has(item.id)}
                    onChange={() => toggleOne(item.id)}
                  />
                </label>
                <div className="file-cell">
                  {item.type === 'image' ? (
                    <img className="thumb" src={item.blobUrl} alt="" />
                  ) : (
                    <video className="thumb" src={item.blobUrl} muted />
                  )}
                  <div className="dl-meta">
                    <span className="dl-name" title={item.name}>
                      {item.name}
                    </span>
                    <span className="dl-sub">
                      {item.type === 'video' ? 'Video' : 'Image'} · {item.time} · {item.sizeLabel}
                    </span>
                  </div>
                </div>
                <div className="row-actions">
                  <button className="btn btn-easy" type="button" onClick={() => setPreview(item)}>
                    <IconEye width={14} height={14} />
                    Preview
                  </button>
                  <button
                    className="btn btn-secondary btn-compact"
                    type="button"
                    onClick={() => downloadHistoryItem(item.id)}
                  >
                    <IconDownloads width={14} height={14} />
                    Save
                  </button>
                  <button
                    className="btn btn-ghost btn-compact"
                    type="button"
                    onClick={() => removeDownload(item.id)}
                  >
                    <IconTrash width={14} height={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {preview && (
        <div className="preview-modal" role="dialog" aria-modal="true">
          <button
            className="preview-backdrop"
            type="button"
            aria-label="Close preview"
            onClick={() => setPreview(null)}
          />
          <div className="preview-sheet">
            <div className="preview-head">
              <div>
                <h3>{preview.name}</h3>
                <p className="preview-meta">
                  Session preview · Save writes the file to your Downloads folder
                </p>
              </div>
              <div className="header-actions">
                <button
                  className="btn btn-easy"
                  type="button"
                  onClick={() => downloadHistoryItem(preview.id)}
                >
                  <IconDownloads width={14} height={14} />
                  Save file
                </button>
                <button className="btn btn-ghost" type="button" onClick={() => setPreview(null)}>
                  Close
                </button>
              </div>
            </div>
            <div className="preview-body">
              {preview.type === 'video' ? (
                <video src={preview.blobUrl} controls playsInline autoPlay />
              ) : (
                <img src={preview.blobUrl} alt={preview.name} />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
