import { useMemo } from "react"
import { Link, useSearchParams } from "react-router-dom"
import {
  buildBudgetPortfolioModel,
  type BudgetFilters,
  type BudgetGrouping,
} from "../../application/queries"
import { useAppStore } from "../../app/state/app-store"
import {
  Button,
  Collapsible,
  EmptyState,
  FilterPanel,
  KpiStrip,
  PageHeader,
  SavedViewsControl,
} from "../../design-system/components"
import {
  BUDGET_AGGREGATION_RULE_REQUIRED,
  budgetStatuses,
  formatEuroCents,
  projectStatuses,
  type BudgetRecord,
  type BudgetType,
  type UUID,
} from "../../domain"
import "./budget.css"

const groupingOptions: readonly [BudgetGrouping, string][] = [
  ["project", "Project"],
  ["chapter", "Hoofdstuk"],
  ["cluster", "Cluster"],
  ["category", "Categorie"],
  ["type", "Type"],
]

const overviewTypes: readonly BudgetType[] = [
  "Goedgekeurd budget",
  "Raming",
  "Contract",
  "Factuur",
  "Betaling",
]

function factualTypeTotal(records: readonly BudgetRecord[], type: BudgetType) {
  return records
    .filter((record) => record.type === type && record.status !== "Geannuleerd")
    .reduce((total, record) => total + record.amountCents, 0)
}

function formatPortfolioAmount(amountCents: number) {
  return amountCents === 0 ? "—" : formatEuroCents(amountCents)
}

function FinancialTypeSummary({
  records,
}: {
  records: readonly BudgetRecord[]
}) {
  return (
    <dl className="budget-type-summary">
      {overviewTypes.map((type) => (
        <div key={type}>
          <dt>{type === "Goedgekeurd budget" ? "Budget" : type}</dt>
          <dd>{formatPortfolioAmount(factualTypeTotal(records, type))}</dd>
        </div>
      ))}
    </dl>
  )
}

