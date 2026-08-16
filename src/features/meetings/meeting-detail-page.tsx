import { useMemo, useState } from "react"
import { useForm, useWatch, type FieldPath } from "react-hook-form"
import {
  Link,
  useLocation,
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router-dom"
import { buildMeetingDetailModel } from "../../application/queries"
import {
  MeetingManagementError,
  MeetingManagementService,
  TopicManagementError,
  TopicManagementService,
  UpdateManagementError,
  UpdateManagementService,
} from "../../application/services"
import { useAppStore } from "../../app/state/app-store"
import {
  Badge,
  Button,
  EmptyState,
  ErrorState,
  PageHeader,
} from "../../design-system/components"
import { useEscapeKey } from "../../design-system/patterns"
import {
  agendaDiscussionStatuses,
  agendaObjectTypes,
  type AgendaItem,
  type AgendaObjectType,
  type LocalDate,
  type ReportItem,
  type TopicStatus,
  type UUID,
} from "../../domain"
import { formatLocalDate, todayAsLocalDate } from "../../utils"
import { ActionRows } from "../actions/action-sections"
import { ActionPanel } from "../actions/action-panel"
import { NewTopicPanel } from "../topics/topic-workspace"
import {
  agendaItemFormSchema,
  agendaValuesToInput,
  meetingContributionSchema,
  type AgendaItemFormValues,
  type MeetingContributionValues,
} from "./meeting-form-schema"
import "./meetings.css"

const meetingService = new MeetingManagementService()
const topicService = new TopicManagementService()
const updateService = new UpdateManagementService()

type MeetingMode = "prepare" | "process" | "report"
type DetailPanel =
  | { type: "agenda"; item?: AgendaItem }
  | { type: "update" | "decision"; item: AgendaItem }
  | { type: "action"; item: AgendaItem }
  | { type: "topic" }
  | { type: "revision" }
  | { type: "edit-action"; actionId: UUID }

function agendaDefaults(item?: AgendaItem): AgendaItemFormValues {
  return {
    title: item?.title ?? "",
    reason: item?.reason ?? "",
    notes: item?.notes ?? "",
    discussionStatus: item?.discussionStatus ?? "Te bespreken",
    objectType: item?.objectType ?? "",
    objectId: item?.objectId ?? "",
  }
}

function objectLabel(
  state: NonNullable<
    ReturnType<typeof useAppStore.getState>["session"]
  >["state"],
  objectType: AgendaObjectType,
  objectId: UUID,
): string {
  if (objectType === "Project") {
    const item = state.indices.projectById.get(objectId)
    return item ? `${item.code} · ${item.title}` : "Onbekend project"
  }
  if (objectType === "Cluster") {
    const item = state.indices.clusterById.get(objectId)
    return item ? `${item.code} · ${item.title}` : "Onbekende cluster"
  }
  if (objectType === "Topic") {
    const item = state.indices.topicById.get(objectId)
    return item ? `${item.code} · ${item.title}` : "Onbekend topic"
  }
  const item = state.indices.actionById.get(objectId)
  return item ? `${item.code} · ${item.title}` : "Onbekende actie"
}

function groupReportItems(
  items: readonly ReportItem[],
): ReadonlyMap<string, readonly ReportItem[]> {
  const groups = new Map<string, ReportItem[]>()
  for (const item of items) {
    const group = groups.get(item.section) ?? []
    group.push(item)
    groups.set(item.section, group)
  }
  return groups
}

function groupReportItemsByOwner(
  items: readonly ReportItem[],
): ReadonlyMap<string, readonly ReportItem[]> {
  const groups = new Map<string, ReportItem[]>()
  for (const item of items) {
    const group = groups.get(item.contentType) ?? []
    group.push(item)
    groups.set(item.contentType, group)
  }
  return groups
}

interface AgendaPanelProps {
  meetingId: UUID
  item?: AgendaItem
  onClose: () => void
  onSaved: (message: string) => void
}

function AgendaPanel({ meetingId, item, onClose, onSaved }: AgendaPanelProps) {
  useEscapeKey(onClose)
  const session = useAppStore((state) => state.session)!
  const replaceDomainState = useAppStore((state) => state.replaceDomainState)
  const {
    register,
    handleSubmit,
    setError,
    setValue,
    control,
    formState: { errors, isSubmitting },
  } = useForm<AgendaItemFormValues>({ defaultValues: agendaDefaults(item) })
  const objectType = useWatch({ control, name: "objectType" })
  const candidates = useMemo(() => {
    if (!objectType) return []
    const records =
      objectType === "Project"
        ? session.state.records.projects
        : objectType === "Cluster"
          ? session.state.records.clusters
          : objectType === "Topic"
            ? session.state.records.topics
            : session.state.records.actions
    return records
      .filter(
        (record) =>
          record.audit.active &&
          meetingService.isAgendaObjectRelevant(
            session.state,
            meetingId,
            objectType,
            record.id,
          ),
      )
      .map((record) => ({
        id: record.id,
        label: objectLabel(session.state, objectType, record.id),
      }))
      .sort((left, right) => left.label.localeCompare(right.label, "nl"))
  }, [meetingId, objectType, session])

  const submit = handleSubmit((values) => {
    const parsed = agendaItemFormSchema.safeParse(values)
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        const field = issue.path[0]
        if (typeof field === "string") {
          setError(field as FieldPath<AgendaItemFormValues>, {
            message: issue.message,
          })
        }
      }
      return
    }
    const latest = useAppStore.getState().session?.state
    if (!latest) return
    try {
      const result = meetingService.saveAgendaItem(
        latest,
        meetingId,
        agendaValuesToInput(parsed.data),
        item?.id,
      )
      replaceDomainState(result.state)
      onSaved(
        `${item ? "Agendapunt bijgewerkt" : "Agendapunt toegevoegd"} in de lokale sessie · JSON nog opslaan`,
      )
    } catch (error) {
      if (error instanceof MeetingManagementError) {
        for (const issue of error.issues) {
          setError(issue.field as FieldPath<AgendaItemFormValues>, {
            message: issue.message,
          })
        }
      }
    }
  })

  return (
    <aside
      className="meeting-panel"
      role="dialog"
      aria-modal="false"
      aria-labelledby="meeting-panel-title"
    >
      <header>
        <div>
          <span>Agenda voorbereiden</span>
          <h2 id="meeting-panel-title">
            {item ? "Agendapunt bewerken" : "Agendapunt toevoegen"}
          </h2>
        </div>
        <Button variant="tertiary" onClick={onClose}>
          Sluiten
        </Button>
      </header>
      <form onSubmit={(event) => void submit(event)} noValidate>
        <label>
          <span>Titel</span>
          <input autoFocus {...register("title")} />
          {errors.title ? (
            <small role="alert">{errors.title.message}</small>
          ) : null}
        </label>
        <label>
          <span>
            Aanleiding <em>optioneel</em>
          </span>
          <textarea rows={3} {...register("reason")} />
        </label>
        <label>
          <span>Bespreekstatus</span>
          <select {...register("discussionStatus")}>
            {agendaDiscussionStatuses.map((status) => (
              <option key={status}>{status}</option>
            ))}
          </select>
        </label>
        <fieldset className="meeting-panel__source">
          <legend>
            Bronkoppeling <em>optioneel</em>
          </legend>
          <label>
            <span>Brontype</span>
            <select
              {...register("objectType")}
              onChange={(event) => {
                register("objectType").onChange(event)
                setValue("objectId", "")
              }}
            >
              <option value="">Vrij agendapunt</option>
              {agendaObjectTypes.map((type) => (
                <option key={type}>{type}</option>
              ))}
            </select>
          </label>
          {objectType ? (
            <label>
              <span>Bronrecord</span>
              <select {...register("objectId")}>
                <option value="">Kies een record</option>
                {candidates.map((candidate) => (
                  <option key={candidate.id} value={candidate.id}>
                    {candidate.label}
                  </option>
                ))}
              </select>
              {errors.objectId ? (
                <small role="alert">{errors.objectId.message}</small>
              ) : null}
            </label>
          ) : null}
        </fieldset>
        <label>
          <span>
            Notities <em>optioneel</em>
          </span>
          <textarea rows={6} {...register("notes")} />
        </label>
        <footer>
          <Button type="submit" disabled={isSubmitting}>
            Agendapunt opslaan
          </Button>
          <Button variant="tertiary" onClick={onClose}>
            Annuleren
          </Button>
        </footer>
      </form>
    </aside>
  )
}

