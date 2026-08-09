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
  UUID,
} from "../../domain"

export interface DomainCollections {
  chapters: Chapter[]
  clusters: Cluster[]
  projects: Project[]
  projectClusterHistory: ProjectClusterHistory[]
  actors: Actor[]
  topics: Topic[]
  updates: Update[]
  actions: Action[]
  actionHistory: ActionHistory[]
  evidence: Evidence[]
  planning: PlanningEntry[]
  planningDependencies: PlanningDependency[]
  budgets: BudgetRecord[]
  budgetMutations: BudgetMutation[]
  meetings: Meeting[]
  meetingParticipants: MeetingParticipant[]
  agendaItems: AgendaItem[]
  reports: Report[]
  reportItems: ReportItem[]
  config: Config[]
  choiceLists: ChoiceList[]
  log: LogEntry[]
}

export type DomainCollectionKey = keyof DomainCollections

export interface DomainIndices {
  chapterById: ReadonlyMap<UUID, Chapter>
  projectById: ReadonlyMap<UUID, Project>
  clusterById: ReadonlyMap<UUID, Cluster>
  topicById: ReadonlyMap<UUID, Topic>
  actorById: ReadonlyMap<UUID, Actor>
  meetingById: ReadonlyMap<UUID, Meeting>
  meetingParticipantById: ReadonlyMap<UUID, MeetingParticipant>
  agendaItemById: ReadonlyMap<UUID, AgendaItem>
  reportById: ReadonlyMap<UUID, Report>
  reportItemById: ReadonlyMap<UUID, ReportItem>
  updateById: ReadonlyMap<UUID, Update>
  actionById: ReadonlyMap<UUID, Action>
  budgetById: ReadonlyMap<UUID, BudgetRecord>
  budgetMutationById: ReadonlyMap<UUID, BudgetMutation>
  planningById: ReadonlyMap<UUID, PlanningEntry>
  planningDependencyById: ReadonlyMap<UUID, PlanningDependency>
  topicsByProject: ReadonlyMap<UUID, readonly Topic[]>
  topicsByCluster: ReadonlyMap<UUID, readonly Topic[]>
  projectClusterHistoryByProject: ReadonlyMap<
    UUID,
    readonly ProjectClusterHistory[]
  >
  updatesByObject: ReadonlyMap<string, readonly Update[]>
  updatesByMeeting: ReadonlyMap<UUID, readonly Update[]>
  actionsByObject: ReadonlyMap<string, readonly Action[]>
  actionsByOwner: ReadonlyMap<UUID, readonly Action[]>
  actionsByProject: ReadonlyMap<UUID, readonly Action[]>
  actionsByMeeting: ReadonlyMap<UUID, readonly Action[]>
  actionHistoryByAction: ReadonlyMap<UUID, readonly ActionHistory[]>
  planningByProject: ReadonlyMap<UUID, readonly PlanningEntry[]>
  planningByTopic: ReadonlyMap<UUID, readonly PlanningEntry[]>
  planningDependenciesByPredecessor: ReadonlyMap<
    UUID,
    readonly PlanningDependency[]
  >
  planningDependenciesBySuccessor: ReadonlyMap<
    UUID,
    readonly PlanningDependency[]
  >
  budgetByProject: ReadonlyMap<UUID, readonly BudgetRecord[]>
  budgetByTopic: ReadonlyMap<UUID, readonly BudgetRecord[]>
  budgetMutationsByBudgetRecord: ReadonlyMap<UUID, readonly BudgetMutation[]>
  meetingParticipantsByMeeting: ReadonlyMap<UUID, readonly MeetingParticipant[]>
  agendaItemsByMeeting: ReadonlyMap<UUID, readonly AgendaItem[]>
  reportsByMeeting: ReadonlyMap<UUID, readonly Report[]>
  reportItemsByReport: ReadonlyMap<UUID, readonly ReportItem[]>
  meetingsByProject: ReadonlyMap<UUID, readonly Meeting[]>
}

export interface NormalizedDomainState {
  records: DomainCollections
  indices: DomainIndices
}

export function createEmptyDomainCollections(): DomainCollections {
  return {
    chapters: [],
    clusters: [],
    projects: [],
    projectClusterHistory: [],
    actors: [],
    topics: [],
    updates: [],
    actions: [],
    actionHistory: [],
    evidence: [],
    planning: [],
    planningDependencies: [],
    budgets: [],
    budgetMutations: [],
    meetings: [],
    meetingParticipants: [],
    agendaItems: [],
    reports: [],
    reportItems: [],
    config: [],
    choiceLists: [],
    log: [],
  }
}

function groupBy<K, T>(
  records: readonly T[],
  keySelector: (record: T) => K | undefined,
): ReadonlyMap<K, readonly T[]> {
  const grouped = new Map<K, T[]>()

  for (const record of records) {
    const key = keySelector(record)
    if (key === undefined) continue
    const group = grouped.get(key) ?? []
    group.push(record)
    grouped.set(key, group)
  }

  return grouped
}

