import { useState, type FormEvent } from "react"
import { ProjectManagementService } from "../../application/services"
import { useAppStore } from "../../app/state/app-store"
import { Button } from "../../design-system/components"
import {
  projectStatuses,
  type Project,
  type ProjectStatus,
  type UUID,
} from "../../domain"

const projectService = new ProjectManagementService()

interface ProjectQuickEditProps {
  project: Project
  onSaved: (message: string) => void
}

export function ProjectQuickEdit({ project, onSaved }: ProjectQuickEditProps) {
  const session = useAppStore((state) => state.session)!
  const [status, setStatus] = useState<ProjectStatus>(project.status)
  const [phase, setPhase] = useState(project.phase)
  const [coordinatorActorId, setCoordinatorActorId] = useState(
    project.coordinatorActorId ?? "",
  )
  const [progressPercent, setProgressPercent] = useState(
    String(project.progressPercent ?? 0),
  )
  const [error, setError] = useState("")
  const activeActors = session.state.records.actors
    .filter((actor) => actor.active && actor.audit.active)
    .sort((left, right) =>
      left.displayName.localeCompare(right.displayName, "nl"),
    )

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError("")
    const progress = Number(progressPercent)
    if (!Number.isInteger(progress) || progress < 0 || progress > 100) {
      setError("Voortgang moet een geheel getal van 0 tot en met 100 zijn.")
      return
    }
    const state = useAppStore.getState().session?.state
    if (!state) return
    try {
      const result = projectService.updateProject(state, project.id, {
        code: project.code,
        title: project.title,
        description: project.description,
        chapterId: project.chapterId,
        ...(project.clusterId ? { clusterId: project.clusterId } : {}),
        status,
        phase,
        ...(project.site ? { site: project.site } : {}),
        ...(project.location ? { location: project.location } : {}),
        ...(project.department ? { department: project.department } : {}),
        ...(coordinatorActorId
          ? { coordinatorActorId: coordinatorActorId as UUID }
          : {}),
        ...(project.startDate ? { startDate: project.startDate } : {}),
        ...(project.plannedEndDate
          ? { plannedEndDate: project.plannedEndDate }
          : {}),
        ...(project.actualEndDate
          ? { actualEndDate: project.actualEndDate }
          : {}),
        progressPercent: progress,
        ...(project.documentsUrl ? { documentsUrl: project.documentsUrl } : {}),
      })
      useAppStore.getState().replaceDomainState(result.state)
      onSaved("Kerngegevens bijgewerkt")
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "De kerngegevens konden niet worden bijgewerkt.",
      )
    }
  }

  return (
    <form className="project-quick-edit" onSubmit={submit}>
      <header>
        <div>
          <span>Contextvaste update</span>
          <h2>Kerngegevens snel bijwerken</h2>
          <p>
            Werk de dagelijkse opvolging bij. Gebruik “Project bewerken” voor
            structuur, omschrijving en planning.
          </p>
        </div>
      </header>
      <div className="project-quick-edit__fields">
        <label>
          <span>Status</span>
          <select
            value={status}
            onChange={(event) => setStatus(event.target.value as ProjectStatus)}
          >
            {projectStatuses.map((value) => (
              <option key={value}>{value}</option>
            ))}
          </select>
        </label>
        <label>
          <span>Fase</span>
          <input
            value={phase}
            onChange={(event) => setPhase(event.target.value)}
          />
        </label>
        <label>
          <span>Projectcoördinator</span>
          <select
            value={coordinatorActorId}
            onChange={(event) => setCoordinatorActorId(event.target.value)}
          >
            <option value="">Niet toegewezen</option>
            {activeActors.map((actor) => (
              <option key={actor.id} value={actor.id}>
                {actor.displayName}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>Voortgang (%)</span>
          <input
            type="number"
            min="0"
            max="100"
            step="1"
            value={progressPercent}
            onChange={(event) => setProgressPercent(event.target.value)}
          />
        </label>
      </div>
      {error ? (
        <p className="project-quick-edit__error" role="alert">
          {error}
        </p>
      ) : null}
      <footer>
        <span>De wijziging wordt pas toegepast wanneer je opslaat.</span>
        <Button type="submit">Bijwerken in sessie</Button>
      </footer>
    </form>
  )
}
