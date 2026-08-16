import type {
  ActionStatus,
  AgendaDiscussionStatus,
  AgendaObjectType,
  ActorType,
  AuditFields,
  BudgetStatus,
  BudgetType,
  DateTime,
  LocalDate,
  MeetingScopeType,
  MeetingStatus,
  ObjectType,
  PlanningDependencyType,
  PlanningKind,
  PlanningStatus,
  Priority,
  ProjectStatus,
  ProjectSize,
  RecordStatus,
  ReportStatus,
  TopicParentType,
  TopicStatus,
  UUID,
  UpdateType,
} from "../value-objects"

export interface Entity {
  id: UUID
}

export interface AuditedEntity extends Entity {
  audit: AuditFields
}

export interface Chapter extends AuditedEntity {
  code: string
  title: string
  order: number
  status: RecordStatus
}

export interface Cluster extends AuditedEntity {
  chapterId: UUID
  code: string
  title: string
  description: string
  status: RecordStatus
  currentUpdateId?: UUID
  order: number
}

export interface Project extends AuditedEntity {
  chapterId: UUID
  clusterId?: UUID
  code: string
  title: string
  description: string
  status: ProjectStatus
  phase: string
  site?: string
  location?: string
  department?: string
  coordinatorActorId?: UUID
  startDate?: LocalDate
  plannedEndDate?: LocalDate
  actualEndDate?: LocalDate
  progressPercent?: number
  size?: ProjectSize
  currentUpdateId?: UUID
  documentsUrl?: string
}

export interface ProjectClusterHistory extends AuditedEntity {
  projectId: UUID
  clusterId: UUID
  validFrom: LocalDate
  validTo?: LocalDate
  reason?: string
  authorActorId?: UUID
}

export interface Actor extends AuditedEntity {
  type: ActorType
  displayName: string
  email?: string
  organization?: string
  role?: string
  active: boolean
}

export interface Topic extends AuditedEntity {
  parentType: TopicParentType
  projectId?: UUID
  clusterId?: UUID
  code: string
  title: string
  context: string
  ownerActorId?: UUID
  priority: Priority
  status: TopicStatus
  order: number
  currentUpdateId?: UUID
}

export interface Update extends AuditedEntity {
  objectType: ObjectType
  objectId: UUID
  meetingId?: UUID
  type: UpdateType
  date: LocalDate
  authorActorId: UUID
  text: string
}

export interface Action extends AuditedEntity {
  objectType: ObjectType
  objectId: UUID
  sourceMeetingId?: UUID
  code: string
  title: string
  description?: string
  ownerActorId: UUID
  deadline?: LocalDate
  status: ActionStatus
  priority: Priority
  completedAt?: LocalDate
}

export interface ActionHistory extends AuditedEntity {
  actionId: UUID
  changedAt: DateTime
  changedByActorId: UUID
  field: string
  previousValue?: string
  newValue?: string
  reason?: string
}

export interface Evidence extends AuditedEntity {
  objectType: ObjectType
  objectId: UUID
  type: string
  title: string
  description?: string
  urlOrReference?: string
  date?: LocalDate
  authorActorId?: UUID
}

export interface PlanningEntry extends AuditedEntity {
  projectId: UUID
  topicId?: UUID
  kind: PlanningKind
  title: string
  startDate?: LocalDate
  plannedEndDate: LocalDate
  actualEndDate?: LocalDate
  progressPercent?: number
  status: PlanningStatus
  isMilestone: boolean
  order: number
}

export interface PlanningDependency extends AuditedEntity {
  predecessorPlanningId: UUID
  successorPlanningId: UUID
  type: PlanningDependencyType
}

export interface BudgetRecord extends AuditedEntity {
  projectId: UUID
  topicId?: UUID
  category: string
  type: BudgetType
  description: string
  amountCents: number
  date: LocalDate
  status: BudgetStatus
  reference?: string
  supplierActorId?: UUID
}

export interface BudgetMutation extends AuditedEntity {
  budgetRecordId: UUID
  changeType: string
  deltaCents?: number
  previousAmountCents?: number
  newAmountCents?: number
  reason: string
  date: LocalDate
  authorActorId: UUID
}

export interface Meeting extends AuditedEntity {
  type: string
  scopeType: MeetingScopeType
  scopeId?: UUID
  number?: string
  title: string
  date: LocalDate
  chairActorId?: UUID
  reporterActorId?: UUID
  status: MeetingStatus
  nextMeetingDate?: LocalDate
}

export interface MeetingParticipant extends AuditedEntity {
  meetingId: UUID
  actorId: UUID
  role?: string
  attended: boolean
}

export interface AgendaItem extends AuditedEntity {
  meetingId: UUID
  order: number
  title: string
  reason?: string
  notes?: string
  objectType?: AgendaObjectType
  objectId?: UUID
  discussionStatus: AgendaDiscussionStatus
}

export interface Report extends AuditedEntity {
  meetingId: UUID
  version: number
  status: ReportStatus
  draftDate?: LocalDate
  finalDate?: LocalDate
  authorActorId: UUID
  pdfReference?: string
}

export interface ReportItem extends AuditedEntity {
  reportId: UUID
  order: number
  section: string
  contentType: string
  objectType?: ObjectType
  objectId?: UUID
  titleSnapshot: string
  textSnapshot: string
}

export interface ChoiceList extends AuditedEntity {
  listKey: string
  valueKey: string
  label: string
  order: number
  system: boolean
  active: boolean
}

export interface Config extends AuditedEntity {
  schemaVersion: string
  dataSetId: UUID
  createdAt: DateTime
  appVersion: string
  defaultCurrency: string
  currentActorId?: UUID
}

export interface LogEntry extends AuditedEntity {
  level: "Blocking" | "Recoverable" | "Warning" | "Info"
  message: string
  objectType?: ObjectType
  objectId?: UUID
  occurredAt: DateTime
}
