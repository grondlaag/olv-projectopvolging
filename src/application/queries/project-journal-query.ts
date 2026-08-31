import type {
  Action,
  Actor,
  AgendaItem,
  Evidence,
  LocalDate,
  Meeting,
  PlanningEntry,
  Project,
  Topic,
  Update,
  UUID,
} from "../../domain"
import type { NormalizedDomainState } from "../services/domain-state"

const closedActionStatuses = new Set(["Afgerond", "Geannuleerd"])

export type JournalEntryType =
  "update" | "action" | "decision_request" | "decision"

export interface JournalEntryView {
  id: UUID
  type: JournalEntryType
  content: string
  createdAt: string
  updatedAt: string
  date: LocalDate
  createdBy?: Actor
  owner?: Actor
  dueDate?: LocalDate
  status?: Action["status"]
  priority?: Action["priority"]
  completed?: boolean
  meetingLinks: readonly AgendaLinkView[]
  source: Update | Action | Evidence
}

export interface DecisionRequestPayload {
  projectId: UUID
  requestedFromIds: UUID[]
  requestedAt: string
  dueDate?: LocalDate
  status: "pending" | "decided" | "cancelled"
  resolvedByDecisionEntryId?: UUID
}

export interface DecisionRequestView {
  evidence: Evidence
  projectId: UUID
  parentType: "Topic" | "Update" | "Action"
  parentId: UUID
  question: string
  requestedFrom: readonly Actor[]
  requestedAt: string
  dueDate?: LocalDate
  status: DecisionRequestPayload["status"]
  resolvedByDecisionEntryId?: UUID
}

export interface AgendaLinkView {
  agendaItem?: AgendaItem
  evidence?: Evidence
  meeting?: Meeting
  agendaItemId?: UUID
  meetingDate?: LocalDate
  status?: "pending" | "scheduled" | "discussed"
}

export interface ProjectJournalTopic {
  topic: Topic
  owner?: Actor
  planning?: PlanningEntry
  openActions: readonly JournalEntryView[]
  decisions: readonly JournalEntryView[]
  history: readonly JournalEntryView[]
  decisionRequests: readonly DecisionRequestView[]
  agendaLinks: readonly AgendaLinkView[]
  entries: readonly JournalEntryView[]
  lastActivityAt: string
}

export interface ProjectJournalWorkspace {
  project: Project
  activeTopics: readonly ProjectJournalTopic[]
  closedTopics: readonly ProjectJournalTopic[]
  projectEntries: readonly JournalEntryView[]
  openActions: readonly (JournalEntryView & { topic?: Topic })[]
  pendingDecisionRequests: readonly (DecisionRequestView & { topic?: Topic })[]
  recentDecisions: readonly (JournalEntryView & { topic?: Topic })[]
  upcomingPlanning: readonly PlanningEntry[]
  criticalTopics: readonly ProjectJournalTopic[]
}

function parseDecisionRequest(
  evidence: Evidence,
): DecisionRequestPayload | null {
  if (evidence.type !== "DecisionRequest" || !evidence.description) return null
  try {
    const value = JSON.parse(
      evidence.description,
    ) as Partial<DecisionRequestPayload>
    if (
      !value.projectId ||
      !Array.isArray(value.requestedFromIds) ||
      !value.requestedAt ||
      !["pending", "decided", "cancelled"].includes(value.status ?? "")
    ) {
      return null
    }
    return value as DecisionRequestPayload
  } catch {
    return null
  }
}

export function decisionRequestsForProject(
  state: NormalizedDomainState,
  projectId: UUID,
): readonly DecisionRequestView[] {
  return state.records.evidence.flatMap((evidence) => {
    if (!evidence.audit.active) return []
    const payload = parseDecisionRequest(evidence)
    if (!payload || payload.projectId !== projectId) return []
    if (
      evidence.objectType !== "Topic" &&
      evidence.objectType !== "Update" &&
      evidence.objectType !== "Action"
    ) {
      return []
    }
    return [
      {
        evidence,
        projectId,
        parentType: evidence.objectType,
        parentId: evidence.objectId,
        question: evidence.title,
        requestedFrom: payload.requestedFromIds.flatMap((id) => {
          const actor = state.indices.actorById.get(id)
          return actor ? [actor] : []
        }),
        requestedAt: payload.requestedAt,
        ...(payload.dueDate ? { dueDate: payload.dueDate } : {}),
        status: payload.status,
        ...(payload.resolvedByDecisionEntryId
          ? { resolvedByDecisionEntryId: payload.resolvedByDecisionEntryId }
          : {}),
      },
    ]
  })
}

function updateEntry(
  state: NormalizedDomainState,
  update: Update,
): JournalEntryView {
  const createdBy = state.indices.actorById.get(update.authorActorId)
  const completed = state.records.evidence.some(
    (evidence) =>
      evidence.audit.active &&
      evidence.type === "JournalCompletion" &&
      evidence.objectType === "Update" &&
      evidence.objectId === update.id,
  )
  return {
    id: update.id,
    type: update.type === "Beslissing" ? "decision" : "update",
    content: update.text,
    createdAt: update.audit.createdAt,
    updatedAt: update.audit.updatedAt,
    date: update.date,
    ...(createdBy ? { createdBy } : {}),
    completed,
    meetingLinks: agendaLinksForObject(state, "Update", update.id),
    source: update,
  }
}

