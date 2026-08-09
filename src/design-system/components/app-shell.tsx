import { useEffect } from "react"
import { Outlet, useLocation } from "react-router-dom"
import { restoreWorkbookSession } from "../../application/services"
import { discardPersistedSession } from "../../app/providers/session-persistence"
import { useAppStore } from "../../app/state/app-store"
import { WorkbookImportPanel } from "../../features/workbook/workbook-import-panel"
import { useDialogFocusManagement } from "../patterns"
import { Button } from "./button"
import { AppHeader } from "./app-header"
import { MainNavigation } from "./main-navigation"
import "./shell.css"

export function AppShell() {
  useDialogFocusManagement()
  const location = useLocation()
  const dirty = useAppStore((state) => state.dirty)
  const recoveryCandidate = useAppStore((state) => state.recoveryCandidate)
  const restoreSnapshot = useAppStore((state) => state.restoreSnapshot)
  const discardRecovery = useAppStore((state) => state.discardRecovery)

  useEffect(() => {
    function warnBeforeUnload(event: BeforeUnloadEvent) {
      if (!dirty) return
      event.preventDefault()
      event.returnValue = ""
    }
    window.addEventListener("beforeunload", warnBeforeUnload)
    return () => window.removeEventListener("beforeunload", warnBeforeUnload)
  }, [dirty])

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "auto" })
  }, [location.pathname])

  function restore() {
    if (!recoveryCandidate) return
    restoreSnapshot(
      recoveryCandidate,
      restoreWorkbookSession(recoveryCandidate),
    )
  }

  function discard() {
    discardRecovery()
    void discardPersistedSession()
  }

  function skipToContent() {
    document.getElementById("main-content")?.focus()
  }

  return (
    <div className="app-shell">
      <button className="skip-link" type="button" onClick={skipToContent}>
        Ga naar inhoud
      </button>
      <AppHeader />
      {recoveryCandidate ? (
        <section className="session-recovery" aria-label="Sessieherstel">
          <div>
            <strong>
              {recoveryCandidate.dirty
                ? "Er zijn niet-geëxporteerde wijzigingen gevonden."
                : "Er is een lokale werksessie gevonden."}
            </strong>
            <span>
              {recoveryCandidate.fileName} · bewaard om{" "}
              {new Intl.DateTimeFormat("nl-BE", {
                hour: "2-digit",
                minute: "2-digit",
              }).format(new Date(recoveryCandidate.savedAt))}
            </span>
          </div>
          <Button onClick={restore}>Sessie herstellen</Button>
          <Button variant="tertiary" onClick={discard}>
            Verwerpen
          </Button>
        </section>
      ) : null}
      <div className="app-shell__body">
        <MainNavigation />
        <main className="app-shell__main" id="main-content" tabIndex={-1}>
          <Outlet />
        </main>
      </div>
      <WorkbookImportPanel />
    </div>
  )
}
