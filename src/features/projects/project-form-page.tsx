import { useEffect, useMemo, useState } from "react"
import { flushSync } from "react-dom"
import {
  useForm,
  useWatch,
  type FieldPath,
  type FieldValues,
  type UseFormSetError,
} from "react-hook-form"
import { Link, useNavigate, useParams } from "react-router-dom"
import {
  ProjectManagementError,
  ProjectManagementService,
} from "../../application/services"
import { useAppStore } from "../../app/state/app-store"
import {
  Button,
  EmptyState,
  ErrorState,
  SearchableSelect,
} from "../../design-system/components"
import { useEscapeKey } from "../../design-system/patterns"
import {
  actorTypes,
  projectStatuses,
  type Actor,
  type Cluster,
  type Project,
  type UUID,
} from "../../domain"
import {
  actorFormSchema,
  actorValuesToInput,
  clusterFormSchema,
  clusterValuesToInput,
  projectFormSchema,
  projectValuesToInput,
  type ActorFormValues,
  type ClusterFormValues,
  type ProjectFormValues,
} from "./project-form-schema"
import "./project-form-page.css"

const projectManagementService = new ProjectManagementService()

function emptyProjectValues(): ProjectFormValues {
  return {
    code: "",
    title: "",
    description: "",
    chapterId: "",
    clusterId: "",
    status: "Idee",
    phase: "",
    site: "",
    location: "",
    department: "",
    coordinatorActorId: "",
    startDate: "",
    plannedEndDate: "",
    actualEndDate: "",
    progressPercent: "0",
    documentsUrl: "",
  }
}

function projectValues(project: Project): ProjectFormValues {
  return {
    code: project.code,
    title: project.title,
    description: project.description,
    chapterId: project.chapterId,
    clusterId: project.clusterId ?? "",
    status: project.status,
    phase: project.phase,
    site: project.site ?? "",
    location: project.location ?? "",
    department: project.department ?? "",
    coordinatorActorId: project.coordinatorActorId ?? "",
    startDate: project.startDate ?? "",
    plannedEndDate: project.plannedEndDate ?? "",
    actualEndDate: project.actualEndDate ?? "",
    progressPercent: String(project.progressPercent ?? 0),
    documentsUrl: project.documentsUrl ?? "",
  }
}

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

interface InlineClusterPanelProps {
  chapterId: UUID
  onClose: () => void
  onSaved: (cluster: Cluster) => void
}

function InlineClusterPanel({
  chapterId,
  onClose,
  onSaved,
}: InlineClusterPanelProps) {
  useEscapeKey(onClose)
  const replaceDomainState = useAppStore((state) => state.replaceDomainState)
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<ClusterFormValues>({
    defaultValues: { code: "", title: "", description: "" },
  })

  const submit = handleSubmit((values) => {
    const parsed = clusterFormSchema.safeParse(values)
    if (!parsed.success) {
      applyZodErrors(parsed.error.issues, setError)
      return
    }
    const state = useAppStore.getState().session?.state
    if (!state) return
    try {
      const result = projectManagementService.createCluster(
        state,
        clusterValuesToInput(parsed.data, chapterId),
      )
      flushSync(() => replaceDomainState(result.state))
      onSaved(result.record)
    } catch (error) {
      if (error instanceof ProjectManagementError) {
        for (const issue of error.issues) {
          setError(issue.field as FieldPath<ClusterFormValues>, {
            message: issue.message,
          })
        }
      }
    }
  })

  return (
    <aside
      className="project-inline-panel"
      role="dialog"
      aria-modal="false"
      aria-labelledby="new-cluster-title"
    >
      <header>
        <div>
          <span>In projectcontext</span>
          <h2 id="new-cluster-title">Nieuwe cluster</h2>
        </div>
        <Button
          variant="tertiary"
          onClick={onClose}
          aria-label="Clusterpaneel sluiten"
        >
          Sluiten
        </Button>
      </header>
      <p>
        De cluster wordt bewaard in de huidige sessie en meteen in het project
        geselecteerd.
      </p>
      <form onSubmit={(event) => void submit(event)} noValidate>
        <label>
          <span>Clustercode</span>
          <input {...register("code")} aria-invalid={Boolean(errors.code)} />
          {errors.code ? (
            <small role="alert">{errors.code.message}</small>
          ) : null}
        </label>
        <label>
          <span>Clusternaam</span>
          <input {...register("title")} aria-invalid={Boolean(errors.title)} />
          {errors.title ? (
            <small role="alert">{errors.title.message}</small>
          ) : null}
        </label>
        <label>
          <span>
            Omschrijving <em>optioneel</em>
          </span>
          <textarea rows={4} {...register("description")} />
        </label>
        <div className="project-inline-panel__actions">
          <Button type="submit" disabled={isSubmitting}>
            Cluster opslaan
          </Button>
          <Button variant="tertiary" onClick={onClose}>
            Annuleren
          </Button>
        </div>
      </form>
    </aside>
  )
}

