import type {
  Action,
  ActionHistory,
  AuditFields,
  DateTime,
  Evidence,
  LocalDate,
  Topic,
  Update,
  UUID,
} from "../../domain"
import { todayAsLocalDate } from "../../utils"
import type {
  DecisionRequestPayload,
  JournalEntryType,
} from "../queries/project-journal-query"
import { ActionManagementService } from "./action-management-service"
import {
  normalizeDomainState,
  type NormalizedDomainState,
} from "./domain-state"
import { MeetingManagementService } from "./meeting-management-service"
import { PlanningManagementService } from "./planning-management-service"
import { cloneDomainCollections } from "./semantic-comparison"
import { TopicManagementService } from "./topic-management-service"
import { UpdateManagementService } from "./update-management-service"

export interface JournalMutationOptions {
  now?: Date
  createUuid?: () => UUID
}

export interface JournalMutationResult<T = unknown> {
  state: NormalizedDomainState
  record?: T
  message: string
}

export interface ParsedJournalCommand {
  name:
    | "update"
    | "action"
    | "decision"
    | "topic"
    | "plan"
    | "close"
    | "reopen"
    | "move"
    | "agenda"
  content: string
  arguments: readonly string[]
}

export const journalCommands = [
  { command: "/actie", description: "Maak een open actie" },
  { command: "/besluit", description: "Leg een beslissing vast" },
  { command: "/topic", description: "Maak een nieuw topic" },
  { command: "/plan", description: "Plan dit topic" },
  { command: "/sluit", description: "Sluit dit topic" },
  { command: "/heropen", description: "Heropen dit topic" },
  { command: "/verplaats", description: "Verplaats een geselecteerde entry" },
  { command: "/agendeer", description: "Zet dit topic op een overlegagenda" },
] as const

function defaultUuid(): UUID {
  return crypto.randomUUID() as UUID
}

function auditFields(now: Date, actorId?: UUID): AuditFields {
  const timestamp = now.toISOString() as DateTime
  return {
    createdAt: timestamp,
    ...(actorId ? { createdByActorId: actorId } : {}),
    updatedAt: timestamp,
    ...(actorId ? { updatedByActorId: actorId } : {}),
    active: true,
  }
}

function activeActorId(state: NormalizedDomainState): UUID {
  const actorId = state.records.config[0]?.currentActorId
  const actor = actorId ? state.indices.actorById.get(actorId) : undefined
  if (!actor?.active || !actor.audit.active) {
    throw new Error("Kies eerst een actieve huidige actor in Instellingen.")
  }
  return actor.id
}

function nextTopicCode(state: NormalizedDomainState, projectId: UUID): string {
  const used = new Set(
    (state.indices.topicsByProject.get(projectId) ?? []).map(
      (topic) => topic.code,
    ),
  )
  let sequence = used.size + 1
  let code = `TOP-${String(sequence).padStart(3, "0")}`
  while (used.has(code)) {
    sequence += 1
    code = `TOP-${String(sequence).padStart(3, "0")}`
  }
  return code
}

function nextActionCode(state: NormalizedDomainState): string {
  const used = new Set(state.records.actions.map((action) => action.code))
  let sequence = used.size + 1
  let code = `ACT-${String(sequence).padStart(3, "0")}`
  while (used.has(code)) {
    sequence += 1
    code = `ACT-${String(sequence).padStart(3, "0")}`
  }
  return code
}

function dateArgument(
  value: string | undefined,
  now: Date,
): LocalDate | undefined {
  if (!value) return undefined
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value as LocalDate
  const match = /^(\d{1,2})[/-](\d{1,2})(?:[/-](\d{4}))?$/.exec(value)
  if (!match) return undefined
  const year = match[3] ?? String(now.getFullYear())
  return `${year}-${match[2]!.padStart(2, "0")}-${match[1]!.padStart(2, "0")}` as LocalDate
}

export function parseJournalCommand(value: string): ParsedJournalCommand {
  const text = value.trim()
  if (!text.startsWith("/")) {
    return { name: "update", content: text, arguments: [] }
  }
  const [rawCommand = "", ...argumentsList] = text.split(/\s+/)
  const content = argumentsList.join(" ").trim()
  const names: Record<string, ParsedJournalCommand["name"]> = {
    "/actie": "action",
    "/besluit": "decision",
    "/topic": "topic",
    "/plan": "plan",
    "/sluit": "close",
    "/heropen": "reopen",
    "/verplaats": "move",
    "/agendeer": "agenda",
  }
  return {
    name: names[rawCommand.toLocaleLowerCase("nl")] ?? "update",
    content: names[rawCommand.toLocaleLowerCase("nl")] ? content : text,
    arguments: argumentsList,
  }
}

