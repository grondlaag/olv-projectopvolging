import { useDeferredValue, useEffect, useMemo, useState } from "react"
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
    <label className="portfolio-filter">
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
  const [filtersOpen, setFiltersOpen] = useState(false)

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
    <div className="portfolio-page">
      <PageHeader
        eyebrow="Projectstructuur"
        title="Portfolio"
        description="Hoofdstuk → cluster → project. Klik één keer op een projectregel om het dossier te openen."
        actions={
          <div className="portfolio-page__actions">
            <span className="portfolio-page__result-count">
              <strong>{filteredRows.length}</strong> van {rows.length} projecten
            </span>
            <Button onClick={() => navigate("/projects/new")}>
              + Nieuw project
            </Button>
          </div>
        }
      />

      <section className="portfolio-filters" aria-label="Portfoliofilters">
        <div className="portfolio-presets" aria-label="Snelle selecties">
          <span>Snelle selecties</span>
          <button
            type="button"
            disabled={!currentActorId}
            onClick={() =>
              updateFilters({
                ...defaultPortfolioFilters,
                coordinatorActorId: currentActorId ?? "",
              })
            }
          >
            Mijn projecten
          </button>
          <button
            type="button"
            onClick={() =>
              updateFilters({
                ...defaultPortfolioFilters,
                clusterId: "without-cluster",
              })
            }
          >
            Zonder cluster
          </button>
          <button
            type="button"
            onClick={() => updateFilters(defaultPortfolioFilters)}
          >
            Alle open projecten
          </button>
        </div>
        <div className="portfolio-filters__primary">
          <label className="portfolio-filter portfolio-filter--search">
            <span>Zoekterm</span>
            <input
              type="search"
              value={filters.search}
              placeholder="Code, titel, site of coördinator"
              onChange={(event) =>
                updateFilters({ search: event.target.value })
              }
            />
          </label>
          <fieldset className="portfolio-scope">
            <legend>Projecten</legend>
            {(
              [
                ["open", "Open"],
                ["closed", "Gesloten"],
                ["all", "Alles"],
              ] as const
            ).map(([value, label]) => (
              <label key={value}>
                <input
                  type="radio"
                  name="portfolio-scope"
                  value={value}
                  checked={filters.scope === value}
                  onChange={() => updateFilters({ scope: value })}
                />
                <span>{label}</span>
              </label>
            ))}
          </fieldset>
          <Button
            variant="secondary"
            aria-expanded={filtersOpen}
            onClick={() => setFiltersOpen((open) => !open)}
          >
            Filters
            {activeFilterEntries.length
              ? " (" + activeFilterEntries.length + ")"
              : ""}
          </Button>
          {filters.search ||
          filters.scope !== defaultPortfolioFilters.scope ||
          activeFilterEntries.length ? (
            <Button
              variant="tertiary"
              onClick={() => updateFilters(defaultPortfolioFilters)}
            >
              Wissen
            </Button>
          ) : null}
        </div>

        {activeFilterEntries.length ? (
          <div className="portfolio-filter-chips" aria-label="Actieve filters">
            {activeFilterEntries.map((entry) => (
              <button
                type="button"
                key={entry.key}
                onClick={() => updateFilters({ [entry.key]: "" })}
                aria-label={entry.label + " verwijderen"}
              >
                {entry.label} <span aria-hidden="true">×</span>
              </button>
            ))}
          </div>
        ) : null}

        {filtersOpen ? (
          <div className="portfolio-filters__grid">
            <FilterSelect
              label="Hoofdstuk"
              value={filters.chapterId}
              options={filterOptions.chapters.map((item) => ({
                value: item.id,
                label: item.title,
              }))}
              onChange={(chapterId) =>
                updateFilters({ chapterId, clusterId: "" })
              }
            />
            <FilterSelect
              label="Cluster"
              value={filters.clusterId}
              options={[
                { value: "without-cluster", label: "Zonder cluster" },
                ...filterOptions.clusters
                  .filter(
                    (item) =>
                      !filters.chapterId ||
                      item.chapterId === filters.chapterId,
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
          </div>
        ) : null}
      </section>

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
            <section
              className="portfolio-chapter"
              key={chapterGroup.chapter.id}
              aria-labelledby={`chapter-${chapterGroup.chapter.id}`}
            >
              <header>
                <span>{chapterGroup.chapter.code}</span>
                <h2 id={`chapter-${chapterGroup.chapter.id}`}>
                  {chapterGroup.chapter.title}
                </h2>
              </header>
              {chapterGroup.clusters.map((clusterGroup) => (
                <div className="portfolio-cluster" key={clusterGroup.id}>
                  <div className="portfolio-cluster__heading">
                    <h3>{clusterGroup.title}</h3>
                    {clusterGroup.cluster ? (
                      <Button
                        variant="tertiary"
                        onClick={() =>
                          navigate(`/clusters/${clusterGroup.cluster!.id}`)
                        }
                        aria-label={`${clusterGroup.title} clustertopics openen`}
                      >
                        Clustertopics
                      </Button>
                    ) : null}
                  </div>
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
                </div>
              ))}
            </section>
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
