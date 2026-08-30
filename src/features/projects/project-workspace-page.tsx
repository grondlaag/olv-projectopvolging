import { useMemo, useState, type FormEvent, type KeyboardEvent } from "react"
import { Link, useNavigate, useParams } from "react-router-dom"
import {
  buildProjectJournalWorkspace,
  type JournalEntryType,
  type JournalEntryView,
  type ProjectJournalTopic,
} from "../../application/queries"
import {
  journalCommands,
  ProjectJournalService,
} from "../../application/services"
import { useAppStore } from "../../app/state/app-store"
import {
  Badge,
  Button,
  Collapsible,
  EmptyState,
  ErrorState,
  KpiStrip,
  SidePanel,
  WorkspaceGrid,
  WorkspacePage,
} from "../../design-system/components"
import type { LocalDate, UUID } from "../../domain"
import { formatLocalDate, todayAsLocalDate } from "../../utils"
import { ProjectDossierHeader } from "./project-dossier-header"
import "./project-workspace-page.css"

type WorkspaceView = "dashboard" | "journal"
type Selection =
  | { kind: "topic"; topicId: UUID }
  | { kind: "entry"; entryId: UUID; topicId: UUID }

const journalService = new ProjectJournalService()
const typeLabels: Record<JournalEntryType, string> = {
  update: "Update",
  action: "Actie",
  decision: "Beslissing",
}

function readableError(error: unknown) {
  return error instanceof Error
    ? error.message
    : "De wijziging kon niet worden opgeslagen."
}

function EntryRow({
  entry,
  selected,
  onSelect,
  onTypeChange,
  onComplete,
}: {
  entry: JournalEntryView
  selected: boolean
  onSelect: () => void
  onTypeChange: (type: JournalEntryType) => void
  onComplete: () => void
}) {
  return (
    <article
      className={`journal-entry${selected ? " is-selected" : ""}`}
      onClick={onSelect}
    >
      <div className="journal-entry__main">
        {entry.type === "action" ? (
          <button
            type="button"
            className="journal-entry__check"
            aria-label={`Actie ${entry.content} voltooien`}
            onClick={(event) => {
              event.stopPropagation()
              onComplete()
            }}
          />
        ) : (
          <span
            className={`journal-entry__marker journal-entry__marker--${entry.type}`}
          />
        )}
        <div>
          <p>{entry.content}</p>
          <small>
            {entry.createdBy?.displayName ??
              entry.owner?.displayName ??
              "Onbekende actor"}{" "}
            · {formatLocalDate(entry.date)}
            {entry.dueDate ? ` · tegen ${formatLocalDate(entry.dueDate)}` : ""}
          </small>
        </div>
      </div>
      <select
        aria-label={`Type van ${entry.content}`}
        value={entry.type}
        onClick={(event) => event.stopPropagation()}
        onChange={(event) =>
          onTypeChange(event.target.value as JournalEntryType)
        }
      >
        {Object.entries(typeLabels).map(([value, label]) => (
          <option key={value} value={value}>
            {label}
          </option>
        ))}
      </select>
    </article>
  )
}

