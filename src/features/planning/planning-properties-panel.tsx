import { useState, type FormEvent } from "react"
import {
  PlanningManagementError,
  PlanningManagementService,
  ProjectJournalService,
} from "../../application/services"
import { useAppStore } from "../../app/state/app-store"
import { Button } from "../../design-system/components"
import { useEscapeKey } from "../../design-system/patterns"
import {
  allocationModes,
  milestoneStatuses,
  phaseIntensities,
  planningStatuses,
  resourceTypes,
  type AllocationMode,
  type LocalDate,
  type Milestone,
  type MilestoneStatus,
  type PhaseIntensity,
  type PlanningStatus,
  type ProjectPhase,
  type Resource,
  type ResourceAssignment,
  type ResourceType,
  type UUID,
} from "../../domain"
import { formatLocalDate, todayAsLocalDate } from "../../utils"

const planningService = new PlanningManagementService()
const journalService = new ProjectJournalService()

export type PlanningPanelKind =
  "phase" | "milestone" | "resource" | "assignment" | "timing"

interface PlanningPropertiesPanelProps {
  projectId?: UUID
  kind: PlanningPanelKind
  phase?: ProjectPhase
  milestone?: Milestone
  resource?: Resource
  assignment?: ResourceAssignment
  onClose: () => void
  onSaved: (message: string) => void
}

function numberValue(value: FormDataEntryValue | null): number {
  return Number(String(value ?? "0").replace(",", "."))
}

function ResourceAvailabilityEditor({ resource }: { resource: Resource }) {
  const replaceDomainState = useAppStore((state) => state.replaceDomainState)
  const [error, setError] = useState("")
  const today = todayAsLocalDate()

  function add(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError("")
    const form = event.currentTarget
    const data = new FormData(form)
    const state = useAppStore.getState().session?.state
    if (!state) return
    try {
      const result = planningService.addResourceAvailability(
        state,
        resource.id,
        {
          startDate: String(data.get("startDate")) as LocalDate,
          endDate: String(data.get("endDate")) as LocalDate,
          availabilityPercent: numberValue(data.get("availabilityPercent")),
          reason: String(data.get("reason") ?? ""),
        },
      )
      replaceDomainState(result.state)
      form.reset()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Opslaan is mislukt.")
    }
  }

  function archive(id: UUID) {
    const state = useAppStore.getState().session?.state
    if (!state) return
    try {
      const result = planningService.archiveResourceAvailability(
        state,
        resource.id,
        id,
      )
      replaceDomainState(result.state)
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Archiveren is mislukt.",
      )
    }
  }

  const active = resource.availabilityExceptions
    .filter((item) => item.audit.active)
    .sort((left, right) => left.startDate.localeCompare(right.startDate))

  return (
    <section className="planning-availability">
      <header>
        <span>Capaciteitskalender</span>
        <h3>Afwezigheid of deeltijdse beschikbaarheid</h3>
      </header>
      {active.length ? (
        <ul>
          {active.map((item) => (
            <li key={item.id}>
              <div>
                <strong>{item.reason}</strong>
                <span>
                  {formatLocalDate(item.startDate)} –{" "}
                  {formatLocalDate(item.endDate)} · {item.availabilityPercent}%
                  beschikbaar
                </span>
              </div>
              <Button variant="tertiary" onClick={() => archive(item.id)}>
                Archiveren
              </Button>
            </li>
          ))}
        </ul>
      ) : (
        <p>Nog geen afwijkingen op de standaard weekcapaciteit.</p>
      )}
      <form
        className="planning-form planning-form--availability"
        onSubmit={add}
      >
        <label>
          <span>Van</span>
          <input name="startDate" type="date" defaultValue={today} required />
        </label>
        <label>
          <span>Tot en met</span>
          <input name="endDate" type="date" defaultValue={today} required />
        </label>
        <label>
          <span>Beschikbaar (%)</span>
          <input
            name="availabilityPercent"
            type="number"
            min="0"
            max="100"
            defaultValue="0"
            required
          />
        </label>
        <label>
          <span>Reden</span>
          <input
            name="reason"
            placeholder="Bijv. verlof, opleiding of 50% inzet"
            required
          />
        </label>
        {error ? (
          <p className="planning-form__error" role="alert">
            {error}
          </p>
        ) : null}
        <footer>
          <Button type="submit" variant="secondary">
            Periode toevoegen
          </Button>
        </footer>
      </form>
    </section>
  )
}

