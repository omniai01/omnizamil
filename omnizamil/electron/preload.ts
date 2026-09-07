import { webUtils } from 'electron';
import { contextBridge, ipcRenderer } from 'electron';

type DepsProgress = {
  stage: string;
  percent: number;
  etaSeconds?: number | null;
  imageStatus?: 'ready' | 'missing' | 'installing';
  videoStatus?: 'ready' | 'missing' | 'installing';
  components?: Array<{
    id: string;
    name: string;
    status: 'ready' | 'installing' | 'needed';
  }>;
};

contextBridge.exposeInMainWorld('omni', {
  isElectron: true,
  saveFileDialog: (defaultName: string) =>
    ipcRenderer.invoke('dialog:saveFile', defaultName) as Promise<string | null>,
  openMediaDialog: () => ipcRenderer.invoke('dialog:openMedia') as Promise<string[]>,
  openImagesDialog: () => ipcRenderer.invoke('dialog:openMedia') as Promise<string[]>,
  showItemInFolder: (targetPath: string) =>
    ipcRenderer.invoke('shell:showItem', targetPath) as Promise<void>,
  getPathForFile: (file: File) => {
    try {
      return webUtils.getPathForFile(file);
    } catch {
      return '';
    }
  },
  removeVideo: (payload: {
    inputPath?: string;
    inputBase64?: string;
    inputName?: string;
  }) =>
    ipcRenderer.invoke('video:remove', payload) as Promise<{
      ok: true;
      outputPath: string;
      base64: string;
      size: number;
      fileName: string;
      frames: number;
      templateNcc: number;
      source: string | null;
    }>,
  writeBase64: (filePath: string, base64: string) =>
    ipcRenderer.invoke('fs:writeBase64', filePath, base64) as Promise<boolean>,
  saveAutoDownload: (payload: { fileName: string; base64: string }) =>
    ipcRenderer.invoke('downloads:saveAuto', payload) as Promise<string>,
  depsStatus: () =>
    ipcRenderer.invoke('deps:status') as Promise<{
      ready: boolean;
      message: string;
      canCopyLocal?: boolean;
      checks?: Array<{
        id: string;
        name: string;
        ready: boolean;
        label: string;
        detail: string;
      }>;
      image?: { ready: boolean; label: string };
      video?: { ready: boolean; label: string };
      components?: Array<{
        id: string;
        name: string;
        status: 'ready' | 'installing' | 'needed';
      }>;
    }>,
  depsEnsure: () =>
    ipcRenderer.invoke('deps:ensure') as Promise<
      { ok: true; restartedNeeded: boolean } | { ok: false; stopped: true }
    >,
  depsStop: () => ipcRenderer.invoke('deps:stop') as Promise<{ ok: true }>,
  onDepsProgress: (cb: (p: DepsProgress) => void) => {
    const listener = (_: unknown, p: DepsProgress) => cb(p);
    ipcRenderer.on('deps:progress', listener);
    return () => ipcRenderer.removeListener('deps:progress', listener);
  },
  relaunch: () => ipcRenderer.invoke('app:relaunch') as Promise<boolean>,
  runUninstaller: () =>
    ipcRenderer.invoke('app:runUninstaller') as Promise<
      { ok: true; path: string } | { ok: false; fallback: 'settings' }
    >,
  getVersion: () => ipcRenderer.invoke('app:getVersion') as Promise<string>,
  getHardwareId: () => ipcRenderer.invoke('app:hardwareId') as Promise<string>,
  openExternal: (url: string) => ipcRenderer.invoke('shell:openExternal', url) as Promise<boolean>,
  checkUpdates: () =>
    ipcRenderer.invoke('updates:check') as Promise<{
      ok: true;
      upToDate: boolean;
      current: string;
      latest: string;
      message: string;
      url?: string;
    }>,
});
