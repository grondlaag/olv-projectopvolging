import { useMemo, useState } from "react"
import { useForm, useWatch, type FieldPath } from "react-hook-form"
import { Link, useNavigate, useParams } from "react-router-dom"
import {
  MeetingManagementError,
  MeetingManagementService,
  type MeetingInput,
} from "../../application/services"
import { useAppStore } from "../../app/state/app-store"
import {
  Button,
  EmptyState,
  ErrorState,
  PageHeader,
  SearchableSelect,
} from "../../design-system/components"
import {
  meetingScopeTypes,
  type Actor,
  type Meeting,
  type UUID,
} from "../../domain"
import { todayAsLocalDate } from "../../utils"
import { InlineActorPanel } from "../projects/project-form-page"
import {
  meetingFormSchema,
  meetingValuesToInput,
  type MeetingFormValues,
} from "./meeting-form-schema"
import "./meetings.css"

const meetingService = new MeetingManagementService()

function emptyValues(): MeetingFormValues {
  return {
    type: "Projectoverleg",
    scopeType: "Project",
    scopeId: "",
    number: "",
    title: "",
    date: todayAsLocalDate(),
    chairActorId: "",
    reporterActorId: "",
    nextMeetingDate: "",
    participantActorIds: [],
  }
}

function meetingValues(
  meeting: Meeting,
  participantActorIds: readonly UUID[],
): MeetingFormValues {
  return {
    type: meeting.type,
    scopeType: meeting.scopeType,
    scopeId: meeting.scopeId ?? "",
    number: meeting.number ?? "",
    title: meeting.title,
    date: meeting.date,
    chairActorId: meeting.chairActorId ?? "",
    reporterActorId: meeting.reporterActorId ?? "",
    nextMeetingDate: meeting.nextMeetingDate ?? "",
    participantActorIds: [...participantActorIds],
  }
}

function applyServiceErrors(
  error: MeetingManagementError,
  setError: ReturnType<typeof useForm<MeetingFormValues>>["setError"],
) {
  for (const issue of error.issues) {
    setError(issue.field as FieldPath<MeetingFormValues>, {
      message: issue.message,
    })
  }
}

