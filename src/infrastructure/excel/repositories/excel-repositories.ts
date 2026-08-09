import type {
  Action,
  ActionHistory,
  Actor,
  AgendaItem,
  BudgetMutation,
  BudgetRecord,
  Chapter,
  ChoiceList,
  Cluster,
  Config,
  Entity,
  Evidence,
  LogEntry,
  Meeting,
  MeetingParticipant,
  PlanningDependency,
  PlanningEntry,
  Project,
  ProjectClusterHistory,
  Report,
  ReportItem,
  Repositories,
  Topic,
  Update,
} from "../../../domain"
import type { NormalizedDomainState } from "../../../application/services"
import { InMemoryRepository } from "../../repositories"

export class ExcelRepositoryAdapter<
  T extends Entity,
> extends InMemoryRepository<T> {}

export function createExcelRepositories(
  state: NormalizedDomainState,
): Repositories {
  const records = state.records
  return {
    chapters: new ExcelRepositoryAdapter<Chapter>(records.chapters),
    clusters: new ExcelRepositoryAdapter<Cluster>(records.clusters),
    projects: new ExcelRepositoryAdapter<Project>(records.projects),
    projectClusterHistory: new ExcelRepositoryAdapter<ProjectClusterHistory>(
      records.projectClusterHistory,
    ),
    actors: new ExcelRepositoryAdapter<Actor>(records.actors),
    topics: new ExcelRepositoryAdapter<Topic>(records.topics),
    updates: new ExcelRepositoryAdapter<Update>(records.updates),
    actions: new ExcelRepositoryAdapter<Action>(records.actions),
    actionHistory: new ExcelRepositoryAdapter<ActionHistory>(
      records.actionHistory,
    ),
    evidence: new ExcelRepositoryAdapter<Evidence>(records.evidence),
    planning: new ExcelRepositoryAdapter<PlanningEntry>(records.planning),
    planningDependencies: new ExcelRepositoryAdapter<PlanningDependency>(
      records.planningDependencies,
    ),
    budgets: new ExcelRepositoryAdapter<BudgetRecord>(records.budgets),
    budgetMutations: new ExcelRepositoryAdapter<BudgetMutation>(
      records.budgetMutations,
    ),
    meetings: new ExcelRepositoryAdapter<Meeting>(records.meetings),
    meetingParticipants: new ExcelRepositoryAdapter<MeetingParticipant>(
      records.meetingParticipants,
    ),
    agendaItems: new ExcelRepositoryAdapter<AgendaItem>(records.agendaItems),
    reports: new ExcelRepositoryAdapter<Report>(records.reports),
    reportItems: new ExcelRepositoryAdapter<ReportItem>(records.reportItems),
    choiceLists: new ExcelRepositoryAdapter<ChoiceList>(records.choiceLists),
    config: new ExcelRepositoryAdapter<Config>(records.config),
    log: new ExcelRepositoryAdapter<LogEntry>(records.log),
  }
}
