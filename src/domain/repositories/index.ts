/* eslint-disable @typescript-eslint/no-empty-object-type -- Named repository interfaces are stable architecture ports. */

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
  Topic,
  Update,
} from "../entities"
import type { UUID } from "../value-objects"

export interface Repository<T extends Entity> {
  list(): Promise<readonly T[]>
  get(id: UUID): Promise<T | undefined>
  create(entity: T): Promise<T>
  update(id: UUID, patch: Partial<Omit<T, "id">>): Promise<T>
}

export interface ChapterRepository extends Repository<Chapter> {}
export interface ClusterRepository extends Repository<Cluster> {}
export interface ProjectRepository extends Repository<Project> {}
export interface ProjectClusterHistoryRepository extends Repository<ProjectClusterHistory> {}
export interface ActorRepository extends Repository<Actor> {}
export interface TopicRepository extends Repository<Topic> {}
export interface UpdateRepository extends Repository<Update> {}
export interface ActionRepository extends Repository<Action> {}
export interface ActionHistoryRepository extends Repository<ActionHistory> {}
export interface EvidenceRepository extends Repository<Evidence> {}
export interface PlanningRepository extends Repository<PlanningEntry> {}
export interface PlanningDependencyRepository extends Repository<PlanningDependency> {}
export interface BudgetRepository extends Repository<BudgetRecord> {}
export interface BudgetMutationRepository extends Repository<BudgetMutation> {}
export interface MeetingRepository extends Repository<Meeting> {}
export interface MeetingParticipantRepository extends Repository<MeetingParticipant> {}
export interface AgendaItemRepository extends Repository<AgendaItem> {}
export interface ReportRepository extends Repository<Report> {}
export interface ReportItemRepository extends Repository<ReportItem> {}
export interface ChoiceListRepository extends Repository<ChoiceList> {}
export interface ConfigRepository extends Repository<Config> {}
export interface LogRepository extends Repository<LogEntry> {}

export interface Repositories {
  chapters: ChapterRepository
  clusters: ClusterRepository
  projects: ProjectRepository
  projectClusterHistory: ProjectClusterHistoryRepository
  actors: ActorRepository
  topics: TopicRepository
  updates: UpdateRepository
  actions: ActionRepository
  actionHistory: ActionHistoryRepository
  evidence: EvidenceRepository
  planning: PlanningRepository
  planningDependencies: PlanningDependencyRepository
  budgets: BudgetRepository
  budgetMutations: BudgetMutationRepository
  meetings: MeetingRepository
  meetingParticipants: MeetingParticipantRepository
  agendaItems: AgendaItemRepository
  reports: ReportRepository
  reportItems: ReportItemRepository
  choiceLists: ChoiceListRepository
  config: ConfigRepository
  log: LogRepository
}