export interface InlineActorPanelProps {
  onClose: () => void
  onSaved: (actor: Actor) => void
  contextLabel?: string
}

export function InlineActorPanel({
  onClose,
  onSaved,
  contextLabel = "In projectcontext",
}: InlineActorPanelProps) {
  useEscapeKey(onClose)
  const replaceDomainState = useAppStore((state) => state.replaceDomainState)
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<ActorFormValues>({
    defaultValues: {
      displayName: "",
      type: "Intern",
      email: "",
      organization: "",
      role: "",
      active: true,
    },
  })

  const submit = handleSubmit((values) => {
    const parsed = actorFormSchema.safeParse(values)
    if (!parsed.success) {
      applyZodErrors(parsed.error.issues, setError)
      return
    }
    const state = useAppStore.getState().session?.state
    if (!state) return
    try {
      const result = projectManagementService.createActor(
        state,
        actorValuesToInput(parsed.data),
      )
      flushSync(() => replaceDomainState(result.state))
      onSaved(result.record)
    } catch (error) {
      if (error instanceof ProjectManagementError) {
        for (const issue of error.issues) {
          setError(issue.field as FieldPath<ActorFormValues>, {
            message: issue.message,
          })
        }
      }
    }
  })

  return (
    <aside
      className="project-inline-panel"
      role="dialog"
      aria-modal="false"
      aria-labelledby="new-actor-title"
    >
      <header>
        <div>
          <span>{contextLabel}</span>
          <h2 id="new-actor-title">Nieuwe actor</h2>
        </div>
        <Button
          variant="tertiary"
          onClick={onClose}
          aria-label="Actorpaneel sluiten"
        >
          Sluiten
        </Button>
      </header>
      <p>De nieuwe actor wordt meteen als projectcoördinator geselecteerd.</p>
      <form onSubmit={(event) => void submit(event)} noValidate>
        <label>
          <span>Naam</span>
          <input
            {...register("displayName")}
            aria-invalid={Boolean(errors.displayName)}
          />
          {errors.displayName ? (
            <small role="alert">{errors.displayName.message}</small>
          ) : null}
        </label>
        <label>
          <span>Type</span>
          <select {...register("type")}>
            {actorTypes.map((type) => (
              <option key={type}>{type}</option>
            ))}
          </select>
        </label>
        <label>
          <span>
            E-mail <em>optioneel</em>
          </span>
          <input
            type="email"
            {...register("email")}
            aria-invalid={Boolean(errors.email)}
          />
          {errors.email ? (
            <small role="alert">{errors.email.message}</small>
          ) : null}
        </label>
        <label>
          <span>
            Organisatie <em>optioneel</em>
          </span>
          <input {...register("organization")} />
        </label>
        <label>
          <span>
            Rol <em>optioneel</em>
          </span>
          <input {...register("role")} />
        </label>
        <label className="project-inline-panel__checkbox">
          <input type="checkbox" {...register("active")} />
          <span>Actor is actief</span>
        </label>
        <div className="project-inline-panel__actions">
          <Button type="submit" disabled={isSubmitting}>
            Actor opslaan
          </Button>
          <Button variant="tertiary" onClick={onClose}>
            Annuleren
          </Button>
        </div>
      </form>
    </aside>
  )
}

