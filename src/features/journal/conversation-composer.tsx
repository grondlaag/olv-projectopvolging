import { useMemo, useState, type FormEvent, type KeyboardEvent } from "react"
import {
  ActionManagementError,
  ActionManagementService,
  UpdateManagementError,
  UpdateManagementService,
  type ActionContextType,
  type UpdateContextType,
} from "../../application/services"
import { useAppStore } from "../../app/state/app-store"
import { Button, SearchableSelect } from "../../design-system/components"
import {
  priorities,
  type Action,
  type LocalDate,
  type Priority,
  type Update,
  type UUID,
} from "../../domain"
import { formatLocalDate, todayAsLocalDate } from "../../utils"
import { InlineActorPanel } from "../projects/project-form-page"
import "./conversation.css"

const updateService = new UpdateManagementService()
const actionService = new ActionManagementService()

export type ConversationKind = "update" | "decision" | "action"
export type ConversationContextType = Extract<
  UpdateContextType & ActionContextType,
  "Project" | "Cluster" | "Topic" | "Meeting"
>

export interface ConversationComposerProps {
  contextType: ConversationContextType
  contextId: UUID
  contextLabel: string
  meetingId?: UUID
  disabled?: boolean
  compact?: boolean
  onSaved?: (message: string) => void
}

