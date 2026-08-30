import { useMemo, useState, type KeyboardEvent } from "react"
import {
  buildAgendaItemContext,
  buildProjectJournalWorkspace,
  type JournalEntryView,
  type MeetingDetailModel,
} from "../../application/queries"
import {
  journalCommands,
  MeetingManagementService,
  ProjectJournalService,
  TopicManagementService,
} from "../../application/services"
import { useAppStore } from "../../app/state/app-store"
import {
  Badge,
  Button,
  EmptyState,
  SidePanel,
} from "../../design-system/components"
import type {
  AgendaDiscussionStatus,
  AgendaItem,
  TopicStatus,
  UUID,
} from "../../domain"
import { agendaDiscussionStatuses } from "../../domain"
import { formatLocalDate } from "../../utils"
import { JournalPropertiesPanel } from "../journal/journal-properties-panel"
import {
  JournalEntryRow,
  type JournalSelection,
  topicDisplayId,
} from "../journal/project-journal"
import "../journal/project-journal.css"

const meetingService = new MeetingManagementService()
const journalService = new ProjectJournalService()
const topicService = new TopicManagementService()

interface MeetingProcessingWorkspaceProps {
  model: MeetingDetailModel
  frozen: boolean
  onMessage: (message: string) => void
  onBuildReport: () => void
  onEditAgenda: (item: AgendaItem) => void
}

interface MeetingAgendaPreparationProps {
  model: MeetingDetailModel
  frozen: boolean
  canCreateTopic: boolean
  onAdd: () => void
  onNewTopic: () => void
  onEdit: (item: AgendaItem) => void
  onMove: (item: AgendaItem, direction: "up" | "down") => void
}

function statusTone(status: AgendaDiscussionStatus) {
  if (status === "Besproken") return "success" as const
  if (status === "Doorgeschoven") return "warning" as const
  return "neutral" as const
}

export function MeetingAgendaPreparation({
  model,
  frozen,
  canCreateTopic,
  onAdd,
  onNewTopic,
  onEdit,
  onMove,
}: MeetingAgendaPreparationProps) {
  return (
    <section className="meeting-section meeting-agenda meeting-agenda--grouped">
      <header>
        <div>
          <span>Hoofdstuk · cluster · project</span>
          <h2>Agenda</h2>
        </div>
        {!frozen ? (
          <div>
            <Button variant="secondary" onClick={onAdd}>
              + Project of topic
            </Button>
            {canCreateTopic ? (
              <Button variant="tertiary" onClick={onNewTopic}>
                + Nieuw topic
              </Button>
            ) : null}
          </div>
        ) : null}
      </header>
      {model.agendaGroups.length ? (
        <div className="meeting-agenda-groups">
          {model.agendaGroups.map((group) => (
            <details
              key={group.id}
              open
              className={group.legacy ? "is-legacy" : ""}
            >
              <summary>
                <span>
                  <small>
                    {group.chapter
                      ? `${group.chapter.code} · ${group.chapter.title}`
                      : "Zonder hoofdstuk"}
                  </small>
                  <strong>
                    {group.cluster
                      ? `${group.cluster.code} · ${group.cluster.title}`
                      : "Zonder cluster"}
                  </strong>
                  <span>{group.label}</span>
                </span>
                <em>{group.items.length} punten</em>
              </summary>
              <ol>
                {group.items.map((item) => {
                  const globalIndex = model.agenda.findIndex(
                    (candidate) => candidate.id === item.id,
                  )
                  return (
                    <li key={item.id}>
                      <div className="meeting-agenda__order">
                        <strong>{item.order}</strong>
                        {!frozen ? (
                          <span>
                            <button
                              aria-label={`${item.title} omhoog`}
                              disabled={globalIndex === 0}
                              onClick={() => onMove(item, "up")}
                            >
                              ↑
                            </button>
                            <button
                              aria-label={`${item.title} omlaag`}
                              disabled={globalIndex === model.agenda.length - 1}
                              onClick={() => onMove(item, "down")}
                            >
                              ↓
                            </button>
                          </span>
                        ) : null}
                      </div>
                      <div className="meeting-agenda__content">
                        <header>
                          <strong>{item.title}</strong>
                          <Badge tone={statusTone(item.discussionStatus)}>
                            {item.discussionStatus}
                          </Badge>
                        </header>
                        {item.reason ? <p>{item.reason}</p> : null}
                        {group.legacy ? (
                          <small>
                            Koppel dit punt opnieuw aan een project of topic.
                          </small>
                        ) : null}
                      </div>
                      {!frozen ? (
                        <Button variant="tertiary" onClick={() => onEdit(item)}>
                          Bewerken
                        </Button>
                      ) : null}
                    </li>
                  )
                })}
              </ol>
            </details>
          ))}
        </div>
      ) : (
        <EmptyState
          title="Agenda is nog leeg"
          description="Koppel een bestaand project of topic, of maak meteen een nieuw topic."
          action={
            !frozen ? (
              <Button onClick={onAdd}>Eerste project of topic toevoegen</Button>
            ) : undefined
          }
        />
      )}
    </section>
  )
}

