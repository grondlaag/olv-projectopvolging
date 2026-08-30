import { useMemo, useState, type FormEvent } from "react"
import { Link, useNavigate, useParams } from "react-router-dom"
import { buildProjectJournalWorkspace } from "../../application/queries"
import { ProjectJournalService } from "../../application/services"
import { useAppStore } from "../../app/state/app-store"
import {
  Button,
  EmptyState,
  ErrorState,
  KpiStrip,
  ViewBar,
  WorkspaceGrid,
  WorkspacePage,
} from "../../design-system/components"
import type { LocalDate, UUID } from "../../domain"
import { todayAsLocalDate } from "../../utils"
import { JournalPropertiesPanel } from "../journal/journal-properties-panel"
import {
  ProjectJournal,
  type JournalSelection,
} from "../journal/project-journal"
import "../journal/project-journal.css"
import { ProjectDossierHeader } from "./project-dossier-header"
import "./project-workspace-page.css"

type WorkspaceView = "dashboard" | "journal"
const journalService = new ProjectJournalService()

function Dashboard({
  workspace,
}: {
  workspace: NonNullable<ReturnType<typeof buildProjectJournalWorkspace>>
}) {
  const sections = [
    {
      title: "Open acties",
      items: workspace.openActions.map((item) => ({
        id: item.id,
        label: item.content,
        context: item.topic?.title ?? "Projectniveau",
      })),
    },
    {
      title: "Beslissingen gevraagd",
      items: workspace.pendingDecisionRequests.map((item) => ({
        id: item.evidence.id,
        label: item.question,
        context: item.topic?.title ?? "Projectniveau",
      })),
    },
    {
      title: "Recente beslissingen",
      items: workspace.recentDecisions.map((item) => ({
        id: item.id,
        label: item.content,
        context: item.topic?.title ?? "Projectniveau",
      })),
    },
  ]
  return (
    <div className="project-dashboard">
      <KpiStrip
        ariaLabel="Projectkerncijfers"
        items={[
          {
            id: "topics",
            label: "Actieve topics",
            value: workspace.activeTopics.length,
          },
          {
            id: "actions",
            label: "Open acties",
            value: workspace.openActions.length,
            tone: workspace.openActions.length ? "attention" : "positive",
          },
          {
            id: "requests",
            label: "Beslissingen gevraagd",
            value: workspace.pendingDecisionRequests.length,
            tone: workspace.pendingDecisionRequests.length
              ? "attention"
              : "neutral",
          },
          {
            id: "critical",
            label: "Aandacht nodig",
            value: workspace.criticalTopics.length,
            tone: workspace.criticalTopics.length ? "attention" : "positive",
          },
        ]}
      />
      <div className="project-dashboard__grid">
        {sections.map((section) => (
          <section className="project-dashboard__section" key={section.title}>
            <header>
              <h2>{section.title}</h2>
              <span>{section.items.length}</span>
            </header>
            {section.items.length ? (
              <ul>
                {section.items.slice(0, 6).map((item) => (
                  <li key={item.id}>
                    <span>{item.label}</span>
                    <small>{item.context}</small>
                  </li>
                ))}
              </ul>
            ) : (
              <p>Geen items die nu aandacht vragen.</p>
            )}
          </section>
        ))}
        <section className="project-dashboard__section project-dashboard__section--wide">
          <header>
            <h2>Kritieke topics</h2>
            <span>{workspace.criticalTopics.length}</span>
          </header>
          {workspace.criticalTopics.length ? (
            <ul>
              {workspace.criticalTopics.map((item) => (
                <li key={item.topic.id}>
                  <Link
                    to={`/projects/${workspace.project.id}/journal?topicId=${item.topic.id}`}
                  >
                    {item.topic.title}
                  </Link>
                  <small>
                    {item.openActions.length} open acties ·{" "}
                    {
                      item.decisionRequests.filter(
                        (request) => request.status === "pending",
                      ).length
                    }{" "}
                    beslissingsvragen
                  </small>
                </li>
              ))}
            </ul>
          ) : (
            <p>Geen topics met verhoogde aandacht.</p>
          )}
        </section>
      </div>
    </div>
  )
}

function NewTopicBar({
  projectId,
  onClose,
  onStatus,
}: {
  projectId: UUID
  onClose: () => void
  onStatus: (message: string, error?: boolean) => void
}) {
  const [title, setTitle] = useState("")
  const replaceDomainState = useAppStore((state) => state.replaceDomainState)
  return (
    <form
      className="new-topic-bar"
      onSubmit={(event: FormEvent) => {
        event.preventDefault()
        try {
          const result = journalService.createTopic(
            useAppStore.getState().session!.state,
            projectId,
            title,
          )
          replaceDomainState(result.state)
          onStatus(result.message)
          onClose()
        } catch (error) {
          onStatus(
            error instanceof Error ? error.message : "Topic toevoegen mislukt",
            true,
          )
        }
      }}
    >
      <label>
        <span className="sr-only">Titel nieuw topic</span>
        <input
          autoFocus
          value={title}
          placeholder="Titel van het nieuwe topic"
          onChange={(event) => setTitle(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Escape") onClose()
          }}
        />
      </label>
      <Button type="submit">Topic toevoegen</Button>
      <Button type="button" variant="tertiary" onClick={onClose}>
        Annuleren
      </Button>
    </form>
  )
}

