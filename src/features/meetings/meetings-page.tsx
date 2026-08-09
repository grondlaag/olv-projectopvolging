import { useMemo, useState } from "react"
import { useNavigate } from "react-router-dom"
import {
  buildMeetingListItems,
  defaultMeetingFilters,
  filterMeetingListItems,
  type MeetingFilters,
} from "../../application/queries"
import { useAppStore } from "../../app/state/app-store"
import {
  Badge,
  Button,
  EmptyState,
  PageHeader,
} from "../../design-system/components"
import { meetingScopeTypes, meetingStatuses } from "../../domain"
import { formatLocalDate } from "../../utils"
import "./meetings.css"

export function MeetingsPage() {
  const navigate = useNavigate()
  const session = useAppStore((state) => state.session)
  const setImportPanelOpen = useAppStore((state) => state.setImportPanelOpen)
  const [filters, setFilters] = useState<MeetingFilters>(defaultMeetingFilters)
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
          title="Laad eerst een projectworkbook"
          description="Na import verschijnen hier overlegmomenten, agenda's en verslagen."
          action={
            <Button onClick={() => setImportPanelOpen(true)}>
              Excelbestand laden
            </Button>
          }
        />
      </div>
    )
  }

  const setFilter = <K extends keyof MeetingFilters>(
    field: K,
    value: MeetingFilters[K],
  ) => setFilters((current) => ({ ...current, [field]: value }))

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
          <Button
            variant="tertiary"
            onClick={() => setFilters(defaultMeetingFilters)}
          >
            Filters wissen
          </Button>
        ) : null}
      </div>

      {filtered.length ? (
        <div className="meeting-table-wrap">
          <table className="meeting-table">
            <thead>
              <tr>
                <th>Datum</th>
                <th>Overleg</th>
                <th>Scope</th>
                <th>Voorzitter</th>
                <th>Deelnemers</th>
                <th>Agenda</th>
                <th>Status</th>
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
                  <td>
                    <strong>{item.meeting.scopeType}</strong>
                    <small>{item.scopeLabel}</small>
                  </td>
                  <td>{item.chair?.displayName ?? "—"}</td>
                  <td>{item.participantCount}</td>
                  <td>{item.agendaCount}</td>
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
