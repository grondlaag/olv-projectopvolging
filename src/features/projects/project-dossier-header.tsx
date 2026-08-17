import type { ReactNode } from "react"
import { Link, useLocation, useNavigate } from "react-router-dom"
import { currentAppRoute, withReturnTo } from "../../app/routing"
import { useAppStore } from "../../app/state/app-store"
import {
  Badge,
  Button,
  FavoriteButton,
  KpiStrip,
  OverflowMenu,
  PageHeader,
} from "../../design-system/components"
import type { Project } from "../../domain"
import { formatLocalDate } from "../../utils"
import "./project-dossier-header.css"

export type ProjectDossierTab =
  "overview" | "topics" | "journal" | "planning" | "budget"

interface ProjectDossierHeaderProps {
  project: Project
  activeTab: ProjectDossierTab
  actions?: ReactNode
  primaryAction?: ReactNode
  openTopicCount?: number
}

const tabs: readonly [
  ProjectDossierTab,
  string,
  (project: Project) => string,
][] = [
  ["overview", "Overzicht", (project) => `/projects/${project.id}`],
  ["topics", "Topics", (project) => `/projects/${project.id}/topics`],
  [
    "journal",
    "Projectjournaal",
    (project) => `/projects/${project.id}/journal`,
  ],
  ["planning", "Planning", (project) => `/projects/${project.id}/planning`],
  ["budget", "Budget", (project) => `/projects/${project.id}/budget`],
]

export function ProjectDossierHeader({
  project,
  activeTab,
  actions,
  primaryAction,
  openTopicCount,
}: ProjectDossierHeaderProps) {
  const navigate = useNavigate()
  const location = useLocation()
  const session = useAppStore((state) => state.session)!
  const chapter = session.state.indices.chapterById.get(project.chapterId)
  const cluster = project.clusterId
    ? session.state.indices.clusterById.get(project.clusterId)
    : undefined
  const coordinator = project.coordinatorActorId
    ? session.state.indices.actorById.get(project.coordinatorActorId)
    : undefined

  return (
    <div className="project-dossier-header">
      <nav
        className="project-dossier-header__breadcrumb"
        aria-label="Kruimelpad"
      >
        <Link to="/portfolio">Portfolio</Link>
        <span aria-hidden="true">/</span>
        <span>{chapter?.title ?? "Onbekend hoofdstuk"}</span>
        <span aria-hidden="true">/</span>
        <span aria-current="page">{project.code}</span>
      </nav>

      <PageHeader
        eyebrow={project.code}
        title={project.title}
        description={`${chapter?.title ?? "Onbekend hoofdstuk"} · ${cluster?.title ?? "Zonder cluster"}`}
        actions={
          <>
            {primaryAction ?? (
              <Button
                onClick={() =>
                  navigate(
                    withReturnTo(
                      `/projects/${project.id}/edit`,
                      currentAppRoute(location),
                    ),
                  )
                }
              >
                Project bewerken
              </Button>
            )}
            <OverflowMenu label="Projectacties">
              {primaryAction ? (
                <Button
                  variant="tertiary"
                  onClick={() =>
                    navigate(
                      withReturnTo(
                        `/projects/${project.id}/edit`,
                        currentAppRoute(location),
                      ),
                    )
                  }
                >
                  Project bewerken
                </Button>
              ) : null}
              {actions}
              <FavoriteButton
                route={`/projects/${project.id}`}
                label={`${project.code} · ${project.title}`}
                kind="Project"
              />
            </OverflowMenu>
          </>
        }
      />

      <KpiStrip
        className="project-dossier-header__summary"
        ariaLabel="Projectstatus"
        items={[
          {
            id: "status",
            label: "Status",
            value: (
              <Badge
                tone={
                  project.status === "Afgesloten"
                    ? "success"
                    : project.status === "Geannuleerd"
                      ? "danger"
                      : "info"
                }
              >
                {project.status}
              </Badge>
            ),
          },
          { id: "phase", label: "Fase", value: project.phase || "—" },
          {
            id: "coordinator",
            label: "Coördinator",
            value: coordinator?.displayName ?? "—",
          },
          {
            id: "period",
            label: "Projectperiode",
            value: `${formatLocalDate(project.startDate)} – ${formatLocalDate(project.plannedEndDate)}`,
          },
          {
            id: "progress",
            label: "Voortgang",
            value: `${project.progressPercent ?? 0}%`,
          },
          { id: "size", label: "Omvang", value: project.size ?? "—" },
        ]}
      />

      <nav
        className="project-dossier-header__tabs"
        aria-label="Projectdossierweergave"
      >
        {tabs.map(([key, label, route]) => (
          <Link
            key={key}
            to={route(project)}
            className={activeTab === key ? "is-active" : undefined}
            aria-current={activeTab === key ? "page" : undefined}
          >
            {label}
            {key === "topics" && openTopicCount !== undefined ? (
              <span>{openTopicCount}</span>
            ) : null}
          </Link>
        ))}
      </nav>
    </div>
  )
}
