import { useMemo, useState } from "react"
import { useForm, type FieldPath } from "react-hook-form"
import { Link, useNavigate, useParams } from "react-router-dom"
import {
  buildProjectPlanningModel,
  type PlanningZoom,
} from "../../application/queries"
import {
  PlanningManagementError,
  PlanningManagementService,
} from "../../application/services"
import { useAppStore } from "../../app/state/app-store"
import {
  Badge,
  Button,
  EmptyState,
  ErrorState,
} from "../../design-system/components"
import { useEscapeKey } from "../../design-system/patterns"
import { planningStatuses, type PlanningEntry, type UUID } from "../../domain"
import { formatLocalDate, todayAsLocalDate } from "../../utils"
import { ProjectDossierHeader } from "../projects/project-dossier-header"
import {
  dependencyFormSchema,
  dependencyValuesToInput,
  planningEntryFormSchema,
  timingValuesToInput,
  type DependencyFormValues,
  type PlanningEntryFormValues,
} from "./planning-form-schema"
import { PlanningGantt } from "./planning-gantt"
import { TopicTimingPanel } from "./topic-timing-panel"
import "./planning.css"

const planningService = new PlanningManagementService()

type EntryPanelMode = "milestone" | "custom"

interface EntryPanelProps {
  projectId: UUID
  mode: EntryPanelMode
  entry?: PlanningEntry
  onClose: () => void
  onSaved: () => void
}

function applyFormIssues<T extends object>(
  issues: readonly { path: PropertyKey[]; message: string }[],
  setError: (field: FieldPath<T>, error: { message: string }) => void,
) {
  for (const issue of issues) {
    const field = issue.path[0]
    if (typeof field === "string")
      setError(field as FieldPath<T>, { message: issue.message })
  }
}

