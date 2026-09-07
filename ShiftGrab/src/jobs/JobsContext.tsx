import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import type { ActiveJob } from '../../electron/youtube/types'
import { useControl } from '../lib/control'
import { reportDownload, reportError } from '../lib/telemetry'

type JobsContextValue = {
  jobs: ActiveJob[]
  processing: ActiveJob[]
  finished: ActiveJob[]
  refresh: () => Promise<void>
  setJobsSnapshot: (next: ActiveJob[]) => void
}

const JobsContext = createContext<JobsContextValue | null>(null)

export function JobsProvider({ children }: { children: ReactNode }) {
  const [jobs, setJobs] = useState<ActiveJob[]>([])
  const { hwid, displayName } = useControl()
  const reportedRef = useRef(new Set<string>())

  const refresh = useCallback(async () => {
    const list = await window.shiftgrab.listJobs()
    setJobs(list)
  }, [])

  const setJobsSnapshot = useCallback((next: ActiveJob[]) => {
    setJobs(Array.isArray(next) ? next : [])
  }, [])

  useEffect(() => {
    void refresh()
    const off = window.shiftgrab.onJobsUpdate((next) => {
      setJobs(Array.isArray(next) ? next : [])
    })
    const timer = window.setInterval(() => {
      void refresh()
    }, 1500)
    return () => {
      off()
      window.clearInterval(timer)
    }
  }, [refresh])

  useEffect(() => {
    if (!hwid) return
    for (const job of jobs) {
      if (job.status !== 'done' && job.status !== 'failed') continue
      const key = `${job.id}:${job.status}`
      if (reportedRef.current.has(key)) continue
      reportedRef.current.add(key)
      const elapsed = Math.max(
        0,
        new Date(job.updatedAt).getTime() - new Date(job.createdAt).getTime(),
      )
      const audioOnly = /audio|mp3/i.test(job.qualityId || '')
      void reportDownload({
        hwid,
        url: job.url,
        success: job.status === 'done',
        elapsedMs: elapsed,
        audioOnly,
        displayName,
        errorMessage: job.error,
      })
      if (job.status === 'failed' && job.error) {
        void reportError({
          hwid,
          displayName,
          errorType: 'DOWNLOAD',
          message: job.error,
          severity: 'warning',
        })
      }
    }
  }, [jobs, hwid, displayName])

  const value = useMemo(() => {
    const processing = jobs.filter(
      (j) => j.status === 'queued' || j.status === 'processing',
    )
    const finished = jobs.filter(
      (j) =>
        j.status === 'done' || j.status === 'failed' || j.status === 'cancelled',
    )
    return { jobs, processing, finished, refresh, setJobsSnapshot }
  }, [jobs, refresh, setJobsSnapshot])

  return <JobsContext.Provider value={value}>{children}</JobsContext.Provider>
}

export function useJobs() {
  const ctx = useContext(JobsContext)
  if (!ctx) throw new Error('useJobs must be used inside JobsProvider')
  return ctx
}
