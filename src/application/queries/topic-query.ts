import type {
  Action,
  Actor,
  Meeting,
  PlanningEntry,
  Priority,
  Topic,
  TopicParentType,
  TopicStatus,
  Update,
  UUID,
} from "../../domain"
import type { NormalizedDomainState } from "../services"

const closedActionStatuses = new Set(["Afgerond", "Geannuleerd"])

export interface TopicFilters {
  search: string
  status: "" | TopicStatus
  ownerActorId: string
  priority: "" | Priority
}

export const defaultTopicFilters: TopicFilters = {
  search: "",
  status: "",
  ownerActorId: "",
  priority: "",
}

export interface TopicListItem {
  topic: Topic
  owner?: Actor
  currentUpdate?: Update
  planning?: PlanningEntry
  actionCount: number
  openActionCount: number
  lastActivityDate: string
}

function topicRecords(
  state: NormalizedDomainState,
  parentType: TopicParentType,
  parentId: UUID,
): readonly Topic[] {
  return parentType === "Project"
    ? (state.indices.topicsByProject.get(parentId) ?? [])
    : (state.indices.topicsByCluster.get(parentId) ?? [])
}

export function buildTopicListItems(
  state: NormalizedDomainState,
  parentType: TopicParentType,
  parentId: UUID,
): readonly TopicListItem[] {
  return topicRecords(state, parentType, parentId)
    .filter((topic) => topic.audit.active)
    .map((topic) => {
      const updates =
        state.indices.updatesByObject.get(`Topic:${topic.id}`) ?? []
      const actions =
        state.indices.actionsByObject.get(`Topic:${topic.id}`) ?? []
      const planning = state.indices.planningByTopic.get(topic.id)?.[0]
      const owner = topic.ownerActorId
        ? state.indices.actorById.get(topic.ownerActorId)
        : undefined
      const currentUpdate = topic.currentUpdateId
        ? state.indices.updateById.get(topic.currentUpdateId)
        : undefined
      const lastUpdateDate = updates.reduce(
        (latest, update) => (update.date > latest ? update.date : latest),
        "",
      )
      return {
        topic,
        ...(owner ? { owner } : {}),
        ...(currentUpdate?.audit.active ? { currentUpdate } : {}),
        ...(planning ? { planning } : {}),
        actionCount: actions.length,
        openActionCount: actions.filter(
          (action) => !closedActionStatuses.has(action.status),
        ).length,
        lastActivityDate: lastUpdateDate || topic.audit.updatedAt.slice(0, 10),
      }
    })
    .sort(
      (left, right) =>
        left.topic.order - right.topic.order ||
        left.topic.title.localeCompare(right.topic.title, "nl"),
    )
}

export function filterTopicListItems(
  items: readonly TopicListItem[],
  filters: TopicFilters,
): readonly TopicListItem[] {
  const search = filters.search.trim().toLocaleLowerCase("nl")
  return items.filter((item) => {
    if (filters.status && item.topic.status !== filters.status) return false
    if (
      filters.ownerActorId &&
      item.topic.ownerActorId !== filters.ownerActorId
    )
      return false
    if (filters.priority && item.topic.priority !== filters.priority)
      return false
    if (!search) return true
    return [
      item.topic.code,
      item.topic.title,
      item.topic.context,
      item.owner?.displayName,
      item.currentUpdate?.text,
    ]
      .filter(Boolean)
      .join(" ")
      .toLocaleLowerCase("nl")
      .includes(search)
  })
}

export function buildTopicJournal(
  state: NormalizedDomainState,
  topicId: UUID,
): readonly Update[] {
  return [...(state.indices.updatesByObject.get(`Topic:${topicId}`) ?? [])]
    .filter((entry) => entry.audit.active)
    .sort(
      (left, right) =>
        right.date.localeCompare(left.date) ||
        right.audit.createdAt.localeCompare(left.audit.createdAt),
    )
}

export interface ProjectOverviewModel {
  openTopicCount: number
  criticalTopicCount: number
  openActionCount: number
  overdueActionCount: number
  nextMilestone?: PlanningEntry
  currentTopicNotes: readonly TopicListItem[]
}

