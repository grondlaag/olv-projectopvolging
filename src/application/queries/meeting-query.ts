import {
  isAgendaObjectInMeetingScope,
  type Action,
  type Actor,
  type AgendaItem,
  type AgendaObjectType,
  type Chapter,
  type Cluster,
  type Meeting,
  type MeetingParticipant,
  type MeetingScopeReferences,
  type MeetingScopeType,
  type MeetingStatus,
  type Project,
  type Report,
  type ReportItem,
  type Topic,
  type Update,
  type UUID,
} from "../../domain"
import type { NormalizedDomainState } from "../services"
import {
  buildActionListItems,
  groupActionListItemsByOwner,
  isActionOverdue,
  type ActionOwnerGroup,
} from "./action-query"

export interface MeetingFilters {
  search: string
  type: string
  scopeType: "" | MeetingScopeType
  status: "" | MeetingStatus
  dateFrom: string
  dateTo: string
}

export const defaultMeetingFilters: MeetingFilters = {
  search: "",
  type: "",
  scopeType: "",
  status: "",
  dateFrom: "",
  dateTo: "",
}

export interface MeetingListItem {
  meeting: Meeting
  scopeLabel: string
  chair?: Actor
  participantCount: number
  agendaCount: number
  reportCount: number
}

export interface AgendaSuggestion {
  objectType: Extract<AgendaObjectType, "Project" | "Topic">
  objectId: UUID
  title: string
  reason: string
  tone: "attention" | "neutral"
}

export interface AgendaMeetingLink {
  meeting: Meeting
  agendaItem: AgendaItem
}

export interface AgendaSchedulingModel {
  availableMeetings: readonly Meeting[]
  scheduledMeetings: readonly AgendaMeetingLink[]
}

export interface MeetingParticipantView {
  participant: MeetingParticipant
  actor?: Actor
}

export interface MeetingDetailModel {
  meeting: Meeting
  scopeLabel: string
  chair?: Actor
  reporter?: Actor
  participants: readonly MeetingParticipantView[]
  agenda: readonly AgendaItem[]
  updates: readonly Update[]
  decisions: readonly Update[]
  actions: readonly Action[]
  actionOwnerGroups: readonly ActionOwnerGroup[]
  reports: readonly Report[]
  selectedReport?: Report
  selectedReportItems: readonly ReportItem[]
  suggestions: readonly AgendaSuggestion[]
  agendaGroups: readonly MeetingAgendaGroup[]
}

export interface MeetingAgendaGroup {
  id: string
  chapter?: Chapter
  cluster?: Cluster
  project?: Project
  label: string
  items: readonly AgendaItem[]
  legacy: boolean
}

export interface AgendaItemContextModel {
  item: AgendaItem
  chapter?: Chapter
  cluster?: Cluster
  project?: Project
  topic?: Topic
  currentUpdate?: Update
  updates: readonly Update[]
  decisions: readonly Update[]
  actions: readonly Action[]
  meetings: readonly Meeting[]
}

function references(state: NormalizedDomainState): MeetingScopeReferences {
  return {
    chapterIds: new Set(state.records.chapters.map((item) => item.id)),
    clustersById: state.indices.clusterById,
    projectsById: state.indices.projectById,
    topicsById: state.indices.topicById,
    actionsById: state.indices.actionById,
  }
}

export function meetingScopeLabel(
  state: NormalizedDomainState,
  meeting: Pick<Meeting, "scopeType" | "scopeId">,
): string {
  if (meeting.scopeType === "Portfolio") return "Volledig portfolio"
  if (!meeting.scopeId) return "Onbekende scope"
  if (meeting.scopeType === "Hoofdstuk") {
    const chapter = state.indices.chapterById.get(meeting.scopeId)
    return chapter ? `${chapter.code} · ${chapter.title}` : "Onbekend hoofdstuk"
  }
  if (meeting.scopeType === "Cluster") {
    const cluster = state.indices.clusterById.get(meeting.scopeId)
    return cluster ? `${cluster.code} · ${cluster.title}` : "Onbekende cluster"
  }
  const project = state.indices.projectById.get(meeting.scopeId)
  return project ? `${project.code} · ${project.title}` : "Onbekend project"
}

