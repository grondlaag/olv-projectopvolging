import type { Action, Meeting, Topic, Update, UUID } from "../../domain"
import type { NormalizedDomainState } from "../services"

export type GlobalSearchResultType =
  | "Project"
  | "Cluster"
  | "Topic"
  | "Actuele stand"
  | "Update"
  | "Beslissing"
  | "Actie"
  | "Overleg"

export interface GlobalSearchResult {
  id: string
  type: GlobalSearchResultType
  title: string
  context: string
  route: string
  searchableText: string
}

function normalized(value: string): string {
  return value.toLocaleLowerCase("nl").normalize("NFKD")
}

function topicRoute(topic: Topic): string {
  return topic.projectId
    ? `/projects/${topic.projectId}/topics/${topic.id}`
    : `/clusters/${topic.clusterId}/topics/${topic.id}`
}

function topicContext(state: NormalizedDomainState, topic: Topic): string {
  if (topic.projectId) {
    const project = state.indices.projectById.get(topic.projectId)
    return project ? `${project.code} · ${project.title}` : "Onbekend project"
  }
  const cluster = topic.clusterId
    ? state.indices.clusterById.get(topic.clusterId)
    : undefined
  return cluster ? `${cluster.code} · ${cluster.title}` : "Onbekende cluster"
}

function updateContext(
  state: NormalizedDomainState,
  update: Update,
): Pick<GlobalSearchResult, "route" | "context"> | undefined {
  if (update.objectType === "Topic") {
    const topic = state.indices.topicById.get(update.objectId)
    if (!topic) return undefined
    return { route: topicRoute(topic), context: topicContext(state, topic) }
  }
  if (update.objectType === "Project") {
    const project = state.indices.projectById.get(update.objectId)
    if (!project) return undefined
    return {
      route: `/projects/${project.id}/journal`,
      context: `${project.code} · ${project.title}`,
    }
  }
  if (update.objectType === "Cluster") {
    const cluster = state.indices.clusterById.get(update.objectId)
    if (!cluster) return undefined
    return {
      route: `/clusters/${cluster.id}`,
      context: `${cluster.code} · ${cluster.title}`,
    }
  }
  if (update.meetingId && state.indices.meetingById.has(update.meetingId)) {
    const meeting = state.indices.meetingById.get(update.meetingId)!
    return { route: `/meetings/${meeting.id}`, context: meeting.title }
  }
  return undefined
}

function actionContext(
  state: NormalizedDomainState,
  action: Action,
): Pick<GlobalSearchResult, "route" | "context"> {
  const route = `/actions?actie=${action.id}`
  if (action.objectType === "Topic") {
    const topic = state.indices.topicById.get(action.objectId)
    if (topic) return { route, context: topicContext(state, topic) }
  }
  if (action.objectType === "Project") {
    const project = state.indices.projectById.get(action.objectId)
    if (project) return { route, context: `${project.code} · ${project.title}` }
  }
  if (action.objectType === "Cluster") {
    const cluster = state.indices.clusterById.get(action.objectId)
    if (cluster) return { route, context: `${cluster.code} · ${cluster.title}` }
  }
  if (action.objectType === "Meeting") {
    const meeting = state.indices.meetingById.get(action.objectId)
    if (meeting) return { route, context: meeting.title }
  }
  return { route, context: "Globale actielijst" }
}

function meetingContext(
  state: NormalizedDomainState,
  meeting: Meeting,
): string {
  if (!meeting.scopeId) return "Portfolio"
  if (meeting.scopeType === "Project") {
    const project = state.indices.projectById.get(meeting.scopeId)
    return project ? `${project.code} · ${project.title}` : "Project"
  }
  if (meeting.scopeType === "Cluster")
    return state.indices.clusterById.get(meeting.scopeId)?.title ?? "Cluster"
  return state.indices.chapterById.get(meeting.scopeId)?.title ?? "Hoofdstuk"
}

function currentUpdateIds(state: NormalizedDomainState): ReadonlySet<UUID> {
  return new Set(
    [
      ...state.records.projects,
      ...state.records.clusters,
      ...state.records.topics,
    ].flatMap((record) =>
      record.currentUpdateId ? [record.currentUpdateId] : [],
    ),
  )
}

export function buildGlobalSearchResults(
  state: NormalizedDomainState,
  rawQuery: string,
  limit = 18,
): readonly GlobalSearchResult[] {
  const query = normalized(rawQuery.trim())
  if (query.length < 2) return []
  const results: GlobalSearchResult[] = []
  const add = (result: GlobalSearchResult) => {
    if (
      results.length < limit &&
      normalized(result.searchableText).includes(query)
    )
      results.push(result)
  }

  for (const project of state.records.projects) {
    if (!project.audit.active) continue
    const chapter = state.indices.chapterById.get(project.chapterId)
    const cluster = project.clusterId
      ? state.indices.clusterById.get(project.clusterId)
      : undefined
    add({
      id: `project:${project.id}`,
      type: "Project",
      title: `${project.code} · ${project.title}`,
      context: `${chapter?.title ?? "Onbekend hoofdstuk"} · ${cluster?.title ?? "Zonder cluster"}`,
      route: `/projects/${project.id}`,
      searchableText: [
        project.code,
        project.title,
        project.description,
        project.site,
        project.location,
        project.department,
      ]
        .filter(Boolean)
        .join(" "),
    })
  }
  for (const cluster of state.records.clusters) {
    if (!cluster.audit.active) continue
    add({
      id: `cluster:${cluster.id}`,
      type: "Cluster",
      title: `${cluster.code} · ${cluster.title}`,
      context:
        state.indices.chapterById.get(cluster.chapterId)?.title ??
        "Onbekend hoofdstuk",
      route: `/clusters/${cluster.id}`,
      searchableText: `${cluster.code} ${cluster.title} ${cluster.description}`,
    })
  }
  for (const topic of state.records.topics) {
    if (!topic.audit.active) continue
    add({
      id: `topic:${topic.id}`,
      type: "Topic",
      title: `${topic.code} · ${topic.title}`,
      context: topicContext(state, topic),
      route: topicRoute(topic),
      searchableText: `${topic.code} ${topic.title} ${topic.context} ${topic.priority} ${topic.status}`,
    })
  }

  const currents = currentUpdateIds(state)
  for (const update of state.records.updates) {
    if (!update.audit.active) continue
    const context = updateContext(state, update)
    if (!context) continue
    const type =
      update.type === "Beslissing"
        ? "Beslissing"
        : currents.has(update.id)
          ? "Actuele stand"
          : "Update"
    add({
      id: `update:${update.id}`,
      type,
      title: update.text,
      ...context,
      searchableText: `${update.type} ${update.text} ${context.context}`,
    })
  }
  for (const action of state.records.actions) {
    if (!action.audit.active) continue
    const context = actionContext(state, action)
    add({
      id: `action:${action.id}`,
      type: "Actie",
      title: `${action.code} · ${action.title}`,
      ...context,
      searchableText: `${action.code} ${action.title} ${action.description ?? ""} ${action.status} ${context.context}`,
    })
  }
  for (const meeting of state.records.meetings) {
    if (!meeting.audit.active) continue
    const context = meetingContext(state, meeting)
    add({
      id: `meeting:${meeting.id}`,
      type: "Overleg",
      title: meeting.title,
      context: `${context} · ${meeting.date}`,
      route: `/meetings/${meeting.id}`,
      searchableText: `${meeting.number ?? ""} ${meeting.title} ${meeting.type} ${context}`,
    })
  }

  return results
}