interface ContributionPanelProps {
  meetingId: UUID
  item: AgendaItem
  mode: "update" | "decision"
  onClose: () => void
  onSaved: (message: string) => void
}

function ContributionPanel({
  meetingId,
  item,
  mode,
  onClose,
  onSaved,
}: ContributionPanelProps) {
  useEscapeKey(onClose)
  const session = useAppStore((state) => state.session)!
  const replaceDomainState = useAppStore((state) => state.replaceDomainState)
  const currentActorId = session.state.records.config[0]?.currentActorId
  const currentActor = currentActorId
    ? session.state.indices.actorById.get(currentActorId)
    : undefined
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<MeetingContributionValues>({
    defaultValues: {
      type: mode === "decision" ? "Beslissing" : "Update",
      date: todayAsLocalDate(),
      text: "",
      makeCurrent: false,
    },
  })
  const canBeCurrent =
    item.objectType === "Project" ||
    item.objectType === "Cluster" ||
    item.objectType === "Topic"

  const submit = handleSubmit((values) => {
    const parsed = meetingContributionSchema.safeParse(values)
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        const field = issue.path[0]
        if (typeof field === "string")
          setError(field as FieldPath<MeetingContributionValues>, {
            message: issue.message,
          })
      }
      return
    }
    const latest = useAppStore.getState().session?.state
    if (!latest) return
    try {
      const result = updateService.addUpdate(latest, {
        objectType: item.objectType ?? "Meeting",
        objectId: item.objectId ?? meetingId,
        meetingId,
        type: mode === "decision" ? "Beslissing" : parsed.data.type,
        date: parsed.data.date as LocalDate,
        text: parsed.data.text,
        ...(mode === "update" && canBeCurrent && parsed.data.makeCurrent
          ? { makeCurrent: true }
          : {}),
      })
      replaceDomainState(result.state)
      onSaved(
        `${mode === "decision" ? "Beslissing" : "Update"} opgeslagen in overleg én brondossier · JSON nog opslaan`,
      )
    } catch (error) {
      if (error instanceof UpdateManagementError)
        setError("text", { message: error.message })
    }
  })

  return (
    <aside
      className="meeting-panel"
      role="dialog"
      aria-modal="false"
      aria-labelledby="meeting-panel-title"
    >
      <header>
        <div>
          <span>{item.title}</span>
          <h2 id="meeting-panel-title">
            {mode === "decision" ? "Beslissing toevoegen" : "Update toevoegen"}
          </h2>
        </div>
        <Button variant="tertiary" onClick={onClose}>
          Sluiten
        </Button>
      </header>
      <form onSubmit={(event) => void submit(event)} noValidate>
        <div className="meeting-panel__fixed">
          <span>Auteur</span>
          <strong>
            {currentActor?.displayName ?? "Geen actieve actor gekozen"}
          </strong>
        </div>
        <label>
          <span>Datum</span>
          <input type="date" {...register("date")} />
        </label>
        <label>
          <span>{mode === "decision" ? "Beslissing" : "Bijdrage"}</span>
          <textarea rows={8} {...register("text")} />
          {errors.text ? (
            <small role="alert">{errors.text.message}</small>
          ) : null}
        </label>
        {mode === "update" && canBeCurrent ? (
          <label className="meeting-panel__checkbox">
            <input type="checkbox" {...register("makeCurrent")} />
            <span>Instellen als actuele stand van de bron</span>
          </label>
        ) : null}
        <footer>
          <Button type="submit" disabled={isSubmitting || !currentActor}>
            {mode === "decision" ? "Beslissing opslaan" : "Update opslaan"}
          </Button>
          <Button variant="tertiary" onClick={onClose}>
            Annuleren
          </Button>
        </footer>
      </form>
    </aside>
  )
}

