import { useMemo, useState, type ReactNode } from "react"
import { useSearchParams } from "react-router-dom"
import {
  useForm,
  type FieldPath,
  type FieldValues,
  type UseFormSetError,
} from "react-hook-form"
import { jsonDataFileService } from "../../app/providers/data-file-services"
import { useAppStore } from "../../app/state/app-store"
import {
  SettingsManagementError,
  SettingsManagementService,
} from "../../application/services"
import {
  Badge,
  Button,
  EmptyState,
  KpiStrip,
  PageHeader,
  SearchableSelect,
} from "../../design-system/components"
import { useEscapeKey } from "../../design-system/patterns"
import {
  actorTypes,
  type Actor,
  type Chapter,
  type ChoiceList,
  type Cluster,
  type UUID,
} from "../../domain"
import {
  actorSettingsInput,
  actorSettingsSchema,
  chapterSettingsInput,
  chapterSettingsSchema,
  choiceSettingsInput,
  choiceSettingsSchema,
  clusterSettingsInput,
  clusterSettingsSchema,
  configurableChoiceLists,
  generalSettingsInput,
  generalSettingsSchema,
  type ActorSettingsValues,
  type ChapterSettingsValues,
  type ChoiceSettingsValues,
  type ClusterSettingsValues,
  type GeneralSettingsValues,
} from "./settings-form-schema"
import "./settings-page.css"

const service = new SettingsManagementService()

type SettingsTab = "general" | "structure" | "actors" | "choices" | "data"
type Editor =
  | { kind: "chapter"; id?: UUID }
  | { kind: "cluster"; id?: UUID; chapterId?: UUID }
  | { kind: "actor"; id?: UUID }
  | { kind: "choice"; id?: UUID; listKey?: string }

const tabs: readonly { key: SettingsTab; label: string }[] = [
  { key: "general", label: "Algemeen" },
  { key: "structure", label: "Hoofdstukken en clusters" },
  { key: "actors", label: "Actoren" },
  { key: "choices", label: "Keuzelijsten" },
  { key: "data", label: "Gegevensbestand" },
]

function applyErrors<T extends FieldValues>(
  issues: readonly { path: PropertyKey[]; message: string }[],
  setError: UseFormSetError<T>,
) {
  for (const issue of issues) {
    const field = issue.path[0]
    if (typeof field === "string") {
      setError(field as FieldPath<T>, { message: issue.message })
    }
  }
}

function mutationError<T extends FieldValues>(
  error: unknown,
  setError: UseFormSetError<T>,
) {
  if (error instanceof SettingsManagementError) {
    setError(error.field as FieldPath<T>, { message: error.message })
  }
}

function SettingsDrawer({
  title,
  eyebrow,
  onClose,
  children,
}: {
  title: string
  eyebrow: string
  onClose: () => void
  children: ReactNode
}) {
  useEscapeKey(onClose)
  return (
    <aside
      className="settings-drawer"
      role="dialog"
      aria-modal="false"
      aria-labelledby="settings-drawer-title"
    >
      <header>
        <div>
          <span>{eyebrow}</span>
          <h2 id="settings-drawer-title">{title}</h2>
        </div>
        <Button
          variant="tertiary"
          onClick={onClose}
          aria-label="Beheerpaneel sluiten"
        >
          Sluiten
        </Button>
      </header>
      {children}
    </aside>
  )
}

function FormActions({
  label,
  onClose,
}: {
  label: string
  onClose: () => void
}) {
  return (
    <div className="settings-form__actions">
      <Button type="submit">{label}</Button>
      <Button variant="tertiary" onClick={onClose}>
        Annuleren
      </Button>
    </div>
  )
}

