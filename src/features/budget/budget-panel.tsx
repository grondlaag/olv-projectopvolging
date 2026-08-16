import { flushSync } from "react-dom"
import {
  useForm,
  type FieldPath,
  type FieldValues,
  type UseFormSetError,
} from "react-hook-form"
import {
  BudgetManagementError,
  BudgetManagementService,
} from "../../application/services"
import { useAppStore } from "../../app/state/app-store"
import { Button, SearchableSelect } from "../../design-system/components"
import { useEscapeKey } from "../../design-system/patterns"
import {
  budgetStatuses,
  formatEuroCents,
  type BudgetRecord,
  type UUID,
} from "../../domain"
import { formatLocalDate, todayAsLocalDate } from "../../utils"
import {
  budgetCorrectionFormSchema,
  budgetCorrectionValuesToInput,
  budgetFormSchema,
  budgetValuesToInput,
  type BudgetCorrectionFormValues,
  type BudgetFormValues,
} from "./budget-form-schema"
import "./budget.css"

const service = new BudgetManagementService()
const conciseBudgetTypes = [
  "Goedgekeurd budget",
  "Raming",
  "Contract",
  "Factuur",
  "Betaling",
  "Meerwerk",
  "Minwerk",
] as const

function applyZodErrors<T extends FieldValues>(
  issues: readonly { path: PropertyKey[]; message: string }[],
  setError: UseFormSetError<T>,
): void {
  for (const issue of issues) {
    const field = issue.path[0]
    if (typeof field === "string") {
      setError(field as FieldPath<T>, { message: issue.message })
    }
  }
}

interface NewBudgetPanelProps {
  projectId: UUID
  defaultTopicId?: UUID
  onClose: () => void
  onSaved: (record: BudgetRecord) => void
}

export function NewBudgetPanel({
  projectId,
  defaultTopicId,
  onClose,
  onSaved,
}: NewBudgetPanelProps) {
  useEscapeKey(onClose)
  const session = useAppStore((state) => state.session)
  const replaceDomainState = useAppStore((state) => state.replaceDomainState)
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<BudgetFormValues>({
    defaultValues: {
      type: "Raming",
      category: "",
      description: "",
      amount: "",
      date: todayAsLocalDate(),
      status: "Concept",
      reference: "",
      supplierActorId: "",
      topicId: defaultTopicId ?? "",
    },
  })
  if (!session) return null
  const project = session.state.indices.projectById.get(projectId)
  if (!project) return null
  const topics = session.state.indices.topicsByProject.get(project.id) ?? []
  const suppliers = session.state.records.actors.filter(
    (actor) => actor.active && actor.audit.active,
  )
  const categoryOptions = session.state.records.choiceLists
    .filter(
      (choice) =>
        choice.listKey === "budget-category" &&
        choice.active &&
        choice.audit.active,
    )
    .sort((left, right) => left.order - right.order)

  const submit = handleSubmit((values) => {
    const parsed = budgetFormSchema.safeParse(values)
    if (!parsed.success) {
      applyZodErrors(parsed.error.issues, setError)
      return
    }
    const state = useAppStore.getState().session?.state
    if (!state) return
    try {
      const result = service.createRecord(
        state,
        budgetValuesToInput(parsed.data, project.id),
      )
      flushSync(() => replaceDomainState(result.state))
      onSaved(result.record)
      onClose()
    } catch (error) {
      if (error instanceof BudgetManagementError) {
        for (const issue of error.issues) {
          setError(issue.field as FieldPath<BudgetFormValues>, {
            message: issue.message,
          })
        }
      }
    }
  })

  return (
    <aside
      className="budget-panel"
      role="dialog"
      aria-modal="false"
      aria-labelledby="budget-panel-title"
    >
      <header className="budget-panel__header">
        <div>
          <span>{project.code} · projectcontext staat vast</span>
          <h2 id="budget-panel-title">Budgetitem toevoegen</h2>
          <p>
            Een nieuw financieel feit; een foutcorrectie gebeurt via historie.
          </p>
        </div>
        <Button variant="tertiary" onClick={onClose}>
          Sluiten
        </Button>
      </header>
      <form
        className="budget-panel__form"
        onSubmit={(event) => void submit(event)}
        noValidate
      >
        <section>
          <h3>Financieel feit</h3>
          <div className="budget-form-grid">
            <label>
              <span>Type</span>
              <select aria-label="Type" {...register("type")}>
                {conciseBudgetTypes.map((type) => (
                  <option key={type}>{type}</option>
                ))}
              </select>
              <small>
                Bestellingen en contingentie worden als categorie bij raming of
                contract gevolgd; foutcorrecties via Correctiehistoriek.
              </small>
            </label>
            <label>
              <span>Categorie</span>
              <input list="budget-category-options" {...register("category")} />
              <datalist id="budget-category-options">
                {categoryOptions.map((choice) => (
                  <option value={choice.label} key={choice.id} />
                ))}
              </datalist>
              {errors.category ? (
                <small role="alert">{errors.category.message}</small>
              ) : null}
            </label>
            <label>
              <span>Bedrag</span>
              <input
                inputMode="decimal"
                placeholder="1.234,56"
                {...register("amount")}
              />
              {errors.amount ? (
                <small role="alert">{errors.amount.message}</small>
              ) : null}
            </label>
            <label>
              <span>Datum</span>
              <input type="date" {...register("date")} />
              {errors.date ? (
                <small role="alert">{errors.date.message}</small>
              ) : null}
            </label>
          </div>
          <label>
            <span>Omschrijving</span>
            <textarea rows={4} {...register("description")} />
            {errors.description ? (
              <small role="alert">{errors.description.message}</small>
            ) : null}
          </label>
        </section>

        <details className="budget-panel__details">
          <summary>Meer opties</summary>
          <p>
            Status, referentie en analytische context kunnen later worden
            aangevuld. Een topickoppeling maakt geen tweede budgetrecord.
          </p>
          <div className="budget-form-grid">
            <label>
              <span>Status</span>
              <select {...register("status")}>
                {budgetStatuses.map((status) => (
                  <option key={status}>{status}</option>
                ))}
              </select>
            </label>
            <label>
              <span>Referentie</span>
              <input {...register("reference")} />
            </label>
            <SearchableSelect
              label="Topic"
              emptyLabel="Geen topic"
              options={topics.map((topic) => ({
                value: topic.id,
                label: `${topic.code} · ${topic.title}`,
              }))}
              error={
                errors.topicId ? (
                  <small role="alert">{errors.topicId.message}</small>
                ) : null
              }
              {...register("topicId")}
            />
            <SearchableSelect
              label="Leverancier"
              emptyLabel="Geen leverancier"
              options={suppliers.map((actor) => ({
                value: actor.id,
                label: actor.displayName,
              }))}
              error={
                errors.supplierActorId ? (
                  <small role="alert">{errors.supplierActorId.message}</small>
                ) : null
              }
              {...register("supplierActorId")}
            />
          </div>
        </details>

        <footer className="budget-panel__footer">
          <Button type="submit" disabled={isSubmitting}>
            Budgetitem opslaan
          </Button>
          <Button variant="tertiary" onClick={onClose}>
            Annuleren
          </Button>
        </footer>
      </form>
    </aside>
  )
}

