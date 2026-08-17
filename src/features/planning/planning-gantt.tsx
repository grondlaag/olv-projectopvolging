import { memo, useEffect, useMemo, useRef } from "react"
import { Badge } from "../../design-system/components"
import type { PlanningDependency, UUID } from "../../domain"
import { formatLocalDate } from "../../utils"
import type { PlanningRow, PlanningZoom } from "../../application/queries"
import "./planning.css"

const dayMs = 86_400_000
const rowHeight = 44

interface ZoomDefinition {
  pixelsPerDay: number
  paddingDays: number
}

const zoomDefinitions: Record<PlanningZoom, ZoomDefinition> = {
  week: { pixelsPerDay: 20, paddingDays: 7 },
  month: { pixelsPerDay: 7, paddingDays: 21 },
  quarter: { pixelsPerDay: 3, paddingDays: 45 },
  year: { pixelsPerDay: 1.15, paddingDays: 120 },
}

function ordinal(value: string): number {
  return Math.floor(Date.parse(`${value}T00:00:00Z`) / dayMs)
}

function localDate(day: number): string {
  return new Date(day * dayMs).toISOString().slice(0, 10)
}

function tickLabel(value: string, zoom: PlanningZoom): string {
  const date = new Date(`${value}T00:00:00Z`)
  return new Intl.DateTimeFormat("nl-BE", {
    ...(zoom === "week"
      ? { weekday: "short", day: "2-digit" }
      : zoom === "month"
        ? { day: "2-digit", month: "short" }
        : zoom === "quarter"
          ? { month: "short", year: "2-digit" }
          : { month: "short", year: "numeric" }),
    timeZone: "UTC",
  }).format(date)
}

function timelineTickDays(
  startDay: number,
  endDay: number,
  zoom: PlanningZoom,
): number[] {
  if (zoom === "week" || zoom === "month") {
    const step = zoom === "week" ? 1 : 7
    const days: number[] = []
    for (let day = startDay; day <= endDay; day += step) days.push(day)
    return days
  }

  const start = new Date(startDay * dayMs)
  const monthStep = zoom === "quarter" ? 1 : 3
  let month = start.getUTCMonth()
  if (zoom === "year") month = Math.ceil(month / 3) * 3
  let cursor = Date.UTC(start.getUTCFullYear(), month, 1) / dayMs
  if (cursor < startDay) {
    month += monthStep
    cursor = Date.UTC(start.getUTCFullYear(), month, 1) / dayMs
  }

  const days: number[] = []
  while (cursor <= endDay) {
    days.push(cursor)
    const date = new Date(cursor * dayMs)
    cursor =
      Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + monthStep, 1) / dayMs
  }
  return days
}

function statusTone(status?: PlanningRow["status"]) {
  if (status === "Afgerond") return "success" as const
  if (status === "Risico" || status === "Vertraagd") return "warning" as const
  if (status === "Geannuleerd") return "neutral" as const
  return "info" as const
}

interface PlanningGanttProps {
  rows: readonly PlanningDisplayRow[]
  dependencies?: readonly PlanningDependency[]
  zoom: PlanningZoom
  today: string
  onSelectEntry?: (entryId: UUID) => void
  onSelectRow?: (row: PlanningRow) => void
  onToggleGroup?: (rowId: string) => void
  expandedProjectIds?: ReadonlySet<string>
  onToggleProject?: (projectId: UUID) => void
  emptyMessage?: string
}

export interface PlanningGroupRow {
  id: string
  title: string
  subtitle: string
  depth: 0 | 1
  kind: "group"
  expanded: boolean
}

export type PlanningDisplayRow = PlanningRow | PlanningGroupRow

function isPlanningGroupRow(row: PlanningDisplayRow): row is PlanningGroupRow {
  return row.kind === "group"
}