export function BudgetPage() {
  const [searchParameters, setSearchParameters] = useSearchParams()
  const session = useAppStore((state) => state.session)
  const setImportPanelOpen = useAppStore((state) => state.setImportPanelOpen)
  const filters = useMemo<BudgetFilters>(() => {
    const projectStatus = searchParameters.get("projectstatus") ?? ""
    const budgetStatus = searchParameters.get("budgetstatus") ?? ""
    return {
      ...(searchParameters.get("hoofdstuk")
        ? { chapterId: searchParameters.get("hoofdstuk") as UUID }
        : {}),
      ...(searchParameters.get("cluster")
        ? { clusterId: searchParameters.get("cluster") as UUID }
        : {}),
      ...(searchParameters.get("project")
        ? { projectId: searchParameters.get("project") as UUID }
        : {}),
      ...((projectStatuses as readonly string[]).includes(projectStatus)
        ? {
            projectStatus: projectStatus as NonNullable<
              BudgetFilters["projectStatus"]
            >,
          }
        : {}),
      ...((budgetStatuses as readonly string[]).includes(budgetStatus)
        ? {
            budgetStatus: budgetStatus as NonNullable<
              BudgetFilters["budgetStatus"]
            >,
          }
        : {}),
      ...(searchParameters.get("categorie")
        ? { category: searchParameters.get("categorie")! }
        : {}),
    }
  }, [searchParameters])
  const requestedGrouping = searchParameters.get("groepering")
  const grouping: BudgetGrouping = groupingOptions.some(
    ([value]) => value === requestedGrouping,
  )
    ? (requestedGrouping as BudgetGrouping)
    : "type"
  const model = useMemo(
    () =>
      session
        ? buildBudgetPortfolioModel(session.state, filters, grouping)
        : undefined,
    [filters, grouping, session],
  )

  if (!session || !model) {
    return (
      <div className="budget-page">
        <PageHeader
          eyebrow="Financieel"
          title="Budget"
          description="Portfolio-overzicht van projectgebonden financiële feiten."
        />
        <EmptyState
          title="Open een projectgegevensbestand"
          description="Budgetrecords worden volledig lokaal uit het JSON-bestand gelezen."
          action={
            <Button onClick={() => setImportPanelOpen(true)}>
              JSON openen of nieuw starten
            </Button>
          }
        />
      </div>
    )
  }

  const updateFilter = <K extends keyof BudgetFilters>(
    key: K,
    value: BudgetFilters[K] | "",
  ) => {
    const parameters = new URLSearchParams(searchParameters)
    const keys: Record<keyof BudgetFilters, string> = {
      chapterId: "hoofdstuk",
      clusterId: "cluster",
      projectId: "project",
      projectStatus: "projectstatus",
      budgetStatus: "budgetstatus",
      category: "categorie",
    }
    if (value) parameters.set(keys[key], value)
    else parameters.delete(keys[key])
    setSearchParameters(parameters, { replace: true })
  }

  function resetFilters() {
    const parameters = new URLSearchParams(searchParameters)
    for (const key of [
      "hoofdstuk",
      "cluster",
      "project",
      "projectstatus",
      "budgetstatus",
      "categorie",
    ])
      parameters.delete(key)
    setSearchParameters(parameters, { replace: true })
  }

  function selectGrouping(value: BudgetGrouping) {
    const parameters = new URLSearchParams(searchParameters)
    if (value === "type") parameters.delete("groepering")
    else parameters.set("groepering", value)
    setSearchParameters(parameters, { replace: true })
  }

  const allPortfolioRecords = session.state.records.budgets.filter(
    (record) => record.audit.active,
  )
  const activeFilters = [
    ...(filters.chapterId
      ? [
          {
            id: "chapter",
            label: `Hoofdstuk: ${session.state.indices.chapterById.get(filters.chapterId)?.title ?? "Onbekend"}`,
            onRemove: () => updateFilter("chapterId", ""),
          },
        ]
      : []),
    ...(filters.clusterId
      ? [
          {
            id: "cluster",
            label: `Cluster: ${session.state.indices.clusterById.get(filters.clusterId)?.title ?? "Onbekend"}`,
            onRemove: () => updateFilter("clusterId", ""),
          },
        ]
      : []),
    ...(filters.projectId
      ? [
          {
            id: "project",
            label: `Project: ${session.state.indices.projectById.get(filters.projectId)?.code ?? "Onbekend"}`,
            onRemove: () => updateFilter("projectId", ""),
          },
        ]
      : []),
    ...(filters.projectStatus
      ? [
          {
            id: "project-status",
            label: `Projectstatus: ${filters.projectStatus}`,
            onRemove: () => updateFilter("projectStatus", ""),
          },
        ]
      : []),
    ...(filters.budgetStatus
      ? [
          {
            id: "budget-status",
            label: `Budgetstatus: ${filters.budgetStatus}`,
            onRemove: () => updateFilter("budgetStatus", ""),
          },
        ]
      : []),
    ...(filters.category
      ? [
          {
            id: "category",
            label: `Categorie: ${filters.category}`,
            onRemove: () => updateFilter("category", ""),
          },
        ]
      : []),
  ]

  return (
    <div className="budget-page">
      <PageHeader
        eyebrow="Financieel portfolio"
        title="Budget"
        description={`Directe financiële feiten uit ${session.fileName}.`}
      />

      <KpiStrip
        className="budget-portfolio-kpis"
        ariaLabel="Financiële portefeuilletotalen"
        items={overviewTypes.map((type) => ({
          id: type,
          label: type === "Goedgekeurd budget" ? "Budget" : type,
          value: formatPortfolioAmount(
            factualTypeTotal(allPortfolioRecords, type),
          ),
          supportingText: "alle projecten",
        }))}
      />

      <FilterPanel
        className="budget-filter-bar"
        activeFilters={activeFilters}
        onClear={resetFilters}
        actions={<SavedViewsControl page="budget" />}
      >
        <label>
          <span>Hoofdstuk</span>
          <select
            value={filters.chapterId ?? ""}
            onChange={(event) =>
              updateFilter("chapterId", event.target.value as UUID | "")
            }
          >
            <option value="">Alle hoofdstukken</option>
            {session.state.records.chapters.map((chapter) => (
              <option key={chapter.id} value={chapter.id}>
                {chapter.title}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>Cluster</span>
          <select
            value={filters.clusterId ?? ""}
            onChange={(event) =>
              updateFilter("clusterId", event.target.value as UUID | "")
            }
          >
            <option value="">Alle clusters</option>
            {session.state.records.clusters
              .filter(
                (cluster) =>
                  !filters.chapterId || cluster.chapterId === filters.chapterId,
              )
              .map((cluster) => (
                <option key={cluster.id} value={cluster.id}>
                  {cluster.title}
                </option>
              ))}
          </select>
        </label>
        <label>
          <span>Project</span>
          <select
            aria-label="Projectfilter"
            value={filters.projectId ?? ""}
            onChange={(event) =>
              updateFilter("projectId", event.target.value as UUID | "")
            }
          >
            <option value="">Alle projecten</option>
            {session.state.records.projects.map((project) => (
              <option key={project.id} value={project.id}>
                {project.code} · {project.title}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>Projectstatus</span>
          <select
            value={filters.projectStatus ?? ""}
            onChange={(event) =>
              updateFilter(
                "projectStatus",
                event.target.value as BudgetFilters["projectStatus"] | "",
              )
            }
          >
            <option value="">Alle statussen</option>
            {projectStatuses.map((status) => (
              <option key={status}>{status}</option>
            ))}
          </select>
        </label>
        <label>
          <span>Budgetstatus</span>
          <select
            value={filters.budgetStatus ?? ""}
            onChange={(event) =>
              updateFilter(
                "budgetStatus",
                event.target.value as BudgetFilters["budgetStatus"] | "",
              )
            }
          >
            <option value="">Alle statussen</option>
            {budgetStatuses.map((status) => (
              <option key={status}>{status}</option>
            ))}
          </select>
        </label>
        <label>
          <span>Categorie</span>
          <select
            value={filters.category ?? ""}
            onChange={(event) => updateFilter("category", event.target.value)}
          >
            <option value="">Alle categorieën</option>
            {model.categories.map((category) => (
              <option key={category}>{category}</option>
            ))}
          </select>
        </label>
      </FilterPanel>

      <Collapsible
        className="budget-rule-note"
        title="Over deze totalen"
        summary="Niet-geannuleerde bedragen per exact feitstype"
      >
        <p title={BUDGET_AGGREGATION_RULE_REQUIRED}>
          Budget, raming, contract, factuur en betaling zijn rechtstreekse
          typesommen. Prognose, resterend budget en afwijking blijven bewust
          onberekend tot hun businessregel is beslist.
        </p>
      </Collapsible>

      <section className="budget-section">
        <div className="budget-section__heading">
          <div>
            <span>Hoofdstuk → cluster → project</span>
            <h2>Financiële portefeuille</h2>
          </div>
          <strong>{model.projectRows.length} projecten</strong>
        </div>
        <div className="budget-portfolio-tree">
          {session.state.records.chapters
            .map((chapter) => ({
              chapter,
              rows: model.projectRows.filter(
                (row) => row.project.chapterId === chapter.id,
              ),
            }))
            .filter((group) => group.rows.length)
            .map(({ chapter, rows }) => {
              const chapterRecords = rows.flatMap((row) => row.records)
              return (
                <Collapsible
                  key={chapter.id}
                  className="budget-chapter"
                  title={`${chapter.code} · ${chapter.title}`}
                  summary={
                    <span className="budget-tree-summary">
                      <span>{rows.length} projecten</span>
                      <FinancialTypeSummary records={chapterRecords} />
                    </span>
                  }
                >
                  {[
                    ...new Set(
                      rows.map((row) => row.cluster?.id ?? "without-cluster"),
                    ),
                  ].map((clusterId) => {
                    const clusterRows = rows.filter(
                      (row) =>
                        (row.cluster?.id ?? "without-cluster") === clusterId,
                    )
                    const clusterLabel =
                      clusterRows[0]?.cluster?.title ?? "Zonder cluster"
                    const clusterRecords = clusterRows.flatMap(
                      (row) => row.records,
                    )
                    return (
                      <Collapsible
                        key={clusterId}
                        className="budget-cluster"
                        title={clusterLabel}
                        summary={
                          <span className="budget-tree-summary">
                            <span>{clusterRows.length} projecten</span>
                            <FinancialTypeSummary records={clusterRecords} />
                          </span>
                        }
                      >
                        <div className="budget-table-wrap">
                          <table className="budget-table budget-table--portfolio">
                            <thead>
                              <tr>
                                <th>Project</th>
                                {overviewTypes.map((type) => (
                                  <th key={type}>
                                    {type === "Goedgekeurd budget"
                                      ? "Budget"
                                      : type}
                                  </th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {clusterRows.map((row) => (
                                <tr key={row.project.id}>
                                  <td>
                                    <Link
                                      to={`/projects/${row.project.id}/budget`}
                                    >
                                      <strong>{row.project.code}</strong> ·{" "}
                                      {row.project.title}
                                    </Link>
                                  </td>
                                  {overviewTypes.map((type) => (
                                    <td
                                      className="budget-table__amount"
                                      key={type}
                                    >
                                      {formatPortfolioAmount(
                                        factualTypeTotal(row.records, type),
                                      )}
                                    </td>
                                  ))}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </Collapsible>
                    )
                  })}
                </Collapsible>
              )
            })}
        </div>
      </section>

      <Collapsible
        className="budget-section budget-analysis"
        eyebrow="Verdiepende ledgeranalyse"
        title="Andere groepering"
        summary={`${model.groups.length} groepen`}
      >
        <div className="budget-analysis__toolbar">
          <label className="budget-grouping">
            <span>Groepeer per</span>
            <select
              value={grouping}
              onChange={(event) =>
                selectGrouping(event.target.value as BudgetGrouping)
              }
            >
              {groupingOptions.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
        </div>
        {model.groups.length ? (
          <div className="budget-table-wrap">
            <table className="budget-table budget-table--groups">
              <thead>
                <tr>
                  <th>Groep</th>
                  <th>Records</th>
                  <th>Meerwerk</th>
                  <th>Minwerk</th>
                  <th>Netto meer/min</th>
                  <th>Types aanwezig</th>
                </tr>
              </thead>
              <tbody>
                {model.groups.map((group) => (
                  <tr key={group.key}>
                    <td>
                      {grouping === "project" ? (
                        <Link to={`/projects/${group.key}/budget`}>
                          {group.label}
                        </Link>
                      ) : (
                        <strong>{group.label}</strong>
                      )}
                    </td>
                    <td>{group.summary.recordCount}</td>
                    <td>{formatEuroCents(group.summary.moreWorkCents)}</td>
                    <td>− {formatEuroCents(group.summary.lessWorkCents)}</td>
                    <td>
                      {formatEuroCents(group.summary.changeOrderImpactCents)}
                    </td>
                    <td className="budget-table__types">
                      {[...group.summary.typeTotals.values()]
                        .filter((total) => total.recordCount)
                        .map((total) => total.type)
                        .join(" · ")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState
            title="Geen budgetitems binnen deze selectie"
            description="Pas de filters aan of voeg een budgetitem toe vanuit een project."
          />
        )}
      </Collapsible>

      <Collapsible
        className="budget-exceptions"
        eyebrow="Financiële signalen"
        title="Uitzonderingen"
        summary={`${model.projectsWithoutEstimateRecord.length} zonder ramingrecord`}
      >
        <div className="budget-exceptions__content">
          <section>
            <h2>Projecten boven budget</h2>
            <p>Nog niet beschikbaar zolang de prognoseregel niet is beslist.</p>
          </section>
          <section>
            <h2>Grootste afwijkingen</h2>
            <p>
              Nog niet beschikbaar zolang de afwijkingsregel niet is beslist.
            </p>
          </section>
          <section>
            <h2>Projecten zonder niet-geannuleerd ramingrecord</h2>
            {model.projectsWithoutEstimateRecord.length ? (
              <ul>
                {model.projectsWithoutEstimateRecord
                  .slice(0, 10)
                  .map((project) => (
                    <li key={project.id}>
                      <Link to={`/projects/${project.id}/budget`}>
                        {project.code} · {project.title}
                      </Link>
                    </li>
                  ))}
              </ul>
            ) : (
              <p>Elk geselecteerd project heeft minstens één ramingrecord.</p>
            )}
          </section>
        </div>
      </Collapsible>
    </div>
  )
}
