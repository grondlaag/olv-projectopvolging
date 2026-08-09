import { useMemo, useState } from "react"
import { Link } from "react-router-dom"
import {
  buildBudgetPortfolioModel,
  defaultBudgetFilters,
  type BudgetFilters,
  type BudgetGrouping,
} from "../../application/queries"
import { useAppStore } from "../../app/state/app-store"
import { Button, EmptyState, PageHeader } from "../../design-system/components"
import {
  BUDGET_AGGREGATION_RULE_REQUIRED,
  budgetStatuses,
  formatEuroCents,
  projectStatuses,
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

export function BudgetPage() {
  const session = useAppStore((state) => state.session)
  const setImportPanelOpen = useAppStore((state) => state.setImportPanelOpen)
  const [filters, setFilters] = useState<BudgetFilters>(defaultBudgetFilters)
  const [grouping, setGrouping] = useState<BudgetGrouping>("project")
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
          title="Laad een projectworkbook"
          description="Budgetrecords worden volledig lokaal uit Excel gelezen."
          action={
            <Button onClick={() => setImportPanelOpen(true)}>
              Excelbestand laden
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
    setFilters((current) => {
      const next = { ...current }
      if (value === "") delete next[key]
      else next[key] = value as BudgetFilters[K]
      return next
    })
  }

  return (
    <div className="budget-page">
      <PageHeader
        eyebrow="Financieel portfolio"
        title="Budget"
        description={`Directe financiële feiten uit ${session.fileName}.`}
      />

      <section
        className="budget-portfolio-kpis"
        aria-label="Portfoliokerncijfers"
      >
        {["Totaal goedgekeurd", "Totale prognose", "Totale afwijking"].map(
          (label) => (
            <div key={label} title={BUDGET_AGGREGATION_RULE_REQUIRED}>
              <span>{label}</span>
              <strong>Regel vereist</strong>
            </div>
          ),
        )}
        <div>
          <span>Budgetitems</span>
          <strong>{model.portfolioSummary.recordCount}</strong>
        </div>
        <div>
          <span>Netto meer/minwerk</span>
          <strong>
            {formatEuroCents(model.portfolioSummary.changeOrderImpactCents)}
          </strong>
        </div>
      </section>

      <aside className="budget-rule-note">
        <strong>Geen schijnzekerheid in financiële KPI’s.</strong>
        <span>{BUDGET_AGGREGATION_RULE_REQUIRED}</span>
      </aside>

      <section className="budget-filter-bar" aria-label="Budgetfilters">
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
        <Button variant="tertiary" onClick={() => setFilters({})}>
          Filters wissen
        </Button>
      </section>

      <section className="budget-section">
        <div className="budget-section__heading">
          <div>
            <span>Directe ledgeranalyse</span>
            <h2>Groepering</h2>
          </div>
          <label className="budget-grouping">
            <span>Groepeer per</span>
            <select
              value={grouping}
              onChange={(event) =>
                setGrouping(event.target.value as BudgetGrouping)
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
      </section>

      <div className="budget-exceptions">
        <section>
          <h2>Projecten boven budget</h2>
          <p>{BUDGET_AGGREGATION_RULE_REQUIRED}</p>
        </section>
        <section>
          <h2>Grootste afwijkingen</h2>
          <p>{BUDGET_AGGREGATION_RULE_REQUIRED}</p>
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
    </div>
  )
}