interface RevisionPanelProps {
  meetingId: UUID
  onClose: () => void
  onSaved: (message: string) => void
}

function RevisionPanel({ meetingId, onClose, onSaved }: RevisionPanelProps) {
  useEscapeKey(onClose)
  const replaceDomainState = useAppStore((state) => state.replaceDomainState)
  const {
    register,
    handleSubmit,
    setError,
    formState: { isSubmitting },
  } = useForm<{ reason: string }>({ defaultValues: { reason: "" } })
  const submit = handleSubmit(({ reason }) => {
    const latest = useAppStore.getState().session?.state
    if (!latest) return
    try {
      const result = meetingService.createRevision(latest, meetingId, reason)
      replaceDomainState(result.state)
      onSaved(
        `Verslagrevisie ${result.record.version} definitief opgeslagen · JSON nog opslaan`,
      )
    } catch (error) {
      if (error instanceof MeetingManagementError)
        setError("reason", { message: error.message })
    }
  })
  return (
    <aside
      className="meeting-panel"
      role="dialog"
      aria-modal="false"
      aria-labelledby="meeting-panel-title"
    >
      <header>
        <div>
          <span>Historische correctie</span>
          <h2 id="meeting-panel-title">Nieuwe verslagrevisie</h2>
        </div>
        <Button variant="tertiary" onClick={onClose}>
          Sluiten
        </Button>
      </header>
      <form onSubmit={(event) => void submit(event)}>
        <p className="meeting-panel__warning">
          De vorige versie blijft intact. Gebruik dit alleen om het oude verslag
          te corrigeren, niet voor nieuwe overlegfeiten.
        </p>
        <label>
          <span>Reden en correctie</span>
          <textarea rows={8} {...register("reason")} />
        </label>
        <footer>
          <Button type="submit" disabled={isSubmitting}>
            Revisie definitief opslaan
          </Button>
          <Button variant="tertiary" onClick={onClose}>
            Annuleren
          </Button>
        </footer>
      </form>
    </aside>
  )
}