function EntryPanel({
  projectId,
  mode,
  entry,
  onClose,
  onSaved,
}: EntryPanelProps) {
  useEscapeKey(onClose)
  const replaceDomainState = useAppStore((state) => state.replaceDomainState)
  const kind: "Milestone" | "Custom" =
    mode === "milestone" ? "Milestone" : "Custom"
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<PlanningEntryFormValues>({
    defaultValues: {
      title: entry?.title ?? "",
      kind,
      startDate: entry?.startDate ?? "",
      plannedEndDate: entry?.plannedEndDate ?? "",
      progressPercent: entry?.progressPercent ?? 0,
      status: entry?.status ?? "Niet gestart",
      isMilestone: kind === "Milestone",
    },
  })

  const submit = handleSubmit((values) => {
    const normalizedValues = {
      ...values,
      kind,
      isMilestone: kind === "Milestone",
    }
    const parsed = planningEntryFormSchema.safeParse(normalizedValues)
    if (!parsed.success) {
      applyFormIssues<PlanningEntryFormValues>(parsed.error.issues, setError)
      return
    }
    const state = useAppStore.getState().session?.state
    if (!state) return
    try {
      const timing = timingValuesToInput(parsed.data)
      const input = {
        projectId,
        kind,
        title: parsed.data.title,
        ...timing,
      }
      const result = entry
        ? planningService.updateEntry(state, entry.id, input)
        : planningService.createEntry(state, input)
      replaceDomainState(result.state)
      onSaved()
    } catch (error) {
      if (!(error instanceof PlanningManagementError)) return
      for (const issue of error.issues) {
        const field = (
          issue.field === "projectId" ? "title" : issue.field
        ) as FieldPath<PlanningEntryFormValues>
        setError(field, { message: issue.message })
      }
    }
  })

  return (
    <aside
      className="planning-panel"
      role="dialog"
      aria-modal="false"
      aria-labelledby="entry-panel-title"
    >
      <header className="planning-panel__header">
        <div>
          <span>Projectplanning</span>
          <h2 id="entry-panel-title">
            {entry
              ? "Planningitem bewerken"
              : kind === "Milestone"
                ? "Mijlpaal toevoegen"
                : "Vrij planningitem toevoegen"}
          </h2>
          <p>De wijziging wordt pas bij opslaan in de sessie gezet.</p>
        </div>
        <Button variant="tertiary" onClick={onClose}>
          Sluiten
        </Button>
      </header>
      <form
        className="planning-form"
        onSubmit={(event) => void submit(event)}
        noValidate
      >
        <section>
          <h3>Planningitem</h3>
          <label>
            <span>Titel</span>
            <input
              {...register("title")}
              aria-invalid={Boolean(errors.title)}
            />
            {errors.title ? (
              <small role="alert">{errors.title.message}</small>
            ) : null}
          </label>
          {kind === "Custom" ? (
            <label>
              <span>Startdatum</span>
              <input
                type="date"
                {...register("startDate")}
                aria-invalid={Boolean(errors.startDate)}
              />
              {errors.startDate ? (
                <small role="alert">{errors.startDate.message}</small>
              ) : null}
            </label>
          ) : null}
          <label>
            <span>
              {kind === "Milestone" ? "Mijlpaaldatum" : "Geplande einddatum"}
            </span>
            <input
              type="date"
              {...register("plannedEndDate")}
              aria-invalid={Boolean(errors.plannedEndDate)}
            />
            {errors.plannedEndDate ? (
              <small role="alert">{errors.plannedEndDate.message}</small>
            ) : null}
          </label>
        </section>
        <section>
          <h3>Opvolging</h3>
          <label htmlFor="planning-entry-progress">
            <span>Voortgang</span>
            <div className="planning-form__number">
              <input
                id="planning-entry-progress"
                aria-label="Voortgang"
                type="number"
                min="0"
                max="100"
                {...register("progressPercent", { valueAsNumber: true })}
              />
              <span>%</span>
            </div>
            {errors.progressPercent ? (
              <small role="alert">{errors.progressPercent.message}</small>
            ) : null}
          </label>
          <label>
            <span>Status</span>
            <select {...register("status")}>
              {planningStatuses.map((status) => (
                <option key={status}>{status}</option>
              ))}
            </select>
          </label>
        </section>
        <footer>
          <Button type="submit" disabled={isSubmitting}>
            Planningitem opslaan
          </Button>
          <Button variant="tertiary" onClick={onClose}>
            Annuleren
          </Button>
        </footer>
      </form>
    </aside>
  )
}

interface DependencyPanelProps {
  entries: readonly PlanningEntry[]
  onClose: () => void
  onSaved: () => void
}