function MeetingInlineComposer({
  agendaItem,
  disabled,
  onMutation,
}: {
  agendaItem: AgendaItem
  disabled: boolean
  onMutation: (message: string, error?: boolean) => void
}) {
  const [value, setValue] = useState("")
  const replaceDomainState = useAppStore((state) => state.replaceDomainState)
  const command = value.startsWith("/")
    ? value.split(/\s/)[0]!.toLocaleLowerCase("nl")
    : ""
  const suggestions = command
    ? journalCommands.filter(
        (item) =>
          [
            "/update",
            "/actie",
            "/besluit",
            "/beslissing",
            "/beslissing-nodig",
          ].includes(item.command) && item.command.startsWith(command),
      )
    : []
  const submit = () => {
    if (!value.trim() || disabled) return
    try {
      const result = journalService.executeMeetingComposer(
        useAppStore.getState().session!.state,
        agendaItem.id,
        value,
      )
      replaceDomainState(result.state)
      setValue("")
      onMutation(`${result.message} · opgeslagen in sessie`)
    } catch (error) {
      onMutation(
        error instanceof Error ? error.message : "Toevoegen mislukt.",
        true,
      )
    }
  }
  const insertToken = (token: string) =>
    setValue(
      (current) =>
        `${current}${current && !current.endsWith(" ") ? " " : ""}${token}`,
    )
  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault()
      submit()
    }
  }
  return (
    <div className="journal-composer meeting-journal-composer">
      <textarea
        rows={2}
        value={value}
        disabled={disabled}
        aria-label={`Schrijf verder bij ${agendaItem.title}`}
        placeholder="Schrijf verder…"
        onChange={(event) => setValue(event.target.value)}
        onKeyDown={onKeyDown}
      />
      <div className="journal-composer__controls">
        <span className="meeting-journal-composer__hint">
          Enter = opslaan · Shift+Enter = nieuwe regel
        </span>
        <button
          type="button"
          onClick={() => insertToken("@")}
          aria-label="Persoon vermelden"
        >
          @
        </button>
        <button
          type="button"
          onClick={() => insertToken("#")}
          aria-label="Tag toevoegen"
        >
          #
        </button>
        <button
          type="button"
          onClick={() => insertToken("[bijlage](https://)")}
          aria-label="Bijlagelink toevoegen"
        >
          ↗
        </button>
        <button type="button" onClick={submit} aria-label="Bijdrage toevoegen">
          →
        </button>
      </div>
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
    </div>
  )
}

function belongsToAgendaEntry(
  entry: JournalEntryView,
  meetingId: UUID,
  agendaItemId: UUID,
) {
  if (
    entry.meetingLinks.some(
      (link) =>
        link.agendaItemId === agendaItemId ||
        link.agendaItem?.id === agendaItemId,
    )
  )
    return true
  if (entry.source.objectType !== "Topic") return false
  if ("meetingId" in entry.source) return entry.source.meetingId === meetingId
  if ("sourceMeetingId" in entry.source)
    return entry.source.sourceMeetingId === meetingId
  return false
}

