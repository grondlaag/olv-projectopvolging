import { useMemo, useState } from "react"
import { useNavigate, useSearchParams } from "react-router-dom"
import {
  addLocalDateDays,
  buildActionListItems,
  filterActionListItems,
  groupActionListItemsByOwner,
  isActionOpen,
  isActionOverdue,
  type ActionFilters,
  type ActionListItem,
} from "../../application/queries"
import {
  ActionManagementService,
  type ActionContextType,
} from "../../application/services"
import { safeReturnTo } from "../../app/routing"
import { useAppStore } from "../../app/state/app-store"
import {
  Badge,
  Button,
  EmptyState,
  FilterPanel,
  KpiStrip,
  PageHeader,
  SavedViewsControl,
  TableDisplayControl,
} from "../../design-system/components"
import { useWorkspacePreferences } from "../../app/preferences/workspace-preferences"
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
  selectedIds: ReadonlySet<UUID>
  onToggleSelected: (actionId: UUID) => void
  onToggleAll: (selected: boolean) => void
  hiddenColumns: ReadonlySet<string>
  density: "comfortable" | "compact"
}

const actionTableColumns = [
  { id: "action", label: "Actie", required: true },
  { id: "context", label: "Project / context" },
  { id: "topic", label: "Topic" },
  { id: "owner", label: "Eigenaar" },
  { id: "deadline", label: "Deadline" },
  { id: "status", label: "Status" },
  { id: "priority", label: "Prioriteit" },
] as const