function relationEvidence(
  objectType: "Topic" | "Update" | "Action",
  objectId: UUID,
  title: string,
  description: Record<string, unknown>,
  now: Date,
  actorId: UUID,
  createUuid: () => UUID,
): Evidence {
  return {
    id: createUuid(),
    objectType,
    objectId,
    type: "JournalRelation",
    title,
    description: JSON.stringify(description),
    date: todayAsLocalDate(now) as LocalDate,
    authorActorId: actorId,
    audit: auditFields(now, actorId),
  }
}

export class ProjectJournalService {
  private readonly topicService = new TopicManagementService()
  private readonly updateService = new UpdateManagementService()
  private readonly actionService = new ActionManagementService()
  private readonly planningService = new PlanningManagementService()
  private readonly meetingService = new MeetingManagementService()

  addEntry(
    state: NormalizedDomainState,
    topicId: UUID,
    type: JournalEntryType,
    content: string,
    options: JournalMutationOptions = {},
  ): JournalMutationResult {
    const text = content.trim()
    if (!text) throw new Error("Schrijf eerst inhoud voor deze bijdrage.")
    const topic = state.indices.topicById.get(topicId)
    if (!topic?.projectId || !topic.audit.active) {
      throw new Error("Het projecttopic bestaat niet meer.")
    }
    const now = options.now ?? new Date()
    const actorId = activeActorId(state)
    if (type === "action") {
      const result = this.actionService.createAction(
        state,
        {
          objectType: "Topic",
          objectId: topic.id,
          title: text,
          ownerActorId: topic.ownerActorId ?? actorId,
          status: "Open",
          priority: topic.priority,
        },
        options,
      )
      return {
        state: result.state,
        record: result.record,
        message: "Actie toegevoegd",
      }
    }
    const result = this.updateService.addUpdate(
      state,
      {
        objectType: "Topic",
        objectId: topic.id,
        authorActorId: actorId,
        type: type === "decision" ? "Beslissing" : "Update",
        date: todayAsLocalDate(now) as LocalDate,
        text,
      },
      options,
    )
    return {
      state: result.state,
      record: result.record,
      message:
        type === "decision" ? "Beslissing toegevoegd" : "Update toegevoegd",
    }
  }

  executeComposer(
    state: NormalizedDomainState,
    topicId: UUID,
    rawValue: string,
    options: JournalMutationOptions = {},
  ): JournalMutationResult {
    const command = parseJournalCommand(rawValue)
    const topic = state.indices.topicById.get(topicId)
    if (!topic?.projectId) throw new Error("Projecttopic niet gevonden.")
    const now = options.now ?? new Date()
    if (
      command.name === "update" ||
      command.name === "action" ||
      command.name === "decision"
    ) {
      return this.addEntry(
        state,
        topicId,
        command.name,
        command.content,
        options,
      )
    }
    if (command.name === "topic") {
      return this.createTopic(state, topic.projectId, command.content, options)
    }
    if (command.name === "close" || command.name === "reopen") {
      const result = this.topicService.setTopicStatus(
        state,
        topicId,
        command.name === "close" ? "Afgesloten" : "Open",
        options,
      )
      return {
        state: result.state,
        record: result.record,
        message: command.name === "close" ? "Topic gesloten" : "Topic heropend",
      }
    }
    if (command.name === "plan") {
      const startDate = dateArgument(command.arguments[0], now)
      const plannedEndDate =
        dateArgument(command.arguments[1], now) ?? startDate
      if (!plannedEndDate) {
        throw new Error(
          "Gebruik /plan dd/mm dd/mm of /plan jjjj-mm-dd jjjj-mm-dd.",
        )
      }
      const result = this.planningService.saveTopicTiming(
        state,
        topicId,
        {
          ...(startDate ? { startDate } : {}),
          plannedEndDate,
          status: "Op schema",
          isMilestone: startDate === plannedEndDate,
        },
        options,
      )
      return {
        state: result.state,
        record: result.record,
        message: "Topic gepland",
      }
    }
    if (command.name === "agenda") {
      const query = command.content.toLocaleLowerCase("nl")
      const meeting = state.records.meetings
        .filter(
          (item) =>
            item.audit.active &&
            item.status !== "Definitief" &&
            (!query ||
              `${item.title} ${item.type}`
                .toLocaleLowerCase("nl")
                .includes(query)),
        )
        .sort((left, right) => left.date.localeCompare(right.date))[0]
      if (!meeting) throw new Error("Geen passend open overleg gevonden.")
      const result = this.meetingService.saveAgendaItem(
        state,
        meeting.id,
        {
          title: topic.title,
          reason: "Geagendeerd vanuit projectjournaal",
          objectType: "Topic",
          objectId: topic.id,
          discussionStatus: "Te bespreken",
        },
        undefined,
        options,
      )
      return {
        state: result.state,
        record: result.record,
        message: `Geagendeerd op ${meeting.title}`,
      }
    }
    throw new Error("Selecteer eerst een entry om die te verplaatsen.")
  }

