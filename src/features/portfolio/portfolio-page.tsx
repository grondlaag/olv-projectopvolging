import { useDeferredValue, useEffect, useMemo } from "react"
import { useNavigate, useSearchParams } from "react-router-dom"
import {
  buildPortfolioRows,
  defaultPortfolioFilters,
  filterPortfolioRows,
  getPortfolioFilterOptions,
  groupPortfolioRows,
  type PortfolioFilters,
  type PortfolioScope,
} from "../../application/queries"
import { useAppStore } from "../../app/state/app-store"
import {
  Badge,
  Button,
  EmptyState,
  FilterPanel,
  KpiStrip,
  PageHeader,
} from "../../design-system/components"
import type { UUID } from "../../domain"
import { formatLocalDate, todayAsLocalDate } from "../../utils"
import "./portfolio-page.css"

const parameterNames: Record<keyof PortfolioFilters, string> = {
  search: "zoek",
  scope: "weergave",
  chapterId: "hoofdstuk",
  clusterId: "cluster",
  status: "status",
  phase: "fase",
  site: "site",
  location: "locatie",
  department: "afdeling",
  coordinatorActorId: "coordinator",
}

function scope(value: string | null): PortfolioScope {
  return value === "closed" || value === "all" ? value : "open"
}

function filtersFromParameters(parameters: URLSearchParams): PortfolioFilters {
  return {
    search: parameters.get(parameterNames.search) ?? "",
    scope: scope(parameters.get(parameterNames.scope)),
    chapterId: parameters.get(parameterNames.chapterId) ?? "",
    clusterId: parameters.get(parameterNames.clusterId) ?? "",
    status: parameters.get(parameterNames.status) ?? "",
    phase: parameters.get(parameterNames.phase) ?? "",
    site: parameters.get(parameterNames.site) ?? "",
    location: parameters.get(parameterNames.location) ?? "",
    department: parameters.get(parameterNames.department) ?? "",
    coordinatorActorId: parameters.get(parameterNames.coordinatorActorId) ?? "",
  }
}

function parametersFromFilters(filters: PortfolioFilters): URLSearchParams {
  const parameters = new URLSearchParams()
  for (const [key, parameterName] of Object.entries(parameterNames) as [
    keyof PortfolioFilters,
    string,
  ][]) {
    const value = filters[key]
    if (!value || value === defaultPortfolioFilters[key]) continue
    parameters.set(parameterName, value)
  }
  return parameters
}

interface FilterSelectProps {
  label: string
  value: string
  options: readonly { value: string; label: string }[]
  onChange: (value: string) => void
}

