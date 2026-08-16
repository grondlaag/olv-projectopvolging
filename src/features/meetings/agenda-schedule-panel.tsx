import { useMemo, useState, type FormEvent } from "react"
import { Link } from "react-router-dom"
import {
  buildAgendaSchedulingModel,
  meetingScopeLabel,
} from "../../application/queries"
import {
  MeetingManagementError,
  MeetingManagementService,
} from "../../application/services"
import { useAppStore } from "../../app/state/app-store"
import { Button } from "../../design-system/components"
import { useEscapeKey } from "../../design-system/patterns"
import type { AgendaObjectType, UUID } from "../../domain"
import { formatLocalDate, todayAsLocalDate } from "../../utils"
import "./meetings.css"

const meetingService = new MeetingManagementService()

interface AgendaSchedulePanelProps {
  objectType: Extract<AgendaObjectType, "Project" | "Topic">
  objectId: UUID
  sourceLabel: string
  onClose: () => void
  onSaved: (message: string) => void
}

export function AgendaSchedulePanel({
  objectType,
  objectId,
  sourceLabel,
  onClose,
  onSaved,
}: AgendaSchedulePanelProps) {
  useEscapeKey(onClose)
  const session = useAppStore((state) => state.session)!
  const replaceDomainState = useAppStore((state) => state.replaceDomainState)
  const [meetingId, setMeetingId] = useState("")
  const [reason, setReason] = useState("")
  const [error, setError] = useState("")
  const model = useMemo(
    () =>
      buildAgendaSchedulingModel(
        session.state,
        objectType,
        objectId,
        todayAsLocalDate(),
      ),
    [objectId, objectType, session],
  )

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!meetingId) {
      setError("Kies een overleg waarop dit besproken moet worden.")
      return
    }
    const latest = useAppStore.getState().session?.state
    if (!latest) return
    try {
      const result = meetingService.saveAgendaItem(latest, meetingId as UUID, {
        title: sourceLabel,
        reason,
        discussionStatus: "Te bespreken",
        objectType,
        objectId,
      })
      replaceDomainState(result.state)
      onSaved("Ingepland voor overleg in de lokale sessie")
    } catch (cause) {
      setError(
        cause instanceof MeetingManagementError
          ? (cause.issues[0]?.message ?? cause.message)
          : "Inplannen voor overleg is mislukt.",
      )
    }
  }

  return (
    <aside
      className="meeting-panel agenda-schedule-panel"
      role="dialog"
      aria-modal="false"
      aria-labelledby="agenda-schedule-title"
    >
      <header>
        <div>
          <span>In context plannen</span>
          <h2 id="agenda-schedule-title">Bespreken op overleg</h2>
        </div>
        <Button
          variant="tertiary"
          onClick={onClose}
          aria-label="Overlegpaneel sluiten"
        >
          Sluiten
        </Button>
      </header>

      <form onSubmit={submit} noValidate>
        <div className="meeting-panel__fixed">
          <span>{objectType === "Project" ? "Project" : "Topic"}</span>
          <strong>{sourceLabel}</strong>
        </div>

        {model.scheduledMeetings.length ? (
          <section className="agenda-schedule-panel__scheduled">
            <span>Reeds ingepland</span>
            <ul>
              {model.scheduledMeetings.map(({ meeting, agendaItem }) => (
                <li key={agendaItem.id}>
                  <Link to={`/meetings/${meeting.id}`}>{meeting.title}</Link>
                  <small>
                    {formatLocalDate(meeting.date)} ·{" "}
                    {agendaItem.discussionStatus}
                  </small>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {model.availableMeetings.length ? (
          <fieldset className="agenda-schedule-panel__choices">
            <legend>Kies een gepland overleg</legend>
            {model.availableMeetings.map((meeting, index) => (
              <label key={meeting.id}>
                <input
                  autoFocus={index === 0}
                  type="radio"
                  name="meetingId"
                  value={meeting.id}
                  checked={meetingId === meeting.id}
                  onChange={(event) => {
                    setMeetingId(event.target.value)
                    setError("")
                  }}
                />
                <span>
                  <strong>{meeting.title}</strong>
                  <small>
                    {formatLocalDate(meeting.date)} · {meeting.type} ·{" "}
                    {meetingScopeLabel(session.state, meeting)}
                  </small>
                </span>
              </label>
            ))}
          </fieldset>
        ) : (
          <div className="agenda-schedule-panel__empty">
            <strong>Geen beschikbaar gepland overleg</strong>
            <p>
              Maak eerst een toekomstig conceptoverleg binnen de juiste
              portfolio-, hoofdstuk-, cluster- of projectscope.
            </p>
            <Link className="button button--secondary" to="/meetings/new">
              + Nieuw overleg
            </Link>
          </div>
        )}

        {model.availableMeetings.length ? (
          <label>
            <span>Reden of gewenste bespreking</span>
            <textarea
              rows={4}
              value={reason}
              placeholder="Optioneel: wat moet tijdens het overleg aan bod komen?"
              onChange={(event) => setReason(event.target.value)}
            />
          </label>
        ) : null}

        {error ? (
          <small role="alert" className="agenda-schedule-panel__error">
            {error}
          </small>
        ) : null}

        <footer>
          <Button variant="tertiary" onClick={onClose}>
            Annuleren
          </Button>
          {model.availableMeetings.length ? (
            <Button type="submit">Op agenda plaatsen</Button>
          ) : null}
        </footer>
      </form>
    </aside>
  )
}