function ActionTable({
  items,
  onEdit,
  onStatusChange,
  selectedIds,
  onToggleSelected,
  onToggleAll,
  hiddenColumns,
  density,
}: ActionTableProps) {
  const today = todayAsLocalDate()
  const allSelected =
    items.length > 0 && items.every((item) => selectedIds.has(item.action.id))
  return (
    <div className="actions-table-wrap">
      <table className="actions-table" data-density={density}>
        <thead>
          <tr>
            <th className="actions-table__selection">
              <input
                type="checkbox"
                aria-label="Selecteer alle zichtbare acties"
                checked={allSelected}
                onChange={(event) => onToggleAll(event.target.checked)}
              />
            </th>
            <th>Actie</th>
            {!hiddenColumns.has("context") ? <th>Project / context</th> : null}
            {!hiddenColumns.has("topic") ? <th>Topic</th> : null}
            {!hiddenColumns.has("owner") ? <th>Eigenaar</th> : null}
            {!hiddenColumns.has("deadline") ? <th>Deadline</th> : null}
            {!hiddenColumns.has("status") ? <th>Status</th> : null}
            {!hiddenColumns.has("priority") ? <th>Prioriteit</th> : null}
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
              <td className="actions-table__selection">
                <input
                  type="checkbox"
                  aria-label={`Selecteer ${item.action.title}`}
                  checked={selectedIds.has(item.action.id)}
                  onChange={() => onToggleSelected(item.action.id)}
                />
              </td>
              <td>
                <button type="button" onClick={() => onEdit(item.action.id)}>
                  <strong>{item.action.title}</strong>
                  <small>{item.action.code}</small>
                </button>
              </td>
              {!hiddenColumns.has("context") ? (
                <td>
                  <strong>{item.projectLabel}</strong>
                  <small>{item.contextLabel}</small>
                </td>
              ) : null}
              {!hiddenColumns.has("topic") ? (
                <td>{item.topic?.title ?? "—"}</td>
              ) : null}
              {!hiddenColumns.has("owner") ? (
                <td>{item.owner?.displayName ?? "Onbekende actor"}</td>
              ) : null}
              {!hiddenColumns.has("deadline") ? (
                <td>{formatLocalDate(item.action.deadline)}</td>
              ) : null}
              {!hiddenColumns.has("status") ? (
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
              ) : null}
              {!hiddenColumns.has("priority") ? (
                <td>{item.action.priority}</td>
              ) : null}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export function ActionsPage() {
  const navigate = useNavigate()
  const [searchParameters, setSearchParameters] = useSearchParams()
  const session = useAppStore((state) => state.session)
  const setImportPanelOpen = useAppStore((state) => state.setImportPanelOpen)
  const filters = useMemo<ActionFilters>(() => {
    const status = searchParameters.get("status") ?? ""
    const priority = searchParameters.get("prioriteit") ?? ""
    const dateScope = searchParameters.get("timing") ?? ""
    return {
      search: searchParameters.get("zoeken") ?? "",
      ownerActorId: searchParameters.get("eigenaar") ?? "",
      projectId: searchParameters.get("project") ?? "",
      clusterId: searchParameters.get("cluster") ?? "",
      status: (actionStatuses as readonly string[]).includes(status)
        ? (status as ActionFilters["status"])
        : "",
      priority: (priorities as readonly string[]).includes(priority)
        ? (priority as ActionFilters["priority"])
        : "",
      dateScope: [
        "overdue",
        "thisWeek",
        "next14",
        "noDeadline",
        "waitingDecision",
      ].includes(dateScope)
        ? (dateScope as ActionFilters["dateScope"])
        : "",
    }
  }, [searchParameters])
  const view: ViewMode =
    searchParameters.get("groep") === "eigenaar" ? "owner" : "list"
  const requestedOperationalView = searchParameters.get("scope")
  const operationalView: OperationalView = [
    "all",
    "mine",
    "open",
    "overdue",
    "week",
    "waiting",
  ].includes(requestedOperationalView ?? "")
    ? (requestedOperationalView as OperationalView)
    : "open"
  const editingId = (searchParameters.get("actie") || undefined) as
    UUID | undefined
  const requestedObjectType = searchParameters.get("objectType")
  const newObjectType = ["Project", "Cluster", "Topic", "Meeting"].includes(
    requestedObjectType ?? "",
  )
    ? (requestedObjectType as ActionContextType)
    : undefined
  const newObjectId = (searchParameters.get("objectId") || undefined) as
    UUID | undefined
  const newActionContext =
    searchParameters.get("nieuw") === "1" && newObjectType && newObjectId
      ? { objectType: newObjectType, objectId: newObjectId }
      : undefined
  const [statusMessage, setStatusMessage] = useState("")
  const [selectedIds, setSelectedIds] = useState<Set<UUID>>(new Set())
  const [bulkStatus, setBulkStatus] = useState<"" | ActionStatus>("")
  const [bulkOwnerId, setBulkOwnerId] = useState("")
  const preferences = useWorkspacePreferences()
  const tablePreference = preferences.tables.actions ?? {
    density: "comfortable" as const,
    hiddenColumns: [],
  }
  const hiddenColumns = useMemo(
    () => new Set(tablePreference.hiddenColumns),
    [tablePreference.hiddenColumns],
  )
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
  const visibleSelectedIds = useMemo(() => {
    const visibleIds = new Set(visible.map((item) => item.action.id))
    return new Set([...selectedIds].filter((id) => visibleIds.has(id)))
  }, [selectedIds, visible])

  if (!session) {
    return (
      <div className="actions-page">
        <PageHeader
          eyebrow="Opvolging"
          title="Acties"
          description="Alle verantwoordelijkheden over projecten, clusters, topics en overleg."
        />
        <EmptyState
          title="Open eerst een projectgegevensbestand"
          description="Na import verschijnt hier de volledige actielijst."
          action={
            <Button onClick={() => setImportPanelOpen(true)}>
              JSON openen of nieuw starten
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
  const newActionContextLabel =
    newActionContext?.objectType === "Project"
      ? session.state.indices.projectById.get(newActionContext.objectId)?.title
      : newActionContext?.objectType === "Cluster"
        ? session.state.indices.clusterById.get(newActionContext.objectId)
            ?.title
        : newActionContext?.objectType === "Topic"
          ? session.state.indices.topicById.get(newActionContext.objectId)
              ?.title
          : newActionContext?.objectType === "Meeting"
            ? session.state.indices.meetingById.get(newActionContext.objectId)
                ?.title
            : undefined

  const updateFilter = <K extends keyof ActionFilters>(
    field: K,
    value: ActionFilters[K],
  ) => {
    const parameters = new URLSearchParams(searchParameters)
    const keys: Record<keyof ActionFilters, string> = {
      search: "zoeken",
      ownerActorId: "eigenaar",
      projectId: "project",
      clusterId: "cluster",
      status: "status",
      priority: "prioriteit",
      dateScope: "timing",
    }
    if (value) parameters.set(keys[field], value)
    else parameters.delete(keys[field])
    setSearchParameters(parameters, { replace: true })
  }

  function selectOperationalView(nextView: OperationalView) {
    const parameters = new URLSearchParams(searchParameters)
    if (nextView === "open") parameters.delete("scope")
    else parameters.set("scope", nextView)
    setSearchParameters(parameters, { replace: true })
  }

  function selectView(nextView: ViewMode) {
    const parameters = new URLSearchParams(searchParameters)
    if (nextView === "owner") parameters.set("groep", "eigenaar")
    else parameters.delete("groep")
    setSearchParameters(parameters, { replace: true })
  }

  function resetFilters() {
    const parameters = new URLSearchParams(searchParameters)
    for (const key of [
      "zoeken",
      "eigenaar",
      "project",
      "cluster",
      "status",
      "prioriteit",
      "timing",
      "scope",
    ])
      parameters.delete(key)
    setSearchParameters(parameters, { replace: true })
  }

  const activeFilters = [
    ...(filters.search
      ? [
          {
            id: "search",
            label: `Zoeken: ${filters.search}`,
            onRemove: () => updateFilter("search", ""),
          },
        ]
      : []),
    ...(filters.ownerActorId
      ? [
          {
            id: "owner",
            label: `Eigenaar: ${session.state.indices.actorById.get(filters.ownerActorId as UUID)?.displayName ?? "Onbekend"}`,
            onRemove: () => updateFilter("ownerActorId", ""),
          },
        ]
      : []),
    ...(filters.projectId
      ? [
          {
            id: "project",
            label: `Project: ${session.state.indices.projectById.get(filters.projectId as UUID)?.code ?? "Onbekend"}`,
            onRemove: () => updateFilter("projectId", ""),
          },
        ]
      : []),
    ...(filters.clusterId
      ? [
          {
            id: "cluster",
            label: `Cluster: ${session.state.indices.clusterById.get(filters.clusterId as UUID)?.title ?? "Onbekend"}`,
            onRemove: () => updateFilter("clusterId", ""),
          },
        ]
      : []),
    ...(filters.status
      ? [
          {
            id: "status",
            label: `Status: ${filters.status}`,
            onRemove: () => updateFilter("status", ""),
          },
        ]
      : []),
    ...(filters.priority
      ? [
          {
            id: "priority",
            label: `Prioriteit: ${filters.priority}`,
            onRemove: () => updateFilter("priority", ""),
          },
        ]
      : []),
    ...(filters.dateScope
      ? [
          {
            id: "timing",
            label: `Timing: ${filters.dateScope}`,
            onRemove: () => updateFilter("dateScope", ""),
          },
        ]
      : []),
    ...(operationalView !== "open"
      ? [
          {
            id: "scope",
            label: `Selectie: ${operationalView}`,
            onRemove: () => selectOperationalView("open"),
          },
        ]
      : []),
  ]

  function openAction(actionId: UUID) {
    const next = new URLSearchParams(searchParameters)
    next.set("actie", actionId)
    setSearchParameters(next)
  }

  function closeAction() {
    if (newActionContext) {
      navigate(safeReturnTo(searchParameters.get("returnTo"), "/actions"))
      return
    }
    const next = new URLSearchParams(searchParameters)
    next.delete("actie")
    setSearchParameters(next, { replace: true })
  }

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
          ? "Actie afgerond · back-up nodig"
          : "Actiestatus bijgewerkt · back-up nodig",
      )
    } catch (error) {
      setStatusMessage(
        error instanceof Error
          ? error.message
          : "De actiestatus kon niet worden gewijzigd.",
      )
    }
  }

  function toggleSelected(actionId: UUID) {
    setSelectedIds((current) => {
      const next = new Set(current)
      if (next.has(actionId)) next.delete(actionId)
      else next.add(actionId)
      return next
    })
  }

  function applyBulkChange() {
    if (!visibleSelectedIds.size || (!bulkStatus && !bulkOwnerId)) return
    let state = useAppStore.getState().session!.state
    try {
      for (const actionId of visibleSelectedIds) {
        const action = state.indices.actionById.get(actionId)
        if (!action) continue
        const result = actionService.updateAction(state, action.id, {
          title: action.title,
          ...(action.description ? { description: action.description } : {}),
          ownerActorId: (bulkOwnerId || action.ownerActorId) as UUID,
          ...(action.deadline ? { deadline: action.deadline } : {}),
          status: bulkStatus || action.status,
          priority: action.priority,
        })
        state = result.state
      }
      useAppStore.getState().replaceDomainState(state)
      setStatusMessage(
        `${visibleSelectedIds.size} acties bijgewerkt · back-up nodig`,
      )
      setSelectedIds(new Set())
      setBulkStatus("")
      setBulkOwnerId("")
    } catch (error) {
      setStatusMessage(
        error instanceof Error
          ? error.message
          : "De geselecteerde acties konden niet worden bijgewerkt.",
      )
    }
  }

  return (
    <div className="actions-page workspace-page">
      <PageHeader
        eyebrow="Opvolging"
        title="Acties"
        description="Eén werklijst voor eigenaarschap, deadlines en beslissingen over alle contexten."
        actions={<Badge tone="info">{visible.length} zichtbaar</Badge>}
      />

      <KpiStrip
        ariaLabel="Actieoverzicht"
        items={[
          {
            id: "visible",
            label: "Zichtbare acties",
            value: visible.length,
            supportingText: `van ${items.length} acties`,
          },
          {
            id: "open",
            label: "Open",
            value: items.filter((item) => isActionOpen(item.action)).length,
            supportingText: "alle contexten",
          },
          {
            id: "overdue",
            label: "Achterstallig",
            value: items.filter((item) =>
              isActionOverdue(item.action, todayAsLocalDate()),
            ).length,
            supportingText: "aandacht vereist",
            tone: "attention",
          },
          {
            id: "waiting",
            label: "Wacht op beslissing",
            value: items.filter(
              (item) => item.action.status === "Wacht op beslissing",
            ).length,
            supportingText: "open besluitvorming",
          },
        ]}
      />

      {statusMessage ? (
        <p className="actions-status-message" role="status">
          {statusMessage}
        </p>
      ) : null}

      <FilterPanel
        activeFilters={activeFilters}
        onClear={resetFilters}
        actions={
          <>
            <SavedViewsControl page="actions" />
            <TableDisplayControl table="actions" columns={actionTableColumns} />
          </>
        }
      >
        <fieldset className="filter-panel__scope">
          <legend>Snelle selecties</legend>
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
              onClick={() => selectOperationalView(value)}
            >
              {label}
            </Button>
          ))}
        </fieldset>
        <label>
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
      </FilterPanel>

      <div className="actions-toolbar">
        <fieldset>
          <legend>Weergave</legend>
          <Button
            variant={view === "list" ? "secondary" : "tertiary"}
            onClick={() => selectView("list")}
          >
            Lijst
          </Button>
          <Button
            variant={view === "owner" ? "secondary" : "tertiary"}
            onClick={() => selectView("owner")}
          >
            Per eigenaar
          </Button>
        </fieldset>
      </div>

      {visibleSelectedIds.size ? (
        <section className="actions-bulk-bar" aria-label="Bulkacties">
          <strong>{visibleSelectedIds.size} geselecteerd</strong>
          <label>
            <span>Status</span>
            <select
              value={bulkStatus}
              onChange={(event) =>
                setBulkStatus(event.target.value as "" | ActionStatus)
              }
            >
              <option value="">Ongewijzigd</option>
              {actionStatuses.map((status) => (
                <option key={status}>{status}</option>
              ))}
            </select>
          </label>
          <label>
            <span>Eigenaar</span>
            <select
              value={bulkOwnerId}
              onChange={(event) => setBulkOwnerId(event.target.value)}
            >
              <option value="">Ongewijzigd</option>
              {activeActors.map((actor) => (
                <option value={actor.id} key={actor.id}>
                  {actor.displayName}
                </option>
              ))}
            </select>
          </label>
          <Button
            onClick={applyBulkChange}
            disabled={!bulkStatus && !bulkOwnerId}
          >
            Wijziging toepassen
          </Button>
          <Button variant="tertiary" onClick={() => setSelectedIds(new Set())}>
            Selectie wissen
          </Button>
        </section>
      ) : null}

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
                  onEdit={openAction}
                  onStatusChange={updateStatus}
                  selectedIds={visibleSelectedIds}
                  onToggleSelected={toggleSelected}
                  onToggleAll={(selected) =>
                    setSelectedIds((current) => {
                      const next = new Set(current)
                      for (const item of group.actions) {
                        if (selected) next.add(item.action.id)
                        else next.delete(item.action.id)
                      }
                      return next
                    })
                  }
                  hiddenColumns={hiddenColumns}
                  density={tablePreference.density}
                />
              </section>
            ))}
          </div>
        ) : (
          <ActionTable
            items={visible}
            onEdit={openAction}
            onStatusChange={updateStatus}
            selectedIds={visibleSelectedIds}
            onToggleSelected={toggleSelected}
            onToggleAll={(selected) =>
              setSelectedIds(
                selected
                  ? new Set(visible.map((item) => item.action.id))
                  : new Set(),
              )
            }
            hiddenColumns={hiddenColumns}
            density={tablePreference.density}
          />
        )
      ) : (
        <EmptyState
          title="Geen acties binnen deze selectie"
          description="Wis of verruim de filters om andere verantwoordelijkheden te zien."
        />
      )}

      {editingId || (newActionContext && newActionContextLabel) ? (
        <ActionPanel
          {...(editingId ? { actionId: editingId } : {})}
          {...(newActionContext
            ? {
                objectType: newActionContext.objectType,
                objectId: newActionContext.objectId,
              }
            : {})}
          contextLabel={newActionContextLabel ?? "Globale actielijst"}
          onClose={closeAction}
        />
      ) : null}
    </div>
  )
}