export function MeetingDetailPage() {
  const { meetingId } = useParams<{ meetingId: string }>()
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParameters, setSearchParameters] = useSearchParams()
  const session = useAppStore((state) => state.session)
  const replaceDomainState = useAppStore((state) => state.replaceDomainState)
  const setImportPanelOpen = useAppStore((state) => state.setImportPanelOpen)
  const dirty = useAppStore((state) => state.dirty)
  const [mode, setMode] = useState<MeetingMode>("prepare")
  const [panel, setPanel] = useState<DetailPanel>()
  const [statusMessage, setStatusMessage] = useState("")
  const [confirmFinalize, setConfirmFinalize] = useState(false)
  const selectedVersion = Number(searchParameters.get("versie")) || undefined
  const model = useMemo(
    () =>
      session && meetingId
        ? buildMeetingDetailModel(
            session.state,
            meetingId as UUID,
            todayAsLocalDate(),
            selectedVersion,
          )
        : undefined,
    [meetingId, selectedVersion, session],
  )

  if (!session)
    return (
      <EmptyState
        title="Open eerst een projectgegevensbestand"
        description="Overlegdossiers worden uit de actieve lokale sessie gelezen."
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
        title="Overleg niet gevonden"
        description="Dit overleg-ID bestaat niet in de geopende gegevensset."
      />
    )

  const { meeting } = model
  const frozen = meeting.status === "Definitief"
  const savedInNavigation = Boolean(
    (location.state as { saved?: boolean } | null)?.saved,
  )

  function commit(message: string, nextPanel?: DetailPanel) {
    setStatusMessage(message)
    setPanel(nextPanel)
  }

  function move(item: AgendaItem, direction: "up" | "down") {
    try {
      const latest = useAppStore.getState().session!.state
      const result = meetingService.moveAgendaItem(latest, item.id, direction)
      replaceDomainState(result.state)
      setStatusMessage(
        "Agendavolgorde opgeslagen in de lokale sessie · JSON nog opslaan",
      )
    } catch (error) {
      setStatusMessage(
        error instanceof Error
          ? error.message
          : "Volgorde wijzigen is mislukt.",
      )
    }
  }

  function addSuggestion(
    objectType: AgendaObjectType,
    objectId: UUID,
    title: string,
    reason: string,
  ) {
    try {
      const latest = useAppStore.getState().session!.state
      const result = meetingService.saveAgendaItem(latest, meeting.id, {
        title,
        reason,
        discussionStatus: "Te bespreken",
        objectType,
        objectId,
      })
      replaceDomainState(result.state)
      setStatusMessage("Suggestie aan de agenda toegevoegd · JSON nog opslaan")
    } catch (error) {
      setStatusMessage(
        error instanceof Error
          ? error.message
          : "Suggestie toevoegen is mislukt.",
      )
    }
  }

  function attendance(participantId: UUID, attended: boolean) {
    try {
      const latest = useAppStore.getState().session!.state
      const result = meetingService.setParticipantAttendance(
        latest,
        participantId,
        attended,
      )
      replaceDomainState(result.state)
      setStatusMessage(
        "Aanwezigheid opgeslagen in de lokale sessie · JSON nog opslaan",
      )
    } catch (error) {
      setStatusMessage(
        error instanceof Error
          ? error.message
          : "Aanwezigheid opslaan is mislukt.",
      )
    }
  }

  function changeTopicStatus(topicId: UUID, status: TopicStatus) {
    try {
      const latest = useAppStore.getState().session!.state
      const result = topicService.setTopicStatus(latest, topicId, status)
      replaceDomainState(result.state)
      setStatusMessage(
        `Topicstatus gewijzigd naar ${status.toLocaleLowerCase("nl")} · JSON nog opslaan`,
      )
    } catch (error) {
      setStatusMessage(
        error instanceof TopicManagementError || error instanceof Error
          ? error.message
          : "Topicstatus wijzigen is mislukt.",
      )
    }
  }

  function saveDraft() {
    try {
      const latest = useAppStore.getState().session!.state
      const result = meetingService.saveDraftReport(latest, meeting.id)
      replaceDomainState(result.state)
      setMode("report")
      setSearchParameters({ versie: String(result.record.version) })
      setStatusMessage(
        `Conceptverslag versie ${result.record.version} opgebouwd · JSON nog opslaan`,
      )
    } catch (error) {
      setStatusMessage(
        error instanceof Error
          ? error.message
          : "Conceptverslag maken is mislukt.",
      )
    }
  }

  function finalize() {
    try {
      const latest = useAppStore.getState().session!.state
      const result = meetingService.finalizeReport(latest, meeting.id)
      replaceDomainState(result.state)
      setMode("report")
      setSearchParameters({ versie: String(result.record.version) })
      setStatusMessage(
        `Verslag versie ${result.record.version} is definitief en historisch bevroren · JSON nog opslaan`,
      )
      setConfirmFinalize(false)
    } catch (error) {
      setStatusMessage(
        error instanceof Error
          ? error.message
          : "Verslag definitief maken is mislukt.",
      )
    }
  }

  const canCreateTopic =
    meeting.scopeType === "Project" || meeting.scopeType === "Cluster"

  return (
    <article className={`meeting-detail meeting-detail--${mode}`}>
      <nav className="meeting-breadcrumb" aria-label="Kruimelpad">
        <Link to="/meetings">Overleg</Link>
        <span aria-hidden="true">/</span>
        <span aria-current="page">{meeting.number ?? meeting.title}</span>
      </nav>
      <PageHeader
        eyebrow={`${meeting.type}${meeting.number ? ` · ${meeting.number}` : ""}`}
        title={meeting.title}
        description={`${formatLocalDate(meeting.date)} · ${model.scopeLabel}`}
        actions={
          !frozen ? (
            <Button onClick={() => navigate(`/meetings/${meeting.id}/edit`)}>
              Overleg bewerken
            </Button>
          ) : (
            <Badge tone="success">Historisch vastgelegd</Badge>
          )
        }
      />

      {dirty || savedInNavigation || statusMessage ? (
        <div className="meeting-session-status" role="status">
          <strong>
            {statusMessage || "Opgeslagen in sessie · JSON nog opslaan"}
          </strong>
          <small>
            De wijziging blijft lokaal tot het volgende JSON-bestand wordt
            opgeslagen.
          </small>
        </div>
      ) : null}

      <div className="meeting-summary" aria-label="Overlegkern">
        <div>
          <span>Status</span>
          <Badge tone={frozen ? "success" : "info"}>{meeting.status}</Badge>
        </div>
        <div>
          <span>Scope</span>
          <strong>{meeting.scopeType}</strong>
        </div>
        <div>
          <span>Voorzitter</span>
          <strong>{model.chair?.displayName ?? "—"}</strong>
        </div>
        <div>
          <span>Verslaggever</span>
          <strong>{model.reporter?.displayName ?? "—"}</strong>
        </div>
        <div>
          <span>Volgend overleg</span>
          <strong>{formatLocalDate(meeting.nextMeetingDate)}</strong>
        </div>
      </div>

      <nav className="meeting-mode-nav" aria-label="Overlegmodus">
        <button
          className={mode === "prepare" ? "is-active" : ""}
          onClick={() => setMode("prepare")}
        >
          Voorbereiden <span>{model.agenda.length}</span>
        </button>
        <button
          className={mode === "process" ? "is-active" : ""}
          onClick={() => setMode("process")}
        >
          Verwerken <span>{model.decisions.length + model.actions.length}</span>
        </button>
        <button
          className={mode === "report" ? "is-active" : ""}
          onClick={() => setMode("report")}
        >
          Verslag <span>{model.reports.length}</span>
        </button>
      </nav>

      {frozen && mode !== "report" ? (
        <div className="meeting-frozen-warning">
          <strong>Definitieve historische toestand</strong>
          <span>
            Inhoudelijke wijzigingen zijn geblokkeerd. Een correctie maakt
            altijd een nieuwe verslagversie.
          </span>
        </div>
      ) : null}

      {mode === "prepare" ? (
        <div className="meeting-workspace">
          <main>
            <section className="meeting-section">
              <header>
                <div>
                  <span>Uitgenodigd</span>
                  <h2>Deelnemers</h2>
                </div>
                <strong>{model.participants.length}</strong>
              </header>
              {model.participants.length ? (
                <ul className="meeting-participants">
                  {model.participants.map(({ participant, actor }) => (
                    <li key={participant.id}>
                      <span>
                        <strong>
                          {actor?.displayName ?? "Onbekende actor"}
                        </strong>
                        <small>
                          {participant.role ??
                            actor?.organization ??
                            actor?.type}
                        </small>
                      </span>
                      <Badge
                        tone={participant.attended ? "success" : "neutral"}
                      >
                        {participant.attended
                          ? "Aanwezig"
                          : "Nog niet geregistreerd"}
                      </Badge>
                    </li>
                  ))}
                </ul>
              ) : (
                <EmptyState
                  title="Nog geen deelnemers"
                  description="Voeg deelnemers toe via Overleg bewerken."
                />
              )}
            </section>
            <section className="meeting-section meeting-agenda">
              <header>
                <div>
                  <span>Geordende voorbereiding</span>
                  <h2>Agenda</h2>
                </div>
                {!frozen ? (
                  <div>
                    <Button
                      variant="secondary"
                      onClick={() => setPanel({ type: "agenda" })}
                    >
                      + Agendapunt
                    </Button>
                    {canCreateTopic ? (
                      <Button
                        variant="tertiary"
                        onClick={() => setPanel({ type: "topic" })}
                      >
                        + Nieuw topic
                      </Button>
                    ) : null}
                  </div>
                ) : null}
              </header>
              {model.agenda.length ? (
                <ol>
                  {model.agenda.map((item, index) => (
                    <li key={item.id}>
                      <div className="meeting-agenda__order">
                        <strong>{item.order}</strong>
                        {!frozen ? (
                          <span>
                            <button
                              aria-label={`${item.title} omhoog`}
                              disabled={index === 0}
                              onClick={() => move(item, "up")}
                            >
                              ↑
                            </button>
                            <button
                              aria-label={`${item.title} omlaag`}
                              disabled={index === model.agenda.length - 1}
                              onClick={() => move(item, "down")}
                            >
                              ↓
                            </button>
                          </span>
                        ) : null}
                      </div>
                      <div className="meeting-agenda__content">
                        <header>
                          <strong>{item.title}</strong>
                          <Badge
                            tone={
                              item.discussionStatus === "Besproken"
                                ? "success"
                                : item.discussionStatus === "Doorgeschoven"
                                  ? "warning"
                                  : "neutral"
                            }
                          >
                            {item.discussionStatus}
                          </Badge>
                        </header>
                        {item.objectType && item.objectId ? (
                          <small>
                            {objectLabel(
                              session.state,
                              item.objectType,
                              item.objectId,
                            )}
                          </small>
                        ) : (
                          <small>Vrij agendapunt</small>
                        )}
                        {item.reason ? <p>{item.reason}</p> : null}
                      </div>
                      {!frozen ? (
                        <Button
                          variant="tertiary"
                          onClick={() => setPanel({ type: "agenda", item })}
                        >
                          Bewerken
                        </Button>
                      ) : null}
                    </li>
                  ))}
                </ol>
              ) : (
                <EmptyState
                  title="Agenda is nog leeg"
                  description="Voeg een vrij agendapunt toe of koppel een relevant project-, cluster-, topic- of actierecord."
                />
              )}
            </section>
          </main>
          <aside className="meeting-suggestions">
            <span>Slimme voorbereiding</span>
            <h2>Voorgesteld voor agenda</h2>
            <p>
              Afgeleid uit open en kritieke topics, besliswacht en
              achterstallige acties. Er worden geen nieuwe velden opgeslagen.
            </p>
            {model.suggestions.length ? (
              <ul>
                {model.suggestions.map((suggestion) => (
                  <li
                    key={`${suggestion.objectType}:${suggestion.objectId}`}
                    className={
                      suggestion.tone === "attention" ? "is-attention" : ""
                    }
                  >
                    <strong>{suggestion.title}</strong>
                    <small>{suggestion.reason}</small>
                    {!frozen ? (
                      <Button
                        variant="tertiary"
                        onClick={() =>
                          addSuggestion(
                            suggestion.objectType,
                            suggestion.objectId,
                            suggestion.title,
                            suggestion.reason,
                          )
                        }
                      >
                        Toevoegen
                      </Button>
                    ) : null}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="meeting-suggestions__empty">
                Geen nieuwe relevante suggesties.
              </p>
            )}
          </aside>
        </div>
      ) : mode === "process" ? (
        <div className="meeting-processing">
          <section className="meeting-section">
            <header>
              <div>
                <span>Registratie</span>
                <h2>Aanwezigheid</h2>
              </div>
            </header>
            {model.participants.length ? (
              <div className="meeting-attendance">
                {model.participants.map(({ participant, actor }) => (
                  <label key={participant.id}>
                    <input
                      type="checkbox"
                      checked={participant.attended}
                      disabled={frozen}
                      onChange={(event) =>
                        attendance(participant.id, event.target.checked)
                      }
                    />
                    <span>{actor?.displayName ?? "Onbekende actor"}</span>
                  </label>
                ))}
              </div>
            ) : (
              <EmptyState
                title="Geen deelnemers"
                description="Voeg deelnemers toe voordat het overleg wordt verwerkt."
              />
            )}
          </section>
          <section className="meeting-section meeting-agenda meeting-agenda--processing">
            <header>
              <div>
                <span>Per agendapunt</span>
                <h2>Bespreking en opvolging</h2>
              </div>
            </header>
            {model.agenda.length ? (
              <ol>
                {model.agenda.map((item) => (
                  <li key={item.id}>
                    <div className="meeting-agenda__order">
                      <strong>{item.order}</strong>
                    </div>
                    <div className="meeting-agenda__content">
                      <header>
                        <strong>{item.title}</strong>
                        <Badge
                          tone={
                            item.discussionStatus === "Besproken"
                              ? "success"
                              : "neutral"
                          }
                        >
                          {item.discussionStatus}
                        </Badge>
                      </header>
                      {item.notes ? (
                        <p>{item.notes}</p>
                      ) : (
                        <p className="is-muted">Nog geen bespreeknotities.</p>
                      )}
                      <div className="meeting-agenda__context-actions">
                        {!frozen ? (
                          <>
                            {item.objectType === "Topic" && item.objectId ? (
                              <label className="meeting-agenda__topic-status">
                                <span>Topicstatus</span>
                                <select
                                  aria-label={`Topicstatus ${item.title}`}
                                  value={
                                    session.state.indices.topicById.get(
                                      item.objectId,
                                    )?.status ?? "Open"
                                  }
                                  onChange={(event) =>
                                    changeTopicStatus(
                                      item.objectId!,
                                      event.target.value as TopicStatus,
                                    )
                                  }
                                >
                                  <option>Open</option>
                                  <option>Afgesloten</option>
                                  <option>Geannuleerd</option>
                                </select>
                              </label>
                            ) : null}
                            <Button
                              variant="tertiary"
                              onClick={() => setPanel({ type: "agenda", item })}
                            >
                              Notitie / status
                            </Button>
                            <Button
                              variant="secondary"
                              onClick={() => setPanel({ type: "update", item })}
                            >
                              + Update
                            </Button>
                            <Button
                              variant="secondary"
                              onClick={() =>
                                setPanel({ type: "decision", item })
                              }
                            >
                              + Beslissing
                            </Button>
                            <Button
                              onClick={() => setPanel({ type: "action", item })}
                            >
                              + Actie
                            </Button>
                          </>
                        ) : null}
                      </div>
                    </div>
                  </li>
                ))}
              </ol>
            ) : (
              <EmptyState
                title="Geen agenda om te verwerken"
                description="Bouw de agenda eerst op in de voorbereidingsmodus."
              />
            )}
          </section>
          <section className="meeting-section">
            <header>
              <div>
                <span>Overlegbijdragen</span>
                <h2>Beslissingen en updates</h2>
              </div>
              <strong>{model.decisions.length + model.updates.length}</strong>
            </header>
            {model.decisions.length + model.updates.length ? (
              <ol className="meeting-contributions">
                {[...model.decisions, ...model.updates]
                  .sort((left, right) =>
                    right.audit.createdAt.localeCompare(left.audit.createdAt),
                  )
                  .map((entry) => (
                    <li
                      key={entry.id}
                      className={
                        entry.type === "Beslissing" ? "is-decision" : ""
                      }
                    >
                      <Badge
                        tone={
                          entry.type === "Beslissing" ? "warning" : "neutral"
                        }
                      >
                        {entry.type}
                      </Badge>
                      <div>
                        <p>{entry.text}</p>
                        <small>
                          {formatLocalDate(entry.date)} · {entry.objectType}
                        </small>
                      </div>
                    </li>
                  ))}
              </ol>
            ) : (
              <EmptyState
                title="Nog geen bijdragen"
                description="Updates en beslissingen verschijnen hier én in het gekoppelde brondossier."
              />
            )}
          </section>
          <section className="meeting-section">
            <header>
              <div>
                <span>Verantwoordelijkheden</span>
                <h2>Acties per persoon</h2>
              </div>
              <strong>{model.actions.length}</strong>
            </header>
            {model.actionOwnerGroups.length ? (
              <div className="meeting-owner-groups">
                {model.actionOwnerGroups.map((group) => (
                  <section key={group.ownerActorId}>
                    <header>
                      <h3>{group.owner?.displayName ?? "Onbekende actor"}</h3>
                      <span>{group.actions.length}</span>
                    </header>
                    <ActionRows
                      items={group.actions}
                      onEdit={(actionId) =>
                        setPanel({ type: "edit-action", actionId })
                      }
                      showContext
                    />
                  </section>
                ))}
              </div>
            ) : (
              <EmptyState
                title="Nog geen overlegacties"
                description="Maak een actie vanuit het relevante agendapunt; de globale actielijst gebruikt hetzelfde record."
              />
            )}
          </section>
          {!frozen ? (
            <div className="meeting-report-callout">
              <div>
                <span>Verwerking gereed?</span>
                <strong>Maak eerst een controleerbaar conceptverslag.</strong>
              </div>
              <Button variant="secondary" onClick={saveDraft}>
                Conceptverslag opbouwen
              </Button>
            </div>
          ) : null}
        </div>
      ) : (
        <div className="meeting-report-area">
          <header className="meeting-report-toolbar">
            <div>
              <span>Verslaghistoriek</span>
              <h2>
                {model.selectedReport
                  ? `Verslag versie ${model.selectedReport.version}`
                  : "Nog geen verslag"}
              </h2>
            </div>
            <div>
              {model.selectedReport ? (
                <Button variant="tertiary" onClick={() => window.print()}>
                  Afdrukken
                </Button>
              ) : null}
              {!frozen ? (
                <>
                  <Button variant="secondary" onClick={saveDraft}>
                    {model.selectedReport?.status === "Concept"
                      ? "Concept actualiseren"
                      : "Conceptverslag maken"}
                  </Button>
                  <Button onClick={() => setConfirmFinalize(true)}>
                    Definitief maken
                  </Button>
                </>
              ) : (
                <Button
                  variant="secondary"
                  onClick={() => setPanel({ type: "revision" })}
                >
                  Nieuwe revisie
                </Button>
              )}
            </div>
          </header>
          {confirmFinalize && !frozen ? (
            <div className="meeting-inline-confirm" role="alert">
              <div>
                <strong>Verslag definitief maken?</strong>
                <span>
                  Agenda, deelnemers en verslaginhoud worden als historische
                  snapshot bevroren. Een latere correctie maakt een revisie.
                </span>
              </div>
              <Button
                variant="tertiary"
                onClick={() => setConfirmFinalize(false)}
              >
                Annuleren
              </Button>
              <Button onClick={finalize}>Ja, definitief maken</Button>
            </div>
          ) : null}
          {model.reports.length ? (
            <nav
              className="meeting-report-versions"
              aria-label="Verslagversies"
            >
              {model.reports.map((report) => (
                <button
                  key={report.id}
                  className={
                    model.selectedReport?.id === report.id ? "is-active" : ""
                  }
                  onClick={() =>
                    setSearchParameters({ versie: String(report.version) })
                  }
                >
                  Versie {report.version}
                  <small>
                    {report.status} ·{" "}
                    {formatLocalDate(report.finalDate ?? report.draftDate)}
                  </small>
                </button>
              ))}
            </nav>
          ) : null}
          {model.selectedReport ? (
            <article className="meeting-report-document">
              <header>
                <div>
                  <span>
                    {meeting.type}
                    {meeting.number ? ` · ${meeting.number}` : ""}
                  </span>
                  <h2>{meeting.title}</h2>
                  <p>
                    {formatLocalDate(meeting.date)} · {model.scopeLabel}
                  </p>
                </div>
                <Badge
                  tone={
                    model.selectedReport.status === "Concept"
                      ? "info"
                      : "success"
                  }
                >
                  {model.selectedReport.status}
                </Badge>
              </header>
              <dl>
                <div>
                  <dt>Voorzitter</dt>
                  <dd>{model.chair?.displayName ?? "—"}</dd>
                </div>
                <div>
                  <dt>Verslaggever</dt>
                  <dd>{model.reporter?.displayName ?? "—"}</dd>
                </div>
                <div>
                  <dt>Versie</dt>
                  <dd>{model.selectedReport.version}</dd>
                </div>
                <div>
                  <dt>Volgend overleg</dt>
                  <dd>{formatLocalDate(meeting.nextMeetingDate)}</dd>
                </div>
              </dl>
              {model.selectedReportItems.length ? (
                <div className="meeting-report-items">
                  {[...groupReportItems(model.selectedReportItems)].map(
                    ([section, items]) => (
                      <section key={section}>
                        <h3>{section}</h3>
                        {section === "Acties" &&
                        items.some((item) => item.contentType !== "Actie") ? (
                          <div className="meeting-report-owner-groups">
                            {[...groupReportItemsByOwner(items)].map(
                              ([owner, ownerItems]) => (
                                <section key={owner}>
                                  <h4>{owner}</h4>
                                  {ownerItems.map((item) => (
                                    <article key={item.id}>
                                      <h5>{item.titleSnapshot}</h5>
                                      <p>{item.textSnapshot}</p>
                                    </article>
                                  ))}
                                </section>
                              ),
                            )}
                          </div>
                        ) : (
                          items.map((item) => (
                            <article key={item.id}>
                              <h4>{item.titleSnapshot}</h4>
                              <p>{item.textSnapshot}</p>
                            </article>
                          ))
                        )}
                      </section>
                    ),
                  )}
                </div>
              ) : (
                <EmptyState
                  title="Leeg conceptverslag"
                  description="Werk deelnemers, agenda, updates, beslissingen en acties bij en actualiseer daarna het concept."
                />
              )}
            </article>
          ) : (
            <EmptyState
              title="Nog geen verslag"
              description="Verwerk de agenda en bouw daarna een conceptverslag op. Definitief maken bevriest de snapshots."
              action={
                !frozen ? (
                  <Button onClick={saveDraft}>Conceptverslag opbouwen</Button>
                ) : undefined
              }
            />
          )}
        </div>
      )}

      {panel?.type === "agenda" ? (
        <AgendaPanel
          meetingId={meeting.id}
          {...(panel.item ? { item: panel.item } : {})}
          onClose={() => setPanel(undefined)}
          onSaved={(message) => commit(message)}
        />
      ) : null}
      {panel?.type === "update" || panel?.type === "decision" ? (
        <ContributionPanel
          meetingId={meeting.id}
          item={panel.item}
          mode={panel.type}
          onClose={() => setPanel(undefined)}
          onSaved={(message) => commit(message)}
        />
      ) : null}
      {panel?.type === "action" ? (
        <ActionPanel
          objectType={
            panel.item.objectType === "Project" ||
            panel.item.objectType === "Cluster" ||
            panel.item.objectType === "Topic"
              ? panel.item.objectType
              : "Meeting"
          }
          objectId={
            panel.item.objectType === "Project" ||
            panel.item.objectType === "Cluster" ||
            panel.item.objectType === "Topic"
              ? panel.item.objectId!
              : meeting.id
          }
          sourceMeetingId={meeting.id}
          contextLabel={`${meeting.title} · ${panel.item.title}`}
          onClose={() => setPanel(undefined)}
          onSaved={() =>
            setStatusMessage(
              "Actie opgeslagen in overleg en globale werklijst · JSON nog opslaan",
            )
          }
        />
      ) : null}
      {panel?.type === "edit-action" ? (
        <ActionPanel
          actionId={panel.actionId}
          contextLabel={meeting.title}
          onClose={() => setPanel(undefined)}
          onSaved={() =>
            setStatusMessage("Actie bijgewerkt · JSON nog opslaan")
          }
        />
      ) : null}
      {panel?.type === "topic" && canCreateTopic && meeting.scopeId ? (
        <NewTopicPanel
          parentType={meeting.scopeType as "Project" | "Cluster"}
          parentId={meeting.scopeId}
          onClose={() => setPanel(undefined)}
          onSaved={(topic) => {
            const latest = useAppStore.getState().session!.state
            const agenda = meetingService.saveAgendaItem(latest, meeting.id, {
              title: `${topic.code} · ${topic.title}`,
              reason: "Nieuw topic vanuit overlegvoorbereiding",
              discussionStatus: "Te bespreken",
              objectType: "Topic",
              objectId: topic.id,
            })
            replaceDomainState(agenda.state)
            commit(
              "Nieuw topic en agendakoppeling opgeslagen · JSON nog opslaan",
            )
          }}
        />
      ) : null}
      {panel?.type === "revision" ? (
        <RevisionPanel
          meetingId={meeting.id}
          onClose={() => setPanel(undefined)}
          onSaved={(message) => commit(message)}
        />
      ) : null}
    </article>
  )
}
