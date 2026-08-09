import {
  validateActionCompletion,
  validateBudgetAmount,
  validateBudgetMutationAmounts,
  validateAgendaObjectScope,
  validateMeetingScope,
  hasPlanningDependencyCycle,
  validatePlanningEntry,
  validateTopicParent,
  type ObjectType,
  type UUID,
} from "../../../domain"
import type { DomainCollections } from "../../../application/services"
import type { ExcelValidationIssue } from "../validation-report"

const blocking = (
  code: string,
  message: string,
  tableName: string,
): ExcelValidationIssue => ({ level: "Blocking", code, message, tableName })

function objectIds(records: DomainCollections): Map<ObjectType, Set<UUID>> {
  return new Map<ObjectType, Set<UUID>>([
    ["Chapter", new Set(records.chapters.map((record) => record.id))],
    ["Cluster", new Set(records.clusters.map((record) => record.id))],
    ["Project", new Set(records.projects.map((record) => record.id))],
    ["Topic", new Set(records.topics.map((record) => record.id))],
    ["Update", new Set(records.updates.map((record) => record.id))],
    ["Action", new Set(records.actions.map((record) => record.id))],
    ["Evidence", new Set(records.evidence.map((record) => record.id))],
    ["PlanningEntry", new Set(records.planning.map((record) => record.id))],
    ["BudgetRecord", new Set(records.budgets.map((record) => record.id))],
    ["Meeting", new Set(records.meetings.map((record) => record.id))],
    ["Report", new Set(records.reports.map((record) => record.id))],
  ])
}

