import { useEffect } from "react"
import { Outlet, useLocation } from "react-router-dom"
import {
  restoreDataSession,
  type NormalizedDomainState,
} from "../../application/services"
import { discardPersistedSession } from "../../app/providers/session-persistence"
import { useAppStore } from "../../app/state/app-store"
import { recordRecentWorkspaceLink } from "../../app/preferences/workspace-preferences"
import type { UUID } from "../../domain"
import { DataFilePanel } from "../../features/workbook/workbook-import-panel"
import { useDialogFocusManagement } from "../patterns"
import { Button } from "./button"
import { AppHeader } from "./app-header"
import { MainNavigation } from "./main-navigation"
import "./shell.css"

function workspaceLinkForPath(state: NormalizedDomainState, pathname: string) {
  const topicMatch = pathname.match(
    /^\/(projects|clusters)\/([^/]+)\/topics\/([^/]+)\/??$/,
  )
  if (topicMatch?.[1] && topicMatch[2] && topicMatch[3]) {
    const topic = state.indices.topicById.get(topicMatch[3] as UUID)
    if (topic)
      return {
        route: `/${topicMatch[1]}/${topicMatch[2]}/topics/${topic.id}`,
        label: `${topic.code} · ${topic.title}`,
        kind: "Topic" as const,
      }
  }
  const meetingMatch = pathname.match(/^\/meetings\/([^/]+)\/??$/)
  if (meetingMatch?.[1]) {
    const meeting = state.indices.meetingById.get(meetingMatch[1] as UUID)
    if (meeting)
      return {
        route: `/meetings/${meeting.id}`,
        label: meeting.title,
        kind: "Overleg" as const,
      }
  }
  const projectMatch = pathname.match(/^\/projects\/([^/]+)/)
  if (projectMatch?.[1]) {
    const project = state.indices.projectById.get(projectMatch[1] as UUID)
    if (project)
      return {
        route: `/projects/${project.id}`,
        label: `${project.code} · ${project.title}`,
        kind: "Project" as const,
      }
  }
  return undefined
}

export function AppShell() {
  useDialogFocusManagement()
  const location = useLocation()
  const dirty = useAppStore((state) => state.dirty)
  const session = useAppStore((state) => state.session)
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

  useEffect(() => {
    if (!session) return
    const link = workspaceLinkForPath(session.state, location.pathname)
    if (link) recordRecentWorkspaceLink(link)
  }, [location.pathname, session])

  function restore() {
    if (!recoveryCandidate) return
    restoreSnapshot(recoveryCandidate, restoreDataSession(recoveryCandidate))
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
                ? "Er zijn niet-opgeslagen wijzigingen gevonden."
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
      <DataFilePanel />
    </div>
  )
}