function ChapterForm({
  record,
  onClose,
}: {
  record?: Chapter | undefined
  onClose: () => void
}) {
  const replaceDomainState = useAppStore((state) => state.replaceDomainState)
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<ChapterSettingsValues>({
    defaultValues: record
      ? { code: record.code, title: record.title, active: record.audit.active }
      : { code: "", title: "", active: true },
  })
  const submit = handleSubmit((values) => {
    const parsed = chapterSettingsSchema.safeParse(values)
    if (!parsed.success) return applyErrors(parsed.error.issues, setError)
    const state = useAppStore.getState().session?.state
    if (!state) return
    try {
      const result = record
        ? service.updateChapter(
            state,
            record.id,
            chapterSettingsInput(parsed.data),
          )
        : service.createChapter(state, chapterSettingsInput(parsed.data))
      replaceDomainState(result.state)
      onClose()
    } catch (error) {
      mutationError(error, setError)
    }
  })
  return (
    <form
      className="settings-form"
      onSubmit={(event) => void submit(event)}
      noValidate
    >
      <label>
        <span>Code</span>
        <input {...register("code")} aria-invalid={Boolean(errors.code)} />
        {errors.code ? <small role="alert">{errors.code.message}</small> : null}
      </label>
      <label>
        <span>Titel</span>
        <input {...register("title")} aria-invalid={Boolean(errors.title)} />
        {errors.title ? (
          <small role="alert">{errors.title.message}</small>
        ) : null}
      </label>
      <label className="settings-form__checkbox">
        <input type="checkbox" {...register("active")} />
        <span>Hoofdstuk is actief</span>
        {errors.active ? (
          <small role="alert">{errors.active.message}</small>
        ) : null}
      </label>
      <FormActions
        label={record ? "Hoofdstuk bijwerken" : "Hoofdstuk toevoegen"}
        onClose={onClose}
      />
    </form>
  )
}

function ClusterForm({
  record,
  initialChapterId,
  onClose,
}: {
  record?: Cluster | undefined
  initialChapterId?: UUID | undefined
  onClose: () => void
}) {
  const session = useAppStore((state) => state.session)!
  const replaceDomainState = useAppStore((state) => state.replaceDomainState)
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<ClusterSettingsValues>({
    defaultValues: record
      ? {
          chapterId: record.chapterId,
          code: record.code,
          title: record.title,
          description: record.description,
          active: record.audit.active,
        }
      : {
          chapterId: initialChapterId ?? "",
          code: "",
          title: "",
          description: "",
          active: true,
        },
  })
  const submit = handleSubmit((values) => {
    const parsed = clusterSettingsSchema.safeParse(values)
    if (!parsed.success) return applyErrors(parsed.error.issues, setError)
    const state = useAppStore.getState().session?.state
    if (!state) return
    try {
      const result = record
        ? service.updateCluster(
            state,
            record.id,
            clusterSettingsInput(parsed.data),
          )
        : service.createCluster(state, clusterSettingsInput(parsed.data))
      replaceDomainState(result.state)
      onClose()
    } catch (error) {
      mutationError(error, setError)
    }
  })
  return (
    <form
      className="settings-form"
      onSubmit={(event) => void submit(event)}
      noValidate
    >
      <SearchableSelect
        label="Hoofdstuk"
        emptyLabel="Kies een hoofdstuk"
        options={session.state.records.chapters
          .filter((item) => item.audit.active || item.id === record?.chapterId)
          .sort((a, b) => a.order - b.order)
          .map((item) => ({
            value: item.id,
            label: `${item.code} · ${item.title}`,
          }))}
        error={
          errors.chapterId ? (
            <small role="alert">{errors.chapterId.message}</small>
          ) : null
        }
        {...register("chapterId")}
      />
      <label>
        <span>Code</span>
        <input {...register("code")} aria-invalid={Boolean(errors.code)} />
        {errors.code ? <small role="alert">{errors.code.message}</small> : null}
      </label>
      <label>
        <span>Naam</span>
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
      <label className="settings-form__checkbox">
        <input type="checkbox" {...register("active")} />
        <span>Cluster is actief</span>
        {errors.active ? (
          <small role="alert">{errors.active.message}</small>
        ) : null}
      </label>
      <FormActions
        label={record ? "Cluster bijwerken" : "Cluster toevoegen"}
        onClose={onClose}
      />
    </form>
  )
}

