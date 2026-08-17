import { lazy, Suspense } from "react"
import { createHashRouter, Navigate } from "react-router-dom"
import {
  AppShell,
  ErrorState,
  LoadingState,
} from "../../design-system/components"
import { DashboardPage } from "../../features/dashboard/dashboard-page"
import { PortfolioPage } from "../../features/portfolio/portfolio-page"
import { ProjectReadonlyPage } from "../../features/projects/project-readonly-page"
import { ProjectFormPage } from "../../features/projects/project-form-page"
import { ClusterTopicsPage } from "../../features/clusters/cluster-topics-page"
import { ActionsPage } from "../../features/actions/actions-page"

const SettingsPage = lazy(() =>
  import("../../features/settings/settings-page").then((module) => ({
    default: module.SettingsPage,
  })),
)

const PlanningPage = lazy(() =>
  import("../../features/planning/planning-page").then((module) => ({
    default: module.PlanningPage,
  })),
)

const ProjectPlanningPage = lazy(() =>
  import("../../features/planning/project-planning-page").then((module) => ({
    default: module.ProjectPlanningPage,
  })),
)

const BudgetPage = lazy(() =>
  import("../../features/budget/budget-page").then((module) => ({
    default: module.BudgetPage,
  })),
)

const ProjectBudgetPage = lazy(() =>
  import("../../features/budget/project-budget-page").then((module) => ({
    default: module.ProjectBudgetPage,
  })),
)

const MeetingsPage = lazy(() =>
  import("../../features/meetings/meetings-page").then((module) => ({
    default: module.MeetingsPage,
  })),
)

const MeetingFormPage = lazy(() =>
  import("../../features/meetings/meeting-form-page").then((module) => ({
    default: module.MeetingFormPage,
  })),
)

const MeetingDetailPage = lazy(() =>
  import("../../features/meetings/meeting-detail-page").then((module) => ({
    default: module.MeetingDetailPage,
  })),
)

function NotFoundPage() {
  return (
    <ErrorState
      title="Pagina niet gevonden"
      description="Deze route bestaat niet. Gebruik de hoofdnavigatie om verder te gaan."
    />
  )
}

export function createAppRouter() {
  return createHashRouter([
    {
      path: "/",
      element: <AppShell />,
      children: [
        { index: true, element: <Navigate to="/dashboard" replace /> },
        {
          path: "dashboard",
          element: <DashboardPage />,
        },
        {
          path: "portfolio",
          element: <PortfolioPage />,
        },
        {
          path: "projects/new",
          element: <ProjectFormPage />,
        },
        {
          path: "projects/:projectId/edit",
          element: <ProjectFormPage />,
        },
        {
          path: "projects/:projectId/planning",
          element: (
            <Suspense
              fallback={<LoadingState label="Projectplanning laden…" />}
            >
              <ProjectPlanningPage />
            </Suspense>
          ),
        },
        {
          path: "projects/:projectId/budget",
          element: (
            <Suspense fallback={<LoadingState label="Projectbudget laden…" />}>
              <ProjectBudgetPage />
            </Suspense>
          ),
        },
        {
          path: "projects/:projectId",
          element: <ProjectReadonlyPage view="overview" />,
        },
        {
          path: "projects/:projectId/overview",
          element: <ProjectReadonlyPage view="overview" />,
        },
        {
          path: "projects/:projectId/topics",
          element: <ProjectReadonlyPage view="topics" />,
        },
        {
          path: "projects/:projectId/journal",
          element: <ProjectReadonlyPage view="journal" />,
        },
        {
          path: "projects/:projectId/topics/:topicId",
          element: <ProjectReadonlyPage view="topics" />,
        },
        {
          path: "clusters/:clusterId",
          element: <ClusterTopicsPage />,
        },
        {
          path: "clusters/:clusterId/topics/:topicId",
          element: <ClusterTopicsPage />,
        },
        {
          path: "actions",
          element: <ActionsPage />,
        },
        {
          path: "planning",
          element: (
            <Suspense fallback={<LoadingState label="Planning laden…" />}>
              <PlanningPage />
            </Suspense>
          ),
        },
        {
          path: "budget",
          element: (
            <Suspense fallback={<LoadingState label="Budget laden…" />}>
              <BudgetPage />
            </Suspense>
          ),
        },
        {
          path: "meetings",
          element: (
            <Suspense fallback={<LoadingState label="Overleg laden…" />}>
              <MeetingsPage />
            </Suspense>
          ),
        },
        {
          path: "meetings/new",
          element: (
            <Suspense
              fallback={<LoadingState label="Overlegformulier laden…" />}
            >
              <MeetingFormPage />
            </Suspense>
          ),
        },
        {
          path: "meetings/:meetingId/edit",
          element: (
            <Suspense
              fallback={<LoadingState label="Overlegformulier laden…" />}
            >
              <MeetingFormPage />
            </Suspense>
          ),
        },
        {
          path: "meetings/:meetingId",
          element: (
            <Suspense fallback={<LoadingState label="Overlegdossier laden…" />}>
              <MeetingDetailPage />
            </Suspense>
          ),
        },
        {
          path: "settings",
          element: (
            <Suspense fallback={<LoadingState label="Instellingen laden…" />}>
              <SettingsPage />
            </Suspense>
          ),
        },
        { path: "*", element: <NotFoundPage /> },
      ],
    },
  ])
}
