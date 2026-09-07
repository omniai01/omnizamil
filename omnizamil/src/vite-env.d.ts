/// <reference types="vite/client" />

export {};

declare global {
  interface Window {
    omni?: {
      saveFileDialog: (defaultName: string) => Promise<string | null>;
      openMediaDialog: () => Promise<string[]>;
      openImagesDialog: () => Promise<string[]>;
      showItemInFolder: (targetPath: string) => Promise<void>;
      removeVideo: (payload: {
        inputPath?: string;
        inputBase64?: string;
        inputName?: string;
      }) => Promise<{
        ok: true;
        outputPath: string;
        base64: string;
        size: number;
        fileName: string;
        frames: number;
        templateNcc: number;
        source: string | null;
      }>;
      writeBase64: (filePath: string, base64: string) => Promise<boolean>;
      saveAutoDownload?: (payload: { fileName: string; base64: string }) => Promise<string>;
      isElectron?: boolean;
      getPathForFile?: (file: File) => string;
      depsStatus?: () => Promise<{
        ready: boolean;
        videoReady?: boolean;
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
      }>;
      depsEnsure?: () => Promise<
        | { ok: true; restartedNeeded: boolean; videoReady?: boolean }
        | { ok: false; stopped: true }
      >;
      depsStop?: () => Promise<{ ok: true }>;
      onDepsProgress?: (
        cb: (p: {
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
        }) => void,
      ) => () => void;
      relaunch?: () => Promise<boolean>;
      runUninstaller?: () => Promise<
        { ok: true; path: string } | { ok: false; fallback: 'settings' }
      >;
      getVersion?: () => Promise<string>;
      getHardwareId?: () => Promise<string>;
      openExternal?: (url: string) => Promise<boolean>;
      checkUpdates?: () => Promise<{
        ok: true;
        upToDate: boolean;
        current: string;
        latest: string;
        message: string;
        url?: string;
      }>;
    };
  }
}

declare module '*.css';
declare module '*image-data.js';
