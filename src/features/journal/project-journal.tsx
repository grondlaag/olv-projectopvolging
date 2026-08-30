import { useState, type KeyboardEvent } from "react"
import type {
  JournalEntryType,
  JournalEntryView,
  ProjectJournalTopic,
  ProjectJournalWorkspace,
} from "../../application/queries"
import {
  journalCommands,
  ProjectJournalService,
} from "../../application/services"
import { useAppStore } from "../../app/state/app-store"
import { Collapsible } from "../../design-system/components"
import type { UUID } from "../../domain"
import { formatLocalDate } from "../../utils"
import { MarkdownContent } from "./markdown-content"

export type JournalSelection =
  | { kind: "topic"; topicId: UUID }
  | { kind: "entry"; entryId: UUID; topicId: UUID }

const journalService = new ProjectJournalService()

export const journalTypeLabels: Record<JournalEntryType, string> = {
  update: "Update",
  action: "Actie",
  decision_request: "Beslissing nodig",
  decision: "Beslissing",
}

export function topicDisplayId(topic: ProjectJournalTopic["topic"]): string {
  const match = /(?:TOP|T)-(\d+)$/i.exec(topic.code)
  return match ? `T-${match[1]!.padStart(3, "0")}` : topic.code
}

function dateParts(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return { day: value.slice(0, 10), time: "" }
  return {
    day: new Intl.DateTimeFormat("nl-BE", {
      day: "2-digit",
      month: "short",
    })
      .format(date)
      .replace(".", ""),
    time: new Intl.DateTimeFormat("nl-BE", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(date),
  }
}

export function JournalEntryRow({
  entry,
  topicId,
  selected,
  onSelect,
  onMutation,
}: {
  entry: JournalEntryView
  topicId: UUID
  selected: boolean
  onSelect: (selection: JournalSelection) => void
  onMutation: (message: string, error?: boolean) => void
}) {
  const [editing, setEditing] = useState(false)
  const [content, setContent] = useState(entry.content)
  const replaceDomainState = useAppStore((state) => state.replaceDomainState)
  const date = dateParts(entry.createdAt)
  const save = () => {
    if (content.trim() === entry.content.trim()) {
      setEditing(false)
      return
    }
    try {
      const result = journalService.editEntry(
        useAppStore.getState().session!.state,
        entry.id,
        {
          content,
          ...(entry.status ? { status: entry.status } : {}),
          ...(entry.owner ? { ownerActorId: entry.owner.id } : {}),
          ...(entry.dueDate ? { dueDate: entry.dueDate } : {}),
          ...(entry.priority ? { priority: entry.priority } : {}),
        },
      )
      replaceDomainState(result.state)
      onMutation("Opgeslagen")
      setEditing(false)
    } catch (error) {
      onMutation(
        error instanceof Error ? error.message : "Opslaan mislukt",
        true,
      )
    }
  }
  const changeType = (targetType: JournalEntryType) => {
    try {
      const result = journalService.convertEntry(
        useAppStore.getState().session!.state,
        entry.id,
        targetType,
      )
      replaceDomainState(result.state)
      onMutation(result.message)
    } catch (error) {
      onMutation(
        error instanceof Error ? error.message : "Type wijzigen mislukt",
        true,
      )
    }
  }
  const complete = () => {
    if (entry.type !== "action") return
    try {
      const result = journalService.completeAction(
        useAppStore.getState().session!.state,
        entry.id,
      )
      replaceDomainState(result.state)
      onMutation(result.message)
    } catch (error) {
      onMutation(
        error instanceof Error ? error.message : "Actie afronden mislukt",
        true,
      )
    }
  }
  const select = () => onSelect({ kind: "entry", entryId: entry.id, topicId })

  return (
    <article
      className={`journal-entry journal-entry--${entry.type}${selected ? " is-selected" : ""}${entry.status === "Afgerond" ? " is-completed" : ""}`}
      tabIndex={0}
      onClick={select}
      onKeyDown={(event) => {
        if (event.key === "Enter") select()
      }}
    >
      <time dateTime={entry.createdAt} className="journal-entry__date">
        <strong>{date.day}</strong>
        <span>{date.time}</span>
      </time>
      <span className="journal-entry__timeline" aria-hidden="true">
        <span />
      </span>
      <div className="journal-entry__content">
        {entry.type !== "update" ? (
          <span
            className={`journal-entry__label journal-entry__label--${entry.type}`}
          >
            {entry.type === "decision"
              ? "✓ "
              : entry.type === "action"
                ? "↗ "
                : "△ "}
            {journalTypeLabels[entry.type]}
          </span>
        ) : null}
        {editing ? (
          <textarea
            autoFocus
            aria-label="Inhoud bewerken"
            rows={Math.max(3, content.split("\n").length)}
            value={content}
            onClick={(event) => event.stopPropagation()}
            onChange={(event) => setContent(event.target.value)}
            onBlur={save}
            onKeyDown={(event) => {
              if (event.key === "Escape") {
                event.preventDefault()
                setContent(entry.content)
                setEditing(false)
              }
              if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
                event.preventDefault()
                save()
              }
            }}
          />
        ) : (
          <MarkdownContent>{entry.content}</MarkdownContent>
        )}
        {entry.type === "action" || entry.type === "decision_request" ? (
          <p className="journal-entry__meta">
            <span aria-hidden="true">→</span>{" "}
            {entry.owner?.displayName ?? "Nog niet toegewezen"}
            {entry.dueDate ? ` · tegen ${formatLocalDate(entry.dueDate)}` : ""}
          </p>
        ) : null}
        {entry.meetingLinks.map((link) =>
          link.meeting ? (
            <p className="journal-entry__meeting" key={link.meeting.id}>
              <span aria-hidden="true">▣</span> {link.meeting.title} ·{" "}
              {formatLocalDate(link.meeting.date)}
            </p>
          ) : null,
        )}
      </div>
      <div
        className="journal-entry__actions"
        onClick={(event) => event.stopPropagation()}
      >
        {entry.type === "action" && entry.status !== "Afgerond" ? (
          <button
            type="button"
            onClick={complete}
            aria-label={`Actie ${entry.content} voltooien`}
          >
            ✓
          </button>
        ) : null}
        <button
          type="button"
          aria-label={`Inhoud van ${entry.content} bewerken`}
          onClick={() => setEditing(true)}
        >
          ✎
        </button>
        <select
          aria-label={`Type van ${entry.content}`}
          value={entry.type}
          onChange={(event) =>
            changeType(event.target.value as JournalEntryType)
          }
        >
          {Object.entries(journalTypeLabels).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </div>
    </article>
  )
}

function TopicComposer({
  topic,
  onMutation,
}: {
  topic: ProjectJournalTopic
  onMutation: (message: string, error?: boolean) => void
}) {
  const [value, setValue] = useState("")
  const [type, setType] = useState<JournalEntryType>("update")
  const replaceDomainState = useAppStore((state) => state.replaceDomainState)
  const command = value.startsWith("/")
    ? value.split(/\s/)[0]!.toLocaleLowerCase("nl")
    : ""
  const suggestions = command
    ? journalCommands.filter((item) => item.command.startsWith(command))
    : []
  const submit = () => {
    if (!value.trim()) return
    try {
      const state = useAppStore.getState().session!.state
      const result = value.startsWith("/")
        ? journalService.executeComposer(state, topic.topic.id, value)
        : journalService.addEntry(state, topic.topic.id, type, value)
      replaceDomainState(result.state)
      setValue("")
      setType("update")
      onMutation(result.message)
    } catch (error) {
      onMutation(
        error instanceof Error ? error.message : "Toevoegen mislukt",
        true,
      )
    }
  }
  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault()
      submit()
    }
  }
  const insertToken = (token: string) =>
    setValue(
      (current) =>
        `${current}${current && !current.endsWith(" ") ? " " : ""}${token}`,
    )
  return (
    <div className="journal-composer">
      <textarea
        rows={1}
        value={value}
        aria-label={`Nieuwe bijdrage aan ${topic.topic.title}`}
        placeholder="Schrijf een update, actie of beslissing..."
        onChange={(event) => setValue(event.target.value)}
        onKeyDown={onKeyDown}
      />
      <div className="journal-composer__controls">
        <select
          aria-label="Soort bijdrage"
          value={type}
          onChange={(event) => setType(event.target.value as JournalEntryType)}
        >
          {Object.entries(journalTypeLabels).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
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

function TopicSection({
  model,
  selection,
  onSelect,
  onMutation,
}: {
  model: ProjectJournalTopic
  selection?: JournalSelection | undefined
  onSelect: (selection: JournalSelection) => void
  onMutation: (message: string, error?: boolean) => void
}) {
  const started = model.topic.audit.createdAt.slice(0, 10)
  return (
    <section
      className={`journal-topic${selection?.topicId === model.topic.id ? " has-selection" : ""}`}
    >
      <button
        type="button"
        className="journal-topic__header"
        onClick={() => onSelect({ kind: "topic", topicId: model.topic.id })}
      >
        <span className="journal-topic__identity">
          <strong>{topicDisplayId(model.topic)}</strong>
          <b>{model.topic.title}</b>
        </span>
        <span className="journal-topic__metadata">
          <span className="status-dot" aria-hidden="true" />{" "}
          {model.topic.status} · {model.topic.priority} ·{" "}
          {model.owner?.displayName ?? "Niet toegewezen"} · Gestart op{" "}
          {formatLocalDate(started as never)}
        </span>
      </button>
      <div className="journal-topic__entries">
        {model.entries.length ? (
          model.entries.map((entry) => (
            <JournalEntryRow
              key={entry.id}
              entry={entry}
              topicId={model.topic.id}
              selected={
                selection?.kind === "entry" && selection.entryId === entry.id
              }
              onSelect={onSelect}
              onMutation={onMutation}
            />
          ))
        ) : (
          <p className="journal-topic__empty">
            Nog geen bijdragen. Schrijf hieronder de eerste update.
          </p>
        )}
      </div>
      {model.topic.status === "Open" ? (
        <TopicComposer topic={model} onMutation={onMutation} />
      ) : null}
    </section>
  )
}

export function ProjectJournal({
  workspace,
  selection,
  onSelect,
  onMutation,
}: {
  workspace: ProjectJournalWorkspace
  selection?: JournalSelection | undefined
  onSelect: (selection: JournalSelection) => void
  onMutation: (message: string, error?: boolean) => void
}) {
  return (
    <main className="project-journal" aria-label="Projectjournaal">
      {workspace.activeTopics.map((topic) => (
        <TopicSection
          key={topic.topic.id}
          model={topic}
          selection={selection}
          onSelect={onSelect}
          onMutation={onMutation}
        />
      ))}
      {workspace.closedTopics.length ? (
        <Collapsible
          className="closed-topics"
          title={`${workspace.closedTopics.length} gesloten topics`}
          summary="Historiek blijft beschikbaar"
        >
          <div className="closed-topics__list">
            {workspace.closedTopics.map((topic) => (
              <TopicSection
                key={topic.topic.id}
                model={topic}
                selection={selection}
                onSelect={onSelect}
                onMutation={onMutation}
              />
            ))}
          </div>
        </Collapsible>
      ) : null}
    </main>
  )
}
