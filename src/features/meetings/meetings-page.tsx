import { useMemo } from "react"
import { useNavigate, useSearchParams } from "react-router-dom"
import {
  buildMeetingListItems,
  filterMeetingListItems,
  type MeetingFilters,
} from "../../application/queries"
import { useAppStore } from "../../app/state/app-store"
import {
  Badge,
  Button,
  EmptyState,
  PageHeader,
  SavedViewsControl,
  TableDisplayControl,
} from "../../design-system/components"
import { useWorkspacePreferences } from "../../app/preferences/workspace-preferences"
import { meetingScopeTypes, meetingStatuses } from "../../domain"
import { formatLocalDate } from "../../utils"
import "./meetings.css"

const meetingTableColumns = [
  { id: "date", label: "Datum", required: true },
  { id: "meeting", label: "Overleg", required: true },
  { id: "scope", label: "Scope" },
  { id: "chair", label: "Voorzitter" },
  { id: "participants", label: "Deelnemers" },
  { id: "agenda", label: "Agenda" },
  { id: "status", label: "Status" },
] as const

export function MeetingsPage() {
  const navigate = useNavigate()
  const [searchParameters, setSearchParameters] = useSearchParams()
  const session = useAppStore((state) => state.session)
  const setImportPanelOpen = useAppStore((state) => state.setImportPanelOpen)
  const preferences = useWorkspacePreferences()
  const tablePreference = preferences.tables.meetings ?? {
    density: "comfortable" as const,
    hiddenColumns: [],
  }
  const hiddenColumns = useMemo(
    () => new Set(tablePreference.hiddenColumns),
    [tablePreference.hiddenColumns],
  )
  const requestedScope = searchParameters.get("scope") ?? ""
  const requestedStatus = searchParameters.get("status") ?? ""
  const filters = useMemo<MeetingFilters>(
    () => ({
      search: searchParameters.get("zoeken") ?? "",
      type: searchParameters.get("type") ?? "",
      scopeType: meetingScopeTypes.includes(
        requestedScope as (typeof meetingScopeTypes)[number],
      )
        ? (requestedScope as MeetingFilters["scopeType"])
        : "",
      status: meetingStatuses.includes(
        requestedStatus as (typeof meetingStatuses)[number],
      )
        ? (requestedStatus as MeetingFilters["status"])
        : "",
      dateFrom: searchParameters.get("vanaf") ?? "",
      dateTo: searchParameters.get("tot") ?? "",
    }),
    [requestedScope, requestedStatus, searchParameters],
  )
  const items = useMemo(
    () => (session ? buildMeetingListItems(session.state) : []),
    [session],
  )
  const filtered = useMemo(
    () => filterMeetingListItems(items, filters),
    [filters, items],
  )
  const types = useMemo(
    () => [...new Set(items.map((item) => item.meeting.type))].sort(),
    [items],
  )

  if (!session) {
    return (
      <div className="meetings-page">
        <PageHeader
          eyebrow="Samenwerking"
          title="Overleg"
          description="Voorbereiden, verwerken en historisch vastleggen in één projectcontext."
        />
        <EmptyState
          title="Open eerst een projectgegevensbestand"
          description="Na import verschijnen hier overlegmomenten, agenda's en verslagen."
          action={
            <Button onClick={() => setImportPanelOpen(true)}>
              JSON openen of nieuw starten
            </Button>
          }
        />
      </div>
    )
  }

  const setFilter = <K extends keyof MeetingFilters>(
    field: K,
    value: MeetingFilters[K],
  ) => {
    const parameters = new URLSearchParams(searchParameters)
    const keys: Record<keyof MeetingFilters, string> = {
      search: "zoeken",
      type: "type",
      scopeType: "scope",
      status: "status",
      dateFrom: "vanaf",
      dateTo: "tot",
    }
    if (value) parameters.set(keys[field], value)
    else parameters.delete(keys[field])
    setSearchParameters(parameters, { replace: true })
  }

  function resetFilters() {
    const parameters = new URLSearchParams(searchParameters)
    for (const key of ["zoeken", "type", "scope", "status", "vanaf", "tot"])
      parameters.delete(key)
    setSearchParameters(parameters, { replace: true })
  }

  return (
    <div className="meetings-page">
      <PageHeader
        eyebrow="Samenwerking"
        title="Overleg"
        description="Rustige voorbereiding, agenda, besluitvorming, actieopvolging en versievaste verslaghistoriek."
        actions={
          <Button onClick={() => navigate("/meetings/new")}>
            + Nieuw overleg
          </Button>
        }
      />

      <section className="meeting-filters" aria-label="Overlegfilters">
        <label className="meeting-filters__search">
          <span>Zoeken</span>
          <input
            type="search"
            value={filters.search}
            onChange={(event) => setFilter("search", event.target.value)}
            placeholder="Titel, nummer, type of scope"
          />
        </label>
        <label>
          <span>Type</span>
          <select
            value={filters.type}
            onChange={(event) => setFilter("type", event.target.value)}
          >
            <option value="">Alle types</option>
            {types.map((type) => (
              <option key={type}>{type}</option>
            ))}
          </select>
        </label>
        <label>
          <span>Scope</span>
          <select
            value={filters.scopeType}
            onChange={(event) =>
              setFilter(
                "scopeType",
                event.target.value as MeetingFilters["scopeType"],
              )
            }
          >
            <option value="">Alle scopes</option>
            {meetingScopeTypes.map((type) => (
              <option key={type}>{type}</option>
            ))}
          </select>
        </label>
        <label>
          <span>Status</span>
          <select
            value={filters.status}
            onChange={(event) =>
              setFilter(
                "status",
                event.target.value as MeetingFilters["status"],
              )
            }
          >
            <option value="">Alle statussen</option>
            {meetingStatuses.map((status) => (
              <option key={status}>{status}</option>
            ))}
          </select>
        </label>
        <label>
          <span>Vanaf</span>
          <input
            type="date"
            value={filters.dateFrom}
            onChange={(event) => setFilter("dateFrom", event.target.value)}
          />
        </label>
        <label>
          <span>Tot en met</span>
          <input
            type="date"
            value={filters.dateTo}
            onChange={(event) => setFilter("dateTo", event.target.value)}
          />
        </label>
      </section>

      <div className="meeting-list-meta">
        <strong>{filtered.length} overlegmomenten</strong>
        {Object.values(filters).some(Boolean) ? (
          <Button variant="tertiary" onClick={resetFilters}>
            Filters wissen
          </Button>
        ) : null}
        <SavedViewsControl page="meetings" />
        <TableDisplayControl table="meetings" columns={meetingTableColumns} />
      </div>

      {filtered.length ? (
        <div className="meeting-table-wrap">
          <table
            className="meeting-table"
            data-density={tablePreference.density}
          >
            <thead>
              <tr>
                <th>Datum</th>
                <th>Overleg</th>
                {!hiddenColumns.has("scope") ? <th>Scope</th> : null}
                {!hiddenColumns.has("chair") ? <th>Voorzitter</th> : null}
                {!hiddenColumns.has("participants") ? (
                  <th>Deelnemers</th>
                ) : null}
                {!hiddenColumns.has("agenda") ? <th>Agenda</th> : null}
                {!hiddenColumns.has("status") ? <th>Status</th> : null}
              </tr>
            </thead>
            <tbody>
              {filtered.map((item) => (
                <tr key={item.meeting.id}>
                  <td>
                    <time>{formatLocalDate(item.meeting.date)}</time>
                  </td>
                  <td>
                    <button
                      type="button"
                      onClick={() => navigate(`/meetings/${item.meeting.id}`)}
                      aria-label={`${item.meeting.title} openen`}
                    >
                      <strong>{item.meeting.title}</strong>
                      <small>
                        {item.meeting.number ? `${item.meeting.number} · ` : ""}
                        {item.meeting.type}
                      </small>
                    </button>
                  </td>
                  {!hiddenColumns.has("scope") ? (
                    <td>
                      <strong>{item.meeting.scopeType}</strong>
                      <small>{item.scopeLabel}</small>
                    </td>
                  ) : null}
                  {!hiddenColumns.has("chair") ? (
                    <td>{item.chair?.displayName ?? "—"}</td>
                  ) : null}
                  {!hiddenColumns.has("participants") ? (
                    <td>{item.participantCount}</td>
                  ) : null}
                  {!hiddenColumns.has("agenda") ? (
                    <td>{item.agendaCount}</td>
                  ) : null}
                  {!hiddenColumns.has("status") ? (
                    <td>
                      <Badge
                        tone={
                          item.meeting.status === "Definitief"
                            ? "success"
                            : "info"
                        }
                      >
                        {item.meeting.status}
                      </Badge>
                    </td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <EmptyState
          title={
            items.length
              ? "Geen overleg binnen deze selectie"
              : "Nog geen overleg"
          }
          description={
            items.length
              ? "Verruim de filters om andere overlegmomenten te zien."
              : "Maak het eerste overleg aan en bouw daarna de agenda op."
          }
          action={
            !items.length ? (
              <Button onClick={() => navigate("/meetings/new")}>
                + Nieuw overleg
              </Button>
            ) : undefined
          }
        />
      )}
    </div>
  )
}