export function buildProjectOverview(
  state: NormalizedDomainState,
  projectId: UUID,
  today: string,
): ProjectOverviewModel {
  const items = buildTopicListItems(state, "Project", projectId)
  const openTopics = items.filter((item) => item.topic.status === "Open")
  const openActions = (
    state.indices.actionsByProject.get(projectId) ?? []
  ).filter((action) => !closedActionStatuses.has(action.status))
  const nextMilestone = [
    ...(state.indices.planningByProject.get(projectId) ?? []),
  ]
    .filter(
      (entry) =>
        entry.audit.active &&
        entry.isMilestone &&
        entry.plannedEndDate >= today &&
        entry.status !== "Afgerond" &&
        entry.status !== "Geannuleerd",
    )
    .sort((left, right) =>
      left.plannedEndDate.localeCompare(right.plannedEndDate),
    )[0]

  return {
    openTopicCount: openTopics.length,
    criticalTopicCount: openTopics.filter(
      (item) => item.topic.priority === "Kritiek",
    ).length,
    openActionCount: openActions.length,
    overdueActionCount: openActions.filter(
      (action) => action.deadline && action.deadline < today,
    ).length,
    ...(nextMilestone ? { nextMilestone } : {}),
    currentTopicNotes: openTopics
      .filter((item) => item.currentUpdate)
      .sort((left, right) =>
        right.lastActivityDate.localeCompare(left.lastActivityDate),
      )
      .slice(0, 4),
  }
}

export type ProjectJournalFilter = "all" | "updates" | "decisions" | "topics"

export interface ProjectJournalEntry {
  update: Update
  sourceType: "Project" | "Topic" | "Action" | "Planning" | "Budget"
  sourceLabel: string
  topicId?: UUID
}

function addObjectUpdates(
  entries: ProjectJournalEntry[],
  state: NormalizedDomainState,
  objectKey: string,
  sourceType: ProjectJournalEntry["sourceType"],
  sourceLabel: string,
  topicId?: UUID,
): void {
  for (const update of state.indices.updatesByObject.get(objectKey) ?? []) {
    if (!update.audit.active) continue
    entries.push({
      update,
      sourceType,
      sourceLabel,
      ...(topicId ? { topicId } : {}),
    })
  }
}

export function buildProjectJournal(
  state: NormalizedDomainState,
  projectId: UUID,
): readonly ProjectJournalEntry[] {
  const entries: ProjectJournalEntry[] = []
  const project = state.indices.projectById.get(projectId)
  if (!project) return entries

  addObjectUpdates(
    entries,
    state,
    `Project:${project.id}`,
    "Project",
    project.title,
  )
  const topics = state.indices.topicsByProject.get(project.id) ?? []
  for (const topic of topics) {
    addObjectUpdates(
      entries,
      state,
      `Topic:${topic.id}`,
      "Topic",
      topic.title,
      topic.id,
    )
  }
  for (const action of state.indices.actionsByProject.get(project.id) ?? []) {
    addObjectUpdates(
      entries,
      state,
      `Action:${action.id}`,
      "Action",
      action.title,
    )
  }
  for (const planning of state.indices.planningByProject.get(project.id) ??
    []) {
    addObjectUpdates(
      entries,
      state,
      `PlanningEntry:${planning.id}`,
      "Planning",
      planning.title,
    )
  }
  for (const budget of state.indices.budgetByProject.get(project.id) ?? []) {
    addObjectUpdates(
      entries,
      state,
      `BudgetRecord:${budget.id}`,
      "Budget",
      budget.description,
    )
  }

  return entries.sort(
    (left, right) =>
      right.update.date.localeCompare(left.update.date) ||
      right.update.audit.createdAt.localeCompare(left.update.audit.createdAt),
  )
}

export function filterProjectJournal(
  entries: readonly ProjectJournalEntry[],
  filter: ProjectJournalFilter,
): readonly ProjectJournalEntry[] {
  if (filter === "all") return entries
  if (filter === "decisions")
    return entries.filter((entry) => entry.update.type === "Beslissing")
  if (filter === "topics")
    return entries.filter((entry) => entry.sourceType === "Topic")
  return entries.filter((entry) => entry.update.type !== "Beslissing")
}

