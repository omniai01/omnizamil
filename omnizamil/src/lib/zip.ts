import JSZip from 'jszip';
import { cleanedName } from './engine';
import type { DownloadItem, QueueItem } from './types';

export async function downloadQueueAsZip(items: QueueItem[], zipName: string) {
  const done = items.filter((q) => q.status === 'done' && q.resultUrl);
  if (!done.length) return;

  const zip = new JSZip();
  await Promise.all(
    done.map(async (item) => {
      const res = await fetch(item.resultUrl!);
      const blob = await res.blob();
      const ext = item.mediaType === 'video' ? 'mp4' : 'png';
      zip.file(cleanedName(item.name, ext), blob);
    }),
  );

  const out = await zip.generateAsync({ type: 'blob' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(out);
  a.download = zipName;
  a.click();
  URL.revokeObjectURL(a.href);
}

export async function downloadHistoryAsZip(items: DownloadItem[], zipName: string) {
  if (!items.length) return;
  const zip = new JSZip();
  await Promise.all(
    items.map(async (item) => {
      const res = await fetch(item.blobUrl);
      const blob = await res.blob();
      zip.file(item.name, blob);
    }),
  );
  const out = await zip.generateAsync({ type: 'blob' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(out);
  a.download = zipName;
  a.click();
  URL.revokeObjectURL(a.href);
}
