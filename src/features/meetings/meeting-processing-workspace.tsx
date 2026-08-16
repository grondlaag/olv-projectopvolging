import { useMemo, useState } from "react"
import { Link } from "react-router-dom"
import {
  buildAgendaItemContext,
  type MeetingDetailModel,
} from "../../application/queries"
import {
  MeetingManagementService,
  TopicManagementService,
} from "../../application/services"
import { useAppStore } from "../../app/state/app-store"
import { Badge, Button, EmptyState } from "../../design-system/components"
import type { AgendaItem, TopicStatus, UUID } from "../../domain"
import { formatLocalDate } from "../../utils"
import {
  ConversationComposer,
  ConversationFeed,
} from "../journal/conversation-composer"

const meetingService = new MeetingManagementService()
const topicService = new TopicManagementService()

interface MeetingProcessingWorkspaceProps {
  model: MeetingDetailModel
  frozen: boolean
  onMessage: (message: string) => void
  onBuildReport: () => void
  onEditAgenda: (item: AgendaItem) => void
  onEditAction: (actionId: UUID) => void
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
            <section key={group.id} className={group.legacy ? "is-legacy" : ""}>
              <header>
                <div>
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
                </div>
                <em>{group.items.length} punten</em>
              </header>
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
                          <Badge
                            tone={
                              item.discussionStatus === "Besproken"
                                ? "success"
                                : item.discussionStatus === "Doorgeschoven"
                                  ? "warning"
                                  : "neutral"
                            }
                          >
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
            </section>
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

export function MeetingProcessingWorkspace({
  model,
  frozen,
  onMessage,
  onBuildReport,
  onEditAgenda,
  onEditAction,
}: MeetingProcessingWorkspaceProps) {
  const session = useAppStore((state) => state.session)!
  const replaceDomainState = useAppStore((state) => state.replaceDomainState)
  const [selectedId, setSelectedId] = useState<UUID | undefined>(
    model.agenda[0]?.id,
  )
  const selected =
    model.agenda.find((item) => item.id === selectedId) ?? model.agenda[0]
  const context = useMemo(
    () =>
      selected ? buildAgendaItemContext(session.state, selected) : undefined,
    [selected, session],
  )

  function attendance(participantId: UUID, attended: boolean) {
    try {
      const latest = useAppStore.getState().session!.state
      const result = meetingService.setParticipantAttendance(
        latest,
        participantId,
        attended,
      )
      replaceDomainState(result.state)
      onMessage("Aanwezigheid opgeslagen in sessie · JSON nog opslaan")
    } catch (error) {
      onMessage(error instanceof Error ? error.message : "Opslaan is mislukt.")
    }
  }

  function changeTopicStatus(topicId: UUID, status: TopicStatus) {
    try {
      const latest = useAppStore.getState().session!.state
      const result = topicService.setTopicStatus(latest, topicId, status)
      replaceDomainState(result.state)
      onMessage("Topicstatus opgeslagen in sessie · JSON nog opslaan")
    } catch (error) {
      onMessage(error instanceof Error ? error.message : "Opslaan is mislukt.")
    }
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
        <div className="meeting-process-grid">
          <nav
            className="meeting-process-agenda"
            aria-label="Agenda tijdens overleg"
          >
            <header>
              <span>Agenda</span>
              <strong>{model.agenda.length} punten</strong>
            </header>
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
                    onClick={() => setSelectedId(item.id)}
                  >
                    <span>{item.order}</span>
                    <strong>{item.title}</strong>
                    <small>{item.discussionStatus}</small>
                  </button>
                ))}
              </section>
            ))}
          </nav>

          <main className="meeting-process-discussion">
            <header>
              <div>
                <span>Agendapunt {selected.order}</span>
                <h2>{selected.title}</h2>
                <p>
                  {selected.reason ||
                    "Geen afzonderlijke aanleiding opgegeven."}
                </p>
              </div>
              <Badge
                tone={
                  selected.discussionStatus === "Besproken"
                    ? "success"
                    : selected.discussionStatus === "Doorgeschoven"
                      ? "warning"
                      : "neutral"
                }
              >
                {selected.discussionStatus}
              </Badge>
            </header>
            {selected.notes ? (
              <div className="meeting-process-notes">
                <span>Bespreeknotitie</span>
                <p>{selected.notes}</p>
              </div>
            ) : null}
            <div className="meeting-process-controls">
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
                  Notitie of bespreekstatus
                </Button>
              ) : null}
            </div>
            {selected.objectType === "Project" ||
            selected.objectType === "Topic" ? (
              <ConversationComposer
                contextType={selected.objectType}
                contextId={selected.objectId!}
                contextLabel={selected.title}
                meetingId={model.meeting.id}
                disabled={frozen}
                onSaved={(message) =>
                  onMessage(`${message} · JSON nog opslaan`)
                }
              />
            ) : (
              <div className="meeting-process-relink" role="alert">
                <strong>
                  Dit historisch agendapunt mist een geldige bron.
                </strong>
                <p>
                  Koppel het eerst aan een project of topic om bijdragen toe te
                  voegen.
                </p>
                {!frozen ? (
                  <Button onClick={() => onEditAgenda(selected)}>
                    Bron koppelen
                  </Button>
                ) : null}
              </div>
            )}
          </main>

          <aside className="meeting-process-context">
            <header>
              <span>Contextjournaal</span>
              <h2>
                {context.topic?.title ??
                  context.project?.title ??
                  selected.title}
              </h2>
              <p>
                {context.chapter?.title ?? "Zonder hoofdstuk"} ·{" "}
                {context.cluster?.title ?? "Zonder cluster"}
              </p>
            </header>
            <section className="meeting-process-current">
              <span>Actuele stand</span>
              <p>{context.currentUpdate?.text ?? "Nog geen actuele stand."}</p>
            </section>
            <ConversationFeed
              updates={[...context.updates, ...context.decisions]}
              actions={context.actions}
              currentMeetingId={model.meeting.id}
              {...(!frozen ? { onEditAction } : {})}
            />
            {context.meetings.length ? (
              <section className="meeting-process-history">
                <span>Eerder en later besproken</span>
                {context.meetings.slice(0, 5).map((meeting) => (
                  <Link key={meeting.id} to={`/meetings/${meeting.id}`}>
                    {formatLocalDate(meeting.date)} · {meeting.title}
                  </Link>
                ))}
              </section>
            ) : null}
          </aside>
        </div>
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