function JournalComposer({
  topicId,
  topicTitle,
  onSaved,
}: {
  topicId: UUID
  topicTitle: string
  onSaved: (message: string) => void
}) {
  const [value, setValue] = useState("")
  const [type, setType] = useState<JournalEntryType>("update")
  const [error, setError] = useState("")
  const replaceDomainState = useAppStore((state) => state.replaceDomainState)
  const suggestions = value.startsWith("/")
    ? journalCommands.filter((item) =>
        item.command.startsWith(value.split(/\s/)[0]!.toLocaleLowerCase("nl")),
      )
    : []

  const submit = () => {
    if (!value.trim()) return
    const state = useAppStore.getState().session?.state
    if (!state) return
    try {
      const result = value.startsWith("/")
        ? journalService.executeComposer(state, topicId, value)
        : journalService.addEntry(state, topicId, type, value)
      replaceDomainState(result.state)
      setValue("")
      setError("")
      onSaved(result.message)
    } catch (caught) {
      setError(readableError(caught))
    }
  }

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault()
      submit()
    }
  }

  return (
    <div className="journal-composer">
      <div
        className="journal-composer__types"
        role="group"
        aria-label="Soort bijdrage"
      >
        {(Object.keys(typeLabels) as JournalEntryType[]).map((entryType) => (
          <button
            key={entryType}
            type="button"
            className={type === entryType ? "is-active" : ""}
            onClick={() => setType(entryType)}
          >
            {typeLabels[entryType]}
          </button>
        ))}
      </div>
      <textarea
        value={value}
        aria-label={`Nieuwe bijdrage aan ${topicTitle}`}
        placeholder="Schrijf een update… Gebruik / voor snelle acties"
        rows={2}
        onChange={(event) => setValue(event.target.value)}
        onKeyDown={onKeyDown}
      />
      {suggestions.length ? (
        <div
          className="journal-command-list"
          role="listbox"
          aria-label="Journaalcommando's"
        >
          {suggestions.map((item) => (
            <button
              key={item.command}
              type="button"
              onClick={() => setValue(`${item.command} `)}
            >
              <strong>{item.command}</strong>
              <span>{item.description}</span>
            </button>
          ))}
        </div>
      ) : null}
      <footer>
        <small>Enter om op te slaan · Shift+Enter voor een nieuwe regel</small>
        <Button onClick={submit}>Toevoegen</Button>
      </footer>
      {error ? (
        <p className="journal-message is-error" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  )
}

function TopicSection({
  model,
  selection,
  onSelect,
  onMutation,
}: {
  model: ProjectJournalTopic
  selection?: Selection | undefined
  onSelect: (selection: Selection) => void
  onMutation: (message: string, error?: boolean) => void
}) {
  const replaceDomainState = useAppStore((state) => state.replaceDomainState)
  const apply = (
    operation: () => ReturnType<ProjectJournalService["convertEntry"]>,
  ) => {
    try {
      const result = operation()
      replaceDomainState(result.state)
      onMutation(result.message)
    } catch (error) {
      onMutation(readableError(error), true)
    }
  }
  const entry = (item: JournalEntryView) => (
    <EntryRow
      key={item.id}
      entry={item}
      selected={selection?.kind === "entry" && selection.entryId === item.id}
      onSelect={() =>
        onSelect({ kind: "entry", entryId: item.id, topicId: model.topic.id })
      }
      onTypeChange={(type) =>
        apply(() =>
          journalService.convertEntry(
            useAppStore.getState().session!.state,
            item.id,
            type,
          ),
        )
      }
      onComplete={() =>
        apply(() =>
          journalService.completeAction(
            useAppStore.getState().session!.state,
            item.id,
          ),
        )
      }
    />
  )
  return (
    <Collapsible
      defaultOpen
      className="journal-topic"
      eyebrow={model.topic.code}
      title={model.topic.title}
      summary={
        <span>
          {model.openActions.length} acties · bijgewerkt{" "}
          {formatLocalDate(model.lastActivityAt.slice(0, 10) as LocalDate)}
        </span>
      }
    >
      <button
        className="journal-topic__context"
        type="button"
        onClick={() => onSelect({ kind: "topic", topicId: model.topic.id })}
      >
        <span>{model.topic.context || "Geen aanvullende context"}</span>
        <Badge
          tone={
            model.topic.priority === "Kritiek"
              ? "danger"
              : model.topic.priority === "Hoog"
                ? "warning"
                : "neutral"
          }
        >
          {model.topic.priority}
        </Badge>
      </button>
      {model.openActions.length ? (
        <section className="journal-lane">
          <h3>Open acties</h3>
          {model.openActions.map(entry)}
        </section>
      ) : null}
      {model.decisionRequests.filter((request) => request.status === "pending")
        .length ? (
        <section className="journal-lane">
          <h3>Beslissing gevraagd</h3>
          {model.decisionRequests
            .filter((request) => request.status === "pending")
            .map((request) => (
              <button
                className="decision-request"
                type="button"
                key={request.evidence.id}
                onClick={() =>
                  onSelect({ kind: "topic", topicId: model.topic.id })
                }
              >
                <span>{request.question}</span>
                <small>
                  {request.requestedFrom
                    .map((actor) => actor.displayName)
                    .join(", ") || "Nog niet toegewezen"}
                </small>
              </button>
            ))}
        </section>
      ) : null}
      {model.decisions.length ? (
        <section className="journal-lane">
          <h3>Beslissingen</h3>
          {model.decisions.slice(0, 2).map(entry)}
          {model.decisions.length > 2 ? (
            <Collapsible
              title={`${model.decisions.length - 2} oudere beslissingen`}
            >
              {model.decisions.slice(2).map(entry)}
            </Collapsible>
          ) : null}
        </section>
      ) : null}
      {model.history.length ? (
        <section className="journal-lane journal-lane--history">
          <h3>Historiek</h3>
          {model.history.map(entry)}
        </section>
      ) : null}
      <JournalComposer
        topicId={model.topic.id}
        topicTitle={model.topic.title}
        onSaved={onMutation}
      />
    </Collapsible>
  )
}

function Dashboard({
  workspace,
}: {
  workspace: NonNullable<ReturnType<typeof buildProjectJournalWorkspace>>
}) {
  const sections = [
    [
      "Open acties",
      workspace.openActions,
      (item: (typeof workspace.openActions)[number]) => item.content,
      (item: (typeof workspace.openActions)[number]) => item.topic?.title,
    ],
    [
      "Beslissingen gevraagd",
      workspace.pendingDecisionRequests,
      (item: (typeof workspace.pendingDecisionRequests)[number]) =>
        item.question,
      (item: (typeof workspace.pendingDecisionRequests)[number]) =>
        item.topic?.title,
    ],
    [
      "Recente beslissingen",
      workspace.recentDecisions,
      (item: (typeof workspace.recentDecisions)[number]) => item.content,
      (item: (typeof workspace.recentDecisions)[number]) => item.topic?.title,
    ],
  ] as const
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
        {sections.map(([title, items, label, context]) => (
          <section className="project-dashboard__section" key={title}>
            <header>
              <h2>{title}</h2>
              <span>{items.length}</span>
            </header>
            {items.length ? (
              <ul>
                {items.slice(0, 6).map((item) => (
                  <li key={"evidence" in item ? item.evidence.id : item.id}>
                    <span>{label(item as never)}</span>
                    <small>{context(item as never) ?? "Projectniveau"}</small>
                  </li>
                ))}
              </ul>
            ) : (
              <p>Geen items die nu aandacht vragen.</p>
            )}
          </section>
        ))}
        <section className="project-dashboard__section">
          <header>
            <h2>Komende planning</h2>
            <span>{workspace.upcomingPlanning.length}</span>
          </header>
          {workspace.upcomingPlanning.length ? (
            <ul>
              {workspace.upcomingPlanning.slice(0, 6).map((item) => (
                <li key={item.id}>
                  <span>{item.title}</span>
                  <small>{formatLocalDate(item.plannedEndDate)}</small>
                </li>
              ))}
            </ul>
          ) : (
            <p>Geen komende planningsitems.</p>
          )}
        </section>
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

function PropertiesPanel({
  selection,
  workspace,
  onClose,
  onStatus,
}: {
  selection: Selection
  workspace: NonNullable<ReturnType<typeof buildProjectJournalWorkspace>>
  onClose: () => void
  onStatus: (message: string, error?: boolean) => void
}) {
  const replaceDomainState = useAppStore((state) => state.replaceDomainState)
  const topicModel = [
    ...workspace.activeTopics,
    ...workspace.closedTopics,
  ].find((item) => item.topic.id === selection.topicId)
  const entry = topicModel
    ? [
        ...topicModel.openActions,
        ...topicModel.decisions,
        ...topicModel.history,
      ].find(
        (item) => selection.kind === "entry" && item.id === selection.entryId,
      )
    : undefined
  const [targetTopicId, setTargetTopicId] = useState(
    workspace.activeTopics.find((item) => item.topic.id !== selection.topicId)
      ?.topic.id ?? selection.topicId,
  )
  const [question, setQuestion] = useState("")
  const [actorId, setActorId] = useState("")
  const actors = useAppStore
    .getState()
    .session!.state.records.actors.filter(
      (actor) => actor.active && actor.audit.active,
    )
  if (!topicModel) return null
  const run = (
    operation: () => ReturnType<ProjectJournalService["moveEntry"]>,
  ) => {
    try {
      const result = operation()
      replaceDomainState(result.state)
      onStatus(result.message)
    } catch (error) {
      onStatus(readableError(error), true)
    }
  }
  return (
    <SidePanel
      open
      ariaLabel={entry ? "Entry-eigenschappen" : "Topiceigenschappen"}
      title={entry ? typeLabels[entry.type] : "Topiceigenschappen"}
      summary={topicModel.topic.title}
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
    >
      <div className="properties-form">
        <dl>
          <dt>Status</dt>
          <dd>{topicModel.topic.status}</dd>
          <dt>Eigenaar</dt>
          <dd>{topicModel.owner?.displayName ?? "Niet toegewezen"}</dd>
          <dt>Prioriteit</dt>
          <dd>{topicModel.topic.priority}</dd>
          <dt>Planning</dt>
          <dd>
            {topicModel.planning
              ? formatLocalDate(topicModel.planning.plannedEndDate)
              : "Niet gepland"}
          </dd>
        </dl>
        {entry ? (
          <>
            <label>
              Verplaats naar topic
              <select
                value={targetTopicId}
                onChange={(event) =>
                  setTargetTopicId(event.target.value as UUID)
                }
              >
                {workspace.activeTopics
                  .filter((item) => item.topic.id !== topicModel.topic.id)
                  .map((item) => (
                    <option key={item.topic.id} value={item.topic.id}>
                      {item.topic.title}
                    </option>
                  ))}
              </select>
            </label>
            <Button
              variant="tertiary"
              onClick={() =>
                run(() =>
                  journalService.moveEntry(
                    useAppStore.getState().session!.state,
                    entry.id,
                    targetTopicId,
                  ),
                )
              }
            >
              Entry verplaatsen
            </Button>
            <Button
              variant="tertiary"
              onClick={() =>
                run(() =>
                  journalService.deriveAction(
                    useAppStore.getState().session!.state,
                    entry.id,
                    topicModel.topic.id,
                    entry.content,
                  ),
                )
              }
            >
              Actie afleiden
            </Button>
            <Button
              variant="tertiary"
              onClick={() =>
                run(() =>
                  journalService.promoteEntryToTopic(
                    useAppStore.getState().session!.state,
                    workspace.project.id,
                    entry.id,
                    entry.content,
                  ),
                )
              }
            >
              Verder opvolgen als topic
            </Button>
          </>
        ) : null}
        <form
          onSubmit={(event: FormEvent) => {
            event.preventDefault()
            run(() =>
              journalService.addDecisionRequest(
                useAppStore.getState().session!.state,
                workspace.project.id,
                selection.kind === "entry"
                  ? entry?.source.objectType === "Action"
                    ? "Action"
                    : "Update"
                  : "Topic",
                selection.kind === "entry"
                  ? selection.entryId
                  : selection.topicId,
                question,
                actorId ? [actorId as UUID] : [],
              ),
            )
            setQuestion("")
          }}
        >
          <h3>Beslissing vragen</h3>
          <label>
            Vraag
            <textarea
              value={question}
              onChange={(event) => setQuestion(event.target.value)}
              rows={3}
            />
          </label>
          <label>
            Van
            <select
              value={actorId}
              onChange={(event) => setActorId(event.target.value)}
            >
              <option value="">Nog niet toegewezen</option>
              {actors.map((actor) => (
                <option key={actor.id} value={actor.id}>
                  {actor.displayName}
                </option>
              ))}
            </select>
          </label>
          <Button>Vraag toevoegen</Button>
        </form>
        <Button
          variant="tertiary"
          onClick={() =>
            run(() =>
              journalService.executeComposer(
                useAppStore.getState().session!.state,
                topicModel.topic.id,
                topicModel.topic.status === "Open" ? "/sluit" : "/heropen",
              ),
            )
          }
        >
          {topicModel.topic.status === "Open"
            ? "Topic sluiten"
            : "Topic heropenen"}
        </Button>
      </div>
    </SidePanel>
  )
}

export function ProjectWorkspacePage({ view }: { view: WorkspaceView }) {
  const { projectId } = useParams<{ projectId: string }>()
  const navigate = useNavigate()
  const session = useAppStore((state) => state.session)
  const setImportPanelOpen = useAppStore((state) => state.setImportPanelOpen)
  const [selection, setSelection] = useState<Selection>()
  const [message, setMessage] = useState<{ text: string; error?: boolean }>()
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
  if (!session)
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
  if (!workspace)
    return (
      <ErrorState
        title="Project niet gevonden"
        description="Dit project-ID bestaat niet in de geopende gegevensset."
      />
    )
  const setStatus = (text: string, error = false) =>
    setMessage({ text, ...(error ? { error } : {}) })
  return (
    <WorkspacePage className="project-workspace-page">
      <ProjectDossierHeader
        project={workspace.project}
        activeTab={view}
        openTopicCount={workspace.activeTopics.length}
        primaryAction={
          view === "journal" ? (
            <Button
              onClick={() => {
                const title = window.prompt("Titel van het nieuwe topic")
                if (!title) return
                try {
                  const result = journalService.createTopic(
                    useAppStore.getState().session!.state,
                    workspace.project.id,
                    title,
                  )
                  useAppStore.getState().replaceDomainState(result.state)
                  setStatus(result.message)
                } catch (error) {
                  setStatus(readableError(error), true)
                }
              }}
            >
              + Topic
            </Button>
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
        <WorkspaceGrid
          inspector={
            selection ? (
              <PropertiesPanel
                selection={selection}
                workspace={workspace}
                onClose={() => setSelection(undefined)}
                onStatus={setStatus}
              />
            ) : undefined
          }
        >
          <main className="project-journal" aria-label="Projectjournaal">
            <header className="project-journal__intro">
              <div>
                <p className="eyebrow">Primaire werkruimte</p>
                <h2>Projectjournaal</h2>
                <p>
                  Topics staan op laatste activiteit. Acties, beslissingen en
                  historiek blijven samen in context.
                </p>
              </div>
            </header>
            {workspace.activeTopics.length ? (
              workspace.activeTopics.map((topic) => (
                <TopicSection
                  key={topic.topic.id}
                  model={topic}
                  selection={selection}
                  onSelect={setSelection}
                  onMutation={setStatus}
                />
              ))
            ) : (
              <EmptyState
                title="Geen actieve topics"
                description="Maak een topic om de projectopvolging te starten."
              />
            )}
            {workspace.closedTopics.length ? (
              <Collapsible
                className="closed-topics"
                title="Gesloten topics"
                summary={`${workspace.closedTopics.length}`}
              >
                <div>
                  {workspace.closedTopics.map((topic) => (
                    <TopicSection
                      key={topic.topic.id}
                      model={topic}
                      selection={selection}
                      onSelect={setSelection}
                      onMutation={setStatus}
                    />
                  ))}
                </div>
              </Collapsible>
            ) : null}
          </main>
        </WorkspaceGrid>
      )}
    </WorkspacePage>
  )
}
