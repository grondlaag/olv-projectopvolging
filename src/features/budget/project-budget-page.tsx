import { useMemo, useState } from "react"
import { useParams, useSearchParams } from "react-router-dom"
import { buildProjectBudgetModel } from "../../application/queries"
import {
  BudgetManagementError,
  BudgetManagementService,
} from "../../application/services"
import { useAppStore } from "../../app/state/app-store"
import {
  Badge,
  Button,
  EmptyState,
  ErrorState,
} from "../../design-system/components"
import {
  BUDGET_AGGREGATION_RULE_REQUIRED,
  budgetTypes,
  formatEuroCents,
  type BudgetRecord,
  type UUID,
} from "../../domain"
import { formatLocalDate } from "../../utils"
import { ProjectDossierHeader } from "../projects/project-dossier-header"
import { BudgetCorrectionPanel, NewBudgetPanel } from "./budget-panel"
import "./budget.css"

const metricLabels = [
  "Goedgekeurd",
  "Actuele raming",
  "Vastgelegd",
  "Gefactureerd",
  "Betaald",
  "Prognose",
  "Resterend",
  "Afwijking",
] as const
const budgetService = new BudgetManagementService()

function BudgetBusinessMetricStrip() {
  return (
    <section className="budget-metrics" aria-label="Financiële kerncijfers">
      {metricLabels.map((label) => (
        <div key={label} title={BUDGET_AGGREGATION_RULE_REQUIRED}>
          <span>{label}</span>
          <strong>—</strong>
        </div>
      ))}
    </section>
  )
}

interface BudgetTableProps {
  records: readonly BudgetRecord[]
  onCorrect: (recordId: UUID) => void
  onArchive: (recordId: UUID) => void
}