export class ExcelReferentialValidator {
  validate(records: DomainCollections): readonly ExcelValidationIssue[] {
    const issues: ExcelValidationIssue[] = []
    const chapters = new Map(
      records.chapters.map((record) => [record.id, record]),
    )
    const clusters = new Map(
      records.clusters.map((record) => [record.id, record]),
    )
    const projects = new Map(
      records.projects.map((record) => [record.id, record]),
    )
    const topics = new Map(records.topics.map((record) => [record.id, record]))
    const updates = new Map(
      records.updates.map((record) => [record.id, record]),
    )
    const actors = new Map(records.actors.map((record) => [record.id, record]))
    const planning = new Map(
      records.planning.map((record) => [record.id, record]),
    )
    const budgets = new Set(records.budgets.map((record) => record.id))
    const meetingById = new Map(
      records.meetings.map((record) => [record.id, record]),
    )
    const meetings = new Set(meetingById.keys())
    const reports = new Set(records.reports.map((record) => record.id))
    const actions = new Set(records.actions.map((record) => record.id))
    const idsByType = objectIds(records)
    const meetingReferences = {
      chapterIds: new Set(chapters.keys()),
      clustersById: clusters,
      projectsById: projects,
      topicsById: topics,
      actionsById: new Map(
        records.actions.map((record) => [record.id, record]),
      ),
    }

    const validateOptionalActor = (
      actorId: UUID | undefined,
      tableName: string,
      recordId: UUID,
      role: string,
      mustBeActive = false,
    ) => {
      if (!actorId) return
      const actor = actors.get(actorId)
      if (!actor || (mustBeActive && !actor.active)) {
        issues.push(
          blocking(
            "excel.relation.actor",
            `${tableName}-record ${recordId} heeft een onbekende${mustBeActive ? " of inactieve" : ""} ${role}.`,
            tableName,
          ),
        )
      }
    }

    const validateCurrentUpdate = (
      updateId: UUID | undefined,
      objectType: ObjectType,
      objectId: UUID,
      tableName: string,
    ) => {
      if (!updateId) return
      const update = updates.get(updateId)
      if (
        !update ||
        !update.audit.active ||
        update.objectType !== objectType ||
        update.objectId !== objectId
      ) {
        issues.push(
          blocking(
            "excel.relation.current-update",
            `${tableName}-record ${objectId} verwijst niet naar een eigen actuele update.`,
            tableName,
          ),
        )
      }
    }

    for (const cluster of records.clusters) {
      if (!chapters.has(cluster.chapterId)) {
        issues.push(
          blocking(
            "excel.relation.cluster-chapter",
            `Cluster ${cluster.id} verwijst naar een onbekend hoofdstuk.`,
            "tblClusters",
          ),
        )
      }
      validateCurrentUpdate(
        cluster.currentUpdateId,
        "Cluster",
        cluster.id,
        "tblClusters",
      )
    }

    for (const project of records.projects) {
      if (!chapters.has(project.chapterId)) {
        issues.push(
          blocking(
            "excel.relation.project-chapter",
            `Project ${project.id} verwijst naar een onbekend hoofdstuk.`,
            "tblProjecten",
          ),
        )
      }
      if (project.clusterId) {
        const cluster = clusters.get(project.clusterId)
        if (!cluster || cluster.chapterId !== project.chapterId) {
          issues.push(
            blocking(
              "excel.relation.project-cluster",
              `Project ${project.id} verwijst naar een ontbrekende of onverenigbare cluster.`,
              "tblProjecten",
            ),
          )
        }
      }
      validateOptionalActor(
        project.coordinatorActorId,
        "tblProjecten",
        project.id,
        "coördinator",
        true,
      )
      validateCurrentUpdate(
        project.currentUpdateId,
        "Project",
        project.id,
        "tblProjecten",
      )
    }

    for (const history of records.projectClusterHistory) {
      const project = projects.get(history.projectId)
      const cluster = clusters.get(history.clusterId)
      if (!project || !cluster || project.chapterId !== cluster.chapterId) {
        issues.push(
          blocking(
            "excel.relation.project-cluster-history",
            `Clusterhistoriek ${history.id} bevat een verbroken relatie.`,
            "tblProjectClusterHistoriek",
          ),
        )
      }
      validateOptionalActor(
        history.authorActorId,
        "tblProjectClusterHistoriek",
        history.id,
        "auteur",
      )
    }

    for (const topic of records.topics) {
      const parentIssues = validateTopicParent(topic)
      if (parentIssues.length > 0) {
        issues.push(
          blocking(
            "excel.topic.invalid-parent",
            `Topic ${topic.id} heeft niet exact één geldige ouder.`,
            "tblTopics",
          ),
        )
      } else if (
        (topic.projectId && !projects.has(topic.projectId)) ||
        (topic.clusterId && !clusters.has(topic.clusterId))
      ) {
        issues.push(
          blocking(
            "excel.topic.broken-parent",
            `Topic ${topic.id} verwijst naar een onbekende ouder.`,
            "tblTopics",
          ),
        )
      }
      validateOptionalActor(
        topic.ownerActorId,
        "tblTopics",
        topic.id,
        "eigenaar",
        true,
      )
      validateCurrentUpdate(
        topic.currentUpdateId,
        "Topic",
        topic.id,
        "tblTopics",
      )
    }

    const validateObjectLink = (
      objectType: ObjectType,
      objectId: UUID,
      tableName: string,
      recordId: UUID,
    ) => {
      if (!idsByType.get(objectType)?.has(objectId)) {
        issues.push(
          blocking(
            "excel.relation.object",
            `${tableName}-record ${recordId} verwijst naar een onbekend object.`,
            tableName,
          ),
        )
      }
    }

    for (const update of records.updates) {
      validateObjectLink(
        update.objectType,
        update.objectId,
        "tblUpdates",
        update.id,
      )
      if (!actors.has(update.authorActorId)) {
        issues.push(
          blocking(
            "excel.relation.update-author",
            `Update ${update.id} heeft een onbekende auteur.`,
            "tblUpdates",
          ),
        )
      }
      if (update.meetingId && !meetings.has(update.meetingId)) {
        issues.push(
          blocking(
            "excel.relation.update-meeting",
            `Update ${update.id} verwijst naar een onbekend overleg.`,
            "tblUpdates",
          ),
        )
      }
      if (update.meetingId && meetings.has(update.meetingId)) {
        const meeting = meetingById.get(update.meetingId)!
        const validMeetingContext =
          update.objectType === "Meeting"
            ? update.objectId === meeting.id
            : update.objectType === "Project" ||
                update.objectType === "Cluster" ||
                update.objectType === "Topic" ||
                update.objectType === "Action"
              ? validateAgendaObjectScope(
                  meeting,
                  update.objectType,
                  update.objectId,
                  meetingReferences,
                ).length === 0
              : false
        if (!validMeetingContext) {
          issues.push(
            blocking(
              "excel.relation.update-meeting-scope",
              `Update ${update.id} valt buiten de scope van het bronoverleg.`,
              "tblUpdates",
            ),
          )
        }
      }
    }

    for (const action of records.actions) {
      if (
        !(["Project", "Cluster", "Topic", "Meeting"] as ObjectType[]).includes(
          action.objectType,
        )
      ) {
        issues.push(
          blocking(
            "excel.action.invalid-context",
            `Actie ${action.id} heeft een niet-ondersteund contexttype.`,
            "tblActies",
          ),
        )
      } else {
        validateObjectLink(
          action.objectType,
          action.objectId,
          "tblActies",
          action.id,
        )
      }
      const owner = actors.get(action.ownerActorId)
      if (!owner?.active || !owner.audit.active) {
        issues.push(
          blocking(
            "excel.relation.action-owner",
            `Actie ${action.id} heeft geen actieve eigenaar.`,
            "tblActies",
          ),
        )
      }
      if (action.sourceMeetingId && !meetings.has(action.sourceMeetingId)) {
        issues.push(
          blocking(
            "excel.relation.action-meeting",
            `Actie ${action.id} verwijst naar een onbekend bronoverleg.`,
            "tblActies",
          ),
        )
      }
      if (action.sourceMeetingId && meetings.has(action.sourceMeetingId)) {
        const meeting = meetingById.get(action.sourceMeetingId)!
        const validMeetingContext =
          action.objectType === "Meeting"
            ? action.objectId === meeting.id
            : action.objectType === "Project" ||
                action.objectType === "Cluster" ||
                action.objectType === "Topic"
              ? validateAgendaObjectScope(
                  meeting,
                  action.objectType,
                  action.objectId,
                  meetingReferences,
                ).length === 0
              : false
        if (!validMeetingContext) {
          issues.push(
            blocking(
              "excel.relation.action-meeting-scope",
              `Actie ${action.id} valt buiten de scope van het bronoverleg.`,
              "tblActies",
            ),
          )
        }
      }
      for (const domainIssue of validateActionCompletion(action)) {
        issues.push(
          blocking(domainIssue.code, domainIssue.message, "tblActies"),
        )
      }
    }

    for (const history of records.actionHistory) {
      if (
        !actions.has(history.actionId) ||
        !actors.has(history.changedByActorId)
      ) {
        issues.push(
          blocking(
            "excel.relation.action-history",
            `Actiehistoriek ${history.id} bevat een verbroken relatie.`,
            "tblActieHistoriek",
          ),
        )
      }
    }

    for (const item of records.evidence) {
      validateObjectLink(item.objectType, item.objectId, "tblBewijs", item.id)
      validateOptionalActor(item.authorActorId, "tblBewijs", item.id, "auteur")
    }

    const topicPlanning = new Set<UUID>()
    for (const entry of records.planning) {
      const project = projects.get(entry.projectId)
      const topic = entry.topicId ? topics.get(entry.topicId) : undefined
      if (
        !project ||
        (entry.topicId && (!topic || topic.projectId !== project.id))
      ) {
        issues.push(
          blocking(
            "excel.relation.planning",
            `Planningitem ${entry.id} bevat een verbroken project/topicrelatie.`,
            "tblPlanning",
          ),
        )
      }
      if (entry.topicId) {
        if (topicPlanning.has(entry.topicId)) {
          issues.push(
            blocking(
              "excel.planning.duplicate-topic",
              `Topic ${entry.topicId} heeft meer dan één primaire planningentry.`,
              "tblPlanning",
            ),
          )
        }
        topicPlanning.add(entry.topicId)
      }
      for (const domainIssue of validatePlanningEntry(entry)) {
        issues.push(
          blocking(domainIssue.code, domainIssue.message, "tblPlanning"),
        )
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
        issues.push(
          blocking(
            "excel.planning.dependency-corrupt",
            `Planningafhankelijkheid ${dependency.id} is ongeldig.`,
            "tblPlanningAfhankelijkheden",
          ),
        )
      }
    }
    if (hasPlanningDependencyCycle(records.planningDependencies)) {
      issues.push(
        blocking(
          "excel.planning.cycle",
          "De planningafhankelijkheden bevatten een cyclus.",
          "tblPlanningAfhankelijkheden",
        ),
      )
    }

    for (const budget of records.budgets) {
      const topic = budget.topicId ? topics.get(budget.topicId) : undefined
      if (
        !projects.has(budget.projectId) ||
        (budget.topicId && (!topic || topic.projectId !== budget.projectId))
      ) {
        issues.push(
          blocking(
            "excel.relation.budget",
            `Budgetrecord ${budget.id} bevat een verbroken project/topicrelatie.`,
            "tblBudget",
          ),
        )
      }
      for (const domainIssue of validateBudgetAmount(budget.amountCents)) {
        issues.push(
          blocking(domainIssue.code, domainIssue.message, "tblBudget"),
        )
      }
      validateOptionalActor(
        budget.supplierActorId,
        "tblBudget",
        budget.id,
        "leverancier",
      )
    }

    for (const mutation of records.budgetMutations) {
      if (
        !budgets.has(mutation.budgetRecordId) ||
        !actors.has(mutation.authorActorId)
      ) {
        issues.push(
          blocking(
            "excel.relation.budget-mutation",
            `Budgetmutatie ${mutation.id} bevat een verbroken relatie.`,
            "tblBudgetMutaties",
          ),
        )
      }
      for (const domainIssue of validateBudgetMutationAmounts(mutation)) {
        issues.push(
          blocking(domainIssue.code, domainIssue.message, "tblBudgetMutaties"),
        )
      }
    }

    for (const participant of records.meetingParticipants) {
      if (
        !meetings.has(participant.meetingId) ||
        !actors.has(participant.actorId)
      ) {
        issues.push(
          blocking(
            "excel.relation.meeting-participant",
            `Overlegdeelnemer ${participant.id} bevat een verbroken relatie.`,
            "tblOverlegDeelnemers",
          ),
        )
      }
    }

    for (const meeting of records.meetings) {
      if (validateMeetingScope(meeting, meetingReferences).length > 0) {
        issues.push(
          blocking(
            "excel.relation.meeting-scope",
            `Overleg ${meeting.id} heeft een ongeldige scope.`,
            "tblOverleggen",
          ),
        )
      }
      validateOptionalActor(
        meeting.chairActorId,
        "tblOverleggen",
        meeting.id,
        "voorzitter",
      )
      validateOptionalActor(
        meeting.reporterActorId,
        "tblOverleggen",
        meeting.id,
        "verslaggever",
      )
    }

    for (const agendaItem of records.agendaItems) {
      if (!meetings.has(agendaItem.meetingId)) {
        issues.push(
          blocking(
            "excel.relation.agenda-item",
            `Agendapunt ${agendaItem.id} verwijst naar een onbekend overleg.`,
            "tblAgendaItems",
          ),
        )
      }
      if (Boolean(agendaItem.objectType) !== Boolean(agendaItem.objectId)) {
        issues.push(
          blocking(
            "excel.relation.agenda-object-pair",
            `Agendapunt ${agendaItem.id} heeft geen volledig objectpaar.`,
            "tblAgendaItems",
          ),
        )
      } else if (agendaItem.objectType && agendaItem.objectId) {
        const meeting = meetingById.get(agendaItem.meetingId)
        if (
          meeting &&
          validateAgendaObjectScope(
            meeting,
            agendaItem.objectType,
            agendaItem.objectId,
            meetingReferences,
          ).length > 0
        ) {
          issues.push(
            blocking(
              "excel.relation.agenda-scope",
              `Agendapunt ${agendaItem.id} valt buiten de overlegscope.`,
              "tblAgendaItems",
            ),
          )
        }
      }
    }

    const reportVersions = new Set<string>()
    for (const report of records.reports) {
      if (
        !meetings.has(report.meetingId) ||
        !actors.has(report.authorActorId)
      ) {
        issues.push(
          blocking(
            "excel.relation.report",
            `Verslag ${report.id} bevat een verbroken relatie.`,
            "tblVerslagen",
          ),
        )
      }
      const versionKey = `${report.meetingId}:${report.version}`
      if (reportVersions.has(versionKey)) {
        issues.push(
          blocking(
            "excel.report.duplicate-version",
            `Overleg ${report.meetingId} heeft verslagversie ${report.version} meer dan één keer.`,
            "tblVerslagen",
          ),
        )
      }
      reportVersions.add(versionKey)
      if (
        (report.status === "Definitief" || report.status === "Gereviseerd") &&
        !report.finalDate
      ) {
        issues.push(
          blocking(
            "excel.report.final-date-required",
            `Definitief verslag ${report.id} vereist een finaledatum.`,
            "tblVerslagen",
          ),
        )
      }
    }

    for (const item of records.reportItems) {
      if (!reports.has(item.reportId)) {
        issues.push(
          blocking(
            "excel.relation.report-item",
            `Verslagitem ${item.id} verwijst naar een onbekend verslag.`,
            "tblVerslagItems",
          ),
        )
      }
      if (Boolean(item.objectType) !== Boolean(item.objectId)) {
        issues.push(
          blocking(
            "excel.relation.report-object-pair",
            `Verslagitem ${item.id} heeft geen volledig objectpaar.`,
            "tblVerslagItems",
          ),
        )
      } else if (item.objectType && item.objectId) {
        validateObjectLink(
          item.objectType,
          item.objectId,
          "tblVerslagItems",
          item.id,
        )
      }
    }

    for (const config of records.config) {
      validateOptionalActor(
        config.currentActorId,
        "tblConfig",
        config.id,
        "huidige actor",
        true,
      )
    }

    const auditedCollections = [
      ["tblHoofdstukken", records.chapters],
      ["tblClusters", records.clusters],
      ["tblProjecten", records.projects],
      ["tblProjectClusterHistoriek", records.projectClusterHistory],
      ["tblActoren", records.actors],
      ["tblTopics", records.topics],
      ["tblUpdates", records.updates],
      ["tblActies", records.actions],
      ["tblActieHistoriek", records.actionHistory],
      ["tblBewijs", records.evidence],
      ["tblPlanning", records.planning],
      ["tblPlanningAfhankelijkheden", records.planningDependencies],
      ["tblBudget", records.budgets],
      ["tblBudgetMutaties", records.budgetMutations],
      ["tblOverleggen", records.meetings],
      ["tblOverlegDeelnemers", records.meetingParticipants],
      ["tblAgendaItems", records.agendaItems],
      ["tblVerslagen", records.reports],
      ["tblVerslagItems", records.reportItems],
      ["tblConfig", records.config],
      ["tblKeuzelijsten", records.choiceLists],
      ["tblLogboek", records.log],
    ] as const
    for (const [tableName, collection] of auditedCollections) {
      for (const record of collection) {
        validateOptionalActor(
          record.audit.createdByActorId,
          tableName,
          record.id,
          "actor in het aanmaakauditveld",
        )
        validateOptionalActor(
          record.audit.updatedByActorId,
          tableName,
          record.id,
          "actor in het wijzigingsauditveld",
        )
      }
    }

    return issues
  }
}
