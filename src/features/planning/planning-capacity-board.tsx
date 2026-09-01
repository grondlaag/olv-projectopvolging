import type { ResourceCapacityPeriod } from "../../application/queries"
import { Button, EmptyState } from "../../design-system/components"
import { useEscapeKey } from "../../design-system/patterns"
import { formatLocalDate } from "../../utils"

interface CapacityBoardProps {
  periods: readonly ResourceCapacityPeriod[]
  onSelect: (period: ResourceCapacityPeriod) => void
  onSelectResource: (period: ResourceCapacityPeriod) => void
}

function percentLabel(value: number): string {
  if (!Number.isFinite(value)) return "∞"
  return `${Math.round(value)}%`
}

export function PlanningCapacityBoard({
  periods,
  onSelect,
  onSelectResource,
}: CapacityBoardProps) {
  const months = [
    ...new Map(periods.map((period) => [period.startDate, period])).values(),
  ].sort((left, right) => left.startDate.localeCompare(right.startDate))
  const resources = [
    ...new Map(
      periods.map((period) => [period.resource.id, period.resource]),
    ).values(),
  ].sort((left, right) => left.name.localeCompare(right.name, "nl"))

  if (!periods.length)
    return (
      <EmptyState
        title="Nog geen capaciteitsvraag"
        description="Maak assets en projecttoewijzingen aan om de belasting per maand te zien."
      />
    )

  return (
    <div
      className="capacity-board"
      role="table"
      aria-label="Capaciteit per maand"
    >
      <div
        className="capacity-board__row capacity-board__row--header"
        role="row"
        style={{
          gridTemplateColumns: `18rem repeat(${months.length}, minmax(7rem, 1fr))`,
        }}
      >
        <span role="columnheader">Asset</span>
        {months.map((month) => (
          <span role="columnheader" key={month.startDate}>
            {new Intl.DateTimeFormat("nl-BE", {
              month: "short",
              year: "numeric",
            }).format(new Date(`${month.startDate}T00:00:00`))}
          </span>
        ))}
      </div>
      {resources.map((resource) => (
        <div
          className="capacity-board__row"
          role="row"
          key={resource.id}
          style={{
            gridTemplateColumns: `18rem repeat(${months.length}, minmax(7rem, 1fr))`,
          }}
        >
          <div role="rowheader" className="capacity-board__resource-header">
            <button
              className="capacity-board__resource"
              type="button"
              onClick={() => {
                const first = periods.find(
                  (item) => item.resource.id === resource.id,
                )
                if (first) onSelectResource(first)
              }}
            >
              <strong>{resource.name}</strong>
              <small>
                {resource.type} · {resource.projectAvailabilityFte} VTE
                beschikbaar
              </small>
            </button>
          </div>
          {months.map((month) => {
            const period = periods.find(
              (item) =>
                item.resource.id === resource.id &&
                item.startDate === month.startDate,
            )
            return period ? (
              <button
                type="button"
                role="cell"
                className={`capacity-board__cell${period.conflict ? " is-conflict" : ""}`}
                key={month.startDate}
                onClick={() => onSelect(period)}
                aria-label={`${resource.name}, ${formatLocalDate(period.startDate)}, ${percentLabel(period.loadPercent)} belast`}
              >
                <strong>{percentLabel(period.loadPercent)}</strong>
                <small>{period.demandFte.toLocaleString("nl-BE")} VTE</small>
              </button>
            ) : (
              <span
                className="capacity-board__cell is-empty"
                role="cell"
                key={month.startDate}
              >
                —
              </span>
            )
          })}
        </div>
      ))}
    </div>
  )
}

export function CapacityDetailPanel({
  period,
  onClose,
}: {
  period: ResourceCapacityPeriod
  onClose: () => void
}) {
  useEscapeKey(onClose)
  return (
    <aside
      className="planning-panel"
      role="dialog"
      aria-modal="false"
      aria-labelledby="capacity-detail-title"
    >
      <header className="planning-panel__header">
        <div>
          <span>Capaciteitsdetail</span>
          <h2 id="capacity-detail-title">{period.resource.name}</h2>
          <p>
            {formatLocalDate(period.startDate)} –{" "}
            {formatLocalDate(period.endDate)}
          </p>
        </div>
        <Button variant="tertiary" onClick={onClose}>
          Sluiten
        </Button>
      </header>
      <div className="planning-selection">
        <div
          className={`capacity-detail__summary${period.conflict ? " is-conflict" : ""}`}
        >
          <span>Belasting</span>
          <strong>{percentLabel(period.loadPercent)}</strong>
          <small>
            {period.demandFte.toLocaleString("nl-BE")} van{" "}
            {period.capacityFte.toLocaleString("nl-BE")} VTE
          </small>
        </div>
        <section className="capacity-detail__breakdown">
          <h3>Opbouw</h3>
          {period.breakdown.map((item) => (
            <article key={item.assignment.id}>
              <div>
                <strong>
                  {item.project.code} · {item.project.title}
                </strong>
                <span>{item.phase?.name ?? "Projectniveau"}</span>
              </div>
              <strong>{item.demandFte.toLocaleString("nl-BE")} VTE</strong>
            </article>
          ))}
        </section>
      </div>
    </aside>
  )
}