export function buildMeetingListItems(
  state: NormalizedDomainState,
): readonly MeetingListItem[] {
  return state.records.meetings
    .filter((meeting) => meeting.audit.active)
    .map((meeting) => {
      const chair = meeting.chairActorId
        ? state.indices.actorById.get(meeting.chairActorId)
        : undefined
      return {
        meeting,
        scopeLabel: meetingScopeLabel(state, meeting),
        ...(chair ? { chair } : {}),
        participantCount:
          state.indices.meetingParticipantsByMeeting.get(meeting.id)?.length ??
          0,
        agendaCount:
          state.indices.agendaItemsByMeeting.get(meeting.id)?.length ?? 0,
        reportCount:
          state.indices.reportsByMeeting.get(meeting.id)?.length ?? 0,
      }
    })
    .sort(
      (left, right) =>
        right.meeting.date.localeCompare(left.meeting.date) ||
        left.meeting.title.localeCompare(right.meeting.title, "nl"),
    )
}

export function filterMeetingListItems(
  items: readonly MeetingListItem[],
  filters: MeetingFilters,
): readonly MeetingListItem[] {
  const search = filters.search.trim().toLocaleLowerCase("nl")
  return items.filter((item) => {
    if (filters.type && item.meeting.type !== filters.type) return false
    if (filters.scopeType && item.meeting.scopeType !== filters.scopeType)
      return false
    if (filters.status && item.meeting.status !== filters.status) return false
    if (filters.dateFrom && item.meeting.date < filters.dateFrom) return false
    if (filters.dateTo && item.meeting.date > filters.dateTo) return false
    if (!search) return true
    return [
      item.meeting.number,
      item.meeting.title,
      item.meeting.type,
      item.scopeLabel,
      item.chair?.displayName,
    ]
      .filter(Boolean)
      .join(" ")
      .toLocaleLowerCase("nl")
      .includes(search)
  })
}

function topicSuggestion(topic: Topic): AgendaSuggestion {
  return {
    objectType: "Topic",
    objectId: topic.id,
    title: `${topic.code} · ${topic.title}`,
    reason:
      topic.priority === "Kritiek"
        ? "Kritiek open topic"
        : "Open topic voor opvolging",
    tone: topic.priority === "Kritiek" ? "attention" : "neutral",
  }
}

function actionSuggestion(
  action: Action & { objectType: "Project" | "Topic" },
  today: string,
): AgendaSuggestion {
  const overdue = isActionOverdue(action, today)
  return {
    objectType: action.objectType,
    objectId: action.objectId,
    title: `${action.code} · ${action.title}`,
    reason: overdue ? "Achterstallige actie" : "Wacht op beslissing",
    tone: overdue ? "attention" : "neutral",
  }
}

export function buildAgendaSuggestions(
  state: NormalizedDomainState,
  meeting: Meeting,
  today: string,
): readonly AgendaSuggestion[] {
  const scopeReferences = references(state)
  const existing = new Set(
    (state.indices.agendaItemsByMeeting.get(meeting.id) ?? []).flatMap(
      (item) =>
        item.objectType && item.objectId
          ? [`${item.objectType}:${item.objectId}`]
          : [],
    ),
  )
  const topicSuggestions = state.records.topics
    .filter(
      (topic) =>
        topic.audit.active &&
        topic.status === "Open" &&
        isAgendaObjectInMeetingScope(
          meeting,
          "Topic",
          topic.id,
          scopeReferences,
        ) &&
        !existing.has(`Topic:${topic.id}`),
    )
    .map(topicSuggestion)
  const actionSuggestions = state.records.actions
    .filter(
      (action) =>
        action.audit.active &&
        (action.objectType === "Project" || action.objectType === "Topic") &&
        (action.status === "Wacht op beslissing" ||
          isActionOverdue(action, today)) &&
        isAgendaObjectInMeetingScope(
          meeting,
          action.objectType,
          action.objectId,
          scopeReferences,
        ) &&
        !existing.has(`${action.objectType}:${action.objectId}`),
    )
    .map((action) =>
      actionSuggestion(
        action as Action & { objectType: "Project" | "Topic" },
        today,
      ),
    )
  const uniqueSuggestions = new Map<string, AgendaSuggestion>()
  for (const suggestion of [...topicSuggestions, ...actionSuggestions]) {
    const key = `${suggestion.objectType}:${suggestion.objectId}`
    const current = uniqueSuggestions.get(key)
    if (
      !current ||
      (current.tone === "neutral" && suggestion.tone === "attention")
    )
      uniqueSuggestions.set(key, suggestion)
  }
  return [...uniqueSuggestions.values()].sort(
    (left, right) =>
      Number(right.tone === "attention") - Number(left.tone === "attention") ||
      left.title.localeCompare(right.title, "nl"),
  )
}