function FilterSelect({ label, value, options, onChange }: FilterSelectProps) {
  return (
    <label>
      <span>{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)}>
        <option value="">Alle</option>
        {options.map((option) => (
          <option value={option.value} key={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  )
}

export function PortfolioPage() {
  const navigate = useNavigate()
  const session = useAppStore((state) => state.session)
  const filters = useAppStore((state) => state.portfolioFilters)
  const setFilters = useAppStore((state) => state.setPortfolioFilters)
  const setImportPanelOpen = useAppStore((state) => state.setImportPanelOpen)
  const [searchParameters, setSearchParameters] = useSearchParams()
  const parameterString = searchParameters.toString()
  useEffect(() => {
    setFilters(filtersFromParameters(new URLSearchParams(parameterString)))
  }, [parameterString, setFilters])

  const rows = useMemo(
    () =>
      session ? buildPortfolioRows(session.state, todayAsLocalDate()) : [],
    [session],
  )
  const filterOptions = useMemo(() => getPortfolioFilterOptions(rows), [rows])
  const deferredSearch = useDeferredValue(filters.search)
  const filteredRows = useMemo(
    () => filterPortfolioRows(rows, { ...filters, search: deferredSearch }),
    [deferredSearch, filters, rows],
  )
  const groups = useMemo(() => groupPortfolioRows(filteredRows), [filteredRows])
  const currentActorId = session?.state.records.config[0]?.currentActorId
  const activeFilterEntries = useMemo(() => {
    if (!session) return []
    const labels: Partial<Record<keyof PortfolioFilters, string | undefined>> =
      {
        chapterId: session.state.indices.chapterById.get(
          filters.chapterId as UUID,
        )?.title,
        clusterId:
          filters.clusterId === "without-cluster"
            ? "Zonder cluster"
            : session.state.indices.clusterById.get(filters.clusterId as UUID)
                ?.title,
        status: filters.status,
        phase: filters.phase,
        site: filters.site,
        location: filters.location,
        department: filters.department,
        coordinatorActorId: session.state.indices.actorById.get(
          filters.coordinatorActorId as UUID,
        )?.displayName,
      }
    return (
      [
        "chapterId",
        "clusterId",
        "status",
        "phase",
        "site",
        "location",
        "department",
        "coordinatorActorId",
      ] as const
    ).flatMap((key) =>
      filters[key] ? [{ key, label: labels[key] ?? filters[key] }] : [],
    )
  }, [filters, session])

  function updateFilters(patch: Partial<PortfolioFilters>) {
    const next = { ...filters, ...patch }
    setFilters(next)
    setSearchParameters(parametersFromFilters(next), { replace: true })
  }

  const activeFilters = [
    ...(filters.search
      ? [
          {
            id: "search",
            label: `Zoeken: ${filters.search}`,
            onRemove: () => updateFilters({ search: "" }),
          },
        ]
      : []),
    ...(filters.scope !== defaultPortfolioFilters.scope
      ? [
          {
            id: "scope",
            label: `Projecten: ${filters.scope === "closed" ? "Gesloten" : "Alles"}`,
            onRemove: () =>
              updateFilters({ scope: defaultPortfolioFilters.scope }),
          },
        ]
      : []),
    ...activeFilterEntries.map((entry) => ({
      id: entry.key,
      label: entry.label,
      onRemove: () => updateFilters({ [entry.key]: "" }),
    })),
  ]

  if (!session) {
    return (
      <div className="portfolio-page">
        <PageHeader
          eyebrow="Projectstructuur"
          title="Portfolio"
          description="Hoofdstukken, clusters en projecten in één scanbare structuur."
        />
        <div className="portfolio-page__empty">
          <EmptyState
            title="Nog geen portfolio geladen"
            description="Open een bestaand JSON-bestand of start een nieuwe gegevensset."
            action={
              <Button onClick={() => setImportPanelOpen(true)}>
                JSON openen of nieuw starten
              </Button>
            }
          />
        </div>
      </div>
    )
  }

  return (
    <div className="portfolio-page workspace-page">
      <PageHeader
        eyebrow="Projectstructuur"
        title="Portfolio"
        description="Hoofdstuk → cluster → project. Klik één keer op een projectregel om het dossier te openen."
        actions={
          <div className="portfolio-page__actions">
            <Button onClick={() => navigate("/projects/new")}>
              + Nieuw project
            </Button>
          </div>
        }
      />

      <KpiStrip
        ariaLabel="Portfolio-overzicht"
        items={[
          {
            id: "visible",
            label: "Zichtbare projecten",
            value: filteredRows.length,
            supportingText: `van ${rows.length} projecten`,
          },
          {
            id: "chapters",
            label: "Hoofdstukken",
            value: session.state.records.chapters.filter(
              (chapter) => chapter.audit.active,
            ).length,
            supportingText: "in de portefeuille",
          },
          {
            id: "clusters",
            label: "Clusters",
            value: session.state.records.clusters.filter(
              (cluster) => cluster.audit.active,
            ).length,
            supportingText: "actieve structuur",
          },
          {
            id: "selection",
            label: "Actieve filters",
            value: activeFilters.length,
            supportingText: activeFilters.length
              ? "selectie toegepast"
              : "volledige selectie",
          },
        ]}
      />

      <FilterPanel
        activeFilters={activeFilters}
        onClear={() => updateFilters(defaultPortfolioFilters)}
        actions={
          <div className="filter-panel__presets" aria-label="Snelle selecties">
            <span>Snelle selecties</span>
            <Button
              variant="tertiary"
              disabled={!currentActorId}
              onClick={() =>
                updateFilters({
                  ...defaultPortfolioFilters,
                  coordinatorActorId: currentActorId ?? "",
                })
              }
            >
              Mijn projecten
            </Button>
            <Button
              variant="tertiary"
              onClick={() =>
                updateFilters({
                  ...defaultPortfolioFilters,
                  clusterId: "without-cluster",
                })
              }
            >
              Zonder cluster
            </Button>
            <Button
              variant="tertiary"
              onClick={() => updateFilters(defaultPortfolioFilters)}
            >
              Alle open projecten
            </Button>
          </div>
        }
      >
        <label>
          <span>Zoekterm</span>
          <input
            type="search"
            value={filters.search}
            placeholder="Code, titel, site of coördinator"
            onChange={(event) => updateFilters({ search: event.target.value })}
          />
        </label>
        <label>
          <span>Projecten</span>
          <select
            value={filters.scope}
            onChange={(event) =>
              updateFilters({ scope: event.target.value as PortfolioScope })
            }
          >
            <option value="open">Open</option>
            <option value="closed">Gesloten</option>
            <option value="all">Alles</option>
          </select>
        </label>
        <FilterSelect
          label="Hoofdstuk"
          value={filters.chapterId}
          options={filterOptions.chapters.map((item) => ({
            value: item.id,
            label: item.title,
          }))}
          onChange={(chapterId) => updateFilters({ chapterId, clusterId: "" })}
        />
        <FilterSelect
          label="Cluster"
          value={filters.clusterId}
          options={[
            { value: "without-cluster", label: "Zonder cluster" },
            ...filterOptions.clusters
              .filter(
                (item) =>
                  !filters.chapterId || item.chapterId === filters.chapterId,
              )
              .map((item) => ({ value: item.id, label: item.title })),
          ]}
          onChange={(clusterId) => updateFilters({ clusterId })}
        />
        <FilterSelect
          label="Status"
          value={filters.status}
          options={filterOptions.statuses.map((value) => ({
            value,
            label: value,
          }))}
          onChange={(status) => updateFilters({ status })}
        />
        <FilterSelect
          label="Fase"
          value={filters.phase}
          options={filterOptions.phases.map((value) => ({
            value,
            label: value,
          }))}
          onChange={(phase) => updateFilters({ phase })}
        />
        <FilterSelect
          label="Site"
          value={filters.site}
          options={filterOptions.sites.map((value) => ({
            value,
            label: value,
          }))}
          onChange={(site) => updateFilters({ site })}
        />
        <FilterSelect
          label="Locatie"
          value={filters.location}
          options={filterOptions.locations.map((value) => ({
            value,
            label: value,
          }))}
          onChange={(location) => updateFilters({ location })}
        />
        <FilterSelect
          label="Afdeling"
          value={filters.department}
          options={filterOptions.departments.map((value) => ({
            value,
            label: value,
          }))}
          onChange={(department) => updateFilters({ department })}
        />
        <FilterSelect
          label="Projectcoördinator"
          value={filters.coordinatorActorId}
          options={filterOptions.coordinators.map((item) => ({
            value: item.id,
            label: item.displayName,
          }))}
          onChange={(coordinatorActorId) =>
            updateFilters({ coordinatorActorId })
          }
        />
      </FilterPanel>

      {groups.length ? (
        <div className="portfolio-tree">
          <div
            className="portfolio-row portfolio-row--header"
            aria-hidden="true"
          >
            <span>Project</span>
            <span>Status / fase</span>
            <span>Coördinator</span>
            <span>Site</span>
            <span>Einddatum</span>
            <span>Voortgang</span>
            <span>Topics</span>
            <span>Acties</span>
            <span>Te laat</span>
          </div>
          {groups.map((chapterGroup) => (
            <details
              className="portfolio-chapter"
              key={chapterGroup.chapter.id}
              open
            >
              <summary>
                <span className="portfolio-disclosure" aria-hidden="true" />
                <span>{chapterGroup.chapter.code}</span>
                <h2 id={`chapter-${chapterGroup.chapter.id}`}>
                  {chapterGroup.chapter.title}
                </h2>
                <small>
                  {chapterGroup.clusters.reduce(
                    (total, cluster) => total + cluster.projects.length,
                    0,
                  )}{" "}
                  projecten
                </small>
              </summary>
              {chapterGroup.clusters.map((clusterGroup) => (
                <details
                  className="portfolio-cluster"
                  key={clusterGroup.id}
                  open
                >
                  <summary className="portfolio-cluster__heading">
                    <span className="portfolio-disclosure" aria-hidden="true" />
                    <h3>{clusterGroup.title}</h3>
                    <small>{clusterGroup.projects.length} projecten</small>
                    {clusterGroup.cluster ? (
                      <Button
                        variant="tertiary"
                        onClick={(event) => {
                          event.preventDefault()
                          event.stopPropagation()
                          navigate(`/clusters/${clusterGroup.cluster!.id}`)
                        }}
                        aria-label={`${clusterGroup.title} clustertopics openen`}
                      >
                        Clustertopics
                      </Button>
                    ) : null}
                  </summary>
                  <div className="portfolio-cluster__projects">
                    {clusterGroup.projects.map((row) => (
                      <button
                        className="portfolio-row portfolio-row--project"
                        key={row.project.id}
                        onClick={() => navigate(`/projects/${row.project.id}`)}
                        aria-label={`${row.project.code} ${row.project.title} openen`}
                      >
                        <span className="portfolio-project-name">
                          <strong>{row.project.code}</strong>
                          <span>{row.project.title}</span>
                        </span>
                        <span className="portfolio-status">
                          <Badge
                            tone={
                              row.project.status === "Afgesloten"
                                ? "success"
                                : row.project.status === "Geannuleerd"
                                  ? "danger"
                                  : "info"
                            }
                          >
                            {row.project.status}
                          </Badge>
                          <small>{row.project.phase}</small>
                        </span>
                        <span>{row.coordinator?.displayName ?? "—"}</span>
                        <span>{row.project.site ?? "—"}</span>
                        <span>
                          {formatLocalDate(row.project.plannedEndDate)}
                        </span>
                        <span className="portfolio-progress">
                          <progress
                            max="100"
                            value={row.project.progressPercent ?? 0}
                          />
                          <small>{row.project.progressPercent ?? 0}%</small>
                        </span>
                        <span>{row.openTopicCount}</span>
                        <span>{row.openActionCount}</span>
                        <span
                          className={
                            row.overdueActionCount
                              ? "portfolio-count--attention"
                              : undefined
                          }
                        >
                          {row.overdueActionCount}
                        </span>
                      </button>
                    ))}
                  </div>
                </details>
              ))}
            </details>
          ))}
        </div>
      ) : (
        <EmptyState
          title="Geen projecten binnen deze selectie"
          description="Pas de zoekterm of filters aan om projecten zichtbaar te maken."
          action={
            <Button
              variant="secondary"
              onClick={() => updateFilters(defaultPortfolioFilters)}
            >
              Filters wissen
            </Button>
          }
        />
      )}
    </div>
  )
}