interface BudgetCorrectionPanelProps {
  recordId: UUID
  onClose: () => void
  onSaved: () => void
}

export function BudgetCorrectionPanel({
  recordId,
  onClose,
  onSaved,
}: BudgetCorrectionPanelProps) {
  useEscapeKey(onClose)
  const session = useAppStore((state) => state.session)
  const replaceDomainState = useAppStore((state) => state.replaceDomainState)
  const record = session?.state.indices.budgetById.get(recordId)
  const history = session
    ? (session.state.indices.budgetMutationsByBudgetRecord.get(recordId) ?? [])
    : []
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<BudgetCorrectionFormValues>({
    defaultValues: {
      amount: record ? String(record.amountCents / 100).replace(".", ",") : "",
      reason: "",
    },
  })
  if (!session || !record) return null

  const submit = handleSubmit((values) => {
    const parsed = budgetCorrectionFormSchema.safeParse(values)
    if (!parsed.success) {
      applyZodErrors(parsed.error.issues, setError)
      return
    }
    const state = useAppStore.getState().session?.state
    if (!state) return
    try {
      const result = service.correctAmount(
        state,
        record.id,
        budgetCorrectionValuesToInput(parsed.data),
      )
      flushSync(() => replaceDomainState(result.state))
      onSaved()
      onClose()
    } catch (error) {
      if (error instanceof BudgetManagementError) {
        for (const issue of error.issues) {
          const field =
            issue.field === "newAmountCents" ? "amount" : issue.field
          setError(field as FieldPath<BudgetCorrectionFormValues>, {
            message: issue.message,
          })
        }
      }
    }
  })

  return (
    <aside
      className="budget-panel"
      role="dialog"
      aria-modal="false"
      aria-labelledby="budget-correction-title"
    >
      <header className="budget-panel__header">
        <div>
          <span>Foutcorrectie · historie blijft behouden</span>
          <h2 id="budget-correction-title">Bedrag corrigeren</h2>
          <p>{record.description}</p>
        </div>
        <Button variant="tertiary" onClick={onClose}>
          Sluiten
        </Button>
      </header>
      <form
        className="budget-panel__form"
        onSubmit={(event) => void submit(event)}
        noValidate
      >
        <section>
          <h3>Correctie van fout</h3>
          <p>
            Huidig bedrag:{" "}
            <strong>{formatEuroCents(record.amountCents)}</strong>
          </p>
          <label>
            <span>Nieuw bedrag</span>
            <input inputMode="decimal" {...register("amount")} />
            {errors.amount ? (
              <small role="alert">{errors.amount.message}</small>
            ) : null}
          </label>
          <label>
            <span>Reden</span>
            <textarea rows={4} {...register("reason")} />
            {errors.reason ? (
              <small role="alert">{errors.reason.message}</small>
            ) : null}
          </label>
        </section>
        <section>
          <h3>Correctiehistoriek</h3>
          {history.length ? (
            <ol className="budget-history">
              {[...history]
                .sort((left, right) => right.date.localeCompare(left.date))
                .map((mutation) => (
                  <li key={mutation.id}>
                    <strong>{mutation.changeType}</strong>
                    <span>{mutation.reason}</span>
                    <small>
                      {formatLocalDate(mutation.date)} ·{" "}
                      {formatEuroCents(mutation.previousAmountCents ?? 0)} →{" "}
                      {formatEuroCents(mutation.newAmountCents ?? 0)}
                    </small>
                  </li>
                ))}
            </ol>
          ) : (
            <p className="budget-panel__quiet">Nog geen foutcorrecties.</p>
          )}
        </section>
        <footer className="budget-panel__footer">
          <Button type="submit" disabled={isSubmitting}>
            Correctie opslaan
          </Button>
          <Button variant="tertiary" onClick={onClose}>
            Annuleren
          </Button>
        </footer>
      </form>
    </aside>
  )
}
