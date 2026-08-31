import { useMemo, useState, type FormEvent } from "react"
import type {
  JournalEntryType,
  ProjectJournalWorkspace,
} from "../../application/queries"
import { ProjectJournalService } from "../../application/services"
import { useAppStore } from "../../app/state/app-store"
import { Button, SidePanel } from "../../design-system/components"
import type {
  ActionStatus,
  LocalDate,
  Priority,
  TopicStatus,
  UUID,
} from "../../domain"
import { actionStatuses, priorities, topicStatuses } from "../../domain"
import { formatLocalDate } from "../../utils"
import {
  type JournalSelection,
  journalTypeLabels,
  topicDisplayId,
} from "./project-journal"

const journalService = new ProjectJournalService()

function objectTypeForEntry(
  type: JournalEntryType,
): "Update" | "Action" | "Evidence" {
  if (type === "action") return "Action"
  if (type === "decision_request") return "Evidence"
  return "Update"
}

export function JournalPropertiesPanel({
  selection,
  workspace,
  onClose,
  onStatus,
}: {
  selection: JournalSelection
  workspace: ProjectJournalWorkspace
  onClose: () => void
  onStatus: (message: string, error?: boolean) => void
}) {
  const replaceDomainState = useAppStore((state) => state.replaceDomainState)
  const state = useAppStore((store) => store.session!.state)
  const topicModel = [
    ...workspace.activeTopics,
    ...workspace.closedTopics,
  ].find((item) => item.topic.id === selection.topicId)
  const entry =
    selection.kind === "entry"
      ? topicModel?.entries.find((item) => item.id === selection.entryId)
      : undefined
  const request = entry
    ? topicModel?.decisionRequests.find((item) => item.evidence.id === entry.id)
    : undefined
  const [topicTitle, setTopicTitle] = useState(topicModel?.topic.title ?? "")
  const [entryContent, setEntryContent] = useState(entry?.content ?? "")
  const [question, setQuestion] = useState("")
  const [decisionText, setDecisionText] = useState("")
  const [requestedActorId, setRequestedActorId] = useState("")
  const [targetTopicId, setTargetTopicId] = useState(
    workspace.activeTopics.find((item) => item.topic.id !== selection.topicId)
      ?.topic.id ?? "",
  )
  const [meetingId, setMeetingId] = useState("")
  const actors = state.records.actors.filter(
    (actor) => actor.active && actor.audit.active,
  )
  const meetings = useMemo(
    () =>
      state.records.meetings
        .filter(
          (meeting) =>
            meeting.audit.active &&
            meeting.status === "Concept" &&
            (meeting.scopeType === "Portfolio" ||
              (meeting.scopeType === "Project" &&
                meeting.scopeId === workspace.project.id) ||
              (meeting.scopeType === "Cluster" &&
                meeting.scopeId === workspace.project.clusterId) ||
              (meeting.scopeType === "Hoofdstuk" &&
                meeting.scopeId === workspace.project.chapterId)),
        )
        .sort((left, right) => left.date.localeCompare(right.date)),
    [state, workspace.project],
  )

  if (!topicModel) return null

  const run = (
    operation: () => ReturnType<ProjectJournalService["editEntry"]>,
    close = false,
  ) => {
    try {
      const result = operation()
      replaceDomainState(result.state)
      onStatus(
        result.message === "Geen wijzigingen" ? "Opgeslagen" : result.message,
      )
      if (close) onClose()
    } catch (error) {
      onStatus(error instanceof Error ? error.message : "Opslaan mislukt", true)
    }
  }

  const saveTopic = (
    overrides: Partial<{
      title: string
      status: TopicStatus
      ownerActorId: UUID
      priority: Priority
    }> = {},
  ) =>
    run(() =>
      journalService.editTopic(state, topicModel.topic.id, {
        title: overrides.title ?? topicTitle,
        status: overrides.status ?? topicModel.topic.status,
        ...(overrides.ownerActorId || topicModel.topic.ownerActorId
          ? {
              ownerActorId:
                overrides.ownerActorId ?? topicModel.topic.ownerActorId,
            }
          : {}),
        priority: overrides.priority ?? topicModel.topic.priority,
      }),
    )

  const saveEntry = (
    overrides: Partial<{
      content: string
      status: ActionStatus
      ownerActorId: UUID
      dueDate: LocalDate
      priority: Priority
      decisionRequestStatus: "pending" | "decided" | "cancelled"
    }> = {},
  ) => {
    if (!entry) return
    run(() =>
      journalService.editEntry(state, entry.id, {
        content: overrides.content ?? entryContent,
        ...((overrides.status ?? entry.status)
          ? { status: overrides.status ?? entry.status }
          : {}),
        ...((overrides.ownerActorId ?? entry.owner?.id)
          ? { ownerActorId: overrides.ownerActorId ?? entry.owner!.id }
          : {}),
        ...((overrides.dueDate ?? entry.dueDate)
          ? { dueDate: overrides.dueDate ?? entry.dueDate }
          : {}),
        ...((overrides.priority ?? entry.priority)
          ? { priority: overrides.priority ?? entry.priority }
          : {}),
        ...(request
          ? {
              requestedFromIds: overrides.ownerActorId
                ? [overrides.ownerActorId]
                : request.requestedFrom.map((actor) => actor.id),
            }
          : {}),
        ...(overrides.decisionRequestStatus
          ? { decisionRequestStatus: overrides.decisionRequestStatus }
          : {}),
      }),
    )
  }

  const links = entry?.meetingLinks ?? topicModel.agendaLinks
  const history = state.records.evidence
    .filter(
      (item) =>
        item.audit.active &&
        item.type === "JournalHistory" &&
        item.objectId === (entry?.id ?? topicModel.topic.id),
    )
    .sort((left, right) =>
      right.audit.createdAt.localeCompare(left.audit.createdAt),
    )
  const actionHistory =
    entry?.type === "action"
      ? (state.indices.actionHistoryByAction.get(entry.id) ?? [])
      : []

  return (
    <SidePanel
      open
      className="journal-properties"
      ariaLabel={entry ? "Entry-eigenschappen" : "Topiceigenschappen"}
      title={entry ? journalTypeLabels[entry.type].toUpperCase() : "TOPIC"}
      summary={
        entry
          ? `${formatLocalDate(entry.date)} · ID: ${entry.id.slice(0, 8)}`
          : `${topicDisplayId(topicModel.topic)} · ${topicModel.topic.title}`
      }
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
    >
      <div className="properties-form">
        {entry ? (
          <label className="properties-form__content">
            {entry.type === "decision_request" ? "Vraag" : "Inhoud"}
            <textarea
              rows={Math.max(5, entryContent.split("\n").length + 1)}
              value={entryContent}
              onChange={(event) => setEntryContent(event.target.value)}
              onBlur={() => saveEntry({ content: entryContent })}
              onKeyDown={(event) => {
                if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
                  event.preventDefault()
                  saveEntry({ content: entryContent })
                }
                if (event.key === "Escape") {
                  setEntryContent(entry.content)
                  event.currentTarget.blur()
                }
              }}
            />
          </label>
        ) : (
          <label>
            Titel
            <input
              value={topicTitle}
              onChange={(event) => setTopicTitle(event.target.value)}
              onBlur={() => saveTopic({ title: topicTitle })}
            />
          </label>
        )}

        <section className="properties-section">
          <h3>Algemeen</h3>
          {entry ? (
            <label>
              Topic
              <select
                value={targetTopicId || topicModel.topic.id}
                onChange={(event) =>
                  setTargetTopicId(event.target.value as UUID)
                }
              >
                <option value={topicModel.topic.id}>
                  {topicDisplayId(topicModel.topic)} {topicModel.topic.title}
                </option>
                {workspace.activeTopics
                  .filter((item) => item.topic.id !== topicModel.topic.id)
                  .map((item) => (
                    <option key={item.topic.id} value={item.topic.id}>
                      {topicDisplayId(item.topic)} {item.topic.title}
                    </option>
                  ))}
              </select>
            </label>
          ) : null}
          {entry ? (
            <label>
              Type
              <select
                value={entry.type}
                onChange={(event) =>
                  run(
                    () =>
                      journalService.convertEntry(
                        state,
                        entry.id,
                        event.target.value as JournalEntryType,
                      ),
                    true,
                  )
                }
              >
                {Object.entries(journalTypeLabels).map(([value, label]) => (
                  <option value={value} key={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <label>
              Status
              <select
                value={topicModel.topic.status}
                onChange={(event) =>
                  saveTopic({ status: event.target.value as TopicStatus })
                }
              >
                {topicStatuses.map((status) => (
                  <option key={status}>{status}</option>
                ))}
              </select>
            </label>
          )}
          {entry?.type === "action" ? (
            <label>
              Status
              <select
                value={entry.status}
                onChange={(event) =>
                  saveEntry({ status: event.target.value as ActionStatus })
                }
              >
                {actionStatuses.map((status) => (
                  <option key={status}>{status}</option>
                ))}
              </select>
            </label>
          ) : null}
          {entry?.type === "decision_request" ? (
            <label>
              Status
              <select
                value={request?.status ?? "pending"}
                onChange={(event) =>
                  saveEntry({
                    decisionRequestStatus: event.target.value as
                      "pending" | "decided" | "cancelled",
                  })
                }
              >
                <option value="pending">Open</option>
                <option value="decided">Beslist</option>
                <option value="cancelled">Geannuleerd</option>
              </select>
            </label>
          ) : null}
          {entry?.type === "action" ||
          entry?.type === "decision_request" ||
          !entry ? (
            <label>
              Eigenaar {entry?.type === "decision_request" ? "/ beslisser" : ""}
              <select
                value={entry?.owner?.id ?? topicModel.topic.ownerActorId ?? ""}
                onChange={(event) => {
                  const ownerActorId = event.target.value as UUID
                  if (entry) saveEntry({ ownerActorId })
                  else saveTopic({ ownerActorId })
                }}
              >
                <option value="">Niet toegewezen</option>
                {actors.map((actor) => (
                  <option value={actor.id} key={actor.id}>
                    {actor.displayName}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          {entry?.type === "action" || !entry ? (
            <label>
              Prioriteit
              <select
                value={entry?.priority ?? topicModel.topic.priority}
                onChange={(event) => {
                  const priority = event.target.value as Priority
                  if (entry) saveEntry({ priority })
                  else saveTopic({ priority })
                }}
              >
                {priorities.map((priority) => (
                  <option key={priority}>{priority}</option>
                ))}
              </select>
            </label>
          ) : null}
          {entry?.type === "action" || entry?.type === "decision_request" ? (
            <label>
              Deadline
              <input
                type="date"
                defaultValue={entry.dueDate}
                onBlur={(event) =>
                  event.target.value &&
                  saveEntry({ dueDate: event.target.value as LocalDate })
                }
              />
            </label>
          ) : null}
        </section>

        <section className="properties-section">
          <h3>Vergadering</h3>
          {links.length ? (
            <ul className="properties-links">
              {links.map((link) => (
                <li key={link.evidence?.id ?? link.agendaItem?.id}>
                  <span>{link.meeting?.title ?? "Onbekend overleg"}</span>
                  <small>
                    {link.meeting ? formatLocalDate(link.meeting.date) : ""} ·{" "}
                    {link.status ?? "scheduled"}
                  </small>
                </li>
              ))}
            </ul>
          ) : (
            <p>Nog niet aan een vergadering gekoppeld.</p>
          )}
          <div className="properties-inline-action">
            <select
              value={meetingId}
              onChange={(event) => setMeetingId(event.target.value)}
              aria-label="Vergadering kiezen"
            >
              <option value="">Kies vergadering...</option>
              {meetings.map((meeting) => (
                <option key={meeting.id} value={meeting.id}>
                  {meeting.title} — {formatLocalDate(meeting.date)}
                </option>
              ))}
            </select>
            <Button
              variant="tertiary"
              disabled={!meetingId}
              onClick={() =>
                run(() =>
                  journalService.linkToMeeting(
                    state,
                    workspace.project.id,
                    topicModel.topic.id,
                    entry ? objectTypeForEntry(entry.type) : "Topic",
                    entry?.id ?? topicModel.topic.id,
                    meetingId as UUID,
                  ),
                )
              }
            >
              + Voeg toe
            </Button>
          </div>
        </section>

        {entry ? (
          <section className="properties-section properties-section--actions">
            <h3>Vervolg</h3>
            {targetTopicId && targetTopicId !== topicModel.topic.id ? (
              <Button
                variant="tertiary"
                onClick={() =>
                  run(
                    () =>
                      journalService.moveEntry(
                        state,
                        entry.id,
                        targetTopicId as UUID,
                      ),
                    true,
                  )
                }
              >
                Verplaats naar Topic
              </Button>
            ) : null}
            {entry.type === "decision_request" &&
            request?.status === "pending" ? (
              <div className="properties-inline-action">
                <label>
                  Genomen beslissing
                  <input
                    value={decisionText}
                    onChange={(event) => setDecisionText(event.target.value)}
                    placeholder="Beschrijf de beslissing..."
                  />
                </label>
                <Button
                  variant="tertiary"
                  disabled={!decisionText.trim()}
                  onClick={() =>
                    run(() =>
                      journalService.resolveDecisionRequest(
                        state,
                        entry.id,
                        topicModel.topic.id,
                        decisionText.trim(),
                      ),
                    )
                  }
                >
                  Los op met beslissing
                </Button>
              </div>
            ) : null}
            {entry.type !== "action" ? (
              <Button
                variant="tertiary"
                onClick={() =>
                  run(() =>
                    journalService.deriveAction(
                      state,
                      entry.id,
                      topicModel.topic.id,
                      entry.content,
                    ),
                  )
                }
              >
                Maak actie
              </Button>
            ) : null}
            <Button
              variant="tertiary"
              onClick={() =>
                run(
                  () =>
                    journalService.promoteEntryToTopic(
                      state,
                      workspace.project.id,
                      entry.id,
                      entry.content.split("\n")[0]!,
                    ),
                  true,
                )
              }
            >
              Maak nieuw Topic hiervan
            </Button>
          </section>
        ) : (
          <form
            className="properties-section"
            onSubmit={(event: FormEvent) => {
              event.preventDefault()
              run(() =>
                journalService.addDecisionRequest(
                  state,
                  workspace.project.id,
                  "Topic",
                  topicModel.topic.id,
                  question,
                  requestedActorId ? [requestedActorId as UUID] : [],
                ),
              )
              setQuestion("")
            }}
          >
            <h3>Beslissing nodig</h3>
            <textarea
              rows={2}
              value={question}
              placeholder="Voeg beslissingsvraag toe"
              aria-label="Nieuwe beslissingsvraag"
              onChange={(event) => setQuestion(event.target.value)}
            />
            <select
              aria-label="Beslisser kiezen"
              value={requestedActorId}
              onChange={(event) => setRequestedActorId(event.target.value)}
            >
              <option value="">Nog niet toegewezen</option>
              {actors.map((actor) => (
                <option key={actor.id} value={actor.id}>
                  {actor.displayName}
                </option>
              ))}
            </select>
            <Button variant="tertiary">+ Voeg beslissingsvraag toe</Button>
          </form>
        )}

        <details className="properties-disclosure">
          <summary>Planning en budget</summary>
          <dl>
            <dt>Planning</dt>
            <dd>
              {topicModel.planning
                ? formatLocalDate(topicModel.planning.plannedEndDate)
                : "Niet gepland"}
            </dd>
            <dt>Budgetrecords</dt>
            <dd>
              {state.indices.budgetByTopic.get(topicModel.topic.id)?.length ??
                0}
            </dd>
          </dl>
        </details>
        <details className="properties-disclosure">
          <summary>Bijlagen en relaties</summary>
          <p>Geen bijlagen. Externe bestanden blijven lokale referenties.</p>
        </details>
        <details className="properties-disclosure">
          <summary>Historiek ({history.length + actionHistory.length})</summary>
          {[...history, ...actionHistory].length ? (
            <ul className="properties-history">
              {history.map((item) => (
                <li key={item.id}>
                  <span>{item.title}</span>
                  <time>
                    {new Date(item.audit.createdAt).toLocaleString("nl-BE")}
                  </time>
                </li>
              ))}
              {actionHistory.map((item) => (
                <li key={item.id}>
                  <span>
                    {item.field}: {item.previousValue ?? "—"} →{" "}
                    {item.newValue ?? "—"}
                  </span>
                  <time>
                    {new Date(item.changedAt).toLocaleString("nl-BE")}
                  </time>
                </li>
              ))}
            </ul>
          ) : (
            <p>Nog geen geregistreerde wijzigingen.</p>
          )}
        </details>
        <details className="properties-disclosure">
          <summary>Metadata</summary>
          <dl>
            <dt>Aangemaakt op</dt>
            <dd>
              {new Date(
                (entry?.source.audit ?? topicModel.topic.audit).createdAt,
              ).toLocaleString("nl-BE")}
            </dd>
            <dt>Laatst gewijzigd</dt>
            <dd>
              {new Date(
                (entry?.source.audit ?? topicModel.topic.audit).updatedAt,
              ).toLocaleString("nl-BE")}
            </dd>
          </dl>
        </details>
      </div>
    </SidePanel>
  )
}
