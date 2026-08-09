import { useMemo, useState } from "react"
import {
  addLocalDateDays,
  buildActionListItems,
  defaultActionFilters,
  filterActionListItems,
  groupActionListItemsByOwner,
  isActionOpen,
  isActionOverdue,
  type ActionFilters,
  type ActionListItem,
} from "../../application/queries"
import { ActionManagementService } from "../../application/services"
import { useAppStore } from "../../app/state/app-store"
import {
  Badge,
  Button,
  EmptyState,
  PageHeader,
} from "../../design-system/components"
import {
  actionStatuses,
  priorities,
  type Action,
  type ActionStatus,
  type UUID,
} from "../../domain"
import { formatLocalDate, todayAsLocalDate } from "../../utils"
import { ActionPanel } from "./action-panel"
import "./actions-page.css"

type ViewMode = "list" | "owner"
type OperationalView = "all" | "mine" | "open" | "overdue" | "week" | "waiting"

const actionService = new ActionManagementService()

function actionTone(status: Action["status"]) {
  if (status === "Afgerond") return "success" as const
  if (status === "Geannuleerd") return "neutral" as const
  if (status === "Wacht op beslissing") return "warning" as const
  return "info" as const
}

interface ActionTableProps {
  items: readonly ActionListItem[]
  onEdit: (actionId: UUID) => void
  onStatusChange: (action: Action, status: ActionStatus) => void
}