export const PlanningGantt = memo(function PlanningGantt({
  rows,
  dependencies = [],
  zoom,
  today,
  onSelectEntry,
  onSelectRow,
  onToggleGroup,
  expandedProjectIds,
  onToggleProject,
  emptyMessage = "Nog geen planningitems om weer te geven.",
}: PlanningGanttProps) {
  const scrollerRef = useRef<HTMLDivElement>(null)
  const layout = useMemo(() => {
    const datedRows = rows.filter(
      (row): row is PlanningRow =>
        !isPlanningGroupRow(row) && Boolean(row.endDate),
    )
    const definition = zoomDefinitions[zoom]
    const starts = datedRows.map((row) =>
      ordinal(row.startDate ?? row.endDate!),
    )
    const ends = datedRows.map((row) => ordinal(row.endDate!))
    const todayDay = ordinal(today)
    const dataStart = starts.length ? Math.min(...starts) : todayDay
    const dataEnd = ends.length ? Math.max(...ends) : todayDay
    const includeToday =
      todayDay >= dataStart - 366 && todayDay <= dataEnd + 366
    const startDay =
      Math.min(dataStart, includeToday ? todayDay : dataStart) -
      definition.paddingDays
    const endDay =
      Math.max(dataEnd, includeToday ? todayDay : dataEnd) +
      definition.paddingDays
    const width = Math.max(
      760,
      Math.ceil((endDay - startDay + 1) * definition.pixelsPerDay),
    )
    const pixelsPerDay = width / (endDay - startDay + 1)
    const ticks: { date: string; x: number }[] = []
    for (const day of timelineTickDays(startDay, endDay, zoom)) {
      ticks.push({ date: localDate(day), x: (day - startDay) * pixelsPerDay })
    }
    const positions = new Map<
      string,
      { start: number; end: number; row: number }
    >()
    rows.forEach((row, index) => {
      if (isPlanningGroupRow(row) || !row.endDate) return
      const start = ordinal(row.startDate ?? row.endDate)
      const end = ordinal(row.endDate)
      positions.set(row.id, {
        start: (start - startDay) * pixelsPerDay,
        end: (end - startDay + 1) * pixelsPerDay,
        row: index,
      })
    })
    return {
      startDay,
      endDay,
      width,
      pixelsPerDay,
      ticks,
      positions,
      todayX: (todayDay - startDay) * pixelsPerDay,
      showToday: todayDay >= startDay && todayDay <= endDay,
    }
  }, [rows, today, zoom])

  useEffect(() => {
    const scroller = scrollerRef.current
    if (!scroller || !layout?.showToday) return
    scroller.scrollLeft = Math.max(
      0,
      layout.todayX - scroller.clientWidth * 0.55,
    )
  }, [layout])

  if (!rows.length) {
    return <p className="planning-gantt__empty">{emptyMessage}</p>
  }

  const connectors = dependencies.flatMap((dependency) => {
    const predecessor = layout.positions.get(dependency.predecessorPlanningId)
    const successor = layout.positions.get(dependency.successorPlanningId)
    if (!predecessor || !successor) return []
    const y1 = predecessor.row * rowHeight + rowHeight / 2
    const y2 = successor.row * rowHeight + rowHeight / 2
    const middle = Math.max(predecessor.end + 9, successor.start - 12)
    return [
      <path
        key={dependency.id}
        d={`M ${predecessor.end} ${y1} H ${middle} V ${y2} H ${successor.start}`}
      />,
    ]
  })

  return (
    <div className="planning-gantt" data-zoom={zoom}>
      <div className="planning-gantt__labels" aria-label="Planningregels">
        <div className="planning-gantt__label-header">
          <span>Planningitem</span>
          <small>
            {formatLocalDate(localDate(layout.startDay))} –{" "}
            {formatLocalDate(localDate(layout.endDay))}
          </small>
        </div>
        {rows.map((row) => {
          if (isPlanningGroupRow(row)) {
            return (
              <button
                type="button"
                key={row.id}
                className={`planning-gantt__label planning-gantt__label--group planning-gantt__label--depth-${row.depth}`}
                aria-expanded={row.expanded}
                onClick={() => onToggleGroup?.(row.id)}
              >
                <span className="planning-gantt__disclosure" aria-hidden="true">
                  {row.expanded ? "−" : "+"}
                </span>
                <span>
                  <strong>{row.title}</strong>
                  <small>{row.subtitle}</small>
                </span>
              </button>
            )
          }

          const labelContent = (
            <>
              <span>
                <strong>{row.title}</strong>
                <small>{row.subtitle}</small>
              </span>
              <span className="planning-gantt__signals">
                {row.delayed ? <em>Over tijd</em> : null}
                {row.status ? (
                  <Badge tone={statusTone(row.status)}>{row.status}</Badge>
                ) : null}
              </span>
            </>
          )

          if (row.kind === "project" && onToggleProject) {
            const expanded = expandedProjectIds?.has(row.projectId) ?? false
            return (
              <div
                key={row.id}
                className={`planning-gantt__label planning-gantt__label--project planning-gantt__label--depth-${row.depth}`}
              >
                <button
                  type="button"
                  className="planning-gantt__disclosure"
                  aria-label={`${expanded ? "Details verbergen voor" : "Details tonen voor"} ${row.title}`}
                  aria-expanded={expanded}
                  onClick={() => onToggleProject(row.projectId)}
                >
                  {expanded ? "−" : "+"}
                </button>
                <button
                  type="button"
                  className="planning-gantt__record-link"
                  onClick={() => onSelectRow?.(row)}
                >
                  {labelContent}
                </button>
              </div>
            )
          }

          return (
            <button
              type="button"
              key={row.id}
              className={`planning-gantt__label planning-gantt__label--depth-${row.depth}`}
              disabled={!onSelectRow && (!row.entry || !onSelectEntry)}
              onClick={() =>
                onSelectRow
                  ? onSelectRow(row)
                  : row.entry && onSelectEntry?.(row.entry.id)
              }
            >
              {labelContent}
            </button>
          )
        })}
      </div>
      <div
        className="planning-gantt__scroller"
        ref={scrollerRef}
        tabIndex={0}
        aria-label="Horizontale tijdas"
      >
        <div
          className="planning-gantt__timeline"
          style={{ width: layout.width }}
        >
          <div className="planning-gantt__axis">
            {layout.ticks.map((tick) => (
              <span key={tick.date} style={{ left: tick.x }}>
                {tickLabel(tick.date, zoom)}
              </span>
            ))}
          </div>
          <div
            className="planning-gantt__rows"
            style={{ height: rows.length * rowHeight }}
          >
            {layout.ticks.map((tick) => (
              <i
                aria-hidden="true"
                className="planning-gantt__gridline"
                key={tick.date}
                style={{ left: tick.x }}
              />
            ))}
            {layout.showToday ? (
              <i
                className="planning-gantt__today"
                style={{ left: layout.todayX }}
                aria-label={`Vandaag ${formatLocalDate(today)}`}
              >
                <span>Vandaag</span>
              </i>
            ) : null}
            <svg
              className="planning-gantt__dependencies"
              width={layout.width}
              height={rows.length * rowHeight}
              aria-label={`${connectors.length} finish-to-start-afhankelijkheden`}
            >
              <defs>
                <marker
                  id="planning-arrow"
                  markerWidth="7"
                  markerHeight="7"
                  refX="6"
                  refY="3.5"
                  orient="auto"
                >
                  <path d="M0,0 L7,3.5 L0,7 Z" />
                </marker>
              </defs>
              <g markerEnd="url(#planning-arrow)">{connectors}</g>
            </svg>
            {rows.map((row, index) => {
              if (isPlanningGroupRow(row))
                return (
                  <div
                    className="planning-gantt__row planning-gantt__row--group"
                    key={row.id}
                    style={{ top: index * rowHeight }}
                  />
                )
              const position = layout.positions.get(row.id)
              if (!position)
                return (
                  <div
                    className="planning-gantt__row"
                    key={row.id}
                    style={{ top: index * rowHeight }}
                  />
                )
              const top = index * rowHeight + 11
              if (row.isMilestone) {
                return (
                  <button
                    key={row.id}
                    type="button"
                    className={`planning-gantt__milestone ${row.delayed ? "is-delayed" : ""}`}
                    style={{ left: position.end - 8, top }}
                    aria-label={`${row.title}, mijlpaal op ${formatLocalDate(row.endDate)}`}
                    onClick={() =>
                      onSelectRow
                        ? onSelectRow(row)
                        : row.entry && onSelectEntry?.(row.entry.id)
                    }
                  />
                )
              }
              const width = Math.max(5, position.end - position.start)
              return (
                <button
                  key={row.id}
                  type="button"
                  className={`planning-gantt__bar planning-gantt__bar--${row.kind} ${row.delayed ? "is-delayed" : ""}`}
                  style={{ left: position.start, top, width }}
                  aria-label={`${row.title}, ${formatLocalDate(row.startDate)} tot ${formatLocalDate(row.endDate)}, ${row.progressPercent}%`}
                  onClick={() =>
                    onSelectRow
                      ? onSelectRow(row)
                      : row.entry && onSelectEntry?.(row.entry.id)
                  }
                >
                  <span style={{ width: `${row.progressPercent}%` }} />
                </button>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
})
