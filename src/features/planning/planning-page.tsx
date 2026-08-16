import { useMemo, useState } from "react"
import { useNavigate } from "react-router-dom"
import {
  buildPortfolioPlanningModel,
  defaultGlobalPlanningFilters,
  summarizePortfolioPlanning,
  type GlobalPlanningFilters,
  type PlanningRow,
  type PlanningZoom,
} from "../../application/queries"
import { useAppStore } from "../../app/state/app-store"
import { Button, EmptyState, PageHeader } from "../../design-system/components"
import { planningStatuses, type UUID } from "../../domain"
import { formatLocalDate, todayAsLocalDate } from "../../utils"
import { PlanningGantt } from "./planning-gantt"
import "./planning.css"

export function PlanningPage() {
  const navigate = useNavigate()
  const session = useAppStore((state) => state.session)
  const setImportPanelOpen = useAppStore((state) => state.setImportPanelOpen)
  const [filters, setFilters] = useState<GlobalPlanningFilters>(
    defaultGlobalPlanningFilters,
  )
  const [zoom, setZoom] = useState<PlanningZoom>("quarter")
  const [collapsedChapters, setCollapsedChapters] = useState<Set<string>>(
    new Set(),
  )
  const [collapsedClusters, setCollapsedClusters] = useState<Set<string>>(
    new Set(),
  )
  const [expandedProjects, setExpandedProjects] = useState<Set<string>>(
    new Set(),
  )
  const today = todayAsLocalDate()
  const model = useMemo(
    () =>
      session ? buildPortfolioPlanningModel(session.state, filters, today) : [],
    [filters, session, today],
  )
  const summary = useMemo(
    () => summarizePortfolioPlanning(model, today),
    [model, today],
  )
  const rows = useMemo(() => {
    const result: PlanningRow[] = []
    for (const chapter of model) {
      if (collapsedChapters.has(chapter.chapter.id)) continue
      for (const cluster of chapter.clusters) {
        const clusterKey = `${chapter.chapter.id}:${cluster.id}`
        if (collapsedClusters.has(clusterKey)) continue
        for (const item of cluster.projects) {
          const projectRow = item.rows[0]
          if (!projectRow) continue
          result.push({
            ...projectRow,
            subtitle: `${chapter.chapter.title} · ${cluster.title} · ${item.project.code}`,
          })
          if (expandedProjects.has(item.project.id))
            result.push(...item.rows.slice(1))
        }
      }
    }
    return result
  }, [collapsedChapters, collapsedClusters, expandedProjects, model])

  if (!session) {
    return (
      <div className="planning-page">
        <PageHeader
          eyebrow="Tijd"
          title="Planning"
          description="Portfolio-Gantt met projectperiodes, mijlpalen en getimede topics."
        />
        <EmptyState
          title="Nog geen planning geladen"
          description="Open een bestaand JSON-bestand of start een nieuwe gegevensset."
          action={
            <Button onClick={() => setImportPanelOpen(true)}>
              JSON openen of nieuw starten
            </Button>
          }
        />
      </div>
    )
  }

  const clusters = session.state.records.clusters.filter(
    (cluster) => !filters.chapterId || cluster.chapterId === filters.chapterId,
  )
  const projects = session.state.records.projects.filter(
    (project) =>
      (!filters.chapterId || project.chapterId === filters.chapterId) &&
      (!filters.clusterId || project.clusterId === filters.clusterId),
  )
  const owners = [
    ...new Map(
      session.state.records.planning.flatMap((entry) => {
        const topic = entry.topicId
          ? session.state.indices.topicById.get(entry.topicId)
          : undefined
        const owner = topic?.ownerActorId
          ? session.state.indices.actorById.get(topic.ownerActorId)
          : undefined
        return owner ? [[owner.id, owner] as const] : []
      }),
    ).values(),
  ].sort((left, right) =>
    left.displayName.localeCompare(right.displayName, "nl"),
  )

  function patchFilters(patch: Partial<GlobalPlanningFilters>) {
    setFilters((current) => ({ ...current, ...patch }))
  }
  function toggle(
    setter: React.Dispatch<React.SetStateAction<Set<string>>>,
    id: string,
  ) {
    setter((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  return (
    <div className="planning-page">
      <PageHeader
        eyebrow="Tijd"
        title="Planning"
        description="Hoofdstuk → cluster → project. Projectdetails zijn standaard ingeklapt."
        actions={
          <span className="planning-result-count">
            <strong>{summary.totalProjects}</strong> projecten
          </span>
        }
      />
      <section
        className="planning-summary"
        aria-label="Samenvatting portfolioplanning"
      >
        <div>
          <span>Planningdekking</span>
          <strong>
            {summary.projectsWithPlanning} van {summary.totalProjects} projecten
          </strong>
          <small>{summary.projectsWithoutPlanning} zonder planning</small>
        </div>
        <div>
          <span>Planningitems</span>
          <strong>{summary.planningItemCount}</strong>
          <small>{summary.milestoneCount} mijlpalen</small>
        </div>
        <div>
          <span>Aandacht</span>
          <strong>{summary.attentionItemCount}</strong>
          <small>risico, vertraagd of over tijd</small>
        </div>
        <div>
          <span>Zichtbare periode</span>
          <strong>
            {summary.earliestDate && summary.latestDate
              ? `${formatLocalDate(summary.earliestDate)} – ${formatLocalDate(summary.latestDate)}`
              : "Nog geen datums"}
          </strong>
          <small>volgens de huidige filters</small>
        </div>
      </section>
      <section className="planning-filters" aria-label="Planningfilters">
        <label>
          <span>Hoofdstuk</span>
          <select
            value={filters.chapterId}
            onChange={(event) =>
              patchFilters({
                chapterId: event.target.value,
                clusterId: "",
                projectId: "",
              })
            }
          >
            <option value="">Alle</option>
            {session.state.records.chapters.map((chapter) => (
              <option value={chapter.id} key={chapter.id}>
                {chapter.title}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>Cluster</span>
          <select
            value={filters.clusterId}
            onChange={(event) =>
              patchFilters({ clusterId: event.target.value, projectId: "" })
            }
          >
            <option value="">Alle</option>
            {clusters.map((cluster) => (
              <option value={cluster.id} key={cluster.id}>
                {cluster.title}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>Project</span>
          <select
            value={filters.projectId}
            onChange={(event) =>
              patchFilters({ projectId: event.target.value })
            }
          >
            <option value="">Alle</option>
            {projects.map((project) => (
              <option value={project.id} key={project.id}>
                {project.code} · {project.title}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>Planningstatus</span>
          <select
            value={filters.status}
            onChange={(event) =>
              patchFilters({
                status: event.target.value as GlobalPlanningFilters["status"],
              })
            }
          >
            <option value="">Alle</option>
            {planningStatuses.map((status) => (
              <option key={status}>{status}</option>
            ))}
          </select>
        </label>
        <label>
          <span>Eigenaar</span>
          <select
            value={filters.ownerActorId}
            onChange={(event) =>
              patchFilters({ ownerActorId: event.target.value })
            }
          >
            <option value="">Alle</option>
            {owners.map((owner) => (
              <option value={owner.id} key={owner.id}>
                {owner.displayName}
              </option>
            ))}
          </select>
        </label>
        <label className="planning-filter-check">
          <input
            type="checkbox"
            checked={filters.riskOnly}
            onChange={(event) =>
              patchFilters({ riskOnly: event.target.checked })
            }
          />
          <span>Alleen risico</span>
        </label>
        <label className="planning-filter-check">
          <input
            type="checkbox"
            checked={filters.delayedOnly}
            onChange={(event) =>
              patchFilters({ delayedOnly: event.target.checked })
            }
          />
          <span>Alleen over tijd</span>
        </label>
        <Button
          variant="tertiary"
          onClick={() => setFilters(defaultGlobalPlanningFilters)}
        >
          Filters wissen
        </Button>
      </section>
      {model.length ? (
        <>
          <section
            className="planning-hierarchy"
            aria-labelledby="planning-hierarchy-title"
          >
            <header>
              <span>Portfoliostructuur</span>
              <h2 id="planning-hierarchy-title">Zichtbare lagen</h2>
            </header>
            {model.map((chapter) => {
              const chapterCollapsed = collapsedChapters.has(chapter.chapter.id)
              return (
                <div
                  className="planning-hierarchy__chapter"
                  key={chapter.chapter.id}
                >
                  <button
                    type="button"
                    aria-expanded={!chapterCollapsed}
                    onClick={() =>
                      toggle(setCollapsedChapters, chapter.chapter.id)
                    }
                  >
                    <span aria-hidden="true">
                      {chapterCollapsed ? "+" : "−"}
                    </span>
                    <strong>
                      {chapter.chapter.code} · {chapter.chapter.title}
                    </strong>
                  </button>
                  {!chapterCollapsed
                    ? chapter.clusters.map((cluster) => {
                        const clusterKey = `${chapter.chapter.id}:${cluster.id}`
                        const clusterCollapsed =
                          collapsedClusters.has(clusterKey)
                        return (
                          <div
                            className="planning-hierarchy__cluster"
                            key={clusterKey}
                          >
                            <button
                              type="button"
                              aria-expanded={!clusterCollapsed}
                              onClick={() =>
                                toggle(setCollapsedClusters, clusterKey)
                              }
                            >
                              <span aria-hidden="true">
                                {clusterCollapsed ? "+" : "−"}
                              </span>
                              <strong>{cluster.title}</strong>
                              <small>{cluster.projects.length} projecten</small>
                            </button>
                            {!clusterCollapsed ? (
                              <div>
                                {cluster.projects.map((item) => {
                                  const expanded = expandedProjects.has(
                                    item.project.id,
                                  )
                                  return (
                                    <button
                                      type="button"
                                      key={item.project.id}
                                      aria-expanded={expanded}
                                      onClick={() =>
                                        toggle(
                                          setExpandedProjects,
                                          item.project.id,
                                        )
                                      }
                                    >
                                      <span aria-hidden="true">
                                        {expanded ? "−" : "+"}
                                      </span>
                                      <span>
                                        {item.project.code} ·{" "}
                                        {item.project.title}
                                      </span>
                                      <small>
                                        {item.entries.length} items ·{" "}
                                        {item.project.plannedEndDate
                                          ? `einde ${formatLocalDate(item.project.plannedEndDate)}`
                                          : "geen projecteinddatum"}
                                      </small>
                                    </button>
                                  )
                                })}
                              </div>
                            ) : null}
                          </div>
                        )
                      })
                    : null}
                </div>
              )
            })}
          </section>
          <section
            className="planning-canvas"
            aria-labelledby="portfolio-gantt-title"
          >
            <header className="planning-canvas__header">
              <div>
                <span>Tijdslijn</span>
                <h2 id="portfolio-gantt-title">Portfolio-Gantt</h2>
              </div>
              <fieldset className="planning-zoom">
                <legend>Zoom</legend>
                {(["week", "month", "quarter", "year"] as const).map(
                  (value) => (
                    <label key={value}>
                      <input
                        type="radio"
                        name="portfolio-zoom"
                        checked={zoom === value}
                        onChange={() => setZoom(value)}
                      />
                      <span>
                        {
                          {
                            week: "Week",
                            month: "Maand",
                            quarter: "Kwartaal",
                            year: "Jaar",
                          }[value]
                        }
                      </span>
                    </label>
                  ),
                )}
              </fieldset>
            </header>
            <PlanningGantt
              rows={rows}
              zoom={zoom}
              today={today}
              onSelectEntry={(entryId) => {
                const entry = session.state.indices.planningById.get(
                  entryId as UUID,
                )
                if (entry) navigate(`/projects/${entry.projectId}/planning`)
              }}
            />
          </section>
        </>
      ) : (
        <EmptyState
          title="Geen planning binnen deze selectie"
          description="Pas de filters aan om projecten en planningitems zichtbaar te maken."
          action={
            <Button
              variant="secondary"
              onClick={() => setFilters(defaultGlobalPlanningFilters)}
            >
              Filters wissen
            </Button>
          }
        />
      )}
    </div>
  )
}