export function PlanningPropertiesPanel({
  projectId,
  kind,
  phase,
  milestone,
  resource,
  assignment,
  onClose,
  onSaved,
}: PlanningPropertiesPanelProps) {
  useEscapeKey(onClose)
  const session = useAppStore((state) => state.session!)
  const replaceDomainState = useAppStore((state) => state.replaceDomainState)
  const project = projectId
    ? session.state.indices.projectById.get(projectId)
    : undefined
  const liveResource = resource
    ? (session.state.indices.resourceById.get(resource.id) ?? resource)
    : undefined
  const [error, setError] = useState("")
  const today = todayAsLocalDate()
  const phases = projectId
    ? (session.state.indices.phasesByProject.get(projectId) ?? [])
        .filter((item) => item.audit.active)
        .sort((left, right) => left.order - right.order)
    : []
  const resources = session.state.records.resources
    .filter((item) => item.audit.active)
    .sort((left, right) => left.name.localeCompare(right.name, "nl"))
  const actors = session.state.records.actors
    .filter((item) => item.active && item.audit.active)
    .sort((left, right) =>
      left.displayName.localeCompare(right.displayName, "nl"),
    )
  const availableResourceActors = actors.filter((actor) => {
    const linked = session.state.records.resources.find(
      (item) => item.audit.active && item.actorId === actor.id,
    )
    return !linked || linked.id === liveResource?.id
  })

  function mutate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError("")
    const data = new FormData(event.currentTarget)
    const state = useAppStore.getState().session?.state
    if (!state) return
    try {
      if (kind === "phase") {
        if (!projectId) throw new Error("Project niet gevonden.")
        const input = {
          projectId,
          name: String(data.get("name") ?? ""),
          startDate: String(data.get("startDate")) as LocalDate,
          endDate: String(data.get("endDate")) as LocalDate,
          status: String(data.get("status")) as PlanningStatus,
          progressPercent: numberValue(data.get("progressPercent")),
          intensity: String(data.get("intensity")) as PhaseIntensity,
          ...(data.get("ownerActorId")
            ? { ownerActorId: String(data.get("ownerActorId")) as UUID }
            : {}),
          ...(data.get("dependsOnPhaseId")
            ? { dependsOnPhaseId: String(data.get("dependsOnPhaseId")) as UUID }
            : {}),
          ...(phase ? { order: phase.order } : {}),
        }
        const result = phase
          ? planningService.updatePhase(state, phase.id, input)
          : planningService.createPhase(state, input)
        replaceDomainState(result.state)
        onSaved(phase ? "Fase bijgewerkt" : "Fase toegevoegd")
      } else if (kind === "milestone") {
        if (!projectId) throw new Error("Project niet gevonden.")
        const input = {
          projectId,
          name: String(data.get("name") ?? ""),
          date: String(data.get("date")) as LocalDate,
          status: String(data.get("status")) as MilestoneStatus,
          ...(data.get("phaseId")
            ? { phaseId: String(data.get("phaseId")) as UUID }
            : {}),
          ...(data.get("ownerActorId")
            ? { ownerActorId: String(data.get("ownerActorId")) as UUID }
            : {}),
        }
        const result = milestone
          ? planningService.updateMilestone(state, milestone.id, input)
          : planningService.createMilestone(state, input)
        replaceDomainState(result.state)
        onSaved(milestone ? "Mijlpaal bijgewerkt" : "Mijlpaal toegevoegd")
      } else if (kind === "resource") {
        const type = String(data.get("type")) as ResourceType
        const input = {
          type,
          name: String(data.get("name") ?? ""),
          capacityFte: numberValue(data.get("capacityFte")),
          projectAvailabilityFte: numberValue(
            data.get("projectAvailabilityFte"),
          ),
          weeklyCapacityHours: numberValue(data.get("weeklyCapacityHours")),
          ...(type === "human" && data.get("actorId")
            ? { actorId: String(data.get("actorId")) as UUID }
            : {}),
          ...(type === "role" && data.get("role")
            ? { role: String(data.get("role")) }
            : {}),
        }
        const result = liveResource
          ? planningService.updateResource(state, liveResource.id, input)
          : planningService.createResource(state, input)
        replaceDomainState(result.state)
        onSaved(liveResource ? "Asset bijgewerkt" : "Asset toegevoegd")
      } else if (kind === "assignment") {
        if (!projectId) throw new Error("Project niet gevonden.")
        const selectedResource = state.indices.resourceById.get(
          String(data.get("resource")) as UUID,
        )
        if (!selectedResource) throw new Error("Kies een asset.")
        const resourceKey =
          selectedResource.type === "role" ? "roleId" : "resourceId"
        const input = {
          projectId,
          ...(data.get("phaseId")
            ? { phaseId: String(data.get("phaseId")) as UUID }
            : {}),
          resourceType: selectedResource.type,
          [resourceKey]: selectedResource.id,
          startDate: String(data.get("startDate")) as LocalDate,
          endDate: String(data.get("endDate")) as LocalDate,
          allocation: numberValue(data.get("allocation")),
          allocationMode: String(data.get("allocationMode")) as AllocationMode,
        }
        const result = assignment
          ? planningService.updateAssignment(state, assignment.id, input)
          : planningService.createAssignment(state, input)
        replaceDomainState(result.state)
        onSaved(assignment ? "Assettoewijzing bijgewerkt" : "Asset toegewezen")
      } else {
        if (!projectId) throw new Error("Project niet gevonden.")
        const title = String(data.get("title") ?? "").trim()
        const created = journalService.createTopic(state, projectId, title)
        if (!created.record)
          throw new Error("Topic kon niet worden aangemaakt.")
        const timed = planningService.saveTopicTiming(
          created.state,
          created.record.id,
          {
            startDate: String(data.get("startDate")) as LocalDate,
            plannedEndDate: String(data.get("endDate")) as LocalDate,
            progressPercent: 0,
            status: "Niet gestart",
            isMilestone: false,
          },
        )
        replaceDomainState(timed.state)
        onSaved("Timingitem als topic toegevoegd")
      }
    } catch (caught) {
      setError(
        caught instanceof PlanningManagementError || caught instanceof Error
          ? caught.message
          : "De wijziging kon niet worden opgeslagen.",
      )
    }
  }

  function archive() {
    const state = useAppStore.getState().session?.state
    if (!state) return
    try {
      const result = phase
        ? planningService.archivePhase(state, phase.id)
        : milestone
          ? planningService.archiveMilestone(state, milestone.id)
          : assignment
            ? planningService.archiveAssignment(state, assignment.id)
            : resource
              ? planningService.archiveResource(state, resource.id)
              : undefined
      if (!result) return
      replaceDomainState(result.state)
      onSaved("Planningrecord gearchiveerd")
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Archiveren is niet gelukt.",
      )
    }
  }

  const title = {
    phase: phase ? "Fase bewerken" : "Fase toevoegen",
    milestone: milestone ? "Mijlpaal bewerken" : "Mijlpaal toevoegen",
    resource: resource ? "Asset bewerken" : "Asset toevoegen",
    assignment: assignment ? "Assettoewijzing bewerken" : "Asset toewijzen",
    timing: "Timingitem toevoegen",
  }[kind]

  return (
    <aside
      className="planning-panel"
      role="dialog"
      aria-modal="false"
      aria-labelledby="planning-properties-title"
    >
      <header className="planning-panel__header">
        <div>
          <span>
            {project ? `${project.code} · Planning` : "Portfolio · Assets"}
          </span>
          <h2 id="planning-properties-title">{title}</h2>
          <p>De tijdslijn blijft achter dit eigenschappenpaneel beschikbaar.</p>
        </div>
        <Button variant="tertiary" onClick={onClose}>
          Sluiten
        </Button>
      </header>
      <form className="planning-form" onSubmit={mutate}>
        {kind === "timing" ? (
          <section>
            <h3>Topic en timing</h3>
            <label>
              <span>Titel</span>
              <input name="title" required autoFocus />
            </label>
            <label>
              <span>Startdatum</span>
              <input
                name="startDate"
                type="date"
                defaultValue={today}
                required
              />
            </label>
            <label>
              <span>Einddatum</span>
              <input
                name="endDate"
                type="date"
                defaultValue={project?.plannedEndDate ?? today}
                required
              />
            </label>
            <p className="planning-form__hint">
              Dit maakt één projecttopic met precies één primaire planningentry.
            </p>
          </section>
        ) : null}

        {kind === "phase" ? (
          <>
            <section>
              <h3>Fase</h3>
              <label>
                <span>Naam</span>
                <input
                  name="name"
                  defaultValue={phase?.name}
                  required
                  autoFocus
                />
              </label>
              <label>
                <span>Startdatum</span>
                <input
                  name="startDate"
                  type="date"
                  defaultValue={phase?.startDate ?? project?.startDate ?? today}
                  required
                />
              </label>
              <label>
                <span>Einddatum</span>
                <input
                  name="endDate"
                  type="date"
                  defaultValue={
                    phase?.endDate ?? project?.plannedEndDate ?? today
                  }
                  required
                />
              </label>
              <label>
                <span>Voorganger</span>
                <select
                  name="dependsOnPhaseId"
                  defaultValue={phase?.dependsOnPhaseId ?? ""}
                >
                  <option value="">Geen</option>
                  {phases
                    .filter((item) => item.id !== phase?.id)
                    .map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name}
                      </option>
                    ))}
                </select>
              </label>
            </section>
            <section>
              <h3>Opvolging</h3>
              <label>
                <span>Status</span>
                <select
                  name="status"
                  defaultValue={phase?.status ?? "Niet gestart"}
                >
                  {planningStatuses.map((value) => (
                    <option key={value}>{value}</option>
                  ))}
                </select>
              </label>
              <label>
                <span>Voortgang (%)</span>
                <input
                  name="progressPercent"
                  type="number"
                  min="0"
                  max="100"
                  defaultValue={phase?.progressPercent ?? 0}
                  required
                />
              </label>
              <label>
                <span>Intensiteit</span>
                <select
                  name="intensity"
                  defaultValue={phase?.intensity ?? "Normaal"}
                >
                  {phaseIntensities.map((value) => (
                    <option key={value}>{value}</option>
                  ))}
                </select>
              </label>
              <label>
                <span>Eigenaar</span>
                <select
                  name="ownerActorId"
                  defaultValue={phase?.ownerActorId ?? ""}
                >
                  <option value="">Niet toegewezen</option>
                  {actors.map((actor) => (
                    <option key={actor.id} value={actor.id}>
                      {actor.displayName}
                    </option>
                  ))}
                </select>
              </label>
            </section>
          </>
        ) : null}

        {kind === "milestone" ? (
          <section>
            <h3>Mijlpaal</h3>
            <label>
              <span>Naam</span>
              <input
                name="name"
                defaultValue={milestone?.name}
                required
                autoFocus
              />
            </label>
            <label>
              <span>Datum</span>
              <input
                name="date"
                type="date"
                defaultValue={milestone?.date ?? today}
                required
              />
            </label>
            <label>
              <span>Fase</span>
              <select name="phaseId" defaultValue={milestone?.phaseId ?? ""}>
                <option value="">Projectniveau</option>
                {phases.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>Status</span>
              <select
                name="status"
                defaultValue={milestone?.status ?? "Gepland"}
              >
                {milestoneStatuses.map((value) => (
                  <option key={value}>{value}</option>
                ))}
              </select>
            </label>
            <label>
              <span>Eigenaar</span>
              <select
                name="ownerActorId"
                defaultValue={milestone?.ownerActorId ?? ""}
              >
                <option value="">Niet toegewezen</option>
                {actors.map((actor) => (
                  <option key={actor.id} value={actor.id}>
                    {actor.displayName}
                  </option>
                ))}
              </select>
            </label>
          </section>
        ) : null}

        {kind === "resource" ? (
          <section>
            <h3>Asset</h3>
            <label>
              <span>Naam</span>
              <input
                name="name"
                defaultValue={liveResource?.name}
                required
                autoFocus
              />
            </label>
            <label>
              <span>Type</span>
              <select name="type" defaultValue={liveResource?.type ?? "human"}>
                {resourceTypes.map((value) => (
                  <option value={value} key={value}>
                    {value}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>Gekoppelde actor (voor personen)</span>
              <select name="actorId" defaultValue={liveResource?.actorId ?? ""}>
                <option value="">Geen</option>
                {availableResourceActors.map((actor) => (
                  <option key={actor.id} value={actor.id}>
                    {actor.displayName}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>Rolbenaming (voor rollen)</span>
              <input name="role" defaultValue={liveResource?.role ?? ""} />
            </label>
            <label>
              <span>Totale capaciteit (VTE)</span>
              <input
                name="capacityFte"
                type="number"
                min="0"
                step="0.05"
                defaultValue={liveResource?.capacityFte ?? 1}
                required
              />
            </label>
            <label>
              <span>Beschikbaar voor projecten (VTE)</span>
              <input
                name="projectAvailabilityFte"
                type="number"
                min="0"
                step="0.05"
                defaultValue={liveResource?.projectAvailabilityFte ?? 1}
                required
              />
            </label>
            <label>
              <span>Standaard weekcapaciteit (uren)</span>
              <input
                name="weeklyCapacityHours"
                type="number"
                min="0"
                step="0.5"
                defaultValue={liveResource?.weeklyCapacityHours ?? 40}
                required
              />
            </label>
          </section>
        ) : null}

        {kind === "assignment" ? (
          <section>
            <h3>Toewijzing</h3>
            <label>
              <span>Asset</span>
              <select
                name="resource"
                defaultValue={
                  assignment?.resourceId ?? assignment?.roleId ?? ""
                }
                required
              >
                <option value="">Kies een persoon, rol of asset</option>
                {resources.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name} · {item.type}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>Fase</span>
              <select name="phaseId" defaultValue={assignment?.phaseId ?? ""}>
                <option value="">Hele project / vrij bereik</option>
                {phases.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>Startdatum</span>
              <input
                name="startDate"
                type="date"
                defaultValue={
                  assignment?.startDate ?? project?.startDate ?? today
                }
                required
              />
            </label>
            <label>
              <span>Einddatum</span>
              <input
                name="endDate"
                type="date"
                defaultValue={
                  assignment?.endDate ?? project?.plannedEndDate ?? today
                }
                required
              />
            </label>
            <label>
              <span>Inzet</span>
              <input
                name="allocation"
                type="number"
                min="0"
                step="0.05"
                defaultValue={assignment?.allocation ?? 0.1}
                required
              />
            </label>
            <label>
              <span>Eenheid</span>
              <select
                name="allocationMode"
                defaultValue={assignment?.allocationMode ?? "fte"}
              >
                {allocationModes.map((value) => (
                  <option key={value} value={value}>
                    {value === "fte"
                      ? "VTE"
                      : value === "hours"
                        ? "Uren per week"
                        : value === "total"
                          ? "Totaaluren"
                          : "Indicatief VTE"}
                  </option>
                ))}
              </select>
            </label>
            {!resources.length ? (
              <p className="planning-form__hint">Maak eerst een asset aan.</p>
            ) : null}
          </section>
        ) : null}

        {error ? (
          <p className="planning-form__error" role="alert">
            {error}
          </p>
        ) : null}
        <footer>
          <Button type="submit">Opslaan</Button>
          {phase || milestone || resource || assignment ? (
            <Button type="button" variant="tertiary" onClick={archive}>
              Archiveren
            </Button>
          ) : null}
          <Button type="button" variant="tertiary" onClick={onClose}>
            Annuleren
          </Button>
        </footer>
      </form>
      {kind === "resource" && liveResource ? (
        <ResourceAvailabilityEditor resource={liveResource} />
      ) : null}
    </aside>
  )
}
