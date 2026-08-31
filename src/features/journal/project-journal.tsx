import { useRef, useState, type KeyboardEvent } from "react"
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
  const [typeMenuOpen, setTypeMenuOpen] = useState(false)
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
  const toggleUpdateCompleted = () => {
    if (entry.type !== "update") return
    try {
      const result = journalService.setUpdateCompleted(
        useAppStore.getState().session!.state,
        entry.id,
        !entry.completed,
      )
      replaceDomainState(result.state)
      onMutation(result.message)
    } catch (error) {
      onMutation(
        error instanceof Error ? error.message : "Update afsluiten mislukt",
        true,
      )
    }
  }
  const select = () => onSelect({ kind: "entry", entryId: entry.id, topicId })

  return (
    <article
      className={`journal-entry journal-entry--${entry.type}${selected ? " is-selected" : ""}${entry.status === "Afgerond" || entry.completed ? " is-completed" : ""}`}
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
            title="Actie voltooien"
          >
            ✓
          </button>
        ) : null}
        {entry.type === "update" ? (
          <button
            type="button"
            onClick={toggleUpdateCompleted}
            aria-label={`${entry.completed ? "Update heropenen" : "Update afsluiten"}: ${entry.content}`}
            title={entry.completed ? "Update heropenen" : "Update afsluiten"}
          >
            {entry.completed ? "↺" : "✓"}
          </button>
        ) : null}
        <button
          type="button"
          aria-label={`Inhoud van ${entry.content} bewerken`}
          onClick={() => setEditing(true)}
          title="Markdown bewerken"
        >
          ✎
        </button>
        <div className="journal-type-menu">
          <button
            type="button"
            aria-label={`Type van ${entry.content} wijzigen`}
            aria-haspopup="menu"
            aria-expanded={typeMenuOpen}
            title="Type wijzigen"
            onClick={() => setTypeMenuOpen((open) => !open)}
          >
            ⋯
          </button>
          {typeMenuOpen ? (
            <div role="menu" className="journal-type-menu__items">
              {Object.entries(journalTypeLabels).map(([value, label]) => (
                <button
                  type="button"
                  role="menuitem"
                  key={value}
                  onClick={() => {
                    setTypeMenuOpen(false)
                    changeType(value as JournalEntryType)
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
          ) : null}
        </div>
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
  const [typeMenuOpen, setTypeMenuOpen] = useState(false)
  const [mentionMenuOpen, setMentionMenuOpen] = useState(false)
  const [preview, setPreview] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const replaceDomainState = useAppStore((state) => state.replaceDomainState)
  const actorRecords = useAppStore(
    (state) => state.session?.state.records.actors,
  )
  const actors = [...(actorRecords ?? [])]
    .filter((actor) => actor.active && actor.audit.active)
    .sort((left, right) =>
      left.displayName.localeCompare(right.displayName, "nl"),
    )
  const command = value.startsWith("/")
    ? value.split(/\s/)[0]!.toLocaleLowerCase("nl")
    : ""
  const suggestions = command
    ? journalCommands.filter((item) => item.command.startsWith(command))
    : []
  const mentionMatch = /(?:^|\s)@([^\s@]*)$/.exec(value)
  const mentionedActors = mentionMatch
    ? actors.filter((actor) =>
        actor.displayName
          .toLocaleLowerCase("nl")
          .includes(mentionMatch[1]!.toLocaleLowerCase("nl")),
      )
    : actors
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
      setPreview(false)
      setMentionMenuOpen(false)
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
  const insertToken = (token: string) => {
    const textarea = textareaRef.current
    const start = textarea?.selectionStart ?? value.length
    const end = textarea?.selectionEnd ?? value.length
    setValue(`${value.slice(0, start)}${token}${value.slice(end)}`)
    requestAnimationFrame(() => {
      textarea?.focus()
      textarea?.setSelectionRange(start + token.length, start + token.length)
    })
  }
  const wrapSelection = (before: string, after = before) => {
    const textarea = textareaRef.current
    if (!textarea) return
    const start = textarea.selectionStart
    const end = textarea.selectionEnd
    const selected = value.slice(start, end) || "tekst"
    setValue(
      `${value.slice(0, start)}${before}${selected}${after}${value.slice(end)}`,
    )
    requestAnimationFrame(() => {
      textarea.focus()
      textarea.setSelectionRange(
        start + before.length,
        start + before.length + selected.length,
      )
    })
  }
  const appendToken = (token: string) => {
    const separator = value && !value.endsWith(" ") ? " " : ""
    const nextValue = `${value}${separator}${token}`
    setValue(nextValue)
    requestAnimationFrame(() => {
      textareaRef.current?.focus()
      textareaRef.current?.setSelectionRange(nextValue.length, nextValue.length)
    })
  }
  const openMentions = () => {
    appendToken("@")
    setMentionMenuOpen(true)
  }
  const insertMention = (displayName: string) => {
    const at = value.lastIndexOf("@")
    const nextValue =
      at >= 0
        ? `${value.slice(0, at)}@${displayName} `
        : `${value}${value && !value.endsWith(" ") ? " " : ""}@${displayName} `
    setValue(nextValue)
    setMentionMenuOpen(false)
    requestAnimationFrame(() => {
      textareaRef.current?.focus()
      textareaRef.current?.setSelectionRange(nextValue.length, nextValue.length)
    })
  }
  return (
    <div className="journal-composer">
      <textarea
        ref={textareaRef}
        rows={1}
        value={value}
        aria-label={`Nieuwe bijdrage aan ${topic.topic.title}`}
        placeholder="Schrijf een update, actie of beslissing..."
        onChange={(event) => {
          const nextValue = event.target.value
          setValue(nextValue)
          setMentionMenuOpen(/(?:^|\s)@[^\s@]*$/.test(nextValue))
          setPreview(false)
        }}
        onKeyDown={onKeyDown}
      />
      <div className="journal-composer__controls">
        <div className="journal-type-menu journal-type-menu--composer">
          <button
            type="button"
            aria-label="Soort bijdrage"
            aria-haspopup="menu"
            aria-expanded={typeMenuOpen}
            title="Soort bijdrage kiezen"
            onClick={() => setTypeMenuOpen((open) => !open)}
          >
            {journalTypeLabels[type]}⌄
          </button>
          {typeMenuOpen ? (
            <div role="menu" className="journal-type-menu__items">
              {Object.entries(journalTypeLabels).map(([value, label]) => (
                <button
                  type="button"
                  role="menuitem"
                  key={value}
                  onClick={() => {
                    setType(value as JournalEntryType)
                    setTypeMenuOpen(false)
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
          ) : null}
        </div>
        <button
          type="button"
          onClick={openMentions}
          aria-label="Persoon vermelden"
          title="Persoon vermelden"
        >
          @
        </button>
        <button
          type="button"
          onClick={() => appendToken("#")}
          aria-label="Tag toevoegen"
          title="Tag toevoegen"
        >
          #
        </button>
        <button
          type="button"
          onClick={() => appendToken("[bijlage](https://)")}
          aria-label="Bijlagelink toevoegen"
          title="Bijlagelink toevoegen"
        >
          ↗
        </button>
        <button
          type="button"
          onClick={submit}
          aria-label="Bijdrage toevoegen"
          title="Bijdrage toevoegen"
        >
          →
        </button>
      </div>
      <div className="journal-markdown-toolbar" aria-label="Markdown opmaak">
        <button
          type="button"
          onClick={() => wrapSelection("**")}
          aria-label="Vet"
          title="Vet (**tekst**)"
        >
          <strong>B</strong>
        </button>
        <button
          type="button"
          onClick={() => wrapSelection("*")}
          aria-label="Cursief"
          title="Cursief (*tekst*)"
        >
          <em>I</em>
        </button>
        <button
          type="button"
          onClick={() => insertToken("\n- ")}
          aria-label="Opsomming"
          title="Opsomming"
        >
          •
        </button>
        <button
          type="button"
          onClick={() => insertToken("\n- [ ] ")}
          aria-label="Checklist"
          title="Checklist"
        >
          ☐
        </button>
        <button
          type="button"
          onClick={() => wrapSelection("`")}
          aria-label="Inline code"
          title="Inline code"
        >
          &lt;/&gt;
        </button>
        <button
          type="button"
          onClick={() => wrapSelection("[", "](https://)")}
          aria-label="Markdownlink"
          title="Link invoegen"
        >
          🔗
        </button>
        <button
          type="button"
          onClick={() => setPreview((shown) => !shown)}
          aria-pressed={preview}
          title="Markdownvoorbeeld tonen"
        >
          {preview ? "Schrijven" : "Voorbeeld"}
        </button>
      </div>
      {preview ? (
        <div
          className="journal-composer__preview"
          aria-label="Markdownvoorbeeld"
        >
          <MarkdownContent>{value || "Nog geen inhoud."}</MarkdownContent>
        </div>
      ) : null}
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
      {mentionMenuOpen && mentionedActors.length ? (
        <div
          className="journal-mention-list"
          role="listbox"
          aria-label="Actoren vermelden"
        >
          {mentionedActors.map((actor) => (
            <button
              type="button"
              key={actor.id}
              onClick={() => insertMention(actor.displayName)}
            >
              <strong>{actor.displayName}</strong>
              <span>{actor.role || actor.organization || "Actor"}</span>
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
