import type { PlanningRow } from "../../application/queries"
import { useAppStore } from "../../app/state/app-store"
import { Button } from "../../design-system/components"
import { useEscapeKey } from "../../design-system/patterns"
import { formatLocalDate } from "../../utils"

export function PlanningSelectionPanel({
  row,
  onClose,
}: {
  row: PlanningRow
  onClose: () => void
}) {
  useEscapeKey(onClose)
  const state = useAppStore((store) => store.session!.state)
  const project = state.indices.projectById.get(row.projectId)
  const action = row.actionId
    ? state.indices.actionById.get(row.actionId)
    : undefined
  const update = row.updateId
    ? state.indices.updateById.get(row.updateId)
    : undefined

  return (
    <aside
      className="planning-panel"
      role="dialog"
      aria-modal="false"
      aria-labelledby="planning-selection-title"
    >
      <header className="planning-panel__header">
        <div>
          <span>Planningdetail</span>
          <h2 id="planning-selection-title">{row.title}</h2>
          <p>{row.subtitle}</p>
        </div>
        <Button variant="tertiary" onClick={onClose}>
          Sluiten
        </Button>
      </header>
      <div className="planning-selection">
        <dl>
          <dt>Project</dt>
          <dd>{project ? `${project.code} · ${project.title}` : "Onbekend"}</dd>
          <dt>Type</dt>
          <dd>
            {row.kind === "project"
              ? "Project"
              : action
                ? "Actie"
                : update
                  ? "Beslissing"
                  : row.kind}
          </dd>
          <dt>Startdatum</dt>
          <dd>{row.startDate ? formatLocalDate(row.startDate) : "—"}</dd>
          <dt>Einddatum</dt>
          <dd>{row.endDate ? formatLocalDate(row.endDate) : "—"}</dd>
          <dt>Status</dt>
          <dd>{action?.status ?? row.status ?? "—"}</dd>
          <dt>Voortgang</dt>
          <dd>{row.progressPercent}%</dd>
          {row.owner ? (
            <>
              <dt>Eigenaar</dt>
              <dd>{row.owner.displayName}</dd>
            </>
          ) : null}
          {action?.deadline ? (
            <>
              <dt>Deadline</dt>
              <dd>{formatLocalDate(action.deadline)}</dd>
            </>
          ) : null}
        </dl>
        <p>
          Dit detail blijft in de planning geopend. Sluit het paneel om verder
          te werken in dezelfde tijdslijn.
        </p>
      </div>
    </aside>
  )
}