export function MeetingFormPage() {
  const { meetingId } = useParams<{ meetingId?: string }>()
  const navigate = useNavigate()
  const session = useAppStore((state) => state.session)
  const replaceDomainState = useAppStore((state) => state.replaceDomainState)
  const setImportPanelOpen = useAppStore((state) => state.setImportPanelOpen)
  const [actorPanel, setActorPanel] = useState(false)
  const [participantSearch, setParticipantSearch] = useState("")
  const meeting = meetingId
    ? session?.state.indices.meetingById.get(meetingId as UUID)
    : undefined
  const existingParticipants = useMemo(
    () =>
      meeting && session
        ? (session.state.indices.meetingParticipantsByMeeting.get(meeting.id) ??
          [])
        : [],
    [meeting, session],
  )
  const {
    register,
    handleSubmit,
    setError,
    setValue,
    control,
    formState: { errors, isSubmitting },
  } = useForm<MeetingFormValues>({
    defaultValues: meeting
      ? meetingValues(
          meeting,
          existingParticipants.map((item) => item.actorId),
        )
      : emptyValues(),
  })
  const scopeType = useWatch({ control, name: "scopeType" })
  const participantIds = useWatch({
    control,
    name: "participantActorIds",
  })

  if (!session) {
    return (
      <EmptyState
        title="Open eerst een projectgegevensbestand"
        description="Overleg wordt binnen de actieve lokale gegevenssessie beheerd."
        action={
          <Button onClick={() => setImportPanelOpen(true)}>
            JSON openen of nieuw starten
          </Button>
        }
      />
    )
  }
  if (meetingId && !meeting) {
    return (
      <ErrorState
        title="Overleg niet gevonden"
        description="Dit overleg-ID bestaat niet in de geopende gegevensset."
      />
    )
  }
  if (meeting?.status === "Definitief") {
    return (
      <ErrorState
        title="Definitief overleg is alleen-lezen"
        description="Maak vanuit het overlegdossier een nieuwe verslagrevisie voor een correctie."
      />
    )
  }

  const activeActors = session.state.records.actors
    .filter((actor) => actor.active && actor.audit.active)
    .sort((left, right) =>
      left.displayName.localeCompare(right.displayName, "nl"),
    )
  const visibleActors = activeActors.filter((actor) =>
    `${actor.displayName} ${actor.organization ?? ""} ${actor.type}`
      .toLocaleLowerCase("nl")
      .includes(participantSearch.trim().toLocaleLowerCase("nl")),
  )
  const meetingTypes = session.state.records.choiceLists
    .filter(
      (choice) =>
        choice.listKey === "meeting-type" &&
        choice.active &&
        choice.audit.active,
    )
    .sort((left, right) => left.order - right.order)
  const scopeOptions =
    scopeType === "Hoofdstuk"
      ? session.state.records.chapters.map((item) => ({
          id: item.id,
          label: `${item.code} · ${item.title}`,
        }))
      : scopeType === "Cluster"
        ? session.state.records.clusters.map((item) => ({
            id: item.id,
            label: `${item.code} · ${item.title}`,
          }))
        : scopeType === "Project"
          ? session.state.records.projects.map((item) => ({
              id: item.id,
              label: `${item.code} · ${item.title}`,
            }))
          : []

  const submit = handleSubmit((values) => {
    const parsed = meetingFormSchema.safeParse(values)
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        const field = issue.path[0]
        if (typeof field === "string") {
          setError(field as FieldPath<MeetingFormValues>, {
            message: issue.message,
          })
        }
      }
      return
    }
    const latest = useAppStore.getState().session?.state
    if (!latest) return
    const input = meetingValuesToInput(parsed.data)
    const attendedByActor = new Map(
      existingParticipants.map((item) => [item.actorId, item.attended]),
    )
    const preservedInput: MeetingInput = {
      ...input,
      participants: input.participants.map((participant) => ({
        ...participant,
        attended: attendedByActor.get(participant.actorId) ?? false,
      })),
    }
    try {
      const result = meeting
        ? meetingService.updateMeeting(latest, meeting.id, preservedInput)
        : meetingService.createMeeting(latest, preservedInput)
      replaceDomainState(result.state)
      navigate(`/meetings/${result.record.id}`, {
        state: { saved: true },
      })
    } catch (error) {
      if (error instanceof MeetingManagementError) {
        applyServiceErrors(error, setError)
      }
    }
  })

  function selectNewActor(actor: Actor) {
    setValue(
      "participantActorIds",
      [...new Set([...(participantIds ?? []), actor.id])],
      { shouldDirty: true },
    )
    setActorPanel(false)
  }

  return (
    <article className="meeting-form-page">
      <nav className="meeting-breadcrumb" aria-label="Kruimelpad">
        <Link to="/meetings">Overleg</Link>
        <span aria-hidden="true">/</span>
        <span aria-current="page">
          {meeting ? "Overleg bewerken" : "Nieuw overleg"}
        </span>
      </nav>
      <PageHeader
        eyebrow="Voorbereiding"
        title={meeting ? "Overleg bewerken" : "Nieuw overleg"}
        description="Leg context en deelnemers rustig vast. De agenda wordt daarna in het overlegdossier opgebouwd."
      />

      <form
        className="meeting-form"
        onSubmit={(event) => void submit(event)}
        noValidate
      >
        <section>
          <header>
            <span>01</span>
            <div>
              <h2>Identiteit en moment</h2>
              <p>Een herkenbare titel en vaste kalenderdatum.</p>
            </div>
          </header>
          <div className="meeting-form__grid">
            <label>
              <span>Type</span>
              <input
                list="meeting-type-options"
                {...register("type")}
                aria-invalid={Boolean(errors.type)}
              />
              <datalist id="meeting-type-options">
                {meetingTypes.map((choice) => (
                  <option value={choice.label} key={choice.id} />
                ))}
              </datalist>
              {errors.type ? (
                <small role="alert">{errors.type.message}</small>
              ) : null}
            </label>
            <label>
              <span>
                Nummer <em>optioneel</em>
              </span>
              <input {...register("number")} />
            </label>
            <label className="meeting-form__wide">
              <span>Titel</span>
              <input
                {...register("title")}
                aria-invalid={Boolean(errors.title)}
              />
              {errors.title ? (
                <small role="alert">{errors.title.message}</small>
              ) : null}
            </label>
            <label>
              <span>Datum</span>
              <input type="date" {...register("date")} />
              {errors.date ? (
                <small role="alert">{errors.date.message}</small>
              ) : null}
            </label>
            <label>
              <span>
                Volgend overleg <em>optioneel</em>
              </span>
              <input type="date" {...register("nextMeetingDate")} />
            </label>
          </div>
        </section>

        <section>
          <header>
            <span>02</span>
            <div>
              <h2>Scope</h2>
              <p>
                De scope bepaalt welke records relevant zijn voor de agenda.
              </p>
            </div>
          </header>
          <div className="meeting-form__grid">
            <label>
              <span>Scopetype</span>
              <select
                {...register("scopeType")}
                onChange={(event) => {
                  register("scopeType").onChange(event)
                  setValue("scopeId", "", { shouldDirty: true })
                }}
              >
                {meetingScopeTypes.map((value) => (
                  <option key={value}>{value}</option>
                ))}
              </select>
            </label>
            {scopeType === "Portfolio" ? (
              <div className="meeting-form__fixed">
                <span>Scope</span>
                <strong>Volledig portfolio</strong>
              </div>
            ) : (
              <SearchableSelect
                label="Scope"
                emptyLabel="Kies een scope"
                options={scopeOptions.map((option) => ({
                  value: option.id,
                  label: option.label,
                }))}
                aria-invalid={Boolean(errors.scopeId)}
                error={
                  errors.scopeId ? (
                    <small role="alert">{errors.scopeId.message}</small>
                  ) : null
                }
                {...register("scopeId")}
              />
            )}
          </div>
        </section>

        <section>
          <header>
            <span>03</span>
            <div>
              <h2>Rollen en deelnemers</h2>
              <p>
                Alle personen verwijzen naar Actor-records; vrije namen worden
                niet opgeslagen.
              </p>
            </div>
          </header>
          <div className="meeting-form__grid">
            <SearchableSelect
              label="Voorzitter (optioneel)"
              emptyLabel="Niet gekozen"
              options={activeActors.map((actor) => ({
                value: actor.id,
                label: actor.displayName,
              }))}
              {...register("chairActorId")}
            />
            <SearchableSelect
              label="Verslaggever (optioneel)"
              emptyLabel="Niet gekozen"
              options={activeActors.map((actor) => ({
                value: actor.id,
                label: actor.displayName,
              }))}
              {...register("reporterActorId")}
            />
          </div>
          <div className="meeting-participant-picker">
            <div>
              <strong>Deelnemers</strong>
              <Button variant="tertiary" onClick={() => setActorPanel(true)}>
                + Nieuwe actor
              </Button>
            </div>
            <label className="meeting-participant-picker__search">
              <span>Deelnemers zoeken</span>
              <input
                type="search"
                value={participantSearch}
                placeholder="Naam, organisatie of type"
                onChange={(event) => setParticipantSearch(event.target.value)}
              />
            </label>
            {activeActors.length ? (
              <div className="meeting-participant-picker__options">
                {visibleActors.map((actor) => (
                  <label key={actor.id}>
                    <input
                      type="checkbox"
                      value={actor.id}
                      {...register("participantActorIds")}
                    />
                    <span>
                      <strong>{actor.displayName}</strong>
                      <small>{actor.organization ?? actor.type}</small>
                    </span>
                  </label>
                ))}
              </div>
            ) : (
              <p>Nog geen actieve actoren beschikbaar.</p>
            )}
            {errors.participantActorIds ? (
              <small role="alert">{errors.participantActorIds.message}</small>
            ) : null}
          </div>
        </section>

        <footer className="meeting-form__footer">
          <Button type="submit" disabled={isSubmitting}>
            {meeting ? "Wijzigingen opslaan" : "Overleg opslaan"}
          </Button>
          <Button
            variant="tertiary"
            onClick={() =>
              navigate(meeting ? `/meetings/${meeting.id}` : "/meetings")
            }
          >
            Annuleren
          </Button>
          <small>Mutatie gebeurt pas bij expliciet opslaan.</small>
        </footer>
      </form>

      {actorPanel ? (
        <InlineActorPanel
          contextLabel="In overlegcontext"
          onClose={() => setActorPanel(false)}
          onSaved={selectNewActor}
        />
      ) : null}
    </article>
  )
}
