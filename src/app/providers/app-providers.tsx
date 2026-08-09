import { useEffect, useState, type PropsWithChildren } from "react"
import {
  createWorkbookSessionSnapshot,
  restoreWorkbookSession,
} from "../../application/services"
import { useAppStore } from "../state/app-store"
import { sessionSnapshotRepository } from "./session-persistence"

export function AppProviders({ children }: PropsWithChildren) {
  const [hydrated, setHydrated] = useState(false)
  const session = useAppStore((state) => state.session)
  const dirty = useAppStore((state) => state.dirty)
  const lastExportAt = useAppStore((state) => state.lastExportAt)

  useEffect(() => {
    let active = true
    void sessionSnapshotRepository
      .load()
      .then((snapshot) => {
        if (!active || !snapshot || useAppStore.getState().session) return
        useAppStore.setState({ recoveryCandidate: snapshot })
      })
      .finally(() => {
        if (active) setHydrated(true)
      })
    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    if (!hydrated || !session) return
    const timer = window.setTimeout(() => {
      void sessionSnapshotRepository.save(
        createWorkbookSessionSnapshot(session, dirty, lastExportAt),
      )
    }, 250)
    return () => window.clearTimeout(timer)
  }, [dirty, hydrated, lastExportAt, session])

  useEffect(() => {
    const snapshot = useAppStore.getState().recoveryCandidate
    if (!snapshot || useAppStore.getState().session) return
    // Validate that a recoverable snapshot can be normalized before offering it.
    try {
      restoreWorkbookSession(snapshot)
    } catch {
      void sessionSnapshotRepository.clear()
      useAppStore.setState({ recoveryCandidate: undefined })
    }
  }, [hydrated])

  return children
}