  createTopic(
    state: NormalizedDomainState,
    projectId: UUID,
    title: string,
    options: JournalMutationOptions = {},
  ): JournalMutationResult<Topic> {
    const normalizedTitle = title.trim()
    if (!normalizedTitle) throw new Error("Geef het nieuwe topic een titel.")
    const actorId = activeActorId(state)
    const result = this.topicService.createTopic(
      state,
      {
        parentType: "Project",
        projectId,
        code: nextTopicCode(state, projectId),
        title: normalizedTitle,
        context: normalizedTitle,
        ownerActorId: actorId,
        priority: "Normaal",
      },
      options,
    )
    return {
      state: result.state,
      record: result.record,
      message: "Topic toegevoegd",
    }
  }

  convertEntry(
    state: NormalizedDomainState,
    entryId: UUID,
    targetType: JournalEntryType,
    options: JournalMutationOptions = {},
  ): JournalMutationResult {
    const update = state.indices.updateById.get(entryId)
    const action = state.indices.actionById.get(entryId)
    const activeUpdate = update?.audit.active ? update : undefined
    const activeAction = action?.audit.active ? action : undefined
    if (!activeUpdate && !activeAction) throw new Error("Entry niet gevonden.")
    const currentType: JournalEntryType = activeAction
      ? "action"
      : activeUpdate?.type === "Beslissing"
        ? "decision"
        : "update"
    if (currentType === targetType)
      return { state, message: "Type ongewijzigd" }
    const now = options.now ?? new Date()
    const timestamp = now.toISOString() as DateTime
    const actorId = activeActorId(state)
    const createUuid = options.createUuid ?? defaultUuid
    const records = cloneDomainCollections(state.records)
    if (
      activeUpdate &&
      (targetType === "update" || targetType === "decision")
    ) {
      const index = records.updates.findIndex((item) => item.id === entryId)
      records.updates[index] = {
        ...activeUpdate,
        type: targetType === "decision" ? "Beslissing" : "Update",
        audit: {
          ...activeUpdate.audit,
          updatedAt: timestamp,
          updatedByActorId: actorId,
        },
      }
    } else if (targetType === "action") {
      const source = activeUpdate!
      const existingIndex = records.actions.findIndex(
        (item) => item.id === entryId,
      )
      const previous =
        existingIndex >= 0 ? records.actions[existingIndex] : undefined
      const converted: Action = {
        id: entryId,
        objectType: source.objectType === "Topic" ? "Topic" : "Project",
        objectId: source.objectId,
        code: previous?.code ?? nextActionCode(state),
        title: source.text,
        ownerActorId: previous?.ownerActorId ?? actorId,
        ...(previous?.deadline ? { deadline: previous.deadline } : {}),
        status:
          previous?.status === "Afgerond"
            ? "Open"
            : (previous?.status ?? "Open"),
        priority: previous?.priority ?? "Normaal",
        audit: {
          ...source.audit,
          updatedAt: timestamp,
          updatedByActorId: actorId,
          active: true,
        },
      }
      if (existingIndex >= 0) records.actions[existingIndex] = converted
      else records.actions.push(converted)
      const updateIndex = records.updates.findIndex(
        (item) => item.id === entryId,
      )
      records.updates[updateIndex] = {
        ...source,
        audit: {
          ...source.audit,
          updatedAt: timestamp,
          updatedByActorId: actorId,
          active: false,
        },
      }
    } else {
      const source = activeAction!
      const existingIndex = records.updates.findIndex(
        (item) => item.id === entryId,
      )
      const converted: Update = {
        id: entryId,
        objectType: source.objectType,
        objectId: source.objectId,
        type:
          targetType === "decision"
            ? ("Beslissing" as const)
            : ("Update" as const),
        date: todayAsLocalDate(now) as LocalDate,
        authorActorId: source.audit.createdByActorId ?? actorId,
        text: source.title,
        audit: {
          ...source.audit,
          updatedAt: timestamp,
          updatedByActorId: actorId,
          active: true,
        },
      }
      if (existingIndex >= 0) records.updates[existingIndex] = converted
      else records.updates.push(converted)
      const actionIndex = records.actions.findIndex(
        (item) => item.id === entryId,
      )
      records.actions[actionIndex] = {
        ...source,
        audit: {
          ...source.audit,
          updatedAt: timestamp,
          updatedByActorId: actorId,
          active: false,
        },
      }
    }
    const history: ActionHistory = {
      id: createUuid(),
      actionId: entryId,
      changedAt: timestamp,
      changedByActorId: actorId,
      field: "currentType",
      previousValue: currentType,
      newValue: targetType,
      reason: "Inline gewijzigd in projectjournaal",
      audit: auditFields(now, actorId),
    }
    records.actionHistory.push(history)
    return {
      state: normalizeDomainState(records),
      record: history,
      message: `Entry gewijzigd naar ${targetType}`,
    }
  }

