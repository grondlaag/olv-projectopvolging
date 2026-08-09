import type { Meeting, PlanningEntry, Project, Update } from "../../domain"
import type { NormalizedDomainState } from "../services"
import {
  addLocalDateDays,
  buildActionListItems,
  isActionOpen,
  isActionOverdue,
  type ActionListItem,
} from "./action-query"
import {
  buildPortfolioRows,
  isProjectClosed,
  type PortfolioProjectRow,
} from "./portfolio-query"
import {
  isPlanningEntryDelayed,
  planningRiskProjectIds,
} from "./planning-query"
import { buildBudgetPortfolioModel } from "./budget-query"

export interface DashboardKpis {
  activeProjects: number
  openTopics: number
  criticalTopics: number
  openActions: number
  overdueActions: number
  upcomingActions: number
  upcomingMilestones: number
}

export interface DashboardModel {
  kpis: DashboardKpis
  recentDecisions: readonly Update[]
  recentlyChangedProjects: readonly Project[]
  attentionProjects: readonly PortfolioProjectRow[]
  attentionActions: readonly ActionListItem[]
  upcomingMilestones: readonly PlanningEntry[]
  delayedPlanningItems: readonly PlanningEntry[]
  planningRiskProjects: readonly Project[]
  projectsWithoutEstimateRecord: readonly Project[]
  upcomingMeetings: readonly Meeting[]
  recentMeetingDecisions: readonly Update[]
}

function addDays(localDate: string, days: number): string {
  const date = new Date(`${localDate}T00:00:00Z`)
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}

export function buildDashboardModel(
  state: NormalizedDomainState,
  today: string,
): DashboardModel {
  const portfolioRows = buildPortfolioRows(state, today)
  const openTopics = state.records.topics.filter(
    (topic) => topic.status === "Open",
  )
  const openActions = state.records.actions.filter(isActionOpen)
  const actionLimit = addLocalDateDays(today, 14)
  const milestoneLimit = addDays(today, 30)
  const upcomingMilestones = state.records.planning
    .filter(
      (entry) =>
        entry.isMilestone &&
        entry.plannedEndDate >= today &&
        entry.plannedEndDate <= milestoneLimit &&
        entry.status !== "Afgerond" &&
        entry.status !== "Geannuleerd",
    )
    .sort((left, right) =>
      left.plannedEndDate.localeCompare(right.plannedEndDate),
    )
  const delayedPlanningItems = state.records.planning
    .filter(
      (entry) => entry.audit.active && isPlanningEntryDelayed(entry, today),
    )
    .sort((left, right) =>
      left.plannedEndDate.localeCompare(right.plannedEndDate),
    )
  const riskProjectIds = planningRiskProjectIds(state, today)
  const budgetModel = buildBudgetPortfolioModel(state)

  return {
    kpis: {
      activeProjects: state.records.projects.filter(
        (project) => !isProjectClosed(project.status),
      ).length,
      openTopics: openTopics.length,
      criticalTopics: openTopics.filter((topic) => topic.priority === "Kritiek")
        .length,
      openActions: openActions.length,
      overdueActions: openActions.filter((action) =>
        isActionOverdue(action, today),
      ).length,
      upcomingActions: openActions.filter(
        (action) =>
          Boolean(action.deadline) &&
          action.deadline! >= today &&
          action.deadline! <= actionLimit,
      ).length,
      upcomingMilestones: upcomingMilestones.length,
    },
    recentDecisions: state.records.updates
      .filter((update) => update.type === "Beslissing")
      .sort((left, right) => right.date.localeCompare(left.date))
      .slice(0, 5),
    recentlyChangedProjects: [...state.records.projects]
      .sort((left, right) =>
        right.audit.updatedAt.localeCompare(left.audit.updatedAt),
      )
      .slice(0, 5),
    attentionProjects: portfolioRows
      .filter(
        (row) =>
          row.criticalTopicCount > 0 ||
          row.overdueActionCount > 0 ||
          row.planningAttentionCount > 0,
      )
      .sort(
        (left, right) =>
          right.overdueActionCount - left.overdueActionCount ||
          right.criticalTopicCount - left.criticalTopicCount ||
          left.project.code.localeCompare(right.project.code, "nl"),
      )
      .slice(0, 6),
    attentionActions: buildActionListItems(state, openActions)
      .filter(
        (item) =>
          isActionOverdue(item.action, today) ||
          item.action.status === "Wacht op beslissing" ||
          (Boolean(item.action.deadline) &&
            item.action.deadline! >= today &&
            item.action.deadline! <= actionLimit),
      )
      .sort(
        (left, right) =>
          Number(isActionOverdue(right.action, today)) -
            Number(isActionOverdue(left.action, today)) ||
          Number(right.action.status === "Wacht op beslissing") -
            Number(left.action.status === "Wacht op beslissing") ||
          (left.action.deadline ?? "9999-12-31").localeCompare(
            right.action.deadline ?? "9999-12-31",
          ),
      )
      .slice(0, 8),
    upcomingMilestones,
    delayedPlanningItems,
    planningRiskProjects: state.records.projects
      .filter((project) => riskProjectIds.has(project.id))
      .sort((left, right) => left.code.localeCompare(right.code, "nl")),
    projectsWithoutEstimateRecord: budgetModel.projectsWithoutEstimateRecord,
    upcomingMeetings: state.records.meetings
      .filter((meeting) => meeting.audit.active && meeting.date >= today)
      .sort((left, right) => left.date.localeCompare(right.date))
      .slice(0, 5),
    recentMeetingDecisions: state.records.updates
      .filter(
        (update) =>
          update.audit.active &&
          update.type === "Beslissing" &&
          Boolean(update.meetingId),
      )
      .sort((left, right) => right.date.localeCompare(left.date))
      .slice(0, 5),
  }
}