function ActorForm({
  record,
  onClose,
}: {
  record?: Actor | undefined
  onClose: () => void
}) {
  const replaceDomainState = useAppStore((state) => state.replaceDomainState)
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<ActorSettingsValues>({
    defaultValues: record
      ? {
          displayName: record.displayName,
          type: record.type,
          email: record.email ?? "",
          organization: record.organization ?? "",
          role: record.role ?? "",
          active: record.active,
        }
      : {
          displayName: "",
          type: "Intern",
          email: "",
          organization: "",
          role: "",
          active: true,
        },
  })
  const submit = handleSubmit((values) => {
    const parsed = actorSettingsSchema.safeParse(values)
    if (!parsed.success) return applyErrors(parsed.error.issues, setError)
    const state = useAppStore.getState().session?.state
    if (!state) return
    try {
      const result = record
        ? service.updateActor(state, record.id, actorSettingsInput(parsed.data))
        : service.createActor(state, actorSettingsInput(parsed.data))
      replaceDomainState(result.state)
      onClose()
    } catch (error) {
      mutationError(error, setError)
    }
  })
  return (
    <form
      className="settings-form"
      onSubmit={(event) => void submit(event)}
      noValidate
    >
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
      <label className="settings-form__checkbox">
        <input type="checkbox" {...register("active")} />
        <span>Actor is actief</span>
        {errors.active ? (
          <small role="alert">{errors.active.message}</small>
        ) : null}
      </label>
      <FormActions
        label={record ? "Actor bijwerken" : "Actor toevoegen"}
        onClose={onClose}
      />
    </form>
  )
}

function ChoiceForm({
  record,
  initialListKey,
  onClose,
}: {
  record?: ChoiceList | undefined
  initialListKey?: string | undefined
  onClose: () => void
}) {
  const replaceDomainState = useAppStore((state) => state.replaceDomainState)
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<ChoiceSettingsValues>({
    defaultValues: record
      ? {
          listKey: record.listKey as ChoiceSettingsValues["listKey"],
          valueKey: record.valueKey,
          label: record.label,
          active: record.active,
        }
      : {
          listKey: (initialListKey ??
            "project-phase") as ChoiceSettingsValues["listKey"],
          valueKey: "",
          label: "",
          active: true,
        },
  })
  const submit = handleSubmit((values) => {
    const parsed = choiceSettingsSchema.safeParse(values)
    if (!parsed.success) return applyErrors(parsed.error.issues, setError)
    const state = useAppStore.getState().session?.state
    if (!state) return
    try {
      const result = record
        ? service.updateChoice(
            state,
            record.id,
            choiceSettingsInput(parsed.data),
          )
        : service.createChoice(state, choiceSettingsInput(parsed.data))
      replaceDomainState(result.state)
      onClose()
    } catch (error) {
      mutationError(error, setError)
    }
  })
  return (
    <form
      className="settings-form"
      onSubmit={(event) => void submit(event)}
      noValidate
    >
      <label>
        <span>Keuzelijst</span>
        <select {...register("listKey")} disabled={record?.system}>
          {configurableChoiceLists.map((item) => (
            <option value={item.key} key={item.key}>
              {item.label}
            </option>
          ))}
        </select>
      </label>
      <label>
        <span>Technische sleutel</span>
        <input
          {...register("valueKey")}
          disabled={record?.system}
          aria-invalid={Boolean(errors.valueKey)}
        />
        {errors.valueKey ? (
          <small role="alert">{errors.valueKey.message}</small>
        ) : null}
      </label>
      <label>
        <span>Label</span>
        <input
          {...register("label")}
          disabled={record?.system}
          aria-invalid={Boolean(errors.label)}
        />
        {errors.label ? (
          <small role="alert">{errors.label.message}</small>
        ) : null}
      </label>
      <label className="settings-form__checkbox">
        <input
          type="checkbox"
          {...register("active")}
          disabled={record?.system}
        />
        <span>Waarde is actief</span>
      </label>
      {record?.system ? (
        <p className="settings-form__note">
          Vaste systeemwaarden zijn alleen-lezen.
        </p>
      ) : null}
      <FormActions
        label={record ? "Waarde bijwerken" : "Waarde toevoegen"}
        onClose={onClose}
      />
    </form>
  )
}

