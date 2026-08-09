import {
  isAgendaObjectInMeetingScope,
  type Action,
  type Actor,
  type AgendaItem,
  type AgendaObjectType,
  type Meeting,
  type MeetingParticipant,
  type MeetingScopeReferences,
  type MeetingScopeType,
  type MeetingStatus,
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
  objectType: AgendaObjectType
  objectId: UUID
  title: string
  reason: string
  tone: "attention" | "neutral"
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

function actionSuggestion(action: Action, today: string): AgendaSuggestion {
  const overdue = isActionOverdue(action, today)
  return {
    objectType: "Action",
    objectId: action.id,
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
        (action.status === "Wacht op beslissing" ||
          isActionOverdue(action, today)) &&
        isAgendaObjectInMeetingScope(
          meeting,
          "Action",
          action.id,
          scopeReferences,
        ) &&
        !existing.has(`Action:${action.id}`),
    )
    .map((action) => actionSuggestion(action, today))
  return [...topicSuggestions, ...actionSuggestions].sort(
    (left, right) =>
      Number(right.tone === "attention") - Number(left.tone === "attention") ||
      left.title.localeCompare(right.title, "nl"),
  )
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
  return {
    meeting,
    scopeLabel: meetingScopeLabel(state, meeting),
    ...(chair ? { chair } : {}),
    ...(reporter ? { reporter } : {}),
    participants,
    agenda: [
      ...(state.indices.agendaItemsByMeeting.get(meeting.id) ?? []),
    ].sort((left, right) => left.order - right.order),
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