function agendaItemRelations(
  state: NormalizedDomainState,
  item: AgendaItem,
): {
  chapter?: Chapter
  cluster?: Cluster
  project?: Project
  topic?: Topic
} {
  const action =
    item.objectType === "Action" && item.objectId
      ? state.indices.actionById.get(item.objectId)
      : undefined
  const topic =
    item.objectType === "Topic" && item.objectId
      ? state.indices.topicById.get(item.objectId)
      : action?.objectType === "Topic"
        ? state.indices.topicById.get(action.objectId)
        : undefined
  const project =
    item.objectType === "Project" && item.objectId
      ? state.indices.projectById.get(item.objectId)
      : action?.objectType === "Project"
        ? state.indices.projectById.get(action.objectId)
        : topic?.projectId
          ? state.indices.projectById.get(topic.projectId)
          : undefined
  const cluster = project?.clusterId
    ? state.indices.clusterById.get(project.clusterId)
    : topic?.clusterId
      ? state.indices.clusterById.get(topic.clusterId)
      : undefined
  const chapterId = project?.chapterId ?? cluster?.chapterId
  const chapter = chapterId
    ? state.indices.chapterById.get(chapterId)
    : undefined
  return {
    ...(chapter ? { chapter } : {}),
    ...(cluster ? { cluster } : {}),
    ...(project ? { project } : {}),
    ...(topic ? { topic } : {}),
  }
}

export function buildMeetingAgendaGroups(
  state: NormalizedDomainState,
  agenda: readonly AgendaItem[],
): readonly MeetingAgendaGroup[] {
  const groups = new Map<
    string,
    Omit<MeetingAgendaGroup, "items"> & { items: AgendaItem[] }
  >()
  for (const item of agenda) {
    const relations = agendaItemRelations(state, item)
    const legacy =
      !relations.project ||
      (item.objectType !== "Project" &&
        item.objectType !== "Topic" &&
        item.objectType !== "Action")
    const id = legacy
      ? "legacy"
      : `${relations.chapter?.id ?? "no-chapter"}:${relations.cluster?.id ?? "no-cluster"}:${relations.project?.id ?? "cluster-topics"}`
    const current = groups.get(id)
    if (current) {
      current.items.push(item)
      continue
    }
    groups.set(id, {
      id,
      ...relations,
      label: legacy
        ? "Historische agendapunten zonder geldige bron"
        : (relations.project?.title ?? "Clustertopics"),
      items: [item],
      legacy,
    })
  }
  return [...groups.values()].sort(
    (left, right) =>
      Number(left.legacy) - Number(right.legacy) ||
      (left.chapter?.order ?? 999) - (right.chapter?.order ?? 999) ||
      (left.cluster?.order ?? 999) - (right.cluster?.order ?? 999) ||
      (left.project?.title ?? left.label).localeCompare(
        right.project?.title ?? right.label,
        "nl",
      ),
  )
}

export function buildAgendaItemContext(
  state: NormalizedDomainState,
  item: AgendaItem,
): AgendaItemContextModel {
  const relations = agendaItemRelations(state, item)
  const key =
    item.objectType && item.objectId
      ? `${item.objectType}:${item.objectId}`
      : `Meeting:${item.meetingId}`
  const contributions = [
    ...(state.indices.updatesByObject.get(key) ?? []),
  ].filter((entry) => entry.audit.active)
  const actions = [...(state.indices.actionsByObject.get(key) ?? [])].filter(
    (entry) => entry.audit.active,
  )
  const seenMeetings = new Set<UUID>()
  const meetings = (
    item.objectType && item.objectId
      ? (state.indices.agendaItemsByObject.get(key) ?? [])
      : []
  )
    .flatMap((agendaItem) => {
      const meeting = state.indices.meetingById.get(agendaItem.meetingId)
      if (!meeting?.audit.active || seenMeetings.has(meeting.id)) return []
      seenMeetings.add(meeting.id)
      return [meeting]
    })
    .sort((left, right) => right.date.localeCompare(left.date))
  const source = relations.topic ?? relations.project
  const currentUpdate = source?.currentUpdateId
    ? state.indices.updateById.get(source.currentUpdateId)
    : undefined
  return {
    item,
    ...relations,
    ...(currentUpdate?.audit.active ? { currentUpdate } : {}),
    updates: contributions.filter((entry) => entry.type !== "Beslissing"),
    decisions: contributions.filter((entry) => entry.type === "Beslissing"),
    actions,
    meetings,
  }
}