export function ProjectFormPage() {
  const navigate = useNavigate()
  const { projectId } = useParams<{ projectId: string }>()
  const isEditing = Boolean(projectId)
  const session = useAppStore((state) => state.session)
  const replaceDomainState = useAppStore((state) => state.replaceDomainState)
  const setImportPanelOpen = useAppStore((state) => state.setImportPanelOpen)
  const [inlinePanel, setInlinePanel] = useState<"cluster" | "actor">()
  const project = projectId
    ? session?.state.indices.projectById.get(projectId as UUID)
    : undefined

  const {
    register,
    control,
    handleSubmit,
    setValue,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<ProjectFormValues>({
    defaultValues: project ? projectValues(project) : emptyProjectValues(),
  })

  const chapterId = useWatch({ control, name: "chapterId" })
  const clusterId = useWatch({ control, name: "clusterId" })
  const clusters = useMemo(
    () =>
      session?.state.records.clusters
        .filter(
          (cluster) => cluster.audit.active && cluster.chapterId === chapterId,
        )
        .sort((left, right) => left.order - right.order) ?? [],
    [chapterId, session],
  )
  const actors = useMemo(
    () =>
      session?.state.records.actors
        .filter((actor) => actor.active && actor.audit.active)
        .sort((left, right) =>
          left.displayName.localeCompare(right.displayName),
        ) ?? [],
    [session],
  )

  useEffect(() => {
    if (!clusterId) return
    const cluster = session?.state.indices.clusterById.get(clusterId as UUID)
    if (!cluster || cluster.chapterId !== chapterId) {
      setValue("clusterId", "", { shouldDirty: true })
    }
  }, [chapterId, clusterId, session, setValue])

  if (!session) {
    return (
      <EmptyState
        title="Projectbeheer vereist een werkbooksessie"
        description="Laad en bevestig eerst een geldig Excelworkbook."
        action={
          <Button onClick={() => setImportPanelOpen(true)}>
            Excelbestand laden
          </Button>
        }
      />
    )
  }

  if (isEditing && !project) {
    return (
      <ErrorState
        title="Project niet gevonden"
        description="Dit project-ID bestaat niet in het geladen workbook."
      />
    )
  }

  const submit = handleSubmit((values) => {
    const parsed = projectFormSchema.safeParse(values)
    if (!parsed.success) {
      applyZodErrors(parsed.error.issues, setError)
      return
    }
    try {
      const latestState = useAppStore.getState().session?.state
      if (!latestState) return
      const input = projectValuesToInput(parsed.data)
      const result = project
        ? projectManagementService.updateProject(latestState, project.id, input)
        : projectManagementService.createProject(latestState, input)
      replaceDomainState(result.state)
      navigate(`/projects/${result.record.id}`, {
        replace: isEditing,
        state: { saved: true },
      })
    } catch (error) {
      if (error instanceof ProjectManagementError) {
        for (const issue of error.issues) {
          setError(issue.field as FieldPath<ProjectFormValues>, {
            message: issue.message,
          })
        }
      }
    }
  })

  const cancelTarget = project ? `/projects/${project.id}` : "/portfolio"

  return (
    <div className="project-form-page">
      <nav className="project-form-page__breadcrumb" aria-label="Kruimelpad">
        <Link to="/portfolio">Portfolio</Link>
        <span aria-hidden="true">/</span>
        <span aria-current="page">
          {project ? "Project bewerken" : "Nieuw project"}
        </span>
      </nav>

      <header className="project-form-page__header">
        <div>
          <p>{project ? project.code : "Projectbeheer"}</p>
          <h1>{project ? "Project bewerken" : "Nieuw project"}</h1>
          <span>
            Vul de dossierbasis in. Wijzigingen worden pas bij opslaan in de
            lokale sessie verwerkt.
          </span>
        </div>
        <Link className="project-form-page__cancel" to={cancelTarget}>
          Annuleren
        </Link>
      </header>

      <div
        className={`project-form-page__workspace ${inlinePanel ? "project-form-page__workspace--panel" : ""}`}
      >
        <form
          className="project-form"
          onSubmit={(event) => void submit(event)}
          noValidate
        >
          <section aria-labelledby="project-identity">
            <div className="project-form__section-heading">
              <span>01</span>
              <div>
                <h2 id="project-identity">Identiteit</h2>
                <p>De herkenbare basis van het projectdossier.</p>
              </div>
            </div>
            <div className="project-form__grid project-form__grid--identity">
              <label>
                <span>Projectcode</span>
                <input
                  {...register("code")}
                  aria-invalid={Boolean(errors.code)}
                />
                {errors.code ? (
                  <small role="alert">{errors.code.message}</small>
                ) : null}
              </label>
              <label className="project-form__wide">
                <span>Titel</span>
                <input
                  {...register("title")}
                  aria-invalid={Boolean(errors.title)}
                />
                {errors.title ? (
                  <small role="alert">{errors.title.message}</small>
                ) : null}
              </label>
              <label className="project-form__full">
                <span>Omschrijving</span>
                <textarea rows={5} {...register("description")} />
              </label>
              <label>
                <span>Status</span>
                <select {...register("status")}>
                  {projectStatuses.map((status) => (
                    <option key={status}>{status}</option>
                  ))}
                </select>
              </label>
              <label>
                <span>Fase</span>
                <input {...register("phase")} />
              </label>
            </div>
          </section>

          <section aria-labelledby="project-context">
            <div className="project-form__section-heading">
              <span>02</span>
              <div>
                <h2 id="project-context">Organisatie en context</h2>
                <p>
                  Structureer het project zonder een cluster verplicht te maken.
                </p>
              </div>
            </div>
            <div className="project-form__grid">
              <label>
                <span>Hoofdstuk</span>
                <select
                  {...register("chapterId")}
                  aria-invalid={Boolean(errors.chapterId)}
                >
                  <option value="">Kies een hoofdstuk</option>
                  {session.state.records.chapters
                    .filter((chapter) => chapter.audit.active)
                    .sort((left, right) => left.order - right.order)
                    .map((chapter) => (
                      <option key={chapter.id} value={chapter.id}>
                        {chapter.code} · {chapter.title}
                      </option>
                    ))}
                </select>
                {errors.chapterId ? (
                  <small role="alert">{errors.chapterId.message}</small>
                ) : null}
              </label>
              <SearchableSelect
                label="Cluster (optioneel)"
                emptyLabel="Zonder cluster"
                options={clusters.map((cluster) => ({
                  value: cluster.id,
                  label: `${cluster.code} · ${cluster.title}`,
                }))}
                disabled={!chapterId}
                action={
                  <Button
                    variant="tertiary"
                    disabled={!chapterId}
                    onClick={() => setInlinePanel("cluster")}
                  >
                    + Nieuwe cluster
                  </Button>
                }
                aria-invalid={Boolean(errors.clusterId)}
                error={
                  errors.clusterId ? (
                    <small role="alert">{errors.clusterId.message}</small>
                  ) : null
                }
                {...register("clusterId")}
              />
              <div className="project-form__full">
                <SearchableSelect
                  label="Projectcoördinator (optioneel)"
                  emptyLabel="Geen coördinator"
                  options={actors.map((actor) => ({
                    value: actor.id,
                    label: `${actor.displayName}${actor.organization ? ` · ${actor.organization}` : ""}`,
                  }))}
                  action={
                    <Button
                      variant="tertiary"
                      onClick={() => setInlinePanel("actor")}
                    >
                      + Nieuwe actor
                    </Button>
                  }
                  aria-invalid={Boolean(errors.coordinatorActorId)}
                  error={
                    errors.coordinatorActorId ? (
                      <small role="alert">
                        {errors.coordinatorActorId.message}
                      </small>
                    ) : null
                  }
                  {...register("coordinatorActorId")}
                />
              </div>
              <label>
                <span>
                  Site <em>optioneel</em>
                </span>
                <input {...register("site")} />
              </label>
              <label>
                <span>
                  Locatie <em>optioneel</em>
                </span>
                <input {...register("location")} />
              </label>
              <label className="project-form__full">
                <span>
                  Afdeling <em>optioneel</em>
                </span>
                <input {...register("department")} />
              </label>
            </div>
          </section>

          <section aria-labelledby="project-planning">
            <div className="project-form__section-heading">
              <span>03</span>
              <div>
                <h2 id="project-planning">Kernplanning</h2>
                <p>
                  Samenvattende projectdata; detailplanning volgt in een latere
                  fase.
                </p>
              </div>
            </div>
            <div className="project-form__grid project-form__grid--three">
              <label>
                <span>
                  Startdatum <em>optioneel</em>
                </span>
                <input
                  type="date"
                  {...register("startDate")}
                  aria-invalid={Boolean(errors.startDate)}
                />
                {errors.startDate ? (
                  <small role="alert">{errors.startDate.message}</small>
                ) : null}
              </label>
              <label>
                <span>
                  Geplande einddatum <em>optioneel</em>
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
              <label>
                <span>
                  Actuele einddatum <em>optioneel</em>
                </span>
                <input
                  type="date"
                  {...register("actualEndDate")}
                  aria-invalid={Boolean(errors.actualEndDate)}
                />
                {errors.actualEndDate ? (
                  <small role="alert">{errors.actualEndDate.message}</small>
                ) : null}
              </label>
              <label>
                <span>
                  Voortgang (%) <em>optioneel</em>
                </span>
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="1"
                  {...register("progressPercent")}
                  aria-invalid={Boolean(errors.progressPercent)}
                />
                {errors.progressPercent ? (
                  <small role="alert">{errors.progressPercent.message}</small>
                ) : null}
              </label>
            </div>
          </section>

          <section aria-labelledby="project-reference">
            <div className="project-form__section-heading">
              <span>04</span>
              <div>
                <h2 id="project-reference">Documenten</h2>
                <p>
                  Een optionele verwijzing; documenten zelf blijven buiten de
                  app.
                </p>
              </div>
            </div>
            <div className="project-form__grid">
              <label className="project-form__full">
                <span>
                  Documenten-URL <em>optioneel</em>
                </span>
                <input
                  type="url"
                  placeholder="https://…"
                  {...register("documentsUrl")}
                  aria-invalid={Boolean(errors.documentsUrl)}
                />
                {errors.documentsUrl ? (
                  <small role="alert">{errors.documentsUrl.message}</small>
                ) : null}
              </label>
            </div>
          </section>

          <footer className="project-form__footer">
            <div>
              <strong>Lokale sessie</strong>
              <span>
                Opslaan downloadt niet automatisch. Exporteer wanneer het
                dossier klaar is.
              </span>
            </div>
            <Button type="submit" disabled={isSubmitting}>
              {project ? "Wijzigingen opslaan" : "Project opslaan"}
            </Button>
          </footer>
        </form>

        {inlinePanel === "cluster" && chapterId ? (
          <InlineClusterPanel
            chapterId={chapterId as UUID}
            onClose={() => setInlinePanel(undefined)}
            onSaved={(cluster) => {
              setValue("clusterId", cluster.id, {
                shouldDirty: true,
                shouldValidate: true,
              })
              setInlinePanel(undefined)
            }}
          />
        ) : null}
        {inlinePanel === "actor" ? (
          <InlineActorPanel
            onClose={() => setInlinePanel(undefined)}
            onSaved={(actor) => {
              setValue("coordinatorActorId", actor.id, {
                shouldDirty: true,
                shouldValidate: true,
              })
              setInlinePanel(undefined)
            }}
          />
        ) : null}
      </div>
    </div>
  )
}