function actionEntry(
  state: NormalizedDomainState,
  action: Action,
): JournalEntryView {
  const createdBy = action.audit.createdByActorId
    ? state.indices.actorById.get(action.audit.createdByActorId)
    : undefined
  const owner = state.indices.actorById.get(action.ownerActorId)
  return {
    id: action.id,
    type: "action",
    content: action.title,
    createdAt: action.audit.createdAt,
    updatedAt: action.audit.updatedAt,
    date: action.audit.createdAt.slice(0, 10) as LocalDate,
    ...(createdBy ? { createdBy } : {}),
    ...(owner ? { owner } : {}),
    ...(action.deadline ? { dueDate: action.deadline } : {}),
    status: action.status,
    priority: action.priority,
    meetingLinks: agendaLinksForObject(state, "Action", action.id),
    source: action,
  }
}

function sortEntries(entries: JournalEntryView[]): JournalEntryView[] {
  return entries.sort(
    (left, right) =>
      right.createdAt.localeCompare(left.createdAt) ||
      right.updatedAt.localeCompare(left.updatedAt),
  )
}

function agendaLinksForObject(
  state: NormalizedDomainState,
  objectType: string,
  objectId: UUID,
): AgendaLinkView[] {
  const agendaLinks = (
    state.indices.agendaItemsByObject.get(`${objectType}:${objectId}`) ?? []
  )
    .filter((item) => item.audit.active)
    .map((agendaItem) => {
      const meeting = state.indices.meetingById.get(agendaItem.meetingId)
      return {
        agendaItem,
        ...(meeting ? { meeting } : {}),
        status:
          agendaItem.discussionStatus === "Besproken"
            ? ("discussed" as const)
            : ("scheduled" as const),
      }
    })
  const evidenceLinks = state.records.evidence.flatMap((evidence) => {
    if (
      !evidence.audit.active ||
      evidence.type !== "MeetingLink" ||
      evidence.objectType !== objectType ||
      evidence.objectId !== objectId ||
      !evidence.description
    ) {
      return []
    }
    try {
      const payload = JSON.parse(evidence.description) as {
        meetingId?: UUID
        agendaItemId?: UUID
        meetingDate?: LocalDate
        status?: "pending" | "scheduled" | "discussed"
      }
      if (!payload.meetingId) return []
      const meeting = state.indices.meetingById.get(payload.meetingId)
      return [
        {
          evidence,
          ...(meeting ? { meeting } : {}),
          ...(payload.agendaItemId
            ? { agendaItemId: payload.agendaItemId }
            : {}),
          ...(payload.meetingDate ? { meetingDate: payload.meetingDate } : {}),
          status: payload.status ?? ("scheduled" as const),
        },
      ]
    } catch {
      return []
    }
  })
  const seen = new Set<UUID>()
  return [...evidenceLinks, ...agendaLinks].filter((link) => {
    const id = link.meeting?.id
    if (!id || seen.has(id)) return false
    seen.add(id)
    return true
  })
}

function decisionRequestEntry(
  state: NormalizedDomainState,
  request: DecisionRequestView,
): JournalEntryView {
  const author = request.evidence.authorActorId
    ? state.indices.actorById.get(request.evidence.authorActorId)
    : undefined
  return {
    id: request.evidence.id,
    type: "decision_request",
    content: request.question,
    createdAt: request.evidence.audit.createdAt,
    updatedAt: request.evidence.audit.updatedAt,
    date: (request.evidence.date ??
      request.evidence.audit.createdAt.slice(0, 10)) as LocalDate,
    ...(author ? { createdBy: author } : {}),
    ...(request.requestedFrom[0] ? { owner: request.requestedFrom[0] } : {}),
    ...(request.dueDate ? { dueDate: request.dueDate } : {}),
    status:
      request.status === "pending"
        ? "Wacht op beslissing"
        : request.status === "decided"
          ? "Afgerond"
          : "Geannuleerd",
    meetingLinks: agendaLinksForObject(state, "Evidence", request.evidence.id),
    source: request.evidence,
  }
}

