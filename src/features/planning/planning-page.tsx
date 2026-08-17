import { useMemo, useState } from "react"
import { useNavigate, useSearchParams } from "react-router-dom"
import {
  buildPortfolioPlanningModel,
  summarizePortfolioPlanning,
  type GlobalPlanningFilters,
  type PlanningZoom,
} from "../../application/queries"
import { useAppStore } from "../../app/state/app-store"
import {
  Button,
  EmptyState,
  PageHeader,
  SavedViewsControl,
} from "../../design-system/components"
import { planningStatuses, projectSizes, projectSizeFte } from "../../domain"
import { formatLocalDate, todayAsLocalDate } from "../../utils"
import { PlanningGantt, type PlanningDisplayRow } from "./planning-gantt"
import "./planning.css"

export function PlanningPage() {
  const navigate = useNavigate()
  const [searchParameters, setSearchParameters] = useSearchParams()
  const session = useAppStore((state) => state.session)
  const setImportPanelOpen = useAppStore((state) => state.setImportPanelOpen)
  const filters = useMemo<GlobalPlanningFilters>(
    () => ({
      chapterId: searchParameters.get("hoofdstuk") ?? "",
      clusterId: searchParameters.get("cluster") ?? "",
      projectId: searchParameters.get("project") ?? "",
      status: (planningStatuses as readonly string[]).includes(
        searchParameters.get("status") ?? "",
      )
        ? (searchParameters.get("status") as GlobalPlanningFilters["status"])
        : "",
      ownerActorId: searchParameters.get("eigenaar") ?? "",
      riskOnly: searchParameters.get("risico") === "1",
      delayedOnly: searchParameters.get("overTijd") === "1",
    }),
    [searchParameters],
  )
  const requestedZoom = searchParameters.get("zoom")
  const zoom: PlanningZoom =
    requestedZoom === "week" ||
    requestedZoom === "month" ||
    requestedZoom === "year"
      ? requestedZoom
      : "quarter"
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
    const result: PlanningDisplayRow[] = []
    for (const chapter of model) {
      const chapterProjectCount = chapter.clusters.reduce(
        (count, cluster) => count + cluster.projects.length,
        0,
      )
      result.push({
        id: `chapter:${chapter.chapter.id}`,
        title: `${chapter.chapter.code} · ${chapter.chapter.title}`,
        subtitle: `${chapterProjectCount} projecten`,
        depth: 0,
        kind: "group",
        expanded: !collapsedChapters.has(chapter.chapter.id),
      })
      if (collapsedChapters.has(chapter.chapter.id)) continue
      for (const cluster of chapter.clusters) {
        const clusterKey = `${chapter.chapter.id}:${cluster.id}`
        result.push({
          id: `cluster:${clusterKey}`,
          title: cluster.title,
          subtitle: `${cluster.projects.length} projecten`,
          depth: 1,
          kind: "group",
          expanded: !collapsedClusters.has(clusterKey),
        })
        if (collapsedClusters.has(clusterKey)) continue
        for (const item of cluster.projects) {
          const projectRow = item.rows[0]
          if (!projectRow) continue
          result.push({
            ...projectRow,
            depth: 2,
            subtitle: `${chapter.chapter.title} · ${cluster.title} · ${item.project.code}`,
          })
          if (expandedProjects.has(item.project.id))
            result.push(
              ...item.rows
                .slice(1)
                .map((row) => ({ ...row, depth: 3 as const })),
            )
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
    const next = { ...filters, ...patch }
    const parameters = new URLSearchParams(searchParameters)
    const fields: [keyof GlobalPlanningFilters, string][] = [
      ["chapterId", "hoofdstuk"],
      ["clusterId", "cluster"],
      ["projectId", "project"],
      ["status", "status"],
      ["ownerActorId", "eigenaar"],
    ]
    for (const [field, key] of fields) {
      const value = next[field]
      if (typeof value === "string" && value) parameters.set(key, value)
      else parameters.delete(key)
    }
    if (next.riskOnly) parameters.set("risico", "1")
    else parameters.delete("risico")
    if (next.delayedOnly) parameters.set("overTijd", "1")
    else parameters.delete("overTijd")
    setSearchParameters(parameters, { replace: true })
  }
  function resetFilters() {
    const parameters = new URLSearchParams(searchParameters)
    for (const key of [
      "hoofdstuk",
      "cluster",
      "project",
      "status",
      "eigenaar",
      "risico",
      "overTijd",
    ])
      parameters.delete(key)
    setSearchParameters(parameters, { replace: true })
  }
  function selectZoom(value: PlanningZoom) {
    const parameters = new URLSearchParams(searchParameters)
    if (value === "quarter") parameters.delete("zoom")
    else parameters.set("zoom", value)
    setSearchParameters(parameters, { replace: true })
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
        description="Eén uitklapbare portfoliostructuur met de tijdslijn er direct naast."
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
        <div>
          <span>Indicatieve resourcevraag</span>
          <strong>{summary.indicativeFte.toLocaleString("nl-BE")} VTE</strong>
          <small>
            {summary.unscaledProjectCount} projecten nog niet ingeschaald
          </small>
        </div>
      </section>
      <section
        className="planning-resources"
        aria-labelledby="planning-resources-title"
      >
        <div>
          <span>Resourcemanagement</span>
          <h2 id="planning-resources-title">Projectomvang in portefeuille</h2>
          <p>
            Indicatieve gelijktijdige vraag op basis van de gekozen
            XS–XXL-omvang; geen personeelsplanning.
          </p>
        </div>
        <div className="planning-resources__scale">
          {projectSizes.map((size) => (
            <div key={size}>
              <span>{size}</span>
              <strong>{summary.sizeCounts[size]}</strong>
              <small>
                {projectSizeFte[size].toLocaleString("nl-BE")} VTE/project
              </small>
            </div>
          ))}
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
        <Button variant="tertiary" onClick={resetFilters}>
          Filters wissen
        </Button>
        <SavedViewsControl page="planning" />
      </section>
      {model.length ? (
        <>
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
                        onChange={() => selectZoom(value)}
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
              expandedProjectIds={expandedProjects}
              onToggleGroup={(rowId) => {
                if (rowId.startsWith("chapter:")) {
                  toggle(setCollapsedChapters, rowId.slice(8))
                } else if (rowId.startsWith("cluster:")) {
                  toggle(setCollapsedClusters, rowId.slice(8))
                }
              }}
              onToggleProject={(projectId) =>
                toggle(setExpandedProjects, projectId)
              }
              onSelectRow={(row) => {
                if (row.kind === "project") {
                  navigate(`/projects/${row.projectId}`)
                } else if (row.topic) {
                  navigate(`/projects/${row.projectId}/topics/${row.topic.id}`)
                } else if (row.actionId) {
                  navigate(`/actions?actie=${row.actionId}`)
                } else {
                  navigate(`/projects/${row.projectId}/planning`)
                }
              }}
            />
          </section>
        </>
      ) : (
        <EmptyState
          title="Geen planning binnen deze selectie"
          description="Pas de filters aan om projecten en planningitems zichtbaar te maken."
          action={
            <Button variant="secondary" onClick={resetFilters}>
              Filters wissen
            </Button>
          }
        />
      )}
    </div>
  )
}
