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
} from "../../application/services"
import { useAppStore } from "../../app/state/app-store"
import { currentAppRoute, withReturnTo } from "../../app/routing"
import {
  Badge,
  Button,
  EmptyState,
  ErrorState,
  FavoriteButton,
  PageHeader,
} from "../../design-system/components"
import { useEscapeKey } from "../../design-system/patterns"
import {
  agendaDiscussionStatuses,
  type AgendaItem,
  type AgendaObjectType,
  type ReportItem,
  type UUID,
} from "../../domain"
import { formatLocalDate, todayAsLocalDate } from "../../utils"
import type { MeetingDocumentKind } from "../../infrastructure/files/meeting-document-service"
import { ActionPanel } from "../actions/action-panel"
import { NewTopicPanel } from "../topics/topic-workspace"
import {
  MeetingAgendaPreparation,
  MeetingProcessingWorkspace,
} from "./meeting-processing-workspace"
import {
  agendaItemFormSchema,
  agendaValuesToInput,
  type AgendaItemFormValues,
} from "./meeting-form-schema"
import "./meetings.css"

const meetingService = new MeetingManagementService()

type MeetingMode = "prepare" | "process" | "report"
type DetailPanel =
  | { type: "agenda"; item?: AgendaItem }
  | { type: "topic" }
  | { type: "revision" }
  | { type: "edit-action"; actionId: UUID }