export function MeetingProcessingWorkspace({
  model,
  frozen,
  onMessage,
  onBuildReport,
  onEditAgenda,
}: MeetingProcessingWorkspaceProps) {
  const session = useAppStore((state) => state.session)!
  const replaceDomainState = useAppStore((state) => state.replaceDomainState)
  const [selectedId, setSelectedId] = useState<UUID | undefined>(
    model.agenda[0]?.id,
  )
  const [agendaOpen, setAgendaOpen] = useState(false)
  const [propertiesSelection, setPropertiesSelection] =
    useState<JournalSelection>()
  const selected =
    model.agenda.find((item) => item.id === selectedId) ?? model.agenda[0]
  const selectedIndex = selected
    ? model.agenda.findIndex((item) => item.id === selected.id)
    : -1
  const context = useMemo(
    () =>
      selected ? buildAgendaItemContext(session.state, selected) : undefined,
    [selected, session],
  )
  const workspace = useMemo(
    () =>
      context?.project
        ? buildProjectJournalWorkspace(
            session.state,
            context.project.id,
            model.meeting.date,
          )
        : undefined,
    [context, model.meeting.date, session],
  )
  const topicModel = context?.topic
    ? [
        ...(workspace?.activeTopics ?? []),
        ...(workspace?.closedTopics ?? []),
      ].find((item) => item.topic.id === context.topic!.id)
    : undefined
  const meetingEntries = selected
    ? (topicModel?.entries ?? []).filter((entry) =>
        belongsToAgendaEntry(entry, model.meeting.id, selected.id),
      )
    : []

  function attendance(participantId: UUID, attended: boolean) {
    try {
      const result = meetingService.setParticipantAttendance(
        useAppStore.getState().session!.state,
        participantId,
        attended,
      )
      replaceDomainState(result.state)
      onMessage("Aanwezigheid opgeslagen in sessie · back-up nodig")
    } catch (error) {
      onMessage(error instanceof Error ? error.message : "Opslaan is mislukt.")
    }
  }

  function changeTopicStatus(topicId: UUID, status: TopicStatus) {
    try {
      const result = topicService.setTopicStatus(
        useAppStore.getState().session!.state,
        topicId,
        status,
      )
      replaceDomainState(result.state)
      onMessage("Topicstatus opgeslagen in sessie · back-up nodig")
    } catch (error) {
      onMessage(error instanceof Error ? error.message : "Opslaan is mislukt.")
    }
  }

  function changeDiscussionStatus(status: AgendaDiscussionStatus) {
    if (
      !selected ||
      frozen ||
      (selected.objectType !== "Project" && selected.objectType !== "Topic") ||
      !selected.objectId
    )
      return
    try {
      const result = meetingService.saveAgendaItem(
        useAppStore.getState().session!.state,
        model.meeting.id,
        {
          title: selected.title,
          discussionStatus: status,
          objectType: selected.objectType,
          objectId: selected.objectId,
          ...(selected.reason ? { reason: selected.reason } : {}),
          ...(selected.notes ? { notes: selected.notes } : {}),
        },
        selected.id,
      )
      replaceDomainState(result.state)
      onMessage("Agendastatus opgeslagen in sessie · back-up nodig")
    } catch (error) {
      onMessage(error instanceof Error ? error.message : "Opslaan is mislukt.")
    }
  }

  function selectAgenda(id: UUID) {
    setSelectedId(id)
    setPropertiesSelection(undefined)
  }

  return (
    <div className="meeting-process-workspace">
      <details className="meeting-process-attendance">
        <summary>
          Aanwezigheid ·{" "}
          {
            model.participants.filter(({ participant }) => participant.attended)
              .length
          }
          /{model.participants.length} geregistreerd
        </summary>
        <div>
          {model.participants.map(({ participant, actor }) => (
            <label key={participant.id}>
              <input
                type="checkbox"
                checked={participant.attended}
                disabled={frozen}
                onChange={(event) =>
                  attendance(participant.id, event.target.checked)
                }
              />
              <span>{actor?.displayName ?? "Onbekende actor"}</span>
            </label>
          ))}
        </div>
      </details>

      {selected && context ? (
        <>
          <div className="meeting-focus-toolbar" aria-label="Vergaderbediening">
            <div className="meeting-point-navigation">
              <Button
                variant="tertiary"
                aria-label="Vorig agendapunt"
                disabled={selectedIndex <= 0}
                onClick={() =>
                  selectAgenda(model.agenda[selectedIndex - 1]!.id)
                }
              >
                ←
              </Button>
              <label>
                <span>Agendapunt</span>
                <select
                  aria-label="Ga naar agendapunt"
                  value={selected.id}
                  onChange={(event) => selectAgenda(event.target.value as UUID)}
                >
                  {model.agenda.map((item, index) => (
                    <option key={item.id} value={item.id}>
                      {index + 1}. {item.title}
                    </option>
                  ))}
                </select>
              </label>
              <strong>
                {selectedIndex + 1} / {model.agenda.length}
              </strong>
              <Button
                variant="tertiary"
                aria-label="Volgend agendapunt"
                disabled={selectedIndex >= model.agenda.length - 1}
                onClick={() =>
                  selectAgenda(model.agenda[selectedIndex + 1]!.id)
                }
              >
                →
              </Button>
            </div>
            <Button
              variant="tertiary"
              aria-pressed={agendaOpen}
              onClick={() => setAgendaOpen((current) => !current)}
            >
              Agenda {agendaOpen ? "sluiten" : "openen"}
            </Button>
          </div>
          <div
            className={`meeting-process-grid${agendaOpen ? "" : " meeting-process-grid--agenda-closed"}${propertiesSelection ? "" : " meeting-process-grid--context-closed"}`}
          >
            <SidePanel
              className="meeting-process-agenda"
              title="Agenda"
              summary={`${model.agenda.length} punten`}
              open={agendaOpen}
              onOpenChange={setAgendaOpen}
              ariaLabel="Agenda tijdens overleg"
            >
              <nav aria-label="Agenda tijdens overleg">
                {model.agendaGroups.map((group) => (
                  <section
                    key={group.id}
                    className={group.legacy ? "is-legacy" : ""}
                  >
                    <header>
                      <small>
                        {group.chapter
                          ? `${group.chapter.code} · ${group.chapter.title}`
                          : "Zonder hoofdstuk"}
                      </small>
                      <strong>
                        {group.cluster
                          ? `${group.cluster.code} · ${group.cluster.title}`
                          : "Zonder cluster"}
                      </strong>
                      <span>{group.label}</span>
                    </header>
                    {group.items.map((item) => (
                      <button
                        key={item.id}
                        className={selected.id === item.id ? "is-active" : ""}
                        onClick={() => selectAgenda(item.id)}
                      >
                        <span>{item.order}</span>
                        <strong>{item.title}</strong>
                        <small>{item.discussionStatus}</small>
                      </button>
                    ))}
                  </section>
                ))}
              </nav>
            </SidePanel>

            <main className="meeting-process-discussion">
              <header>
                <button
                  type="button"
                  className="meeting-process-topic"
                  disabled={!topicModel}
                  onClick={() =>
                    topicModel &&
                    setPropertiesSelection({
                      kind: "topic",
                      topicId: topicModel.topic.id,
                    })
                  }
                >
                  <span>
                    {context.chapter?.title ?? "Zonder hoofdstuk"} ·{" "}
                    {context.cluster?.title ?? "Zonder cluster"}
                  </span>
                  <h2>{selected.title}</h2>
                  <p>
                    {topicModel
                      ? `${topicDisplayId(topicModel.topic)} · ${topicModel.topic.title}`
                      : (context.project?.title ?? "Bron opnieuw koppelen")}
                  </p>
                </button>
                <Badge tone={statusTone(selected.discussionStatus)}>
                  {selected.discussionStatus}
                </Badge>
              </header>
              {selected.reason || selected.notes ? (
                <div className="meeting-process-notes">
                  {selected.reason ? <p>{selected.reason}</p> : null}
                  {selected.notes ? <p>{selected.notes}</p> : null}
                </div>
              ) : null}
              <div className="meeting-process-controls">
                <label>
                  <span>Agendastatus</span>
                  <select
                    aria-label="Agendastatus"
                    value={selected.discussionStatus}
                    disabled={frozen}
                    onChange={(event) =>
                      changeDiscussionStatus(
                        event.target.value as AgendaDiscussionStatus,
                      )
                    }
                  >
                    {agendaDiscussionStatuses.map((status) => (
                      <option key={status}>{status}</option>
                    ))}
                  </select>
                </label>
                {context.topic ? (
                  <label>
                    <span>Topicstatus</span>
                    <select
                      value={context.topic.status}
                      disabled={frozen}
                      onChange={(event) =>
                        changeTopicStatus(
                          context.topic!.id,
                          event.target.value as TopicStatus,
                        )
                      }
                    >
                      <option>Open</option>
                      <option>Afgesloten</option>
                      <option>Geannuleerd</option>
                    </select>
                  </label>
                ) : null}
                {!frozen ? (
                  <Button
                    variant="tertiary"
                    onClick={() => onEditAgenda(selected)}
                  >
                    Agendapunt bewerken
                  </Button>
                ) : null}
              </div>
              {selected.discussionStatus === "Doorgeschoven" ? (
                <p className="meeting-forwarded">
                  Doorgeschoven naar volgend overleg:{" "}
                  {formatLocalDate(model.meeting.nextMeetingDate)}
                </p>
              ) : null}

              {topicModel ? (
                <section
                  className="meeting-journal"
                  aria-label={`Overlegjournaal voor ${selected.title}`}
                >
                  <div className="meeting-journal__entries">
                    {meetingEntries.length ? (
                      meetingEntries.map((entry) => (
                        <JournalEntryRow
                          key={entry.id}
                          entry={entry}
                          topicId={topicModel.topic.id}
                          selected={
                            propertiesSelection?.kind === "entry" &&
                            propertiesSelection.entryId === entry.id
                          }
                          onSelect={setPropertiesSelection}
                          onMutation={(message, error) =>
                            onMessage(
                              error ? message : `${message} · back-up nodig`,
                            )
                          }
                        />
                      ))
                    ) : (
                      <p className="meeting-journal__empty">
                        Nog geen bijdragen bij dit agendapunt.
                      </p>
                    )}
                  </div>
                  {!frozen ? (
                    <MeetingInlineComposer
                      agendaItem={selected}
                      disabled={frozen}
                      onMutation={(message) =>
                        onMessage(`${message} · back-up nodig`)
                      }
                    />
                  ) : null}
                </section>
              ) : (
                <div className="meeting-process-relink" role="alert">
                  <strong>Koppel dit punt aan een projecttopic.</strong>
                  <p>
                    Dan worden updates, acties en beslissingen rechtstreeks deel
                    van het Project Journaal.
                  </p>
                  {!frozen ? (
                    <Button onClick={() => onEditAgenda(selected)}>
                      Bron koppelen
                    </Button>
                  ) : null}
                </div>
              )}
            </main>

            {propertiesSelection && workspace ? (
              <JournalPropertiesPanel
                selection={propertiesSelection}
                workspace={workspace}
                onClose={() => setPropertiesSelection(undefined)}
                onStatus={(message) => onMessage(`${message} · back-up nodig`)}
              />
            ) : null}
          </div>
        </>
      ) : (
        <EmptyState
          title="Geen agenda om te verwerken"
          description="Voeg in de voorbereiding minstens één project of topic toe."
        />
      )}

      {!frozen && model.agenda.length ? (
        <div className="meeting-report-callout">
          <div>
            <span>Verwerking gereed?</span>
            <strong>Bouw een controleerbaar conceptverslag op.</strong>
          </div>
          <Button variant="secondary" onClick={onBuildReport}>
            Conceptverslag opbouwen
          </Button>
        </div>
      ) : null}
    </div>
  )
}