  completeAction(
    state: NormalizedDomainState,
    actionId: UUID,
    options: JournalMutationOptions = {},
  ): JournalMutationResult<Action> {
    const action = state.indices.actionById.get(actionId)
    if (!action?.audit.active) throw new Error("Actie niet gevonden.")
    const result = this.actionService.updateAction(
      state,
      actionId,
      {
        title: action.title,
        ...(action.description ? { description: action.description } : {}),
        ownerActorId: action.ownerActorId,
        ...(action.deadline ? { deadline: action.deadline } : {}),
        status: "Afgerond",
        priority: action.priority,
      },
      options,
    )
    return {
      state: result.state,
      record: result.record,
      message: "Actie voltooid",
    }
  }

  moveEntry(
    state: NormalizedDomainState,
    entryId: UUID,
    targetTopicId: UUID,
    options: JournalMutationOptions = {},
  ): JournalMutationResult {
    const target = state.indices.topicById.get(targetTopicId)
    if (!target?.projectId || !target.audit.active)
      throw new Error("Doeltopic niet gevonden.")
    const now = options.now ?? new Date()
    const actorId = activeActorId(state)
    const timestamp = now.toISOString() as DateTime
    const records = cloneDomainCollections(state.records)
    const updateIndex = records.updates.findIndex(
      (item) => item.id === entryId && item.audit.active,
    )
    const actionIndex = records.actions.findIndex(
      (item) => item.id === entryId && item.audit.active,
    )
    if (updateIndex >= 0) {
      const source = records.updates[updateIndex]!
      records.updates[updateIndex] = {
        ...source,
        objectType: "Topic",
        objectId: targetTopicId,
        audit: {
          ...source.audit,
          updatedAt: timestamp,
          updatedByActorId: actorId,
        },
      }
    } else if (actionIndex >= 0) {
      const source = records.actions[actionIndex]!
      records.actions[actionIndex] = {
        ...source,
        objectType: "Topic",
        objectId: targetTopicId,
        audit: {
          ...source.audit,
          updatedAt: timestamp,
          updatedByActorId: actorId,
        },
      }
    } else throw new Error("Entry niet gevonden.")
    return {
      state: normalizeDomainState(records),
      message: `Entry verplaatst naar ${target.title}`,
    }
  }

  deriveAction(
    state: NormalizedDomainState,
    sourceEntryId: UUID,
    topicId: UUID,
    title: string,
    options: JournalMutationOptions = {},
  ): JournalMutationResult<Action> {
    const now = options.now ?? new Date()
    const actorId = activeActorId(state)
    const createUuid = options.createUuid ?? defaultUuid
    const topic = state.indices.topicById.get(topicId)
    if (!topic?.projectId) throw new Error("Topic niet gevonden.")
    const result = this.actionService.createAction(
      state,
      {
        objectType: "Topic",
        objectId: topicId,
        title,
        ownerActorId: topic.ownerActorId ?? actorId,
        status: "Open",
        priority: topic.priority,
      },
      options,
    )
    const records = cloneDomainCollections(result.state.records)
    records.evidence.push(
      relationEvidence(
        "Action",
        result.record.id,
        "Afgeleid van journalentry",
        { sourceEntryId },
        now,
        actorId,
        createUuid,
      ),
    )
    return {
      state: normalizeDomainState(records),
      record: result.record,
      message: "Afgeleide actie toegevoegd",
    }
  }