function ActionTable({ items, onEdit, onStatusChange }: ActionTableProps) {
  const today = todayAsLocalDate()
  return (
    <div className="actions-table-wrap">
      <table className="actions-table">
        <thead>
          <tr>
            <th>Actie</th>
            <th>Project / context</th>
            <th>Topic</th>
            <th>Eigenaar</th>
            <th>Deadline</th>
            <th>Status</th>
            <th>Prioriteit</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr
              key={item.action.id}
              className={
                isActionOverdue(item.action, today) ? "is-overdue" : undefined
              }
            >
              <td>
                <button type="button" onClick={() => onEdit(item.action.id)}>
                  <strong>{item.action.title}</strong>
                  <small>{item.action.code}</small>
                </button>
              </td>
              <td>
                <strong>{item.projectLabel}</strong>
                <small>{item.contextLabel}</small>
              </td>
              <td>{item.topic?.title ?? "—"}</td>
              <td>{item.owner?.displayName ?? "Onbekende actor"}</td>
              <td>{formatLocalDate(item.action.deadline)}</td>
              <td className="actions-table__quick-status">
                <Badge tone={actionTone(item.action.status)}>
                  {item.action.status}
                </Badge>
                <select
                  value={item.action.status}
                  aria-label={`Status van ${item.action.title}`}
                  onChange={(event) =>
                    onStatusChange(
                      item.action,
                      event.target.value as ActionStatus,
                    )
                  }
                >
                  {actionStatuses.map((status) => (
                    <option key={status}>{status}</option>
                  ))}
                </select>
              </td>
              <td>{item.action.priority}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export function ActionsPage() {
  const session = useAppStore((state) => state.session)
  const setImportPanelOpen = useAppStore((state) => state.setImportPanelOpen)
  const [filters, setFilters] = useState<ActionFilters>(defaultActionFilters)
  const [view, setView] = useState<ViewMode>("list")
  const [operationalView, setOperationalView] =
    useState<OperationalView>("open")
  const [editingId, setEditingId] = useState<UUID>()
  const [statusMessage, setStatusMessage] = useState("")
  const items = useMemo(
    () => (session ? buildActionListItems(session.state) : []),
    [session],
  )
  const filtered = useMemo(
    () => filterActionListItems(items, filters, todayAsLocalDate()),
    [filters, items],
  )
  const currentActorId = session?.state.records.config[0]?.currentActorId
  const visible = useMemo(() => {
    const today = todayAsLocalDate()
    return filtered.filter((item) => {
      if (operationalView === "all") return true
      if (operationalView === "mine")
        return (
          isActionOpen(item.action) &&
          item.action.ownerActorId === currentActorId
        )
      if (operationalView === "open") return isActionOpen(item.action)
      if (operationalView === "overdue")
        return isActionOverdue(item.action, today)
      if (operationalView === "waiting")
        return item.action.status === "Wacht op beslissing"
      const day = new Date(`${today}T00:00:00Z`).getUTCDay()
      const endOfWeek = addLocalDateDays(today, day === 0 ? 0 : 7 - day)
      return (
        isActionOpen(item.action) &&
        Boolean(item.action.deadline) &&
        item.action.deadline! >= today &&
        item.action.deadline! <= endOfWeek
      )
    })
  }, [currentActorId, filtered, operationalView])
  const ownerGroups = useMemo(
    () => groupActionListItemsByOwner(visible),
    [visible],
  )

  if (!session) {
    return (
      <div className="actions-page">
        <PageHeader
          eyebrow="Opvolging"
          title="Acties"
          description="Alle verantwoordelijkheden over projecten, clusters, topics en overleg."
        />
        <EmptyState
          title="Laad eerst een projectworkbook"
          description="Na import verschijnt hier de volledige actielijst."
          action={
            <Button onClick={() => setImportPanelOpen(true)}>
              Excelbestand laden
            </Button>
          }
        />
      </div>
    )
  }

  const activeActors = session.state.records.actors.filter(
    (actor) => actor.active && actor.audit.active,
  )
  const activeProjects = session.state.records.projects.filter(
    (project) => project.audit.active,
  )
  const activeClusters = session.state.records.clusters.filter(
    (cluster) => cluster.audit.active,
  )

  const updateFilter = <K extends keyof ActionFilters>(
    field: K,
    value: ActionFilters[K],
  ) => setFilters((current) => ({ ...current, [field]: value }))

  function updateStatus(action: Action, status: ActionStatus) {
    const latest = useAppStore.getState().session?.state
    if (!latest || action.status === status) return
    try {
      const result = actionService.updateAction(latest, action.id, {
        title: action.title,
        ...(action.description ? { description: action.description } : {}),
        ownerActorId: action.ownerActorId,
        ...(action.deadline ? { deadline: action.deadline } : {}),
        status,
        priority: action.priority,
      })
      useAppStore.getState().replaceDomainState(result.state)
      setStatusMessage(
        status === "Afgerond"
          ? "Actie afgerond · nog exporteren"
          : "Actiestatus bijgewerkt · nog exporteren",
      )
    } catch (error) {
      setStatusMessage(
        error instanceof Error
          ? error.message
          : "De actiestatus kon niet worden gewijzigd.",
      )
    }
  }

  return (
    <div className="actions-page">
      <PageHeader
        eyebrow="Opvolging"
        title="Acties"
        description="Eén werklijst voor eigenaarschap, deadlines en beslissingen over alle contexten."
        actions={<Badge tone="info">{visible.length} zichtbaar</Badge>}
      />

      <nav className="actions-quick-views" aria-label="Actieweergave">
        {(
          [
            ["mine", "Mijn acties"],
            ["open", "Alle open acties"],
            ["overdue", "Achterstallig"],
            ["week", "Deze week"],
            ["waiting", "Wacht op beslissing"],
            ["all", "Alles"],
          ] as const
        ).map(([value, label]) => (
          <Button
            key={value}
            variant={operationalView === value ? "secondary" : "tertiary"}
            onClick={() => setOperationalView(value)}
          >
            {label}
          </Button>
        ))}
        <Button
          variant={view === "owner" ? "secondary" : "tertiary"}
          onClick={() => {
            setView("owner")
            setOperationalView("open")
          }}
        >
          Per persoon
        </Button>
      </nav>

      {statusMessage ? (
        <p className="actions-status-message" role="status">
          {statusMessage}
        </p>
      ) : null}

      <section className="actions-filterbar" aria-label="Actiefilters">
        <label className="actions-filterbar__search">
          <span>Zoeken</span>
          <input
            type="search"
            value={filters.search}
            onChange={(event) => updateFilter("search", event.target.value)}
            placeholder="Titel, code, project of context"
          />
        </label>
        <label>
          <span>Eigenaar</span>
          <select
            value={filters.ownerActorId}
            onChange={(event) =>
              updateFilter("ownerActorId", event.target.value)
            }
          >
            <option value="">Alle eigenaars</option>
            {activeActors.map((actor) => (
              <option key={actor.id} value={actor.id}>
                {actor.displayName}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>Project</span>
          <select
            value={filters.projectId}
            onChange={(event) => updateFilter("projectId", event.target.value)}
          >
            <option value="">Alle projecten</option>
            {activeProjects.map((project) => (
              <option key={project.id} value={project.id}>
                {project.code} · {project.title}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>Cluster</span>
          <select
            value={filters.clusterId}
            onChange={(event) => updateFilter("clusterId", event.target.value)}
          >
            <option value="">Alle clusters</option>
            {activeClusters.map((cluster) => (
              <option key={cluster.id} value={cluster.id}>
                {cluster.title}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>Status</span>
          <select
            value={filters.status}
            onChange={(event) =>
              updateFilter(
                "status",
                event.target.value as ActionFilters["status"],
              )
            }
          >
            <option value="">Alle statussen</option>
            {actionStatuses.map((status) => (
              <option key={status}>{status}</option>
            ))}
          </select>
        </label>
        <label>
          <span>Prioriteit</span>
          <select
            value={filters.priority}
            onChange={(event) =>
              updateFilter(
                "priority",
                event.target.value as ActionFilters["priority"],
              )
            }
          >
            <option value="">Alle prioriteiten</option>
            {priorities.map((priority) => (
              <option key={priority}>{priority}</option>
            ))}
          </select>
        </label>
        <label>
          <span>Timing</span>
          <select
            value={filters.dateScope}
            onChange={(event) =>
              updateFilter(
                "dateScope",
                event.target.value as ActionFilters["dateScope"],
              )
            }
          >
            <option value="">Alle deadlines</option>
            <option value="overdue">Achterstallig</option>
            <option value="thisWeek">Deze week</option>
            <option value="next14">Komende 14 dagen</option>
            <option value="noDeadline">Zonder deadline</option>
            <option value="waitingDecision">Wacht op beslissing</option>
          </select>
        </label>
      </section>

      <div className="actions-toolbar">
        <fieldset>
          <legend>Weergave</legend>
          <Button
            variant={view === "list" ? "secondary" : "tertiary"}
            onClick={() => setView("list")}
          >
            Lijst
          </Button>
          <Button
            variant={view === "owner" ? "secondary" : "tertiary"}
            onClick={() => setView("owner")}
          >
            Per eigenaar
          </Button>
        </fieldset>
        {filters !== defaultActionFilters ? (
          <Button
            variant="tertiary"
            onClick={() => setFilters(defaultActionFilters)}
          >
            Filters wissen
          </Button>
        ) : null}
      </div>

      {visible.length ? (
        view === "owner" ? (
          <div className="action-owner-groups">
            {ownerGroups.map((group) => (
              <section key={group.ownerActorId}>
                <header>
                  <h2>{group.owner?.displayName ?? "Onbekende actor"}</h2>
                  <span>{group.actions.length} acties</span>
                </header>
                <ActionTable
                  items={group.actions}
                  onEdit={setEditingId}
                  onStatusChange={updateStatus}
                />
              </section>
            ))}
          </div>
        ) : (
          <ActionTable
            items={visible}
            onEdit={setEditingId}
            onStatusChange={updateStatus}
          />
        )
      ) : (
        <EmptyState
          title="Geen acties binnen deze selectie"
          description="Wis of verruim de filters om andere verantwoordelijkheden te zien."
        />
      )}

      {editingId ? (
        <ActionPanel
          actionId={editingId}
          contextLabel="Globale actielijst"
          onClose={() => setEditingId(undefined)}
        />
      ) : null}
    </div>
  )
}