export interface ProjectJournalGroup {
  id: string
  kind: "project" | "topic"
  title: string
  code: string
  topic?: Topic
  currentUpdate?: Update
  updates: readonly Update[]
  decisions: readonly Update[]
  actions: readonly Action[]
  meetings: readonly Meeting[]
  lastActivityDate: string
}

function meetingsForJournalObject(
  state: NormalizedDomainState,
  objectType: "Project" | "Topic",
  objectId: UUID,
): readonly Meeting[] {
  const seen = new Set<UUID>()
  return (
    state.indices.agendaItemsByObject.get(`${objectType}:${objectId}`) ?? []
  )
    .flatMap((agendaItem) => {
      const meeting = state.indices.meetingById.get(agendaItem.meetingId)
      if (!meeting?.audit.active || seen.has(meeting.id)) return []
      seen.add(meeting.id)
      return [meeting]
    })
    .sort((left, right) => right.date.localeCompare(left.date))
}

function journalGroup(
  state: NormalizedDomainState,
  objectType: "Project" | "Topic",
  objectId: UUID,
  title: string,
  code: string,
  topic?: Topic,
): ProjectJournalGroup {
  const journal = [
    ...(state.indices.updatesByObject.get(`${objectType}:${objectId}`) ?? []),
  ]
    .filter((entry) => entry.audit.active)
    .sort(
      (left, right) =>
        right.date.localeCompare(left.date) ||
        right.audit.createdAt.localeCompare(left.audit.createdAt),
    )
  const actions = [
    ...(state.indices.actionsByObject.get(`${objectType}:${objectId}`) ?? []),
  ]
    .filter((action) => action.audit.active)
    .sort((left, right) =>
      right.audit.updatedAt.localeCompare(left.audit.updatedAt),
    )
  const meetings = meetingsForJournalObject(state, objectType, objectId)
  const currentUpdate = topic?.currentUpdateId
    ? state.indices.updateById.get(topic.currentUpdateId)
    : objectType === "Project"
      ? state.indices.projectById.get(objectId)?.currentUpdateId
        ? state.indices.updateById.get(
            state.indices.projectById.get(objectId)!.currentUpdateId!,
          )
        : undefined
      : undefined
  const lastActivityDate = [
    journal[0]?.date,
    actions[0]?.audit.updatedAt.slice(0, 10),
    meetings[0]?.date,
    topic?.audit.updatedAt.slice(0, 10),
  ]
    .filter((value): value is string => Boolean(value))
    .sort((left, right) => right.localeCompare(left))[0]

  return {
    id: `${objectType}:${objectId}`,
    kind: objectType === "Project" ? "project" : "topic",
    title,
    code,
    ...(topic ? { topic } : {}),
    ...(currentUpdate?.audit.active ? { currentUpdate } : {}),
    updates: journal.filter((entry) => entry.type !== "Beslissing"),
    decisions: journal.filter((entry) => entry.type === "Beslissing"),
    actions,
    meetings,
    lastActivityDate: lastActivityDate ?? "",
  }
}

/**
 * Bouwt het projectjournaal per werkcontext. Een projectbrede groep blijft
 * apart van de echte topics; er wordt dus geen kunstmatig "algemeen topic"
 * opgeslagen.
 */
export function buildProjectJournalGroups(
  state: NormalizedDomainState,
  projectId: UUID,
): readonly ProjectJournalGroup[] {
  const project = state.indices.projectById.get(projectId)
  if (!project) return []
  const projectGroup = journalGroup(
    state,
    "Project",
    project.id,
    "Algemene projectopvolging",
    project.code,
  )
  const topicGroups = (state.indices.topicsByProject.get(project.id) ?? [])
    .filter((topic) => topic.audit.active)
    .map((topic) =>
      journalGroup(state, "Topic", topic.id, topic.title, topic.code, topic),
    )
    .sort(
      (left, right) =>
        right.lastActivityDate.localeCompare(left.lastActivityDate) ||
        left.title.localeCompare(right.title, "nl"),
    )
  return [projectGroup, ...topicGroups]
}