function GeneralSettings() {
  const session = useAppStore((state) => state.session)!
  const replaceDomainState = useAppStore((state) => state.replaceDomainState)
  const config = session.state.records.config[0]
  const [feedback, setFeedback] = useState("")
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<GeneralSettingsValues>({
    defaultValues: {
      defaultCurrency: config?.defaultCurrency ?? "EUR",
      currentActorId: config?.currentActorId ?? "",
    },
  })
  const submit = handleSubmit((values) => {
    const parsed = generalSettingsSchema.safeParse(values)
    if (!parsed.success) return applyErrors(parsed.error.issues, setError)
    try {
      const result = service.updateGeneral(
        useAppStore.getState().session!.state,
        generalSettingsInput(parsed.data),
      )
      replaceDomainState(result.state)
      setFeedback("Algemene instellingen opgeslagen in de lokale sessie.")
    } catch (error) {
      mutationError(error, setError)
    }
  })
  const actors = session.state.records.actors
    .filter((item) => item.active && item.audit.active)
    .sort((a, b) => a.displayName.localeCompare(b.displayName, "nl"))
  return (
    <section
      className="settings-section"
      aria-labelledby="general-settings-title"
    >
      <div className="settings-section__heading">
        <div>
          <p>Gebruikerscontext</p>
          <h2 id="general-settings-title">Algemene instellingen</h2>
        </div>
      </div>
      <form
        className="settings-form settings-form--inline"
        onSubmit={(event) => void submit(event)}
        noValidate
      >
        <label>
          <span>Standaardvaluta</span>
          <input
            maxLength={3}
            {...register("defaultCurrency")}
            aria-invalid={Boolean(errors.defaultCurrency)}
          />
          {errors.defaultCurrency ? (
            <small role="alert">{errors.defaultCurrency.message}</small>
          ) : null}
        </label>
        <SearchableSelect
          label="Huidige actor"
          emptyLabel="Geen huidige actor"
          options={actors.map((item) => ({
            value: item.id,
            label: item.displayName,
          }))}
          error={
            errors.currentActorId ? (
              <small role="alert">{errors.currentActorId.message}</small>
            ) : null
          }
          {...register("currentActorId")}
        />
        <div className="settings-form__actions">
          <Button type="submit">Algemeen opslaan</Button>
          {feedback ? <span role="status">{feedback}</span> : null}
        </div>
      </form>
    </section>
  )
}