export function ConversationComposer({
  contextType,
  contextId,
  contextLabel,
  meetingId,
  disabled = false,
  compact = false,
  onSaved,
}: ConversationComposerProps) {
  const session = useAppStore((state) => state.session)!
  const replaceDomainState = useAppStore((state) => state.replaceDomainState)
  const currentActorId = session.state.records.config[0]?.currentActorId
  const currentActor = currentActorId
    ? session.state.indices.actorById.get(currentActorId)
    : undefined
  const [kind, setKind] = useState<ConversationKind>("update")
  const [text, setText] = useState("")
  const [date, setDate] = useState<LocalDate>(todayAsLocalDate() as LocalDate)
  const [actorId, setActorId] = useState<UUID | "">(
    currentActor?.active && currentActor.audit.active ? currentActor.id : "",
  )
  const [deadline, setDeadline] = useState<LocalDate | "">("")
  const [priority, setPriority] = useState<Priority>("Normaal")
  const [makeCurrent, setMakeCurrent] = useState(false)
  const [actorMode, setActorMode] = useState(false)
  const [error, setError] = useState("")
  const [saving, setSaving] = useState(false)
  const activeActors = useMemo(
    () =>
      session.state.records.actors
        .filter((actor) => actor.active && actor.audit.active)
        .sort((left, right) =>
          left.displayName.localeCompare(right.displayName, "nl"),
        ),
    [session],
  )

  function chooseKind(nextKind: ConversationKind) {
    setKind(nextKind)
    setError("")
  }

  function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const cleanText = text.trim()
    if (!cleanText) {
      setError(
        kind === "action"
          ? "Omschrijf de actie voordat je ze opslaat."
          : "Schrijf eerst de bijdrage die je wilt opslaan.",
      )
      return
    }
    if (!actorId) {
      setError(
        kind === "action"
          ? "Kies een actieve eigenaar voor de actie."
          : "Kies een actieve auteur voor deze bijdrage.",
      )
      return
    }
    setSaving(true)
    try {
      const latest = useAppStore.getState().session?.state
      if (!latest) return
      if (kind === "action") {
        const result = actionService.createAction(latest, {
          objectType: contextType,
          objectId: contextId,
          ...(meetingId ? { sourceMeetingId: meetingId } : {}),
          title: cleanText,
          ownerActorId: actorId,
          ...(deadline ? { deadline } : {}),
          status: "Open",
          priority,
        })
        replaceDomainState(result.state)
        onSaved?.("Actie opgeslagen in sessie")
      } else {
        const result = updateService.addUpdate(latest, {
          objectType: contextType,
          objectId: contextId,
          ...(meetingId ? { meetingId } : {}),
          authorActorId: actorId,
          type: kind === "decision" ? "Beslissing" : "Update",
          date,
          text: cleanText,
          ...(kind === "update" && makeCurrent ? { makeCurrent: true } : {}),
        })
        replaceDomainState(result.state)
        onSaved?.(
          kind === "decision"
            ? "Beslissing opgeslagen in sessie"
            : makeCurrent
              ? "Update en actuele stand opgeslagen in sessie"
              : "Update opgeslagen in sessie",
        )
      }
      setText("")
      setDeadline("")
      setMakeCurrent(false)
      setError("")
    } catch (caught) {
      if (
        caught instanceof UpdateManagementError ||
        caught instanceof ActionManagementError
      ) {
        setError(caught.message)
      } else {
        setError("De bijdrage kon niet worden opgeslagen.")
      }
    } finally {
      setSaving(false)
    }
  }

  function shortcuts(event: KeyboardEvent<HTMLFormElement>) {
    if (event.altKey && ["1", "2", "3"].includes(event.key)) {
      event.preventDefault()
      chooseKind(
        event.key === "1"
          ? "update"
          : event.key === "2"
            ? "decision"
            : "action",
      )
    }
    if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
      event.preventDefault()
      event.currentTarget.requestSubmit()
    }
  }

  if (actorMode) {
    return (
      <InlineActorPanel
        onClose={() => setActorMode(false)}
        onSaved={(actor) => {
          setActorId(actor.id)
          setActorMode(false)
        }}
        contextLabel={contextLabel}
        selectionDescription={`De nieuwe actor wordt meteen als ${kind === "action" ? "eigenaar" : "auteur"} geselecteerd; je tekst blijft staan.`}
      />
    )
  }

  return (
    <form
      className={`conversation-composer${compact ? " conversation-composer--compact" : ""}`}
      onSubmit={save}
      onKeyDown={shortcuts}
      aria-label={`Bijdrage toevoegen aan ${contextLabel}`}
    >
      <header>
        <div>
          <span>Vastleggen in context</span>
          <strong>{contextLabel}</strong>
        </div>
        <div
          className="conversation-composer__kinds"
          role="group"
          aria-label="Soort bijdrage"
        >
          {(
            [
              ["update", "Update"],
              ["decision", "Beslissing"],
              ["action", "Actie"],
            ] as const
          ).map(([value, label], index) => (
            <button
              key={value}
              type="button"
              className={kind === value ? "is-active" : ""}
              onClick={() => chooseKind(value)}
              aria-pressed={kind === value}
              title={`Alt+${index + 1}`}
            >
              {label}
            </button>
          ))}
        </div>
      </header>
      <label className="conversation-composer__text">
        <span className="sr-only">
          {kind === "update"
            ? "Update"
            : kind === "decision"
              ? "Beslissing"
              : "Actie"}
        </span>
        <textarea
          rows={compact ? 3 : 4}
          value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder={
            kind === "update"
              ? "Wat is er gewijzigd of wat is de actuele stand?"
              : kind === "decision"
                ? "Welke beslissing is genomen?"
                : "Wat moet gebeuren?"
          }
          disabled={disabled}
          aria-invalid={Boolean(error)}
        />
      </label>
      <div className="conversation-composer__metadata">
        <SearchableSelect
          label={kind === "action" ? "Eigenaar" : "Auteur"}
          emptyLabel="Kies een actieve actor"
          options={activeActors.map((actor) => ({
            value: actor.id,
            label: actor.displayName,
          }))}
          value={actorId}
          onChange={(event) => setActorId(event.target.value as UUID | "")}
          action={
            <Button variant="tertiary" onClick={() => setActorMode(true)}>
              + Nieuwe actor
            </Button>
          }
        />
        {kind === "action" ? (
          <>
            <label>
              <span>
                Deadline <em>optioneel</em>
              </span>
              <input
                type="date"
                value={deadline}
                onChange={(event) =>
                  setDeadline(event.target.value as LocalDate | "")
                }
              />
            </label>
            <label>
              <span>Prioriteit</span>
              <select
                value={priority}
                onChange={(event) =>
                  setPriority(event.target.value as Priority)
                }
              >
                {priorities.map((value) => (
                  <option key={value}>{value}</option>
                ))}
              </select>
            </label>
          </>
        ) : (
          <>
            <label>
              <span>Datum</span>
              <input
                type="date"
                value={date}
                onChange={(event) => setDate(event.target.value as LocalDate)}
              />
            </label>
            {kind === "update" && contextType !== "Meeting" ? (
              <label className="conversation-composer__current">
                <input
                  type="checkbox"
                  checked={makeCurrent}
                  onChange={(event) => setMakeCurrent(event.target.checked)}
                />
                <span>Maak actuele stand</span>
              </label>
            ) : null}
          </>
        )}
      </div>
      {error ? (
        <p className="conversation-composer__error" role="alert">
          {error}
        </p>
      ) : null}
      <footer>
        <small>Ctrl/Cmd + Enter om op te slaan</small>
        <Button type="submit" disabled={disabled || saving}>
          {kind === "update"
            ? "Update opslaan"
            : kind === "decision"
              ? "Beslissing opslaan"
              : "Actie opslaan"}
        </Button>
      </footer>
    </form>
  )
}