export function buildDomainIndices(records: DomainCollections): DomainIndices {
  const topicById = new Map(records.topics.map((record) => [record.id, record]))
  const projectById = new Map(
    records.projects.map((record) => [record.id, record]),
  )
  const meetingById = new Map(
    records.meetings.map((record) => [record.id, record]),
  )
  const actionsByProject = new Map<UUID, Action[]>()
  const meetingsByProject = new Map<UUID, Meeting[]>()
  const projectsByChapter = groupBy(
    records.projects,
    (record) => record.chapterId,
  )
  const projectsByCluster = groupBy(
    records.projects,
    (record) => record.clusterId,
  )

  for (const action of records.actions) {
    let projectId: UUID | undefined
    if (action.objectType === "Project") projectId = action.objectId
    if (action.objectType === "Topic") {
      projectId = topicById.get(action.objectId)?.projectId
    }
    if (action.objectType === "Meeting") {
      const meeting = meetingById.get(action.objectId)
      if (meeting?.scopeType === "Project" && meeting.scopeId) {
        projectId = meeting.scopeId
      }
    }
    if (!projectId) continue
    const projectActions = actionsByProject.get(projectId) ?? []
    projectActions.push(action)
    actionsByProject.set(projectId, projectActions)
  }

  for (const meeting of records.meetings) {
    const projects =
      meeting.scopeType === "Project" && meeting.scopeId
        ? [projectById.get(meeting.scopeId)].filter(
            (project): project is Project => Boolean(project),
          )
        : meeting.scopeType === "Cluster" && meeting.scopeId
          ? (projectsByCluster.get(meeting.scopeId) ?? [])
          : meeting.scopeType === "Hoofdstuk" && meeting.scopeId
            ? (projectsByChapter.get(meeting.scopeId) ?? [])
            : []
    for (const project of projects) {
      const projectMeetings = meetingsByProject.get(project.id) ?? []
      projectMeetings.push(meeting)
      meetingsByProject.set(project.id, projectMeetings)
    }
  }

  return {
    chapterById: new Map(records.chapters.map((record) => [record.id, record])),
    projectById,
    clusterById: new Map(records.clusters.map((record) => [record.id, record])),
    topicById,
    actorById: new Map(records.actors.map((record) => [record.id, record])),
    meetingById,
    meetingParticipantById: new Map(
      records.meetingParticipants.map((record) => [record.id, record]),
    ),
    agendaItemById: new Map(
      records.agendaItems.map((record) => [record.id, record]),
    ),
    reportById: new Map(records.reports.map((record) => [record.id, record])),
    reportItemById: new Map(
      records.reportItems.map((record) => [record.id, record]),
    ),
    updateById: new Map(records.updates.map((record) => [record.id, record])),
    actionById: new Map(records.actions.map((record) => [record.id, record])),
    budgetById: new Map(records.budgets.map((record) => [record.id, record])),
    budgetMutationById: new Map(
      records.budgetMutations.map((record) => [record.id, record]),
    ),
    planningById: new Map(
      records.planning.map((record) => [record.id, record]),
    ),
    planningDependencyById: new Map(
      records.planningDependencies.map((record) => [record.id, record]),
    ),
    topicsByProject: groupBy(records.topics, (record) => record.projectId),
    topicsByCluster: groupBy(records.topics, (record) => record.clusterId),
    projectClusterHistoryByProject: groupBy(
      records.projectClusterHistory,
      (record) => record.projectId,
    ),
    updatesByObject: groupBy(
      records.updates,
      (record) => `${record.objectType}:${record.objectId}`,
    ),
    updatesByMeeting: groupBy(records.updates, (record) => record.meetingId),
    actionsByObject: groupBy(
      records.actions,
      (record) => `${record.objectType}:${record.objectId}`,
    ),
    actionsByOwner: groupBy(records.actions, (record) => record.ownerActorId),
    actionsByProject,
    actionsByMeeting: groupBy(
      records.actions,
      (record) => record.sourceMeetingId,
    ),
    actionHistoryByAction: groupBy(
      records.actionHistory,
      (record) => record.actionId,
    ),
    planningByProject: groupBy(records.planning, (record) => record.projectId),
    planningByTopic: groupBy(records.planning, (record) => record.topicId),
    planningDependenciesByPredecessor: groupBy(
      records.planningDependencies,
      (record) => record.predecessorPlanningId,
    ),
    planningDependenciesBySuccessor: groupBy(
      records.planningDependencies,
      (record) => record.successorPlanningId,
    ),
    budgetByProject: groupBy(records.budgets, (record) => record.projectId),
    budgetByTopic: groupBy(records.budgets, (record) => record.topicId),
    budgetMutationsByBudgetRecord: groupBy(
      records.budgetMutations,
      (record) => record.budgetRecordId,
    ),
    meetingParticipantsByMeeting: groupBy(
      records.meetingParticipants,
      (record) => record.meetingId,
    ),
    agendaItemsByMeeting: groupBy(
      records.agendaItems,
      (record) => record.meetingId,
    ),
    reportsByMeeting: groupBy(records.reports, (record) => record.meetingId),
    reportItemsByReport: groupBy(
      records.reportItems,
      (record) => record.reportId,
    ),
    meetingsByProject,
  }
}

export function normalizeDomainState(
  records: DomainCollections,
): NormalizedDomainState {
  return { records, indices: buildDomainIndices(records) }
}