export function buildMeetingDetailModel(
  state: NormalizedDomainState,
  meetingId: UUID,
  today: string,
  reportVersion?: number,
): MeetingDetailModel | undefined {
  const meeting = state.indices.meetingById.get(meetingId)
  if (!meeting) return undefined
  const reports = [
    ...(state.indices.reportsByMeeting.get(meeting.id) ?? []),
  ].sort((left, right) => right.version - left.version)
  const selectedReport = reportVersion
    ? reports.find((report) => report.version === reportVersion)
    : reports[0]
  const actions = [...(state.indices.actionsByMeeting.get(meeting.id) ?? [])]
  const actionItems = buildActionListItems(state, actions)
  const participants = [
    ...(state.indices.meetingParticipantsByMeeting.get(meeting.id) ?? []),
  ]
    .map((participant) => {
      const actor = state.indices.actorById.get(participant.actorId)
      return { participant, ...(actor ? { actor } : {}) }
    })
    .sort((left, right) =>
      (left.actor?.displayName ?? "").localeCompare(
        right.actor?.displayName ?? "",
        "nl",
      ),
    )
  const contributions = [
    ...(state.indices.updatesByMeeting.get(meeting.id) ?? []),
  ].sort(
    (left, right) =>
      right.date.localeCompare(left.date) ||
      right.audit.createdAt.localeCompare(left.audit.createdAt),
  )
  const chair = meeting.chairActorId
    ? state.indices.actorById.get(meeting.chairActorId)
    : undefined
  const reporter = meeting.reporterActorId
    ? state.indices.actorById.get(meeting.reporterActorId)
    : undefined
  const agenda = [
    ...(state.indices.agendaItemsByMeeting.get(meeting.id) ?? []),
  ].sort((left, right) => left.order - right.order)
  return {
    meeting,
    scopeLabel: meetingScopeLabel(state, meeting),
    ...(chair ? { chair } : {}),
    ...(reporter ? { reporter } : {}),
    participants,
    agenda,
    updates: contributions.filter((update) => update.type !== "Beslissing"),
    decisions: contributions.filter((update) => update.type === "Beslissing"),
    actions,
    actionOwnerGroups: groupActionListItemsByOwner(actionItems),
    reports,
    ...(selectedReport ? { selectedReport } : {}),
    selectedReportItems: selectedReport
      ? [
          ...(state.indices.reportItemsByReport.get(selectedReport.id) ?? []),
        ].sort((left, right) => left.order - right.order)
      : [],
    suggestions: buildAgendaSuggestions(state, meeting, today),
    agendaGroups: buildMeetingAgendaGroups(state, agenda),
  }
}

export function meetingBelongsToProject(
  state: NormalizedDomainState,
  meeting: Meeting,
  projectId: UUID,
): boolean {
  if (meeting.scopeType === "Project") return meeting.scopeId === projectId
  const project = state.indices.projectById.get(projectId)
  if (!project) return false
  if (meeting.scopeType === "Cluster")
    return meeting.scopeId === project.clusterId
  if (meeting.scopeType === "Hoofdstuk")
    return meeting.scopeId === project.chapterId
  return false
}

export function meetingsForProject(
  state: NormalizedDomainState,
  projectId: UUID,
): readonly Meeting[] {
  return [...(state.indices.meetingsByProject.get(projectId) ?? [])]
    .filter((meeting) => meeting.audit.active)
    .sort((left, right) => right.date.localeCompare(left.date))
}

export function buildAgendaSchedulingModel(
  state: NormalizedDomainState,
  objectType: AgendaObjectType,
  objectId: UUID,
  fromDate: string,
): AgendaSchedulingModel {
  const scheduledMeetings = [
    ...(state.indices.agendaItemsByObject.get(`${objectType}:${objectId}`) ??
      []),
  ]
    .filter((agendaItem) => agendaItem.audit.active)
    .flatMap((agendaItem) => {
      const meeting = state.indices.meetingById.get(agendaItem.meetingId)
      return meeting?.audit.active ? [{ meeting, agendaItem }] : []
    })
    .sort((left, right) => left.meeting.date.localeCompare(right.meeting.date))
  const scheduledIds = new Set(
    scheduledMeetings.map(({ meeting }) => meeting.id),
  )
  const availableMeetings = state.records.meetings
    .filter(
      (meeting) =>
        meeting.audit.active &&
        meeting.status === "Concept" &&
        meeting.date >= fromDate &&
        !scheduledIds.has(meeting.id) &&
        isAgendaObjectInMeetingScope(
          meeting,
          objectType,
          objectId,
          references(state),
        ),
    )
    .sort(
      (left, right) =>
        left.date.localeCompare(right.date) ||
        left.title.localeCompare(right.title, "nl"),
    )

  return { availableMeetings, scheduledMeetings }
}
