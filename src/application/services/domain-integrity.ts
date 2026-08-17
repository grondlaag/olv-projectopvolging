import {
  hasPlanningDependencyCycle,
  validateActionCompletion,
  validateAgendaObjectScope,
  validateBudgetAmount,
  validateBudgetMutationAmounts,
  validateMeetingScope,
  validatePlanningEntry,
  validateProject,
  validateTopicParent,
  type ObjectType,
  type UUID,
} from "../../domain"
import type { DomainCollections, DomainCollectionKey } from "./domain-state"

export interface DomainIntegrityIssue {
  code: string
  message: string
  collection: DomainCollectionKey
  recordId?: UUID
}

const supportedActionContexts = new Set<ObjectType>([
  "Project",
  "Cluster",
  "Topic",
  "Meeting",
])

export function validateDomainIntegrity(
  records: DomainCollections,
): readonly DomainIntegrityIssue[] {
  const issues: DomainIntegrityIssue[] = []
  const add = (
    collection: DomainCollectionKey,
    code: string,
    message: string,
    recordId?: UUID,
  ) =>
    issues.push({
      collection,
      code,
      message,
      ...(recordId ? { recordId } : {}),
    })

  const collections = Object.entries(records) as [
    DomainCollectionKey,
    DomainCollections[DomainCollectionKey],
  ][]
  const allIds = new Map<UUID, DomainCollectionKey>()
  for (const [collection, values] of collections) {
    for (const record of values) {
      const previous = allIds.get(record.id)
      if (previous) {
        add(
          collection,
          "data.guid.duplicate",
          `GUID ${record.id} komt voor in ${previous} en ${collection}.`,
          record.id,
        )
      } else {
        allIds.set(record.id, collection)
      }
    }
  }

  const chapters = new Map(records.chapters.map((item) => [item.id, item]))
  const clusters = new Map(records.clusters.map((item) => [item.id, item]))
  const projects = new Map(records.projects.map((item) => [item.id, item]))
  const topics = new Map(records.topics.map((item) => [item.id, item]))
  const updates = new Map(records.updates.map((item) => [item.id, item]))
  const actions = new Map(records.actions.map((item) => [item.id, item]))
  const actors = new Map(records.actors.map((item) => [item.id, item]))
  const planning = new Map(records.planning.map((item) => [item.id, item]))
  const budgets = new Map(records.budgets.map((item) => [item.id, item]))
  const meetings = new Map(records.meetings.map((item) => [item.id, item]))
  const reports = new Map(records.reports.map((item) => [item.id, item]))
  const idsByType = new Map<ObjectType, ReadonlySet<UUID>>([
    ["Chapter", new Set(chapters.keys())],
    ["Cluster", new Set(clusters.keys())],
    ["Project", new Set(projects.keys())],
    ["Topic", new Set(topics.keys())],
    ["Update", new Set(updates.keys())],
    ["Action", new Set(actions.keys())],
    ["Evidence", new Set(records.evidence.map((item) => item.id))],
    ["PlanningEntry", new Set(planning.keys())],
    ["BudgetRecord", new Set(budgets.keys())],
    ["Meeting", new Set(meetings.keys())],
    ["Report", new Set(reports.keys())],
  ])

  const activeActor = (actorId: UUID | undefined) =>
    actorId
      ? actors.get(actorId)?.active === true &&
        actors.get(actorId)?.audit.active === true
      : true
  const knownActor = (actorId: UUID | undefined) =>
    actorId ? actors.has(actorId) : true
  const knownObject = (objectType: ObjectType, objectId: UUID) =>
    idsByType.get(objectType)?.has(objectId) === true
  const meetingReferences = {
    chapterIds: new Set(chapters.keys()),
    clustersById: clusters,
    projectsById: projects,
    topicsById: topics,
    actionsById: actions,
  }

  for (const cluster of records.clusters) {
    if (!chapters.has(cluster.chapterId)) {
      add(
        "clusters",
        "data.relation.cluster-chapter",
        "Cluster verwijst naar een onbekend hoofdstuk.",
        cluster.id,
      )
    }
  }

  for (const project of records.projects) {
    if (!chapters.has(project.chapterId)) {
      add(
        "projects",
        "data.relation.project-chapter",
        "Project verwijst naar een onbekend hoofdstuk.",
        project.id,
      )
    }
    const cluster = project.clusterId
      ? clusters.get(project.clusterId)
      : undefined
    for (const problem of validateProject(project, cluster)) {
      add("projects", problem.code, problem.message, project.id)
    }
    if (
      project.coordinatorActorId &&
      !activeActor(project.coordinatorActorId)
    ) {
      add(
        "projects",
        "data.relation.project-coordinator",
        "Projectcoördinator bestaat niet of is niet actief.",
        project.id,
      )
    }
    if (
      project.startDate &&
      project.plannedEndDate &&
      project.plannedEndDate < project.startDate
    ) {
      add(
        "projects",
        "data.project.date-order",
        "De geplande einddatum ligt vóór de startdatum.",
        project.id,
      )
    }
  }

  const openHistoryByProject = new Set<UUID>()
  for (const history of records.projectClusterHistory) {
    const project = projects.get(history.projectId)
    const cluster = clusters.get(history.clusterId)
    if (!project || !cluster || project.chapterId !== cluster.chapterId) {
      add(
        "projectClusterHistory",
        "data.relation.project-cluster-history",
        "Clusterhistoriek bevat een verbroken relatie.",
        history.id,
      )
    }
    if (!history.validTo) {
      if (openHistoryByProject.has(history.projectId)) {
        add(
          "projectClusterHistory",
          "data.history.multiple-open",
          "Een project heeft meer dan één open clusterkoppeling.",
          history.id,
        )
      }
      openHistoryByProject.add(history.projectId)
    }
    if (!knownActor(history.authorActorId)) {
      add(
        "projectClusterHistory",
        "data.relation.history-author",
        "Clusterhistoriek verwijst naar een onbekende auteur.",
        history.id,
      )
    }
  }

  const checkCurrentUpdate = (
    collection: "clusters" | "projects" | "topics",
    record: { id: UUID; currentUpdateId?: UUID },
    objectType: "Cluster" | "Project" | "Topic",
  ) => {
    if (!record.currentUpdateId) return
    const current = updates.get(record.currentUpdateId)
    if (
      !current?.audit.active ||
      current.objectType !== objectType ||
      current.objectId !== record.id
    ) {
      add(
        collection,
        "data.relation.current-update",
        "Actuele stand verwijst niet naar een eigen actieve update.",
        record.id,
      )
    }
  }
  for (const cluster of records.clusters)
    checkCurrentUpdate("clusters", cluster, "Cluster")
  for (const project of records.projects)
    checkCurrentUpdate("projects", project, "Project")

  for (const topic of records.topics) {
    for (const problem of validateTopicParent(topic)) {
      add("topics", problem.code, problem.message, topic.id)
    }
    if (
      (topic.projectId && !projects.has(topic.projectId)) ||
      (topic.clusterId && !clusters.has(topic.clusterId))
    ) {
      add(
        "topics",
        "data.topic.parent-missing",
        "Topic verwijst naar een onbekende ouder.",
        topic.id,
      )
    }
    if (topic.ownerActorId && !activeActor(topic.ownerActorId)) {
      add(
        "topics",
        "data.relation.topic-owner",
        "Topiceigenaar bestaat niet of is niet actief.",
        topic.id,
      )
    }
    checkCurrentUpdate("topics", topic, "Topic")
  }

  for (const update of records.updates) {
    if (!knownObject(update.objectType, update.objectId)) {
      add(
        "updates",
        "data.relation.update-object",
        "Update verwijst naar een onbekend bronobject.",
        update.id,
      )
    }
    if (!actors.has(update.authorActorId)) {
      add(
        "updates",
        "data.relation.update-author",
        "Update verwijst naar een onbekende auteur.",
        update.id,
      )
    }
    if (update.meetingId && !meetings.has(update.meetingId)) {
      add(
        "updates",
        "data.relation.update-meeting",
        "Update verwijst naar een onbekend overleg.",
        update.id,
      )
    }
  }

  for (const action of records.actions) {
    if (
      !supportedActionContexts.has(action.objectType) ||
      !knownObject(action.objectType, action.objectId)
    ) {
      add(
        "actions",
        "data.relation.action-object",
        "Actie verwijst naar een onbekende of niet-ondersteunde context.",
        action.id,
      )
    }
    if (!activeActor(action.ownerActorId)) {
      add(
        "actions",
        "data.relation.action-owner",
        "Actie heeft geen actieve eigenaar.",
        action.id,
      )
    }
    if (action.sourceMeetingId && !meetings.has(action.sourceMeetingId)) {
      add(
        "actions",
        "data.relation.action-meeting",
        "Actie verwijst naar een onbekend bronoverleg.",
        action.id,
      )
    }
    for (const problem of validateActionCompletion(action)) {
      add("actions", problem.code, problem.message, action.id)
    }
  }
  for (const history of records.actionHistory) {
    if (
      !actions.has(history.actionId) ||
      !actors.has(history.changedByActorId)
    ) {
      add(
        "actionHistory",
        "data.relation.action-history",
        "Actiehistoriek bevat een verbroken relatie.",
        history.id,
      )
    }
  }

  for (const evidence of records.evidence) {
    if (
      !knownObject(evidence.objectType, evidence.objectId) ||
      !knownActor(evidence.authorActorId)
    ) {
      add(
        "evidence",
        "data.relation.evidence",
        "Bewijsmetadata bevat een verbroken relatie.",
        evidence.id,
      )
    }
  }

  const plannedTopics = new Set<UUID>()
  for (const entry of records.planning) {
    const topic = entry.topicId ? topics.get(entry.topicId) : undefined
    if (
      !projects.has(entry.projectId) ||
      (entry.topicId && topic?.projectId !== entry.projectId)
    ) {
      add(
        "planning",
        "data.relation.planning",
        "Planningitem bevat een verbroken project/topicrelatie.",
        entry.id,
      )
    }
    if (entry.topicId) {
      if (plannedTopics.has(entry.topicId)) {
        add(
          "planning",
          "data.planning.duplicate-topic",
          "Topic heeft meer dan één primaire planningentry.",
          entry.id,
        )
      }
      plannedTopics.add(entry.topicId)
    }
    for (const problem of validatePlanningEntry(entry)) {
      add("planning", problem.code, problem.message, entry.id)
    }
  }
  for (const dependency of records.planningDependencies) {
    const predecessor = planning.get(dependency.predecessorPlanningId)
    const successor = planning.get(dependency.successorPlanningId)
    if (
      !predecessor ||
      !successor ||
      predecessor.id === successor.id ||
      predecessor.projectId !== successor.projectId
    ) {
      add(
        "planningDependencies",
        "data.planning.dependency",
        "Planningafhankelijkheid is ongeldig.",
        dependency.id,
      )
    }
  }
  if (hasPlanningDependencyCycle(records.planningDependencies)) {
    add(
      "planningDependencies",
      "data.planning.cycle",
      "Planningafhankelijkheden bevatten een cyclus.",
    )
  }

  for (const budget of records.budgets) {
    const topic = budget.topicId ? topics.get(budget.topicId) : undefined
    if (
      !projects.has(budget.projectId) ||
      (budget.topicId && topic?.projectId !== budget.projectId)
    ) {
      add(
        "budgets",
        "data.relation.budget",
        "Budgetrecord bevat een verbroken project/topicrelatie.",
        budget.id,
      )
    }
    if (!knownActor(budget.supplierActorId)) {
      add(
        "budgets",
        "data.relation.budget-supplier",
        "Budgetrecord verwijst naar een onbekende leverancier.",
        budget.id,
      )
    }
    for (const problem of validateBudgetAmount(budget.amountCents)) {
      add("budgets", problem.code, problem.message, budget.id)
    }
  }
  for (const mutation of records.budgetMutations) {
    if (
      !budgets.has(mutation.budgetRecordId) ||
      !actors.has(mutation.authorActorId)
    ) {
      add(
        "budgetMutations",
        "data.relation.budget-mutation",
        "Budgetmutatie bevat een verbroken relatie.",
        mutation.id,
      )
    }
    for (const problem of validateBudgetMutationAmounts(mutation)) {
      add("budgetMutations", problem.code, problem.message, mutation.id)
    }
  }

  for (const meeting of records.meetings) {
    for (const problem of validateMeetingScope(meeting, meetingReferences)) {
      add("meetings", problem.code, problem.message, meeting.id)
    }
    if (
      !activeActor(meeting.chairActorId) ||
      !activeActor(meeting.reporterActorId)
    ) {
      add(
        "meetings",
        "data.relation.meeting-actor",
        "Overleg verwijst naar een onbekende of inactieve actor.",
        meeting.id,
      )
    }
    if (meeting.sourceMeetingId) {
      const source = meetings.get(meeting.sourceMeetingId)
      if (
        !source ||
        source.id === meeting.id ||
        source.scopeType !== meeting.scopeType ||
        source.scopeId !== meeting.scopeId
      ) {
        add(
          "meetings",
          "data.relation.meeting-source",
          "Vervolgoverleg verwijst niet naar een geldig overleg met dezelfde scope.",
          meeting.id,
        )
      }
    }
  }
  const participantPairs = new Set<string>()
  for (const participant of records.meetingParticipants) {
    const pair = `${participant.meetingId}:${participant.actorId}`
    if (
      !meetings.has(participant.meetingId) ||
      !activeActor(participant.actorId)
    ) {
      add(
        "meetingParticipants",
        "data.relation.meeting-participant",
        "Overlegdeelnemer bevat een verbroken relatie.",
        participant.id,
      )
    }
    if (participantPairs.has(pair)) {
      add(
        "meetingParticipants",
        "data.meeting.participant-duplicate",
        "Een actor staat meer dan één keer in hetzelfde overleg.",
        participant.id,
      )
    }
    participantPairs.add(pair)
  }
  for (const agendaItem of records.agendaItems) {
    const meeting = meetings.get(agendaItem.meetingId)
    if (!meeting) {
      add(
        "agendaItems",
        "data.relation.agenda-meeting",
        "Agendapunt verwijst naar een onbekend overleg.",
        agendaItem.id,
      )
      continue
    }
    if (Boolean(agendaItem.objectType) !== Boolean(agendaItem.objectId)) {
      add(
        "agendaItems",
        "data.relation.agenda-object-pair",
        "Agendapunt heeft geen volledig objectpaar.",
        agendaItem.id,
      )
    } else if (agendaItem.objectType && agendaItem.objectId) {
      for (const problem of validateAgendaObjectScope(
        meeting,
        agendaItem.objectType,
        agendaItem.objectId,
        meetingReferences,
      )) {
        add("agendaItems", problem.code, problem.message, agendaItem.id)
      }
    }
  }

  const reportVersions = new Set<string>()
  for (const report of records.reports) {
    if (!meetings.has(report.meetingId) || !actors.has(report.authorActorId)) {
      add(
        "reports",
        "data.relation.report",
        "Verslag bevat een verbroken relatie.",
        report.id,
      )
    }
    const key = `${report.meetingId}:${report.version}`
    if (reportVersions.has(key)) {
      add(
        "reports",
        "data.report.version-duplicate",
        "Verslagversie komt meer dan één keer voor.",
        report.id,
      )
    }
    reportVersions.add(key)
    if (
      (report.status === "Definitief" || report.status === "Gereviseerd") &&
      !report.finalDate
    ) {
      add(
        "reports",
        "data.report.final-date",
        "Definitief verslag vereist een finaledatum.",
        report.id,
      )
    }
  }
  for (const item of records.reportItems) {
    if (
      !reports.has(item.reportId) ||
      (item.objectType &&
        item.objectId &&
        !knownObject(item.objectType, item.objectId))
    ) {
      add(
        "reportItems",
        "data.relation.report-item",
        "Verslagitem bevat een verbroken relatie.",
        item.id,
      )
    }
    if (Boolean(item.objectType) !== Boolean(item.objectId)) {
      add(
        "reportItems",
        "data.relation.report-object-pair",
        "Verslagitem heeft geen volledig objectpaar.",
        item.id,
      )
    }
  }

  if (records.config.length !== 1) {
    add(
      "config",
      "data.config.single",
      "Een gegevensbestand bevat exact één configuratierecord.",
    )
  }
  for (const config of records.config) {
    if (!activeActor(config.currentActorId)) {
      add(
        "config",
        "data.config.current-actor",
        "De huidige actor bestaat niet of is niet actief.",
        config.id,
      )
    }
  }
  const choiceKeys = new Set<string>()
  for (const choice of records.choiceLists) {
    const key = `${choice.listKey.trim().toLocaleLowerCase("nl")}:${choice.valueKey.trim().toLocaleLowerCase("nl")}`
    if (choiceKeys.has(key)) {
      add(
        "choiceLists",
        "data.choice-list.duplicate",
        "Keuzelijstwaarde komt dubbel voor.",
        choice.id,
      )
    }
    choiceKeys.add(key)
  }

  for (const [collection, values] of collections) {
    for (const record of values) {
      if (
        !knownActor(record.audit.createdByActorId) ||
        !knownActor(record.audit.updatedByActorId)
      ) {
        add(
          collection,
          "data.audit.actor",
          "Auditvelden verwijzen naar een onbekende actor.",
          record.id,
        )
      }
    }
  }

  return issues
}