export function ProjectWorkspacePage({ view }: { view: WorkspaceView }) {
  const { projectId, topicId } = useParams<{
    projectId: string
    topicId?: string
  }>()
  const navigate = useNavigate()
  const session = useAppStore((state) => state.session)
  const setImportPanelOpen = useAppStore((state) => state.setImportPanelOpen)
  const [selection, setSelection] = useState<JournalSelection | undefined>(
    topicId ? { kind: "topic", topicId: topicId as UUID } : undefined,
  )
  const [message, setMessage] = useState<{ text: string; error?: boolean }>()
  const [showNewTopic, setShowNewTopic] = useState(false)
  const [density, setDensity] = useState<"compact" | "comfortable">("compact")
  const [query, setQuery] = useState("")
  const workspace = useMemo(
    () =>
      session && projectId
        ? buildProjectJournalWorkspace(
            session.state,
            projectId as UUID,
            todayAsLocalDate() as LocalDate,
          )
        : undefined,
    [projectId, session],
  )
  if (!session) {
    return (
      <EmptyState
        title="Project kan nog niet worden geopend"
        description="Open eerst het bijbehorende JSON-gegevensbestand."
        action={
          <Button onClick={() => setImportPanelOpen(true)}>
            JSON openen of nieuw starten
          </Button>
        }
      />
    )
  }
  if (!workspace) {
    return (
      <ErrorState
        title="Project niet gevonden"
        description="Dit project-ID bestaat niet in de geopende gegevensset."
      />
    )
  }
  const setStatus = (text: string, error = false) =>
    setMessage({ text, ...(error ? { error } : {}) })
  const visibleWorkspace = query.trim()
    ? {
        ...workspace,
        activeTopics: workspace.activeTopics.filter((item) =>
          `${item.topic.code} ${item.topic.title} ${item.entries.map((entry) => entry.content).join(" ")}`
            .toLocaleLowerCase("nl")
            .includes(query.trim().toLocaleLowerCase("nl")),
        ),
      }
    : workspace

  return (
    <WorkspacePage className="project-workspace-page">
      <ProjectDossierHeader
        project={workspace.project}
        activeTab={view}
        openTopicCount={workspace.activeTopics.length}
        primaryAction={
          view === "journal" ? (
            <Button onClick={() => setShowNewTopic(true)}>+ Nieuw topic</Button>
          ) : (
            <Button
              onClick={() =>
                navigate(`/projects/${workspace.project.id}/journal`)
              }
            >
              Open journaal
            </Button>
          )
        }
      />
      {message ? (
        <p
          className={`journal-message${message.error ? " is-error" : ""}`}
          role={message.error ? "alert" : "status"}
        >
          {message.text}
        </p>
      ) : null}
      {view === "dashboard" ? (
        <Dashboard workspace={workspace} />
      ) : (
        <>
          <ViewBar
            primary={
              <label className="journal-density">
                <span>Weergave</span>
                <select
                  value={density}
                  onChange={(event) =>
                    setDensity(event.target.value as typeof density)
                  }
                >
                  <option value="compact">Compact</option>
                  <option value="comfortable">Ruim</option>
                </select>
              </label>
            }
            actions={
              <Button onClick={() => setShowNewTopic(true)}>
                + Nieuw topic
              </Button>
            }
          >
            <label className="journal-search">
              <span className="sr-only">Journaal filteren</span>
              <input
                value={query}
                placeholder="Filter topics en inhoud"
                onChange={(event) => setQuery(event.target.value)}
              />
            </label>
          </ViewBar>
          {showNewTopic ? (
            <NewTopicBar
              projectId={workspace.project.id}
              onClose={() => setShowNewTopic(false)}
              onStatus={setStatus}
            />
          ) : null}
          <WorkspaceGrid
            className={`journal-workspace journal-workspace--${density}`}
            inspector={
              selection ? (
                <JournalPropertiesPanel
                  key={`${selection.kind}-${selection.kind === "entry" ? selection.entryId : selection.topicId}`}
                  selection={selection}
                  workspace={workspace}
                  onClose={() => setSelection(undefined)}
                  onStatus={setStatus}
                />
              ) : undefined
            }
          >
            {visibleWorkspace.activeTopics.length ? (
              <ProjectJournal
                workspace={visibleWorkspace}
                selection={selection}
                onSelect={setSelection}
                onMutation={setStatus}
              />
            ) : (
              <EmptyState
                title={query ? "Geen topics gevonden" : "Geen actieve topics"}
                description={
                  query
                    ? "Pas de filter aan."
                    : "Maak een topic om de projectopvolging te starten."
                }
              />
            )}
          </WorkspaceGrid>
        </>
      )}
    </WorkspacePage>
  )
}