function DependencyPanel({ entries, onClose, onSaved }: DependencyPanelProps) {
  useEscapeKey(onClose)
  const replaceDomainState = useAppStore((state) => state.replaceDomainState)
  const [domainError, setDomainError] = useState("")
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<DependencyFormValues>({
    defaultValues: { predecessorPlanningId: "", successorPlanningId: "" },
  })
  const submit = handleSubmit((values) => {
    setDomainError("")
    const parsed = dependencyFormSchema.safeParse(values)
    if (!parsed.success) {
      applyFormIssues<DependencyFormValues>(parsed.error.issues, setError)
      return
    }
    const state = useAppStore.getState().session?.state
    if (!state) return
    try {
      const result = planningService.createDependency(
        state,
        dependencyValuesToInput(parsed.data),
      )
      replaceDomainState(result.state)
      onSaved()
    } catch (error) {
      if (error instanceof PlanningManagementError)
        setDomainError(error.message)
    }
  })
  return (
    <aside
      className="planning-panel"
      role="dialog"
      aria-modal="false"
      aria-labelledby="dependency-panel-title"
    >
      <header className="planning-panel__header">
        <div>
          <span>Finish-to-start</span>
          <h2 id="dependency-panel-title">Afhankelijkheid toevoegen</h2>
          <p>De opvolger kan starten nadat de voorganger is geëindigd.</p>
        </div>
        <Button variant="tertiary" onClick={onClose}>
          Sluiten
        </Button>
      </header>
      <form
        className="planning-form"
        onSubmit={(event) => void submit(event)}
        noValidate
      >
        <section>
          <label>
            <span>Voorganger</span>
            <select
              {...register("predecessorPlanningId")}
              aria-invalid={Boolean(errors.predecessorPlanningId)}
            >
              <option value="">Kies een planningitem</option>
              {entries.map((entry) => (
                <option value={entry.id} key={entry.id}>
                  {entry.title}
                </option>
              ))}
            </select>
            {errors.predecessorPlanningId ? (
              <small role="alert">{errors.predecessorPlanningId.message}</small>
            ) : null}
          </label>
          <label>
            <span>Opvolger</span>
            <select
              {...register("successorPlanningId")}
              aria-invalid={Boolean(errors.successorPlanningId)}
            >
              <option value="">Kies een planningitem</option>
              {entries.map((entry) => (
                <option value={entry.id} key={entry.id}>
                  {entry.title}
                </option>
              ))}
            </select>
            {errors.successorPlanningId ? (
              <small role="alert">{errors.successorPlanningId.message}</small>
            ) : null}
          </label>
          {domainError ? (
            <p className="planning-form__error" role="alert">
              {domainError}
            </p>
          ) : null}
        </section>
        <footer>
          <Button type="submit" disabled={entries.length < 2}>
            Afhankelijkheid opslaan
          </Button>
          <Button variant="tertiary" onClick={onClose}>
            Annuleren
          </Button>
        </footer>
      </form>
    </aside>
  )
}