function agendaDefaults(item?: AgendaItem): AgendaItemFormValues {
  return {
    title: item?.title ?? "",
    reason: item?.reason ?? "",
    notes: item?.notes ?? "",
    discussionStatus: item?.discussionStatus ?? "Te bespreken",
    objectType:
      item?.objectType === "Project" || item?.objectType === "Topic"
        ? item.objectType
        : "Project",
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
    getValues,
    control,
    formState: { errors, isSubmitting },
  } = useForm<AgendaItemFormValues>({ defaultValues: agendaDefaults(item) })
  const objectType = useWatch({ control, name: "objectType" })
  const candidates = useMemo(() => {
    const records =
      objectType === "Project"
        ? session.state.records.projects
        : session.state.records.topics
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
  const objectIdField = register("objectId")

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
        `${item ? "Agendapunt bijgewerkt" : "Agendapunt toegevoegd"} in de lokale sessie · back-up nodig`,
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
          <legend>Bronkoppeling</legend>
          <label>
            <span>Brontype</span>
            <select
              {...register("objectType")}
              onChange={(event) => {
                register("objectType").onChange(event)
                setValue("objectId", "")
              }}
            >
              {(["Project", "Topic"] as const).map((type) => (
                <option key={type}>{type}</option>
              ))}
            </select>
          </label>
          <label>
            <span>Bronrecord</span>
            <select
              {...objectIdField}
              onChange={(event) => {
                objectIdField.onChange(event)
                if (!item && !getValues("title").trim()) {
                  const candidate = candidates.find(
                    (entry) => entry.id === event.target.value,
                  )
                  if (candidate)
                    setValue("title", candidate.label, {
                      shouldDirty: true,
                      shouldValidate: true,
                    })
                }
              }}
            >
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
        `Verslagrevisie ${result.record.version} definitief opgeslagen · back-up nodig`,
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
  const requestedMode = searchParameters.get("modus")
  const mode: MeetingMode =
    requestedMode === "process" || requestedMode === "report"
      ? requestedMode
      : "prepare"
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
  const sourceMeeting = meeting.sourceMeetingId
    ? session.state.indices.meetingById.get(meeting.sourceMeetingId)
    : undefined
  const frozen = meeting.status === "Definitief"
  const savedInNavigation = Boolean(
    (location.state as { saved?: boolean } | null)?.saved,
  )

  function commit(message: string, nextPanel?: DetailPanel) {
    setStatusMessage(message)
    setPanel(nextPanel)
  }

  function selectMode(nextMode: MeetingMode) {
    const parameters = new URLSearchParams(searchParameters)
    if (nextMode === "prepare") parameters.delete("modus")
    else parameters.set("modus", nextMode)
    setSearchParameters(parameters, { replace: true })
  }

  function selectReportVersion(version: number) {
    const parameters = new URLSearchParams(searchParameters)
    parameters.set("modus", "report")
    parameters.set("versie", String(version))
    setSearchParameters(parameters, { replace: true })
  }

  function move(item: AgendaItem, direction: "up" | "down") {
    try {
      const latest = useAppStore.getState().session!.state
      const result = meetingService.moveAgendaItem(latest, item.id, direction)
      replaceDomainState(result.state)
      setStatusMessage(
        "Agendavolgorde opgeslagen in de lokale sessie · back-up nodig",
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
    objectType: Extract<AgendaObjectType, "Project" | "Topic">,
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
      setStatusMessage("Suggestie aan de agenda toegevoegd · back-up nodig")
    } catch (error) {
      setStatusMessage(
        error instanceof Error
          ? error.message
          : "Suggestie toevoegen is mislukt.",
      )
    }
  }

  function saveDraft() {
    try {
      const latest = useAppStore.getState().session!.state
      const result = meetingService.saveDraftReport(latest, meeting.id)
      replaceDomainState(result.state)
      selectReportVersion(result.record.version)
      setStatusMessage(
        `Conceptverslag versie ${result.record.version} opgebouwd · back-up nodig`,
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
      selectReportVersion(result.record.version)
      setStatusMessage(
        `Verslag versie ${result.record.version} is definitief en historisch bevroren · back-up nodig`,
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

  async function exportDocument(
    kind: MeetingDocumentKind,
    operation: "pdf" | "copy",
  ) {
    try {
      const { buildMeetingDocument, copyMeetingRichText, downloadMeetingPdf } =
        await import("../../infrastructure/files/meeting-document-service")
      const document = buildMeetingDocument(model!, kind)
      if (operation === "pdf") {
        await downloadMeetingPdf(document)
        setStatusMessage(
          `${kind === "agenda" ? "Agenda" : "Verslag"}-PDF gedownload`,
        )
      } else {
        await copyMeetingRichText(document)
        setStatusMessage(
          `${kind === "agenda" ? "Agenda" : "Verslag"} met opmaak gekopieerd voor Outlook`,
        )
      }
    } catch (error) {
      setStatusMessage(
        error instanceof Error
          ? error.message
          : "Het document kon niet worden gemaakt.",
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
          <>
            <FavoriteButton
              route={`/meetings/${meeting.id}`}
              label={meeting.title}
              kind="Overleg"
            />
            <Button
              variant="secondary"
              onClick={() => navigate(`/meetings/new?vervolgVan=${meeting.id}`)}
            >
              Vervolgoverleg maken
            </Button>
            {!frozen ? (
              <Button
                onClick={() =>
                  navigate(
                    withReturnTo(
                      `/meetings/${meeting.id}/edit`,
                      currentAppRoute(location),
                    ),
                  )
                }
              >
                Overleg bewerken
              </Button>
            ) : (
              <Badge tone="success">Historisch vastgelegd</Badge>
            )}
          </>
        }
      />

      {sourceMeeting ? (
        <p className="meeting-source-link">
          Vervolg op{" "}
          <Link to={`/meetings/${sourceMeeting.id}`}>
            {sourceMeeting.title}
          </Link>
        </p>
      ) : null}

      {dirty || savedInNavigation || statusMessage ? (
        <div className="meeting-session-status" role="status">
          <strong>
            {statusMessage || "Bewaard in lokale sessie · back-up nodig"}
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
          onClick={() => selectMode("prepare")}
        >
          Voorbereiden <span>{model.agenda.length}</span>
        </button>
        <button
          className={mode === "process" ? "is-active" : ""}
          onClick={() => selectMode("process")}
        >
          Verwerken <span>{model.decisions.length + model.actions.length}</span>
        </button>
        <button
          className={mode === "report" ? "is-active" : ""}
          onClick={() => selectMode("report")}
        >
          Verslag <span>{model.reports.length}</span>
        </button>
      </nav>

      {mode === "prepare" || (mode === "report" && model.selectedReport) ? (
        <div className="meeting-document-actions" aria-label="Documentuitvoer">
          <span>{mode === "prepare" ? "Agenda delen" : "Verslag delen"}</span>
          <Button
            variant="tertiary"
            onClick={() =>
              void exportDocument(
                mode === "prepare" ? "agenda" : "report",
                "copy",
              )
            }
          >
            Kopieer voor Outlook
          </Button>
          <Button
            variant="secondary"
            onClick={() =>
              void exportDocument(
                mode === "prepare" ? "agenda" : "report",
                "pdf",
              )
            }
          >
            {mode === "prepare" ? "Agenda PDF" : "Verslag PDF"}
          </Button>
        </div>
      ) : null}

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
            <MeetingAgendaPreparation
              model={model}
              frozen={frozen}
              canCreateTopic={canCreateTopic}
              onAdd={() => setPanel({ type: "agenda" })}
              onNewTopic={() => setPanel({ type: "topic" })}
              onEdit={(item) => setPanel({ type: "agenda", item })}
              onMove={move}
            />
            <section className="meeting-section meeting-agenda" hidden>
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
        <MeetingProcessingWorkspace
          model={model}
          frozen={frozen}
          onMessage={setStatusMessage}
          onBuildReport={saveDraft}
          onEditAgenda={(item) => setPanel({ type: "agenda", item })}
          onEditAction={(actionId) =>
            setPanel({ type: "edit-action", actionId })
          }
        />
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
                  onClick={() => selectReportVersion(report.version)}
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
      {panel?.type === "edit-action" ? (
        <ActionPanel
          actionId={panel.actionId}
          contextLabel={meeting.title}
          onClose={() => setPanel(undefined)}
          onSaved={() => setStatusMessage("Actie bijgewerkt · back-up nodig")}
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
            commit("Nieuw topic en agendakoppeling opgeslagen · back-up nodig")
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