export function SettingsPage() {
  const [searchParameters, setSearchParameters] = useSearchParams()
  const session = useAppStore((state) => state.session)
  const dirty = useAppStore((state) => state.dirty)
  const setImportPanelOpen = useAppStore((state) => state.setImportPanelOpen)
  const markSaved = useAppStore((state) => state.markSaved)
  const requestedTab = searchParameters.get("tab")
  const tab: SettingsTab = tabs.some((item) => item.key === requestedTab)
    ? (requestedTab as SettingsTab)
    : "general"
  const [editor, setEditor] = useState<Editor>()
  const [saveFeedback, setSaveFeedback] = useState("")

  function selectTab(nextTab: SettingsTab) {
    const parameters = new URLSearchParams(searchParameters)
    if (nextTab === "general") parameters.delete("tab")
    else parameters.set("tab", nextTab)
    setSearchParameters(parameters, { replace: true })
    setEditor(undefined)
  }

  const resolvedEditor = useMemo(() => {
    if (!session || !editor?.id) return undefined
    if (editor.kind === "chapter")
      return session.state.indices.chapterById.get(editor.id)
    if (editor.kind === "cluster")
      return session.state.indices.clusterById.get(editor.id)
    if (editor.kind === "actor")
      return session.state.indices.actorById.get(editor.id)
    return session.state.records.choiceLists.find(
      (item) => item.id === editor.id,
    )
  }, [editor, session])

  if (!session) {
    return (
      <div className="settings-page">
        <PageHeader
          eyebrow="Beheer"
          title="Instellingen"
          description="Start een nieuwe gegevensset of open een bestaand JSON-bestand om de applicatie te configureren."
        />
        <EmptyState
          title="Nog geen gegevensset"
          description="Instellingen horen bij het lokale JSON-gegevensbestand en worden samen met alle projectdata opgeslagen."
          action={
            <Button onClick={() => setImportPanelOpen(true)}>
              JSON openen of nieuw starten
            </Button>
          }
        />
      </div>
    )
  }

  const chapters = [...session.state.records.chapters].sort(
    (a, b) => a.order - b.order,
  )
  const clusters = [...session.state.records.clusters].sort(
    (a, b) => a.order - b.order,
  )
  const actors = [...session.state.records.actors].sort((a, b) =>
    a.displayName.localeCompare(b.displayName, "nl"),
  )

  function saveJson() {
    try {
      const exported = jsonDataFileService.exportAndDownload(
        useAppStore.getState().session!.state,
      )
      markSaved(exported.fileName)
      setSaveFeedback("JSON-gegevensbestand opgeslagen.")
    } catch (error) {
      setSaveFeedback(
        error instanceof Error ? error.message : "Opslaan is mislukt.",
      )
    }
  }

  return (
    <div className="settings-page workspace-page">
      <PageHeader
        eyebrow="Beheer"
        title="Instellingen"
        description="Beheer de organisatiestructuur, actoren, keuzelijsten en lokale gegevensbron op één plaats."
        actions={
          <Badge tone={dirty ? "warning" : "success"}>
            {dirty ? "Nog opslaan" : "Opgeslagen"}
          </Badge>
        }
      />
      <KpiStrip
        ariaLabel="Beheersamenvatting"
        items={[
          {
            id: "chapters",
            label: "Hoofdstukken",
            value: chapters.filter((item) => item.audit.active).length,
            supportingText: "actief",
          },
          {
            id: "clusters",
            label: "Clusters",
            value: clusters.filter((item) => item.audit.active).length,
            supportingText: "actief",
          },
          {
            id: "actors",
            label: "Actoren",
            value: actors.filter((item) => item.active).length,
            supportingText: "actief",
          },
          {
            id: "choices",
            label: "Keuzewaarden",
            value: session.state.records.choiceLists.filter(
              (item) => item.active,
            ).length,
            supportingText: "beschikbaar",
          },
        ]}
      />
      <div
        className="settings-tabs"
        role="tablist"
        aria-label="Instellingencategorieën"
      >
        {tabs.map((item) => (
          <button
            type="button"
            role="tab"
            aria-selected={tab === item.key}
            key={item.key}
            onClick={() => selectTab(item.key)}
          >
            {item.label}
          </button>
        ))}
      </div>
      <div
        className={`settings-workspace${editor ? " settings-workspace--drawer" : ""}`}
      >
        <div className="settings-content">
          {tab === "general" ? <GeneralSettings /> : null}
          {tab === "structure" ? (
            <>
              <section
                className="settings-section"
                aria-labelledby="chapters-title"
              >
                <div className="settings-section__heading">
                  <div>
                    <p>Portfoliohiërarchie</p>
                    <h2 id="chapters-title">Hoofdstukken</h2>
                  </div>
                  <Button onClick={() => setEditor({ kind: "chapter" })}>
                    + Hoofdstuk
                  </Button>
                </div>
                <div className="settings-list">
                  {chapters.map((chapter) => (
                    <article key={chapter.id}>
                      <div>
                        <strong>
                          {chapter.code} · {chapter.title}
                        </strong>
                        <span>
                          {
                            clusters.filter(
                              (item) => item.chapterId === chapter.id,
                            ).length
                          }{" "}
                          clusters
                        </span>
                      </div>
                      <Badge
                        tone={chapter.audit.active ? "success" : "neutral"}
                      >
                        {chapter.audit.active ? "Actief" : "Inactief"}
                      </Badge>
                      <Button
                        variant="tertiary"
                        onClick={() =>
                          setEditor({ kind: "chapter", id: chapter.id })
                        }
                      >
                        Bewerken
                      </Button>
                      <Button
                        variant="secondary"
                        onClick={() =>
                          setEditor({ kind: "cluster", chapterId: chapter.id })
                        }
                      >
                        + Cluster
                      </Button>
                    </article>
                  ))}
                </div>
              </section>
              <section
                className="settings-section"
                aria-labelledby="clusters-title"
              >
                <div className="settings-section__heading">
                  <div>
                    <p>Projectgroepering</p>
                    <h2 id="clusters-title">Clusters</h2>
                  </div>
                  <Button onClick={() => setEditor({ kind: "cluster" })}>
                    + Cluster
                  </Button>
                </div>
                {clusters.length ? (
                  <div className="settings-list">
                    {clusters.map((cluster) => (
                      <article key={cluster.id}>
                        <div>
                          <strong>
                            {cluster.code} · {cluster.title}
                          </strong>
                          <span>
                            {session.state.indices.chapterById.get(
                              cluster.chapterId,
                            )?.title ?? "Onbekend hoofdstuk"}
                          </span>
                        </div>
                        <Badge
                          tone={cluster.audit.active ? "success" : "neutral"}
                        >
                          {cluster.audit.active ? "Actief" : "Inactief"}
                        </Badge>
                        <Button
                          variant="tertiary"
                          onClick={() =>
                            setEditor({ kind: "cluster", id: cluster.id })
                          }
                        >
                          Bewerken
                        </Button>
                      </article>
                    ))}
                  </div>
                ) : (
                  <p className="settings-empty">
                    Nog geen clusters. Voeg ze toe onder het juiste hoofdstuk.
                  </p>
                )}
              </section>
            </>
          ) : null}
          {tab === "actors" ? (
            <section
              className="settings-section"
              aria-labelledby="actors-title"
            >
              <div className="settings-section__heading">
                <div>
                  <p>Personen en organisaties</p>
                  <h2 id="actors-title">Actoren</h2>
                </div>
                <Button onClick={() => setEditor({ kind: "actor" })}>
                  + Actor
                </Button>
              </div>
              {actors.length ? (
                <div className="settings-list">
                  {actors.map((actor) => (
                    <article key={actor.id}>
                      <div>
                        <strong>{actor.displayName}</strong>
                        <span>
                          {actor.type}
                          {actor.organization ? ` · ${actor.organization}` : ""}
                        </span>
                      </div>
                      <Badge tone={actor.active ? "success" : "neutral"}>
                        {actor.active ? "Actief" : "Inactief"}
                      </Badge>
                      <Button
                        variant="tertiary"
                        onClick={() =>
                          setEditor({ kind: "actor", id: actor.id })
                        }
                      >
                        Bewerken
                      </Button>
                    </article>
                  ))}
                </div>
              ) : (
                <p className="settings-empty">
                  Nog geen actoren. Voeg minstens één actor toe voor
                  eigenaarschap en historiek.
                </p>
              )}
            </section>
          ) : null}
          {tab === "choices" ? (
            <section
              className="settings-section"
              aria-labelledby="choices-title"
            >
              <div className="settings-section__heading">
                <div>
                  <p>Configureerbare invoer</p>
                  <h2 id="choices-title">Keuzelijsten</h2>
                </div>
                <Button onClick={() => setEditor({ kind: "choice" })}>
                  + Waarde
                </Button>
              </div>
              <div className="settings-choice-groups">
                {configurableChoiceLists.map((definition) => {
                  const values = session.state.records.choiceLists
                    .filter((item) => item.listKey === definition.key)
                    .sort((a, b) => a.order - b.order)
                  return (
                    <section key={definition.key}>
                      <header>
                        <h3>{definition.label}</h3>
                        <Button
                          variant="tertiary"
                          onClick={() =>
                            setEditor({
                              kind: "choice",
                              listKey: definition.key,
                            })
                          }
                        >
                          + Waarde
                        </Button>
                      </header>
                      {values.length ? (
                        <ul>
                          {values.map((value) => (
                            <li key={value.id}>
                              <span>
                                {value.label}
                                <small>{value.valueKey}</small>
                              </span>
                              <Badge
                                tone={value.active ? "success" : "neutral"}
                              >
                                {value.active ? "Actief" : "Inactief"}
                              </Badge>
                              <Button
                                variant="tertiary"
                                onClick={() =>
                                  setEditor({ kind: "choice", id: value.id })
                                }
                              >
                                Bewerken
                              </Button>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p>
                          Vrije invoer blijft mogelijk; er zijn nog geen
                          suggesties.
                        </p>
                      )}
                    </section>
                  )
                })}
              </div>
            </section>
          ) : null}
          {tab === "data" ? (
            <section className="settings-section" aria-labelledby="data-title">
              <div className="settings-section__heading">
                <div>
                  <p>Lokale opslag</p>
                  <h2 id="data-title">Gegevensbestand</h2>
                </div>
              </div>
              <dl className="settings-data">
                <div>
                  <dt>Bestand</dt>
                  <dd>{session.fileName}</dd>
                </div>
                <div>
                  <dt>Formaat</dt>
                  <dd>JSON · schema {session.schemaVersion}</dd>
                </div>
                <div>
                  <dt>Status</dt>
                  <dd>
                    {dirty
                      ? "Wijzigingen nog niet opgeslagen"
                      : "Geen open wijzigingen"}
                  </dd>
                </div>
                <div>
                  <dt>Records</dt>
                  <dd>
                    {Object.values(session.state.records).reduce(
                      (total, collection) => total + collection.length,
                      0,
                    )}
                  </dd>
                </div>
              </dl>
              <div className="settings-data__actions">
                <Button onClick={saveJson}>JSON opslaan</Button>
                <Button
                  variant="secondary"
                  onClick={() => setImportPanelOpen(true)}
                >
                  Ander JSON-bestand openen
                </Button>
              </div>
              {saveFeedback ? (
                <p role="status" className="settings-data__feedback">
                  {saveFeedback}
                </p>
              ) : null}
              <p className="settings-data__privacy">
                Het bestand wordt lokaal opgebouwd en gedownload. Er wordt geen
                projectdata naar een server verzonden.
              </p>
            </section>
          ) : null}
        </div>
        {editor ? (
          <SettingsDrawer
            eyebrow={editor.id ? "Record bewerken" : "Nieuw record"}
            title={
              editor.kind === "chapter"
                ? editor.id
                  ? "Hoofdstuk bewerken"
                  : "Nieuw hoofdstuk"
                : editor.kind === "cluster"
                  ? editor.id
                    ? "Cluster bewerken"
                    : "Nieuwe cluster"
                  : editor.kind === "actor"
                    ? editor.id
                      ? "Actor bewerken"
                      : "Nieuwe actor"
                    : editor.id
                      ? "Keuzewaarde bewerken"
                      : "Nieuwe keuzewaarde"
            }
            onClose={() => setEditor(undefined)}
          >
            {editor.kind === "chapter" ? (
              <ChapterForm
                record={resolvedEditor as Chapter | undefined}
                onClose={() => setEditor(undefined)}
              />
            ) : null}
            {editor.kind === "cluster" ? (
              <ClusterForm
                record={resolvedEditor as Cluster | undefined}
                initialChapterId={editor.chapterId}
                onClose={() => setEditor(undefined)}
              />
            ) : null}
            {editor.kind === "actor" ? (
              <ActorForm
                record={resolvedEditor as Actor | undefined}
                onClose={() => setEditor(undefined)}
              />
            ) : null}
            {editor.kind === "choice" ? (
              <ChoiceForm
                record={resolvedEditor as ChoiceList | undefined}
                initialListKey={editor.listKey}
                onClose={() => setEditor(undefined)}
              />
            ) : null}
          </SettingsDrawer>
        ) : null}
      </div>
    </div>
  )
}