export interface ConversationFeedProps {
  updates: readonly Update[]
  actions: readonly Action[]
  limit?: number
  currentMeetingId?: UUID
  onEditAction?: (actionId: UUID) => void
}

export function ConversationFeed({
  updates,
  actions,
  limit,
  currentMeetingId,
  onEditAction,
}: ConversationFeedProps) {
  const session = useAppStore((state) => state.session)!
  const entries = [
    ...updates.map(
      (update) =>
        ({
          id: update.id,
          date: update.date,
          createdAt: update.audit.createdAt,
          kind: update.type === "Beslissing" ? "decision" : "update",
          update,
        }) as const,
    ),
    ...actions.map(
      (action) =>
        ({
          id: action.id,
          date: action.audit.createdAt.slice(0, 10),
          createdAt: action.audit.createdAt,
          kind: "action",
          action,
        }) as const,
    ),
  ].sort(
    (left, right) =>
      right.date.localeCompare(left.date) ||
      right.createdAt.localeCompare(left.createdAt),
  )
  const visible = typeof limit === "number" ? entries.slice(0, limit) : entries

  if (!visible.length)
    return (
      <p className="conversation-feed__empty">
        Nog geen updates, beslissingen of acties.
      </p>
    )

  return (
    <ol className="conversation-feed">
      {visible.map((entry) => {
        if (entry.kind === "action") {
          const owner = session.state.indices.actorById.get(
            entry.action.ownerActorId,
          )
          return (
            <li
              key={entry.id}
              className="conversation-feed__entry conversation-feed__entry--action"
            >
              <span>Actie</span>
              <div>
                <p>{entry.action.title}</p>
                <small>
                  {owner?.displayName ?? "Onbekende eigenaar"}
                  {entry.action.deadline
                    ? ` · tegen ${formatLocalDate(entry.action.deadline)}`
                    : ""}
                  {currentMeetingId &&
                  entry.action.sourceMeetingId === currentMeetingId
                    ? " · dit overleg"
                    : ""}
                </small>
              </div>
              {onEditAction ? (
                <Button
                  variant="tertiary"
                  onClick={() => onEditAction(entry.action.id)}
                >
                  Bewerken
                </Button>
              ) : null}
            </li>
          )
        }
        const author = session.state.indices.actorById.get(
          entry.update.authorActorId,
        )
        return (
          <li
            key={entry.id}
            className={`conversation-feed__entry conversation-feed__entry--${entry.kind}`}
          >
            <span>
              {entry.kind === "decision" ? "Beslissing" : entry.update.type}
            </span>
            <div>
              <p>{entry.update.text}</p>
              <small>
                {formatLocalDate(entry.update.date)} ·{" "}
                {author?.displayName ?? "Onbekende auteur"}
                {currentMeetingId && entry.update.meetingId === currentMeetingId
                  ? " · dit overleg"
                  : ""}
              </small>
            </div>
          </li>
        )
      })}
    </ol>
  )
}
