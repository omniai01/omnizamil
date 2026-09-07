/// <reference types="vite/client" />

import type { ShiftGrabApi } from '../electron/preload'

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL?: string
  readonly VITE_SUPABASE_ANON_KEY?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

declare global {
  interface Window {
    shiftgrab: ShiftGrabApi
  }
}

export {}