export function ProjectPlanningPage() {
  const navigate = useNavigate()
  const { projectId } = useParams<{ projectId: string }>()
  const session = useAppStore((state) => state.session)
  const setImportPanelOpen = useAppStore((state) => state.setImportPanelOpen)
  const [zoom, setZoom] = useState<PlanningZoom>("month")
  const [panel, setPanel] = useState<EntryPanelMode | "dependency">()
  const [selectedEntryId, setSelectedEntryId] = useState<UUID>()
  const [statusMessage, setStatusMessage] = useState("")
  const today = todayAsLocalDate()
  const model = useMemo(
    () =>
      session && projectId
        ? buildProjectPlanningModel(session.state, projectId as UUID, today)
        : undefined,
    [projectId, session, today],
  )

  if (!session)
    return (
      <EmptyState
        title="Planning kan nog niet worden geopend"
        description="Open een bestaand JSON-bestand of start een nieuwe gegevensset."
        action={
          <Button onClick={() => setImportPanelOpen(true)}>
            JSON openen of nieuw starten
          </Button>
        }
      />
    )
  if (!model)
    return (
      <ErrorState
        title="Project niet gevonden"
        description="Dit project-ID bestaat niet in de geladen sessie."
      />
    )

  const selectedEntry = selectedEntryId
    ? session.state.indices.planningById.get(selectedEntryId)
    : undefined
  const selectedTopic = selectedEntry?.topicId
    ? session.state.indices.topicById.get(selectedEntry.topicId)
    : undefined

  function saved(message: string) {
    setStatusMessage(`${message} in de lokale sessie · back-up nodig`)
    setPanel(undefined)
    setSelectedEntryId(undefined)
  }

  return (
    <article className="planning-page planning-page--project">
      <ProjectDossierHeader
        project={model.project}
        activeTab="planning"
        actions={
          <>
            <Link
              className="planning-source-link"
              to={`/projects/${model.project.id}/topics`}
            >
              + Topic
            </Link>
            <Link className="planning-source-link" to="/actions">
              + Actie
            </Link>
            <Link
              className="planning-source-link"
              to={`/projects/${model.project.id}/journal`}
            >
              + Beslissing
            </Link>
          </>
        }
        primaryAction={
          <Button onClick={() => setPanel("dependency")}>
            + Afhankelijkheid
          </Button>
        }
      />
      {statusMessage ? (
        <p className="planning-session-status" role="status">
          {statusMessage}
        </p>
      ) : null}
      <section className="planning-summary" aria-label="Kernplanning">
        <div>
          <span>Projectperiode</span>
          <strong>
            {formatLocalDate(model.project.startDate)} –{" "}
            {formatLocalDate(model.project.plannedEndDate)}
          </strong>
        </div>
        <div>
          <span>Handmatige voortgang</span>
          <strong>{model.project.progressPercent ?? 0}%</strong>
        </div>
        <div>
          <span>Planningitems</span>
          <strong>{model.entries.length}</strong>
        </div>
        <div>
          <span>Afhankelijkheden</span>
          <strong>{model.dependencies.length}</strong>
        </div>
      </section>
      <section
        className="planning-canvas"
        aria-labelledby="project-gantt-title"
      >
        <header className="planning-canvas__header">
          <div>
            <span>Tijdslijn</span>
            <h2 id="project-gantt-title">Project-Gantt</h2>
          </div>
          <fieldset className="planning-zoom">
            <legend>Zoom</legend>
            {(["week", "month", "quarter", "year"] as const).map((value) => (
              <label key={value}>
                <input
                  type="radio"
                  name="project-zoom"
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
            ))}
          </fieldset>
        </header>
        <PlanningGantt
          rows={model.rows}
          dependencies={model.dependencies}
          zoom={zoom}
          today={today}
          onSelectRow={(row) => {
            if (row.kind === "project") navigate(`/projects/${row.projectId}`)
            else if (row.entry) setSelectedEntryId(row.entry.id)
            else if (row.topic)
              navigate(`/projects/${row.projectId}/topics/${row.topic.id}`)
            else if (row.actionId) navigate(`/actions?actie=${row.actionId}`)
            else navigate(`/projects/${row.projectId}`)
          }}
        />
      </section>
      <section
        className="planning-dependency-list"
        aria-labelledby="dependency-title"
      >
        <header>
          <h2 id="dependency-title">Afhankelijkheden</h2>
          <Badge tone="neutral">Finish-to-start</Badge>
        </header>
        {model.dependencies.length ? (
          <ul>
            {model.dependencies.map((dependency) => (
              <li key={dependency.id}>
                <span>
                  {session.state.indices.planningById.get(
                    dependency.predecessorPlanningId,
                  )?.title ?? "Onbekend"}
                </span>
                <strong aria-label="gevolgd door">→</strong>
                <span>
                  {session.state.indices.planningById.get(
                    dependency.successorPlanningId,
                  )?.title ?? "Onbekend"}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p>
            Nog geen afhankelijkheden. Voeg ze toe wanneer de volgorde
            inhoudelijk vastligt.
          </p>
        )}
      </section>
      {panel === "milestone" || panel === "custom" ? (
        <EntryPanel
          projectId={model.project.id}
          mode={panel}
          onClose={() => setPanel(undefined)}
          onSaved={() =>
            saved(
              panel === "milestone"
                ? "Mijlpaal opgeslagen"
                : "Planningitem opgeslagen",
            )
          }
        />
      ) : null}
      {panel === "dependency" ? (
        <DependencyPanel
          entries={model.entries}
          onClose={() => setPanel(undefined)}
          onSaved={() => saved("Afhankelijkheid opgeslagen")}
        />
      ) : null}
      {selectedEntry && selectedTopic ? (
        <TopicTimingPanel
          topic={selectedTopic}
          planning={selectedEntry}
          onClose={() => setSelectedEntryId(undefined)}
          onSaved={() => saved("Timing opgeslagen")}
        />
      ) : null}
      {selectedEntry && !selectedTopic ? (
        <EntryPanel
          projectId={model.project.id}
          mode={selectedEntry.kind === "Milestone" ? "milestone" : "custom"}
          entry={selectedEntry}
          onClose={() => setSelectedEntryId(undefined)}
          onSaved={() => saved("Planningitem opgeslagen")}
        />
      ) : null}
    </article>
  )
}
