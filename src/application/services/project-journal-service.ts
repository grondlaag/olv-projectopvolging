import type {
  Action,
  AuditFields,
  DateTime,
  Evidence,
  LocalDate,
  Priority,
  Topic,
  TopicStatus,
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

export interface JournalEntryEditInput {
  content: string
  status?: Action["status"]
  ownerActorId?: UUID
  dueDate?: LocalDate
  priority?: Priority
  requestedFromIds?: readonly UUID[]
  decisionRequestStatus?: DecisionRequestPayload["status"]
}

interface MeetingLinkPayload {
  projectId: UUID
  meetingId: UUID
  agendaItemId: UUID
  meetingDate: LocalDate
  status: "discussed"
  createdAt: string
}

export interface JournalTopicEditInput {
  title: string
  status: TopicStatus
  ownerActorId?: UUID
  priority: Priority
}

export interface ParsedJournalCommand {
  name:
    | "update"
    | "action"
    | "decision_request"
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
  { command: "/update", description: "Schrijf een gewone update" },
  { command: "/actie", description: "Maak een open actie" },
  { command: "/besluit", description: "Leg een beslissing vast" },
  { command: "/beslissing", description: "Leg een beslissing vast" },
  {
    command: "/beslissing-nodig",
    description: "Voeg een open beslissingsvraag toe",
  },
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
  const projectTopics = state.records.topics.filter(
    (topic) => topic.projectId === projectId,
  )
  const used = new Set(projectTopics.map((topic) => topic.code))
  let sequence =
    Math.max(
      0,
      ...projectTopics.map((topic) => {
        const match = /(?:TOP|T)-(\d+)$/i.exec(topic.code)
        return match ? Number(match[1]) : topic.order
      }),
    ) + 1
  let code = `T-${String(sequence).padStart(3, "0")}`
  while (used.has(code)) {
    sequence += 1
    code = `T-${String(sequence).padStart(3, "0")}`
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
    "/update": "update",
    "/actie": "action",
    "/besluit": "decision",
    "/beslissing": "decision",
    "/beslissing-nodig": "decision_request",
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

function historyEvidence(
  objectType: "Topic" | "Update" | "Action" | "Evidence",
  objectId: UUID,
  event: string,
  details: Record<string, unknown>,
  now: Date,
  actorId: UUID,
  createUuid: () => UUID,
): Evidence {
  return {
    id: createUuid(),
    objectType,
    objectId,
    type: "JournalHistory",
    title: event,
    description: JSON.stringify({ event, ...details }),
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
    if (type === "decision_request") {
      return this.addDecisionRequest(
        state,
        topic.projectId,
        "Topic",
        topic.id,
        text,
        [],
        undefined,
        options,
      )
    }
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
      command.name === "decision_request" ||
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

  executeMeetingComposer(
    state: NormalizedDomainState,
    agendaItemId: UUID,
    rawValue: string,
    options: JournalMutationOptions = {},
  ): JournalMutationResult {
    const agendaItem = state.indices.agendaItemById.get(agendaItemId)
    if (!agendaItem?.audit.active) throw new Error("Agendapunt niet gevonden.")
    const meeting = state.indices.meetingById.get(agendaItem.meetingId)
    if (!meeting?.audit.active) throw new Error("Overleg niet gevonden.")
    if (agendaItem.objectType !== "Topic" || !agendaItem.objectId) {
      throw new Error(
        "Koppel dit agendapunt aan een projecttopic om journaalbijdragen toe te voegen.",
      )
    }
    const topic = state.indices.topicById.get(agendaItem.objectId)
    if (!topic?.projectId || !topic.audit.active) {
      throw new Error("Het gekoppelde projecttopic bestaat niet meer.")
    }
    const command = parseJournalCommand(rawValue)
    if (
      command.name !== "update" &&
      command.name !== "action" &&
      command.name !== "decision" &&
      command.name !== "decision_request"
    ) {
      throw new Error(
        "Gebruik hier /update, /actie, /besluit of /beslissing-nodig.",
      )
    }

    const now = options.now ?? new Date()
    const actorId = activeActorId(state)
    const created = this.addEntry(
      state,
      topic.id,
      command.name,
      command.content,
      options,
    )
    const record = created.record as Update | Action | Evidence | undefined
    if (!record) throw new Error("De bijdrage kon niet worden aangemaakt.")
    const records = cloneDomainCollections(created.state.records)
    const updateIndex = records.updates.findIndex(
      (item) => item.id === record.id,
    )
    const actionIndex = records.actions.findIndex(
      (item) => item.id === record.id,
    )
    const evidenceIndex = records.evidence.findIndex(
      (item) => item.id === record.id,
    )
    let objectType: "Update" | "Action" | "Evidence"
    if (updateIndex >= 0) {
      records.updates[updateIndex] = {
        ...records.updates[updateIndex]!,
        meetingId: meeting.id,
        date: meeting.date,
      }
      objectType = "Update"
    } else if (actionIndex >= 0) {
      records.actions[actionIndex] = {
        ...records.actions[actionIndex]!,
        sourceMeetingId: meeting.id,
      }
      objectType = "Action"
    } else if (evidenceIndex >= 0) {
      records.evidence[evidenceIndex] = {
        ...records.evidence[evidenceIndex]!,
        date: meeting.date,
      }
      objectType = "Evidence"
    } else {
      throw new Error("De aangemaakte bijdrage kon niet worden gekoppeld.")
    }

    const payload: MeetingLinkPayload = {
      projectId: topic.projectId,
      meetingId: meeting.id,
      agendaItemId: agendaItem.id,
      meetingDate: meeting.date,
      status: "discussed",
      createdAt: now.toISOString(),
    }
    records.evidence.push({
      id: (options.createUuid ?? defaultUuid)(),
      objectType,
      objectId: record.id,
      type: "MeetingLink",
      title: `Besproken in ${meeting.title}`,
      description: JSON.stringify(payload),
      date: meeting.date,
      authorActorId: actorId,
      audit: auditFields(now, actorId),
    })
    const nextState = normalizeDomainState(records)
    return {
      state: nextState,
      record:
        nextState.indices.updateById.get(record.id) ??
        nextState.indices.actionById.get(record.id) ??
        nextState.records.evidence.find((item) => item.id === record.id),
      message: created.message,
    }
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

  editTopic(
    state: NormalizedDomainState,
    topicId: UUID,
    input: JournalTopicEditInput,
    options: JournalMutationOptions = {},
  ): JournalMutationResult<Topic> {
    const existing = state.indices.topicById.get(topicId)
    if (!existing?.audit.active) throw new Error("Topic niet gevonden.")
    const now = options.now ?? new Date()
    const actorId = activeActorId(state)
    const createUuid = options.createUuid ?? defaultUuid
    let result = this.topicService.updateTopic(
      state,
      topicId,
      {
        parentType: existing.parentType,
        ...(existing.projectId ? { projectId: existing.projectId } : {}),
        ...(existing.clusterId ? { clusterId: existing.clusterId } : {}),
        code: existing.code,
        title: input.title,
        context: existing.context || input.title,
        ...(input.ownerActorId ? { ownerActorId: input.ownerActorId } : {}),
        priority: input.priority,
      },
      options,
    )
    if (result.record.status !== input.status) {
      result = this.topicService.setTopicStatus(
        result.state,
        topicId,
        input.status,
        options,
      )
    }
    const changes = {
      ...(existing.title !== result.record.title
        ? { title: [existing.title, result.record.title] }
        : {}),
      ...(existing.status !== result.record.status
        ? { status: [existing.status, result.record.status] }
        : {}),
      ...(existing.ownerActorId !== result.record.ownerActorId
        ? { owner: [existing.ownerActorId, result.record.ownerActorId] }
        : {}),
      ...(existing.priority !== result.record.priority
        ? { priority: [existing.priority, result.record.priority] }
        : {}),
    }
    if (!Object.keys(changes).length) {
      return { state, record: existing, message: "Geen wijzigingen" }
    }
    const records = cloneDomainCollections(result.state.records)
    records.evidence.push(
      historyEvidence(
        "Topic",
        topicId,
        existing.status !== result.record.status
          ? result.record.status === "Open"
            ? "topic reopened"
            : "topic closed"
          : "edited",
        { changes },
        now,
        actorId,
        createUuid,
      ),
    )
    return {
      state: normalizeDomainState(records),
      record: result.record,
      message: "Topic opgeslagen",
    }
  }

  editEntry(
    state: NormalizedDomainState,
    entryId: UUID,
    input: JournalEntryEditInput,
    options: JournalMutationOptions = {},
  ): JournalMutationResult {
    const content = input.content.trim()
    if (!content) throw new Error("Inhoud mag niet leeg zijn.")
    const update = state.indices.updateById.get(entryId)
    const action = state.indices.actionById.get(entryId)
    const request = state.records.evidence.find(
      (item) =>
        item.id === entryId &&
        item.type === "DecisionRequest" &&
        item.audit.active,
    )
    const now = options.now ?? new Date()
    const actorId = activeActorId(state)
    const createUuid = options.createUuid ?? defaultUuid
    if (action?.audit.active) {
      const result = this.actionService.updateAction(
        state,
        action.id,
        {
          title: content,
          ...(action.description ? { description: action.description } : {}),
          ownerActorId: input.ownerActorId ?? action.ownerActorId,
          ...(input.dueDate ? { deadline: input.dueDate } : {}),
          status: input.status ?? action.status,
          priority: input.priority ?? action.priority,
        },
        options,
      )
      return { ...result, message: "Actie opgeslagen" }
    }
    if (update?.audit.active) {
      const records = cloneDomainCollections(state.records)
      const index = records.updates.findIndex((item) => item.id === entryId)
      records.updates[index] = {
        ...update,
        text: content,
        audit: {
          ...update.audit,
          updatedAt: now.toISOString() as DateTime,
          updatedByActorId: actorId,
        },
      }
      records.evidence.push(
        historyEvidence(
          "Update",
          update.id,
          "edited",
          {},
          now,
          actorId,
          createUuid,
        ),
      )
      return {
        state: normalizeDomainState(records),
        record: records.updates[index],
        message: "Bijdrage opgeslagen",
      }
    }
    if (request?.description) {
      const payload = JSON.parse(request.description) as DecisionRequestPayload
      const records = cloneDomainCollections(state.records)
      const index = records.evidence.findIndex((item) => item.id === entryId)
      records.evidence[index] = {
        ...request,
        title: content,
        description: JSON.stringify({
          ...payload,
          requestedFromIds: input.requestedFromIds
            ? [...input.requestedFromIds]
            : payload.requestedFromIds,
          ...(input.dueDate ? { dueDate: input.dueDate } : {}),
          status: input.decisionRequestStatus ?? payload.status,
        } satisfies DecisionRequestPayload),
        audit: {
          ...request.audit,
          updatedAt: now.toISOString() as DateTime,
          updatedByActorId: actorId,
        },
      }
      records.evidence.push(
        historyEvidence(
          "Evidence",
          request.id,
          "edited",
          {},
          now,
          actorId,
          createUuid,
        ),
      )
      return {
        state: normalizeDomainState(records),
        record: records.evidence[index],
        message: "Beslissingsvraag opgeslagen",
      }
    }
    throw new Error("Entry niet gevonden.")
  }

  linkToMeeting(
    state: NormalizedDomainState,
    projectId: UUID,
    topicId: UUID,
    objectType: "Topic" | "Update" | "Action" | "Evidence",
    objectId: UUID,
    meetingId: UUID,
    options: JournalMutationOptions = {},
  ): JournalMutationResult<Evidence> {
    const topic = state.indices.topicById.get(topicId)
    const meeting = state.indices.meetingById.get(meetingId)
    if (!topic?.audit.active || topic.projectId !== projectId) {
      throw new Error("Topic niet gevonden.")
    }
    if (!meeting?.audit.active || meeting.status !== "Concept") {
      throw new Error("Kies een actief conceptoverleg.")
    }
    if (
      !this.meetingService.isAgendaObjectRelevant(
        state,
        meetingId,
        "Topic",
        topicId,
      )
    ) {
      throw new Error(
        "Dit overleg valt buiten de projectcontext van het topic.",
      )
    }
    const existingLink = state.records.evidence.find((item) => {
      if (
        !item.audit.active ||
        item.type !== "MeetingLink" ||
        item.objectType !== objectType ||
        item.objectId !== objectId ||
        !item.description
      ) {
        return false
      }
      try {
        return (
          (JSON.parse(item.description) as { meetingId?: UUID }).meetingId ===
          meetingId
        )
      } catch {
        return false
      }
    })
    if (existingLink) {
      return {
        state,
        record: existingLink,
        message: "Overleg was al gekoppeld",
      }
    }
    let workingState = state
    const topicAlreadyScheduled = (
      state.indices.agendaItemsByObject.get(`Topic:${topicId}`) ?? []
    ).some((item) => item.audit.active && item.meetingId === meetingId)
    if (!topicAlreadyScheduled) {
      workingState = this.meetingService.saveAgendaItem(
        state,
        meetingId,
        {
          title: `${topic.code} ${topic.title}`,
          reason: "Gekoppeld vanuit projectjournaal",
          objectType: "Topic",
          objectId: topicId,
          discussionStatus: "Te bespreken",
        },
        undefined,
        options,
      ).state
    }
    const now = options.now ?? new Date()
    const actorId = activeActorId(workingState)
    const link: Evidence = {
      id: (options.createUuid ?? defaultUuid)(),
      objectType,
      objectId,
      type: "MeetingLink",
      title: meeting.title,
      description: JSON.stringify({
        projectId,
        meetingId,
        status: "scheduled",
        createdAt: now.toISOString(),
      }),
      date: todayAsLocalDate(now) as LocalDate,
      authorActorId: actorId,
      audit: auditFields(now, actorId),
    }
    const records = cloneDomainCollections(workingState.records)
    records.evidence.push(link)
    records.evidence.push(
      historyEvidence(
        objectType,
        objectId,
        "meeting linked",
        { meetingId },
        now,
        actorId,
        options.createUuid ?? defaultUuid,
      ),
    )
    return {
      state: normalizeDomainState(records),
      record: link,
      message: `Gekoppeld aan ${meeting.title}`,
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
    const request = state.records.evidence.find(
      (item) =>
        item.id === entryId &&
        item.type === "DecisionRequest" &&
        item.audit.active,
    )
    const activeUpdate = update?.audit.active ? update : undefined
    const activeAction = action?.audit.active ? action : undefined
    if (!activeUpdate && !activeAction && !request)
      throw new Error("Entry niet gevonden.")
    const currentType: JournalEntryType = activeAction
      ? "action"
      : request
        ? "decision_request"
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
    } else {
      const requestParent = request
        ? request.objectType === "Topic"
          ? { objectType: "Topic" as const, objectId: request.objectId }
          : request.objectType === "Update"
            ? state.indices.updateById.get(request.objectId)
            : request.objectType === "Action"
              ? state.indices.actionById.get(request.objectId)
              : undefined
        : undefined
      const objectType =
        activeUpdate?.objectType ??
        activeAction?.objectType ??
        requestParent?.objectType
      const objectId =
        activeUpdate?.objectId ??
        activeAction?.objectId ??
        requestParent?.objectId
      if (
        !objectId ||
        (objectType !== "Project" &&
          objectType !== "Cluster" &&
          objectType !== "Topic" &&
          objectType !== "Meeting")
      ) {
        throw new Error("De broncontext van deze entry is niet meer geldig.")
      }
      const content =
        activeUpdate?.text ?? activeAction?.title ?? request!.title
      const sourceAudit =
        activeUpdate?.audit ?? activeAction?.audit ?? request!.audit
      const newId = createUuid()
      let converted: Update | Action | Evidence
      if (targetType === "action") {
        const topic =
          objectType === "Topic"
            ? state.indices.topicById.get(objectId)
            : undefined
        converted = {
          id: newId,
          objectType,
          objectId,
          code: nextActionCode(state),
          title: content,
          ownerActorId:
            activeAction?.ownerActorId ?? topic?.ownerActorId ?? actorId,
          ...(activeAction?.deadline
            ? { deadline: activeAction.deadline }
            : {}),
          status: "Open",
          priority: activeAction?.priority ?? topic?.priority ?? "Normaal",
          audit: {
            ...sourceAudit,
            updatedAt: timestamp,
            updatedByActorId: actorId,
            active: true,
          },
        } satisfies Action
        records.actions.push(converted)
      } else if (targetType === "decision_request") {
        const projectId =
          objectType === "Project"
            ? objectId
            : objectType === "Topic"
              ? state.indices.topicById.get(objectId)?.projectId
              : undefined
        if (!projectId) throw new Error("Projectcontext niet gevonden.")
        converted = {
          id: newId,
          objectType:
            objectType === "Topic"
              ? "Topic"
              : activeAction
                ? "Action"
                : "Update",
          objectId: objectType === "Topic" ? objectId : entryId,
          type: "DecisionRequest",
          title: content,
          description: JSON.stringify({
            projectId,
            requestedFromIds: [],
            requestedAt: sourceAudit.createdAt,
            status: "pending",
          } satisfies DecisionRequestPayload),
          date: sourceAudit.createdAt.slice(0, 10) as LocalDate,
          authorActorId: sourceAudit.createdByActorId ?? actorId,
          audit: {
            ...sourceAudit,
            updatedAt: timestamp,
            updatedByActorId: actorId,
            active: true,
          },
        } satisfies Evidence
        records.evidence.push(converted)
      } else {
        converted = {
          id: newId,
          objectType,
          objectId,
          type: targetType === "decision" ? "Beslissing" : "Update",
          date: sourceAudit.createdAt.slice(0, 10) as LocalDate,
          authorActorId:
            activeUpdate?.authorActorId ??
            sourceAudit.createdByActorId ??
            actorId,
          text: content,
          audit: {
            ...sourceAudit,
            updatedAt: timestamp,
            updatedByActorId: actorId,
            active: true,
          },
        } satisfies Update
        records.updates.push(converted)
      }

      if (activeUpdate) {
        const index = records.updates.findIndex(
          (item) => item.id === activeUpdate.id,
        )
        records.updates[index] = {
          ...activeUpdate,
          audit: {
            ...activeUpdate.audit,
            updatedAt: timestamp,
            updatedByActorId: actorId,
            active: false,
          },
        }
      }
      if (activeAction) {
        const index = records.actions.findIndex(
          (item) => item.id === activeAction.id,
        )
        records.actions[index] = {
          ...activeAction,
          audit: {
            ...activeAction.audit,
            updatedAt: timestamp,
            updatedByActorId: actorId,
            active: false,
          },
        }
      }
      if (request) {
        const index = records.evidence.findIndex(
          (item) => item.id === request.id,
        )
        records.evidence[index] = {
          ...request,
          audit: {
            ...request.audit,
            updatedAt: timestamp,
            updatedByActorId: actorId,
            active: false,
          },
        }
      }
      records.evidence.push(
        historyEvidence(
          targetType === "decision_request"
            ? "Evidence"
            : targetType === "action"
              ? "Action"
              : "Update",
          converted.id,
          "type changed",
          {
            previousType: currentType,
            newType: targetType,
            sourceEntryId: entryId,
          },
          now,
          actorId,
          createUuid,
        ),
      )
      return {
        state: normalizeDomainState(records),
        record: converted,
        message: `Entry gewijzigd naar ${targetType}`,
      }
    }
    records.evidence.push(
      historyEvidence(
        "Update",
        entryId,
        "type changed",
        { previousType: currentType, newType: targetType },
        now,
        actorId,
        createUuid,
      ),
    )
    return {
      state: normalizeDomainState(records),
      record: records.updates.find((item) => item.id === entryId),
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

  setUpdateCompleted(
    state: NormalizedDomainState,
    updateId: UUID,
    completed: boolean,
    options: JournalMutationOptions = {},
  ): JournalMutationResult<Evidence | Update> {
    const update = state.indices.updateById.get(updateId)
    if (!update?.audit.active) throw new Error("Update niet gevonden.")
    const now = options.now ?? new Date()
    const actorId = activeActorId(state)
    const createUuid = options.createUuid ?? defaultUuid
    const records = cloneDomainCollections(state.records)
    const existingIndex = records.evidence.findIndex(
      (evidence) =>
        evidence.type === "JournalCompletion" &&
        evidence.objectType === "Update" &&
        evidence.objectId === updateId &&
        evidence.audit.active,
    )

    if (completed && existingIndex < 0) {
      records.evidence.push({
        id: createUuid(),
        objectType: "Update",
        objectId: updateId,
        type: "JournalCompletion",
        title: "Update afgesloten",
        description: JSON.stringify({ completedAt: now.toISOString() }),
        date: todayAsLocalDate(now) as LocalDate,
        authorActorId: actorId,
        audit: auditFields(now, actorId),
      })
    } else if (!completed && existingIndex >= 0) {
      const existing = records.evidence[existingIndex]!
      records.evidence[existingIndex] = {
        ...existing,
        audit: {
          ...existing.audit,
          updatedAt: now.toISOString() as DateTime,
          updatedByActorId: actorId,
          active: false,
        },
      }
    }

    records.evidence.push(
      historyEvidence(
        "Update",
        updateId,
        completed ? "update completed" : "update reopened",
        {},
        now,
        actorId,
        createUuid,
      ),
    )
    return {
      state: normalizeDomainState(records),
      record: update,
      message: completed ? "Update afgesloten" : "Update heropend",
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
