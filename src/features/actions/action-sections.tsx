import { useMemo, useState } from "react"
import {
  buildActionListItems,
  buildProjectActionSummary,
  isActionOpen,
  isActionOverdue,
  type ActionListItem,
} from "../../application/queries"
import type { ActionContextType } from "../../application/services"
import { useAppStore } from "../../app/state/app-store"
import { Badge, Button, EmptyState } from "../../design-system/components"
import type { Action, UUID } from "../../domain"
import { formatLocalDate, todayAsLocalDate } from "../../utils"
import { ActionPanel } from "./action-panel"
import "./actions.css"

function actionTone(status: Action["status"]) {
  if (status === "Afgerond") return "success" as const
  if (status === "Geannuleerd") return "neutral" as const
  if (status === "Wacht op beslissing") return "warning" as const
  return "info" as const
}

interface ActionRowsProps {
  items: readonly ActionListItem[]
  onEdit: (actionId: UUID) => void
  showContext?: boolean
}

export function ActionRows({ items, onEdit, showContext }: ActionRowsProps) {
  const today = todayAsLocalDate()
  return (
    <ul className="action-rows">
      {items.map((item) => (
        <li
          key={item.action.id}
          className={
            isActionOverdue(item.action, today) ? "is-overdue" : undefined
          }
        >
          <button type="button" onClick={() => onEdit(item.action.id)}>
            <span className="action-rows__title">
              <strong>{item.action.title}</strong>
              {showContext ? (
                <small>
                  {item.projectLabel} · {item.contextLabel}
                </small>
              ) : null}
            </span>
            <span>{item.owner?.displayName ?? "Onbekende eigenaar"}</span>
            <time>{formatLocalDate(item.action.deadline)}</time>
            <Badge tone={actionTone(item.action.status)}>
              {item.action.status}
            </Badge>
            <small>{item.action.priority}</small>
          </button>
        </li>
      ))}
    </ul>
  )
}

export interface ActionContextSectionProps {
  objectType: ActionContextType
  objectId: UUID
  contextLabel: string
  heading?: string
  sourceMeetingId?: UUID
}

export function ActionContextSection({
  objectType,
  objectId,
  contextLabel,
  heading = "Open acties",
  sourceMeetingId,
}: ActionContextSectionProps) {
  const session = useAppStore((state) => state.session)
  const [creating, setCreating] = useState(false)
  const [editingId, setEditingId] = useState<UUID>()
  const items = useMemo(() => {
    if (!session) return []
    return buildActionListItems(
      session.state,
      session.state.indices.actionsByObject.get(`${objectType}:${objectId}`) ??
        [],
    )
  }, [objectId, objectType, session])
  const open = items.filter((item) => isActionOpen(item.action))
  const completed = items.filter((item) => !isActionOpen(item.action))

  return (
    <section
      className="action-context-section"
      aria-labelledby="action-heading"
    >
      <header>
        <div>
          <span>Verantwoordelijkheden</span>
          <h2 id="action-heading">{heading}</h2>
        </div>
        <Button variant="secondary" onClick={() => setCreating(true)}>
          + Actie
        </Button>
      </header>
      {open.length ? (
        <ActionRows items={open} onEdit={setEditingId} />
      ) : (
        <EmptyState
          title="Geen open acties"
          description="Voeg een concrete verantwoordelijkheid toe zonder deze context te verlaten."
          action={
            <Button variant="secondary" onClick={() => setCreating(true)}>
              Eerste actie toevoegen
            </Button>
          }
        />
      )}
      {completed.length ? (
        <details className="action-context-section__completed">
          <summary>Afgerond en geannuleerd ({completed.length})</summary>
          <ActionRows items={completed} onEdit={setEditingId} />
        </details>
      ) : null}
      {creating ? (
        <ActionPanel
          objectType={objectType}
          objectId={objectId}
          contextLabel={contextLabel}
          {...(sourceMeetingId ? { sourceMeetingId } : {})}
          onClose={() => setCreating(false)}
        />
      ) : null}
      {editingId ? (
        <ActionPanel
          actionId={editingId}
          contextLabel={contextLabel}
          onClose={() => setEditingId(undefined)}
        />
      ) : null}
    </section>
  )
}

export interface ProjectActionSectionProps {
  projectId: UUID
  contextLabel: string
}

export function ProjectActionSection({
  projectId,
  contextLabel,
}: ProjectActionSectionProps) {
  const session = useAppStore((state) => state.session)!
  const [creating, setCreating] = useState(false)
  const [editingId, setEditingId] = useState<UUID>()
  const summary = useMemo(
    () =>
      buildProjectActionSummary(session.state, projectId, todayAsLocalDate()),
    [projectId, session],
  )

  return (
    <section
      className="project-actions"
      aria-labelledby="project-actions-title"
    >
      <header>
        <div>
          <span>Project en projecttopics</span>
          <h2 id="project-actions-title">Actieopvolging</h2>
        </div>
        <Button variant="secondary" onClick={() => setCreating(true)}>
          + Actie
        </Button>
      </header>
      <div className="project-actions__metrics">
        <div>
          <strong>{summary.open.length}</strong>
          <span>Open</span>
        </div>
        <div className={summary.overdue.length ? "is-attention" : undefined}>
          <strong>{summary.overdue.length}</strong>
          <span>Achterstallig</span>
        </div>
        <div>
          <strong>{summary.next14Days.length}</strong>
          <span>Komende 14 dagen</span>
        </div>
        <div>
          <strong>{summary.waitingDecision.length}</strong>
          <span>Wacht op beslissing</span>
        </div>
      </div>
      {summary.open.length ? (
        <ActionRows items={summary.open} onEdit={setEditingId} showContext />
      ) : (
        <EmptyState
          title="Geen open projectacties"
          description="Directe projectacties en acties uit projecttopics verschijnen hier samen."
        />
      )}
      {summary.recentlyCompleted.length ? (
        <details className="action-context-section__completed">
          <summary>
            Recent afgerond ({summary.recentlyCompleted.length})
          </summary>
          <ActionRows
            items={summary.recentlyCompleted}
            onEdit={setEditingId}
            showContext
          />
        </details>
      ) : null}
      {creating ? (
        <ActionPanel
          objectType="Project"
          objectId={projectId}
          contextLabel={contextLabel}
          onClose={() => setCreating(false)}
        />
      ) : null}
      {editingId ? (
        <ActionPanel
          actionId={editingId}
          contextLabel={contextLabel}
          onClose={() => setEditingId(undefined)}
        />
      ) : null}
    </section>
  )
}