  promoteEntryToTopic(
    state: NormalizedDomainState,
    projectId: UUID,
    sourceEntryId: UUID,
    title: string,
    options: JournalMutationOptions = {},
  ): JournalMutationResult<Topic> {
    const created = this.createTopic(state, projectId, title, options)
    const topic = created.record!
    const sourceUpdate = state.indices.updateById.get(sourceEntryId)
    const sourceAction = state.indices.actionById.get(sourceEntryId)
    const content = sourceUpdate?.text ?? sourceAction?.title ?? title
    const entry = this.addEntry(
      created.state,
      topic.id,
      "update",
      content,
      options,
    )
    const now = options.now ?? new Date()
    const actorId = activeActorId(entry.state)
    const records = cloneDomainCollections(entry.state.records)
    records.evidence.push(
      relationEvidence(
        "Topic",
        topic.id,
        "Verder opgevolgd vanuit journalentry",
        {
          sourceEntryId,
          derivedEntryId: (entry.record as { id?: UUID } | undefined)?.id,
        },
        now,
        actorId,
        options.createUuid ?? defaultUuid,
      ),
    )
    return {
      state: normalizeDomainState(records),
      record: topic,
      message: "Nieuw topic gemaakt",
    }
  }

  addDecisionRequest(
    state: NormalizedDomainState,
    projectId: UUID,
    parentType: "Topic" | "Update" | "Action",
    parentId: UUID,
    question: string,
    requestedFromIds: readonly UUID[],
    dueDate?: LocalDate,
    options: JournalMutationOptions = {},
  ): JournalMutationResult<Evidence> {
    const normalizedQuestion = question.trim()
    if (!normalizedQuestion)
      throw new Error("Formuleer eerst de beslissingsvraag.")
    const now = options.now ?? new Date()
    const actorId = activeActorId(state)
    const payload: DecisionRequestPayload = {
      projectId,
      requestedFromIds: [...requestedFromIds],
      requestedAt: now.toISOString(),
      ...(dueDate ? { dueDate } : {}),
      status: "pending",
    }
    const evidence: Evidence = {
      id: (options.createUuid ?? defaultUuid)(),
      objectType: parentType,
      objectId: parentId,
      type: "DecisionRequest",
      title: normalizedQuestion,
      description: JSON.stringify(payload),
      date: todayAsLocalDate(now) as LocalDate,
      authorActorId: actorId,
      audit: auditFields(now, actorId),
    }
    const records = cloneDomainCollections(state.records)
    records.evidence.push(evidence)
    return {
      state: normalizeDomainState(records),
      record: evidence,
      message: "Beslissingsvraag toegevoegd",
    }
  }

  resolveDecisionRequest(
    state: NormalizedDomainState,
    requestId: UUID,
    topicId: UUID,
    decisionText: string,
    options: JournalMutationOptions = {},
  ): JournalMutationResult {
    const request = state.records.evidence.find(
      (item) =>
        item.id === requestId &&
        item.type === "DecisionRequest" &&
        item.audit.active,
    )
    if (!request?.description)
      throw new Error("Beslissingsvraag niet gevonden.")
    const decision = this.addEntry(
      state,
      topicId,
      "decision",
      decisionText,
      options,
    )
    const payload = JSON.parse(request.description) as DecisionRequestPayload
    const now = options.now ?? new Date()
    const actorId = activeActorId(decision.state)
    const records = cloneDomainCollections(decision.state.records)
    const index = records.evidence.findIndex((item) => item.id === request.id)
    records.evidence[index] = {
      ...request,
      description: JSON.stringify({
        ...payload,
        status: "decided",
        resolvedByDecisionEntryId: (decision.record as { id: UUID }).id,
      } satisfies DecisionRequestPayload),
      audit: {
        ...request.audit,
        updatedAt: now.toISOString() as DateTime,
        updatedByActorId: actorId,
      },
    }
    return {
      state: normalizeDomainState(records),
      record: decision.record,
      message: "Beslissingsvraag opgelost",
    }
  }
}