function topicWorkspace(
  state: NormalizedDomainState,
  topic: Topic,
  requests: readonly DecisionRequestView[],
): ProjectJournalTopic {
  const updates = (state.indices.updatesByObject.get(`Topic:${topic.id}`) ?? [])
    .filter((entry) => entry.audit.active)
    .map((entry) => updateEntry(state, entry))
  const actions = (state.indices.actionsByObject.get(`Topic:${topic.id}`) ?? [])
    .filter((entry) => entry.audit.active)
    .map((entry) => actionEntry(state, entry))
  const planning = state.indices.planningByTopic
    .get(topic.id)
    ?.find((entry) => entry.audit.active)
  const decisionRequests = requests.filter(
    (request) =>
      request.parentType === "Topic" && request.parentId === topic.id,
  )
  const agendaLinks = agendaLinksForObject(state, "Topic", topic.id)
  const openActions = sortEntries(
    actions.filter(
      (entry) => entry.status && !closedActionStatuses.has(entry.status),
    ),
  )
  const completedActions = actions.filter(
    (entry) => entry.status && closedActionStatuses.has(entry.status),
  )
  const decisions = sortEntries(
    updates.filter((entry) => entry.type === "decision"),
  )
  const history = sortEntries([
    ...updates.filter((entry) => entry.type === "update"),
    ...completedActions,
  ])
  const entries = sortEntries([
    ...updates,
    ...actions,
    ...decisionRequests.map((request) => decisionRequestEntry(state, request)),
  ])
  const lastActivityAt = [
    topic.audit.updatedAt,
    planning?.audit.updatedAt,
    ...updates.map((entry) => entry.updatedAt),
    ...actions.map((entry) => entry.updatedAt),
    ...decisionRequests.map((request) => request.evidence.audit.updatedAt),
    ...agendaLinks.flatMap((link) =>
      link.agendaItem ? [link.agendaItem.audit.updatedAt] : [],
    ),
  ]
    .filter((value): value is string => Boolean(value))
    .sort((left, right) => right.localeCompare(left))[0]!

  const owner = topic.ownerActorId
    ? state.indices.actorById.get(topic.ownerActorId)
    : undefined

  return {
    topic,
    ...(owner ? { owner } : {}),
    ...(planning ? { planning } : {}),
    openActions,
    decisions,
    history,
    decisionRequests,
    agendaLinks,
    entries,
    lastActivityAt,
  }
}

export function buildProjectJournalWorkspace(
  state: NormalizedDomainState,
  projectId: UUID,
  today: LocalDate,
): ProjectJournalWorkspace | undefined {
  const project = state.indices.projectById.get(projectId)
  if (!project) return undefined
  const requests = decisionRequestsForProject(state, projectId)
  const topics = (state.indices.topicsByProject.get(projectId) ?? [])
    .filter((topic) => topic.audit.active)
    .map((topic) => topicWorkspace(state, topic, requests))
    .sort(
      (left, right) =>
        right.topic.audit.createdAt.localeCompare(left.topic.audit.createdAt) ||
        right.topic.code.localeCompare(left.topic.code, "nl"),
    )
  const topicByEntry = new Map<UUID, Topic>()
  for (const topic of topics) {
    for (const entry of topic.entries) {
      topicByEntry.set(entry.id, topic.topic)
    }
  }
  const projectUpdates = (
    state.indices.updatesByObject.get(`Project:${projectId}`) ?? []
  )
    .filter((entry) => entry.audit.active)
    .map((entry) => updateEntry(state, entry))
  const projectActions = (
    state.indices.actionsByObject.get(`Project:${projectId}`) ?? []
  )
    .filter((entry) => entry.audit.active)
    .map((entry) => actionEntry(state, entry))
  const allActions = [
    ...projectActions,
    ...topics.flatMap((topic) => topic.openActions),
  ]
  const openActions = sortEntries(
    allActions.filter(
      (entry) => entry.status && !closedActionStatuses.has(entry.status),
    ),
  ).map((entry) => {
    const topic = topicByEntry.get(entry.id)
    return { ...entry, ...(topic ? { topic } : {}) }
  })
  const recentDecisions = sortEntries(
    topics.flatMap((topic) => topic.decisions),
  )
    .slice(0, 8)
    .map((entry) => {
      const topic = topicByEntry.get(entry.id)
      return { ...entry, ...(topic ? { topic } : {}) }
    })
  const pendingDecisionRequests = requests
    .filter((request) => request.status === "pending")
    .map((request) => {
      const topic =
        request.parentType === "Topic"
          ? state.indices.topicById.get(request.parentId)
          : topicByEntry.get(request.parentId)
      return { ...request, ...(topic ? { topic } : {}) }
    })
  const upcomingPlanning = [
    ...(state.indices.planningByProject.get(projectId) ?? []),
  ]
    .filter(
      (entry) =>
        entry.audit.active &&
        entry.plannedEndDate >= today &&
        entry.status !== "Afgerond" &&
        entry.status !== "Geannuleerd",
    )
    .sort((left, right) =>
      left.plannedEndDate.localeCompare(right.plannedEndDate),
    )
  const criticalTopics = topics.filter(
    (topic) =>
      topic.topic.status === "Open" &&
      (topic.topic.priority === "Hoog" ||
        topic.topic.priority === "Kritiek" ||
        topic.openActions.some((entry) =>
          Boolean(entry.dueDate && entry.dueDate < today),
        ) ||
        topic.decisionRequests.some(
          (request) => request.status === "pending",
        ) ||
        topic.planning?.status === "Risico" ||
        topic.planning?.status === "Vertraagd"),
  )

  return {
    project,
    activeTopics: topics.filter((topic) => topic.topic.status === "Open"),
    closedTopics: topics.filter((topic) => topic.topic.status !== "Open"),
    projectEntries: sortEntries([...projectUpdates, ...projectActions]),
    openActions,
    pendingDecisionRequests,
    recentDecisions,
    upcomingPlanning,
    criticalTopics,
  }
}