function BudgetTable({ records, onCorrect, onArchive }: BudgetTableProps) {
  const session = useAppStore((state) => state.session)!
  if (!records.length) {
    return (
      <EmptyState
        title="Geen budgetitems"
        description="Voeg een financieel feit toe binnen deze projectcontext."
      />
    )
  }
  return (
    <div className="budget-table-wrap">
      <table className="budget-table">
        <thead>
          <tr>
            <th>Datum</th>
            <th>Type</th>
            <th>Categorie</th>
            <th>Omschrijving</th>
            <th>Topic</th>
            <th>Leverancier</th>
            <th>Status</th>
            <th>Bedrag</th>
            <th>Referentie</th>
            <th>Acties</th>
          </tr>
        </thead>
        <tbody>
          {records.map((record) => {
            const topic = record.topicId
              ? session.state.indices.topicById.get(record.topicId)
              : undefined
            const supplier = record.supplierActorId
              ? session.state.indices.actorById.get(record.supplierActorId)
              : undefined
            const mutations =
              session.state.indices.budgetMutationsByBudgetRecord.get(
                record.id,
              ) ?? []
            return (
              <tr key={record.id}>
                <td>{formatLocalDate(record.date)}</td>
                <td>{record.type}</td>
                <td>{record.category}</td>
                <td>
                  <strong>{record.description}</strong>
                </td>
                <td>{topic ? `${topic.code} · ${topic.title}` : "—"}</td>
                <td>{supplier?.displayName ?? "—"}</td>
                <td>
                  <Badge
                    tone={
                      record.status === "Geannuleerd"
                        ? "danger"
                        : record.status === "Betaald"
                          ? "success"
                          : "neutral"
                    }
                  >
                    {record.status}
                  </Badge>
                </td>
                <td className="budget-table__amount">
                  {record.type === "Minwerk" ? "− " : ""}
                  {formatEuroCents(record.amountCents)}
                </td>
                <td>{record.reference ?? "—"}</td>
                <td>
                  <Button
                    variant="tertiary"
                    onClick={() => onCorrect(record.id)}
                  >
                    Corrigeren{mutations.length ? ` (${mutations.length})` : ""}
                  </Button>
                  <Button
                    variant="tertiary"
                    onClick={() => onArchive(record.id)}
                  >
                    Verwijderen
                  </Button>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

export function ProjectBudgetPage() {
  const { projectId } = useParams<{ projectId: string }>()
  const [searchParameters, setSearchParameters] = useSearchParams()
  const session = useAppStore((state) => state.session)
  const setImportPanelOpen = useAppStore((state) => state.setImportPanelOpen)
  const [panel, setPanel] = useState<"new" | UUID | undefined>()
  const [statusMessage, setStatusMessage] = useState<string>()
  const topicId = searchParameters.get("topicId") as UUID | null
  const model = useMemo(
    () =>
      session && projectId
        ? buildProjectBudgetModel(
            session.state,
            projectId as UUID,
            topicId ?? undefined,
          )
        : undefined,
    [projectId, session, topicId],
  )

  if (!session) {
    return (
      <EmptyState
        title="Budget kan nog niet worden geopend"
        description="Open eerst het bijbehorende JSON-gegevensbestand."
        action={
          <Button onClick={() => setImportPanelOpen(true)}>
            JSON openen of nieuw starten
          </Button>
        }
      />
    )
  }
  if (!model) {
    return (
      <ErrorState
        title="Project niet gevonden"
        description="Dit project-ID bestaat niet in de geopende gegevensset."
      />
    )
  }
  const selectedTopic = topicId
    ? session.state.indices.topicById.get(topicId)
    : undefined

  return (
    <article className="project-budget-page">
      <ProjectDossierHeader
        project={model.project}
        activeTab="budget"
        primaryAction={
          <Button onClick={() => setPanel("new")}>+ Budgetitem</Button>
        }
      />

      {statusMessage ? (
        <p className="budget-status-message" role="status">
          {statusMessage}
        </p>
      ) : null}

      {selectedTopic ? (
        <div className="budget-topic-filter">
          <span>
            Alleen budgetitems van <strong>{selectedTopic.title}</strong>
          </span>
          <Button
            variant="tertiary"
            onClick={() => {
              searchParameters.delete("topicId")
              setSearchParameters(searchParameters)
            }}
          >
            Toon volledig projectbudget
          </Button>
        </div>
      ) : null}

      <BudgetBusinessMetricStrip />
      <aside className="budget-rule-note">
        <strong>Kerncijfers wachten op een besliste rekenregel.</strong>
        <span>
          De feitelijke budgetregels hieronder blijven volledig zichtbaar en
          worden niet tot een onbetrouwbare prognose samengevoegd.
        </span>
      </aside>

      <section
        className="budget-ledger-facts"
        aria-label="Directe budgetfeiten"
      >
        <div>
          <strong>{model.summary.recordCount}</strong>
          <span>Budgetitems</span>
        </div>
        <div>
          <strong>{formatEuroCents(model.summary.moreWorkCents)}</strong>
          <span>Meerwerk · niet geannuleerd</span>
        </div>
        <div>
          <strong>− {formatEuroCents(model.summary.lessWorkCents)}</strong>
          <span>Minwerk · niet geannuleerd</span>
        </div>
        <div>
          <strong>
            {formatEuroCents(model.summary.changeOrderImpactCents)}
          </strong>
          <span>Netto meer/minwerk</span>
        </div>
      </section>

      <section className="budget-section">
        <div className="budget-section__heading">
          <div>
            <span>Niet-geïnterpreteerde ledger</span>
            <h2>Budgetitems</h2>
          </div>
          <strong>{model.records.length}</strong>
        </div>
        <BudgetTable
          records={model.records}
          onCorrect={(recordId) => setPanel(recordId)}
          onArchive={(recordId) => {
            if (
              !window.confirm(
                "Dit budgetitem verwijderen? Het blijft bewaard in de audit-historiek.",
              )
            )
              return
            try {
              const latest = useAppStore.getState().session?.state
              if (!latest) return
              const result = budgetService.archiveRecord(latest, recordId)
              useAppStore.getState().replaceDomainState(result.state)
              setStatusMessage(
                "Budgetitem verwijderd en audit-historiek bewaard · back-up nodig",
              )
            } catch (error) {
              setStatusMessage(
                error instanceof BudgetManagementError
                  ? error.message
                  : "Budgetitem kon niet worden verwijderd.",
              )
            }
          }}
        />
      </section>

      <section className="budget-section">
        <div className="budget-section__heading">
          <div>
            <span>Alle actieve records · inclusief geannuleerde status</span>
            <h2>Uitsplitsing per type</h2>
          </div>
        </div>
        <div className="budget-type-grid">
          {budgetTypes.map((type) => {
            const total = model.summary.typeTotals.get(type)!
            return (
              <div key={type}>
                <span>{type}</span>
                <strong>{formatEuroCents(total.amountCents)}</strong>
                <small>{total.recordCount} record(s)</small>
              </div>
            )
          })}
        </div>
      </section>

      {panel === "new" ? (
        <NewBudgetPanel
          projectId={model.project.id}
          {...(selectedTopic ? { defaultTopicId: selectedTopic.id } : {})}
          onClose={() => setPanel(undefined)}
          onSaved={() =>
            setStatusMessage(
              "Budgetitem opgeslagen in de lokale sessie · back-up nodig",
            )
          }
        />
      ) : panel ? (
        <BudgetCorrectionPanel
          recordId={panel}
          onClose={() => setPanel(undefined)}
          onSaved={() =>
            setStatusMessage(
              "Foutcorrectie opgeslagen met historie · back-up nodig",
            )
          }
        />
      ) : null}
    </article>
  )
}
