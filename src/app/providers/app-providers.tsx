import { useEffect, useState, type PropsWithChildren } from "react"
import {
  createDataSessionSnapshot,
  restoreDataSession,
} from "../../application/services"
import { useAppStore } from "../state/app-store"
import { sessionSnapshotRepository } from "./session-persistence"

export function AppProviders({ children }: PropsWithChildren) {
  const [hydrated, setHydrated] = useState(false)
  const session = useAppStore((state) => state.session)
  const dirty = useAppStore((state) => state.dirty)
  const lastSavedAt = useAppStore((state) => state.lastSavedAt)

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
        createDataSessionSnapshot(session, dirty, lastSavedAt),
      )
    }, 250)
    return () => window.clearTimeout(timer)
  }, [dirty, hydrated, lastSavedAt, session])

  useEffect(() => {
    const snapshot = useAppStore.getState().recoveryCandidate
    if (!snapshot || useAppStore.getState().session) return
    // Validate that a recoverable snapshot can be normalized before offering it.
    try {
      restoreDataSession(snapshot)
    } catch {
      void sessionSnapshotRepository.clear()
      useAppStore.setState({ recoveryCandidate: undefined })
    }
  }, [hydrated])

  return children
}
