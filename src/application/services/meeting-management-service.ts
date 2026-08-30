import {
  isAgendaObjectInMeetingScope,
  validateAgendaObjectScope,
  validateMeetingScope,
  type AgendaDiscussionStatus,
  type AgendaItem,
  type AgendaObjectType,
  type AuditFields,
  type DateTime,
  type LocalDate,
  type Meeting,
  type MeetingParticipant,
  type MeetingScopeReferences,
  type MeetingScopeType,
  type MeetingStatus,
  type Report,
  type ReportItem,
  type UUID,
} from "../../domain"
import { todayAsLocalDate } from "../../utils"
import {
  normalizeDomainState,
  type NormalizedDomainState,
} from "./domain-state"
import { cloneDomainCollections } from "./semantic-comparison"

export interface MeetingParticipantInput {
  actorId: UUID
  role?: string
  attended: boolean
}

export interface MeetingInput {
  sourceMeetingId?: UUID
  type: string
  scopeType: MeetingScopeType
  scopeId?: UUID
  number?: string
  title: string
  date: LocalDate
  chairActorId?: UUID
  reporterActorId?: UUID
  status: MeetingStatus
  nextMeetingDate?: LocalDate
  participants: readonly MeetingParticipantInput[]
}

export interface AgendaItemInput {
  title: string
  reason?: string
  notes?: string
  discussionStatus: AgendaDiscussionStatus
  objectType: Extract<AgendaObjectType, "Project" | "Topic">
  objectId: UUID
}

export interface MeetingMutationOptions {
  now?: Date
  createUuid?: () => UUID
}

export interface MeetingMutationResult<T> {
  state: NormalizedDomainState
  record: T
}

export interface MeetingManagementIssue {
  field: string
  message: string
}

export class MeetingManagementError extends Error {
  constructor(readonly issues: readonly MeetingManagementIssue[]) {
    super(issues[0]?.message ?? "De overleginvoer is ongeldig.")
    this.name = "MeetingManagementError"
  }
}

function defaultUuid(): UUID {
  return crypto.randomUUID() as UUID
}

function optionalText(value?: string): string | undefined {
  const normalized = value?.trim()
  return normalized ? normalized : undefined
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

function updateAudit(
  audit: AuditFields,
  now: Date,
  actorId?: UUID,
): AuditFields {
  return {
    ...audit,
    updatedAt: now.toISOString() as DateTime,
    ...(actorId ? { updatedByActorId: actorId } : {}),
  }
}

function reportAuthorId(state: NormalizedDomainState, meeting: Meeting): UUID {
  const participantIds = (
    state.indices.meetingParticipantsByMeeting.get(meeting.id) ?? []
  ).map((participant) => participant.actorId)
  const candidates = [
    meeting.reporterActorId,
    meeting.chairActorId,
    ...participantIds,
    state.records.config[0]?.currentActorId,
  ]
  for (const actorId of candidates) {
    const actor = actorId ? state.indices.actorById.get(actorId) : undefined
    if (actor?.active && actor.audit.active) return actor.id
  }
  throw new MeetingManagementError([
    {
      field: "reporterActorId",
      message:
        "Voeg een actieve verslaggever, voorzitter of deelnemer aan het overleg toe.",
    },
  ])
}

function scopeReferences(state: NormalizedDomainState): MeetingScopeReferences {
  return {
    chapterIds: new Set(state.records.chapters.map((item) => item.id)),
    clustersById: state.indices.clusterById,
    projectsById: state.indices.projectById,
    topicsById: state.indices.topicById,
    actionsById: state.indices.actionById,
  }
}

function validateMeetingInput(
  state: NormalizedDomainState,
  input: MeetingInput,
  meetingId?: UUID,
): void {
  const issues: MeetingManagementIssue[] = []
  if (!input.type.trim()) {
    issues.push({ field: "type", message: "Overlegtype is verplicht." })
  }
  if (!input.title.trim()) {
    issues.push({ field: "title", message: "Titel is verplicht." })
  }
  issues.push(
    ...validateMeetingScope(input, scopeReferences(state)).map((issue) => ({
      field: issue.field,
      message: issue.message,
    })),
  )

  if (input.sourceMeetingId) {
    const source = state.indices.meetingById.get(input.sourceMeetingId)
    if (!source?.audit.active) {
      issues.push({
        field: "sourceMeetingId",
        message: "Het oorspronkelijke overleg bestaat niet meer.",
      })
    } else if (source.id === meetingId) {
      issues.push({
        field: "sourceMeetingId",
        message: "Een overleg kan niet zijn eigen vervolg zijn.",
      })
    } else if (
      source.scopeType !== input.scopeType ||
      source.scopeId !== input.scopeId
    ) {
      issues.push({
        field: "scopeId",
        message:
          "Een vervolgoverleg behoudt dezelfde scope als het bronoverleg.",
      })
    }
  }

  const actorIds = new Set<UUID>()
  for (const participant of input.participants) {
    const actor = state.indices.actorById.get(participant.actorId)
    if (!actor?.active || !actor.audit.active) {
      issues.push({
        field: "participants",
        message: "Iedere deelnemer moet een actieve actor zijn.",
      })
    }
    if (actorIds.has(participant.actorId)) {
      issues.push({
        field: "participants",
        message: "Een actor kan maar één keer deelnemen aan hetzelfde overleg.",
      })
    }
    actorIds.add(participant.actorId)
  }
  for (const [field, actorId] of [
    ["chairActorId", input.chairActorId],
    ["reporterActorId", input.reporterActorId],
  ] as const) {
    if (!actorId) continue
    const actor = state.indices.actorById.get(actorId)
    if (!actor?.active || !actor.audit.active) {
      issues.push({
        field,
        message: "Kies een actieve actor.",
      })
    }
  }
  if (issues.length) throw new MeetingManagementError(issues)
}

function ensureConceptMeeting(
  state: NormalizedDomainState,
  meetingId: UUID,
): Meeting {
  const meeting = state.indices.meetingById.get(meetingId)
  if (!meeting?.audit.active) {
    throw new MeetingManagementError([
      { field: "meetingId", message: "Overleg niet gevonden." },
    ])
  }
  if (meeting.status !== "Concept") {
    throw new MeetingManagementError([
      {
        field: "status",
        message:
          "Dit overleg is definitief. Maak een verslagrevisie; wijzig de historische inhoud niet.",
      },
    ])
  }
  return meeting
}

function normalizedMeetingInput(input: MeetingInput) {
  const number = optionalText(input.number)
  return {
    ...(input.sourceMeetingId
      ? { sourceMeetingId: input.sourceMeetingId }
      : {}),
    type: input.type.trim(),
    scopeType: input.scopeType,
    ...(input.scopeId ? { scopeId: input.scopeId } : {}),
    ...(number ? { number } : {}),
    title: input.title.trim(),
    date: input.date,
    ...(input.chairActorId ? { chairActorId: input.chairActorId } : {}),
    ...(input.reporterActorId
      ? { reporterActorId: input.reporterActorId }
      : {}),
    status: input.status,
    ...(input.nextMeetingDate
      ? { nextMeetingDate: input.nextMeetingDate }
      : {}),
  }
}

function replaceParticipants(
  records: ReturnType<typeof cloneDomainCollections>,
  meetingId: UUID,
  participants: readonly MeetingParticipantInput[],
  now: Date,
  actorId: UUID | undefined,
  createUuid: () => UUID,
): void {
  const existing = new Map(
    records.meetingParticipants
      .filter((item) => item.meetingId === meetingId)
      .map((item) => [item.actorId, item]),
  )
  records.meetingParticipants = records.meetingParticipants.filter(
    (item) => item.meetingId !== meetingId,
  )
  for (const input of participants) {
    const previous = existing.get(input.actorId)
    const role = optionalText(input.role)
    records.meetingParticipants.push({
      id: previous?.id ?? createUuid(),
      meetingId,
      actorId: input.actorId,
      ...(role ? { role } : {}),
      attended: input.attended,
      audit: previous
        ? updateAudit(previous.audit, now, actorId)
        : auditFields(now, actorId),
    })
  }
}

function objectTitle(
  state: NormalizedDomainState,
  objectType: AgendaObjectType | undefined,
  objectId: UUID | undefined,
): string | undefined {
  if (!objectType || !objectId) return undefined
  if (objectType === "Project") {
    const item = state.indices.projectById.get(objectId)
    return item ? `${item.code} · ${item.title}` : undefined
  }
  if (objectType === "Cluster") {
    const item = state.indices.clusterById.get(objectId)
    return item ? `${item.code} · ${item.title}` : undefined
  }
  if (objectType === "Topic") {
    const item = state.indices.topicById.get(objectId)
    return item ? `${item.code} · ${item.title}` : undefined
  }
  const item = state.indices.actionById.get(objectId)
  return item ? `${item.code} · ${item.title}` : undefined
}

function reportSnapshots(
  state: NormalizedDomainState,
  meeting: Meeting,
  reportId: UUID,
  now: Date,
  actorId: UUID,
  createUuid: () => UUID,
): ReportItem[] {
  const snapshots: ReportItem[] = []
  let order = 0
  const add = (
    section: string,
    contentType: string,
    titleSnapshot: string,
    textSnapshot: string,
    source?: Pick<AgendaItem, "objectType" | "objectId">,
  ) => {
    order += 1
    snapshots.push({
      id: createUuid(),
      reportId,
      order,
      section,
      contentType,
      ...(source?.objectType ? { objectType: source.objectType } : {}),
      ...(source?.objectId ? { objectId: source.objectId } : {}),
      titleSnapshot,
      textSnapshot,
      audit: auditFields(now, actorId),
    })
  }

  const participants = [
    ...(state.indices.meetingParticipantsByMeeting.get(meeting.id) ?? []),
  ].sort((left, right) => {
    const leftName =
      state.indices.actorById.get(left.actorId)?.displayName ?? ""
    const rightName =
      state.indices.actorById.get(right.actorId)?.displayName ?? ""
    return leftName.localeCompare(rightName, "nl")
  })
  add(
    "Deelnemers",
    "Deelnemers",
    "Deelnemers",
    participants.length
      ? participants
          .map((participant) => {
            const actor = state.indices.actorById.get(participant.actorId)
            return `${actor?.displayName ?? "Onbekende actor"}${participant.role ? ` — ${participant.role}` : ""} — ${participant.attended ? "aanwezig" : "afwezig"}`
          })
          .join("\n")
      : "Geen deelnemers geregistreerd.",
  )

  const agenda = [
    ...(state.indices.agendaItemsByMeeting.get(meeting.id) ?? []),
  ].sort((left, right) => left.order - right.order)
  for (const item of agenda) {
    const sourceLabel = objectTitle(state, item.objectType, item.objectId)
    add(
      "Agenda",
      "Agendapunt",
      `${item.order}. ${item.title}`,
      [
        sourceLabel ? `Bron: ${sourceLabel}` : undefined,
        item.reason ? `Aanleiding: ${item.reason}` : undefined,
        item.notes ? `Notities: ${item.notes}` : undefined,
        `Bespreekstatus: ${item.discussionStatus}`,
      ]
        .filter(Boolean)
        .join("\n"),
      item,
    )
  }

  const contributions = [
    ...(state.indices.updatesByMeeting.get(meeting.id) ?? []),
  ].sort(
    (left, right) =>
      left.date.localeCompare(right.date) ||
      left.audit.createdAt.localeCompare(right.audit.createdAt),
  )
  for (const contribution of contributions) {
    add(
      contribution.type === "Beslissing" ? "Beslissingen" : "Updates",
      contribution.type,
      objectTitle(
        state,
        contribution.objectType as AgendaObjectType,
        contribution.objectId,
      ) ?? meeting.title,
      contribution.text,
      contribution.objectType === "Project" ||
        contribution.objectType === "Cluster" ||
        contribution.objectType === "Topic" ||
        contribution.objectType === "Action"
        ? {
            objectType: contribution.objectType,
            objectId: contribution.objectId,
          }
        : undefined,
    )
  }

  const actions = [
    ...(state.indices.actionsByMeeting.get(meeting.id) ?? []),
  ].sort((left, right) => {
    const leftOwner = state.indices.actorById.get(
      left.ownerActorId,
    )?.displayName
    const rightOwner = state.indices.actorById.get(
      right.ownerActorId,
    )?.displayName
    return (
      (leftOwner ?? "Onbekende actor").localeCompare(
        rightOwner ?? "Onbekende actor",
        "nl",
      ) || left.code.localeCompare(right.code, "nl")
    )
  })
  for (const action of actions) {
    const owner = state.indices.actorById.get(action.ownerActorId)
    add(
      "Acties",
      owner?.displayName ?? "Onbekende actor",
      `${action.code} · ${action.title}`,
      [
        `Eigenaar: ${owner?.displayName ?? "Onbekende actor"}`,
        `Deadline: ${action.deadline ?? "niet bepaald"}`,
        `Status: ${action.status}`,
        action.description,
      ]
        .filter(Boolean)
        .join("\n"),
      action.objectType === "Project" || action.objectType === "Topic"
        ? { objectType: action.objectType, objectId: action.objectId }
        : { objectType: "Action", objectId: action.id },
    )
  }

  const decisionRequestIds = state.records.evidence.flatMap((link) => {
    if (
      !link.audit.active ||
      link.type !== "MeetingLink" ||
      link.objectType !== "Evidence" ||
      !link.description
    )
      return []
    try {
      const payload = JSON.parse(link.description) as { meetingId?: UUID }
      return payload.meetingId === meeting.id ? [link.objectId] : []
    } catch {
      return []
    }
  })
  for (const requestId of decisionRequestIds) {
    const request = state.records.evidence.find(
      (item) =>
        item.id === requestId &&
        item.audit.active &&
        item.type === "DecisionRequest",
    )
    if (!request) continue
    add(
      "Beslissingsvragen",
      "Beslissing nodig",
      request.title,
      request.description ?? request.title,
      request.objectType === "Project" || request.objectType === "Topic"
        ? { objectType: request.objectType, objectId: request.objectId }
        : undefined,
    )
  }
  return snapshots
}

export class MeetingManagementService {
  createMeeting(
    state: NormalizedDomainState,
    input: MeetingInput,
    options: MeetingMutationOptions = {},
  ): MeetingMutationResult<Meeting> {
    validateMeetingInput(state, input)
    const now = options.now ?? new Date()
    const createUuid = options.createUuid ?? defaultUuid
    const actorId = state.records.config[0]?.currentActorId
    const meeting: Meeting = {
      id: createUuid(),
      ...normalizedMeetingInput({ ...input, status: "Concept" }),
      audit: auditFields(now, actorId),
    }
    const records = cloneDomainCollections(state.records)
    records.meetings.push(meeting)
    replaceParticipants(
      records,
      meeting.id,
      input.participants,
      now,
      actorId,
      createUuid,
    )
    if (input.sourceMeetingId) {
      const carriedItems = (
        state.indices.agendaItemsByMeeting.get(input.sourceMeetingId) ?? []
      ).filter(
        (item) =>
          item.audit.active &&
          item.discussionStatus === "Doorgeschoven" &&
          (item.objectType === "Project" || item.objectType === "Topic") &&
          Boolean(item.objectId),
      )
      records.agendaItems.push(
        ...carriedItems.map((item, index): AgendaItem => ({
          id: createUuid(),
          meetingId: meeting.id,
          order: index + 1,
          title: item.title,
          ...(item.reason ? { reason: item.reason } : {}),
          ...(item.notes ? { notes: item.notes } : {}),
          objectType: item.objectType as "Project" | "Topic",
          objectId: item.objectId!,
          discussionStatus: "Te bespreken",
          audit: auditFields(now, actorId),
        })),
      )
    }
    return { state: normalizeDomainState(records), record: meeting }
  }

  updateMeeting(
    state: NormalizedDomainState,
    meetingId: UUID,
    input: MeetingInput,
    options: MeetingMutationOptions = {},
  ): MeetingMutationResult<Meeting> {
    const existing = ensureConceptMeeting(state, meetingId)
    validateMeetingInput(state, input, meetingId)
    const now = options.now ?? new Date()
    const createUuid = options.createUuid ?? defaultUuid
    const actorId = state.records.config[0]?.currentActorId
    const record: Meeting = {
      ...existing,
      ...normalizedMeetingInput({ ...input, status: "Concept" }),
      audit: updateAudit(existing.audit, now, actorId),
    }
    for (const field of [
      "scopeId",
      "number",
      "chairActorId",
      "reporterActorId",
      "nextMeetingDate",
      "sourceMeetingId",
    ] as const) {
      if (!(field in normalizedMeetingInput(input))) delete record[field]
    }
    const records = cloneDomainCollections(state.records)
    const index = records.meetings.findIndex((item) => item.id === meetingId)
    records.meetings[index] = record
    replaceParticipants(
      records,
      meetingId,
      input.participants,
      now,
      actorId,
      createUuid,
    )
    return { state: normalizeDomainState(records), record }
  }

  saveAgendaItem(
    state: NormalizedDomainState,
    meetingId: UUID,
    input: AgendaItemInput,
    agendaItemId?: UUID,
    options: MeetingMutationOptions = {},
  ): MeetingMutationResult<AgendaItem> {
    const meeting = ensureConceptMeeting(state, meetingId)
    const issues: MeetingManagementIssue[] = []
    if (!input.title.trim()) {
      issues.push({ field: "title", message: "Titel is verplicht." })
    }
    if (input.objectType !== "Project" && input.objectType !== "Topic") {
      issues.push({
        field: "objectType",
        message: "Koppel een agendapunt aan een project of topic.",
      })
    }
    issues.push(
      ...validateAgendaObjectScope(
        meeting,
        input.objectType,
        input.objectId,
        scopeReferences(state),
      ).map((issue) => ({ field: issue.field, message: issue.message })),
    )
    const existing = agendaItemId
      ? state.indices.agendaItemById.get(agendaItemId)
      : undefined
    if (agendaItemId && (!existing || existing.meetingId !== meetingId)) {
      issues.push({
        field: "agendaItemId",
        message: "Agendapunt niet gevonden.",
      })
    }
    const siblings = state.indices.agendaItemsByMeeting.get(meetingId) ?? []
    if (
      input.objectType &&
      input.objectId &&
      siblings.some(
        (item) =>
          item.audit.active &&
          item.id !== existing?.id &&
          item.objectType === input.objectType &&
          item.objectId === input.objectId,
      )
    ) {
      issues.push({
        field: "objectId",
        message: "Dit record staat al op de agenda van dit overleg.",
      })
    }
    if (issues.length) throw new MeetingManagementError(issues)

    const now = options.now ?? new Date()
    const createUuid = options.createUuid ?? defaultUuid
    const actorId = state.records.config[0]?.currentActorId
    const reason = optionalText(input.reason)
    const notes = optionalText(input.notes)
    const record: AgendaItem = {
      id: existing?.id ?? createUuid(),
      meetingId,
      order:
        existing?.order ??
        Math.max(0, ...siblings.map((item) => item.order)) + 1,
      title: input.title.trim(),
      ...(reason ? { reason } : {}),
      ...(notes ? { notes } : {}),
      ...(input.objectType ? { objectType: input.objectType } : {}),
      ...(input.objectId ? { objectId: input.objectId } : {}),
      discussionStatus: input.discussionStatus,
      audit: existing
        ? updateAudit(existing.audit, now, actorId)
        : auditFields(now, actorId),
    }
    const records = cloneDomainCollections(state.records)
    if (existing) {
      const index = records.agendaItems.findIndex(
        (item) => item.id === existing.id,
      )
      records.agendaItems[index] = record
    } else {
      records.agendaItems.push(record)
    }
    return { state: normalizeDomainState(records), record }
  }

  moveAgendaItem(
    state: NormalizedDomainState,
    agendaItemId: UUID,
    direction: "up" | "down",
    options: MeetingMutationOptions = {},
  ): MeetingMutationResult<AgendaItem> {
    const item = state.indices.agendaItemById.get(agendaItemId)
    if (!item) {
      throw new MeetingManagementError([
        { field: "agendaItemId", message: "Agendapunt niet gevonden." },
      ])
    }
    ensureConceptMeeting(state, item.meetingId)
    const ordered = [
      ...(state.indices.agendaItemsByMeeting.get(item.meetingId) ?? []),
    ].sort((left, right) => left.order - right.order)
    const index = ordered.findIndex((candidate) => candidate.id === item.id)
    const target = ordered[index + (direction === "up" ? -1 : 1)]
    if (!target) return { state, record: item }

    const now = options.now ?? new Date()
    const actorId = state.records.config[0]?.currentActorId
    const records = cloneDomainCollections(state.records)
    const currentIndex = records.agendaItems.findIndex(
      (candidate) => candidate.id === item.id,
    )
    const targetIndex = records.agendaItems.findIndex(
      (candidate) => candidate.id === target.id,
    )
    records.agendaItems[currentIndex] = {
      ...item,
      order: target.order,
      audit: updateAudit(item.audit, now, actorId),
    }
    records.agendaItems[targetIndex] = {
      ...target,
      order: item.order,
      audit: updateAudit(target.audit, now, actorId),
    }
    const next = normalizeDomainState(records)
    return { state: next, record: next.indices.agendaItemById.get(item.id)! }
  }

  setParticipantAttendance(
    state: NormalizedDomainState,
    participantId: UUID,
    attended: boolean,
    options: MeetingMutationOptions = {},
  ): MeetingMutationResult<MeetingParticipant> {
    const participant = state.indices.meetingParticipantById.get(participantId)
    if (!participant) {
      throw new MeetingManagementError([
        { field: "participantId", message: "Deelnemer niet gevonden." },
      ])
    }
    ensureConceptMeeting(state, participant.meetingId)
    const now = options.now ?? new Date()
    const actorId = state.records.config[0]?.currentActorId
    const record: MeetingParticipant = {
      ...participant,
      attended,
      audit: updateAudit(participant.audit, now, actorId),
    }
    const records = cloneDomainCollections(state.records)
    const index = records.meetingParticipants.findIndex(
      (item) => item.id === participant.id,
    )
    records.meetingParticipants[index] = record
    return { state: normalizeDomainState(records), record }
  }

  saveDraftReport(
    state: NormalizedDomainState,
    meetingId: UUID,
    options: MeetingMutationOptions = {},
  ): MeetingMutationResult<Report> {
    const meeting = ensureConceptMeeting(state, meetingId)
    const now = options.now ?? new Date()
    const createUuid = options.createUuid ?? defaultUuid
    const actorId = reportAuthorId(state, meeting)
    const reports = state.indices.reportsByMeeting.get(meetingId) ?? []
    const existing = reports.find((report) => report.status === "Concept")
    const version =
      existing?.version ??
      Math.max(0, ...reports.map((report) => report.version)) + 1
    const report: Report = {
      id: existing?.id ?? createUuid(),
      meetingId,
      version,
      status: "Concept",
      draftDate: todayAsLocalDate(now) as LocalDate,
      authorActorId: actorId,
      audit: existing
        ? updateAudit(existing.audit, now, actorId)
        : auditFields(now, actorId),
    }
    const records = cloneDomainCollections(state.records)
    if (existing) {
      const index = records.reports.findIndex((item) => item.id === existing.id)
      records.reports[index] = report
      records.reportItems = records.reportItems.filter(
        (item) => item.reportId !== existing.id,
      )
    } else {
      records.reports.push(report)
    }
    const snapshotState = normalizeDomainState(records)
    records.reportItems.push(
      ...reportSnapshots(
        snapshotState,
        meeting,
        report.id,
        now,
        actorId,
        createUuid,
      ),
    )
    return { state: normalizeDomainState(records), record: report }
  }

  finalizeReport(
    state: NormalizedDomainState,
    meetingId: UUID,
    options: MeetingMutationOptions = {},
  ): MeetingMutationResult<Report> {
    let workingState = state
    let draft = (state.indices.reportsByMeeting.get(meetingId) ?? []).find(
      (report) => report.status === "Concept",
    )
    if (!draft) {
      const result = this.saveDraftReport(state, meetingId, options)
      workingState = result.state
      draft = result.record
    }
    const meeting = ensureConceptMeeting(workingState, meetingId)
    const now = options.now ?? new Date()
    const actorId = draft.authorActorId
    const status = draft.version === 1 ? "Definitief" : "Gereviseerd"
    const report: Report = {
      ...draft,
      status,
      finalDate: todayAsLocalDate(now) as LocalDate,
      audit: updateAudit(draft.audit, now, actorId),
    }
    const records = cloneDomainCollections(workingState.records)
    const reportIndex = records.reports.findIndex(
      (item) => item.id === draft!.id,
    )
    records.reports[reportIndex] = report
    const meetingIndex = records.meetings.findIndex(
      (item) => item.id === meetingId,
    )
    records.meetings[meetingIndex] = {
      ...meeting,
      status: "Definitief",
      audit: updateAudit(meeting.audit, now, actorId),
    }
    return { state: normalizeDomainState(records), record: report }
  }

  createRevision(
    state: NormalizedDomainState,
    meetingId: UUID,
    reason: string,
    options: MeetingMutationOptions = {},
  ): MeetingMutationResult<Report> {
    const meeting = state.indices.meetingById.get(meetingId)
    const normalizedReason = reason.trim()
    if (!meeting || meeting.status !== "Definitief") {
      throw new MeetingManagementError([
        {
          field: "meetingId",
          message: "Alleen een definitief overleg kan worden gereviseerd.",
        },
      ])
    }
    if (!normalizedReason) {
      throw new MeetingManagementError([
        { field: "reason", message: "Een revisiereden is verplicht." },
      ])
    }
    const now = options.now ?? new Date()
    const createUuid = options.createUuid ?? defaultUuid
    const actorId = reportAuthorId(state, meeting)
    const reports = state.indices.reportsByMeeting.get(meetingId) ?? []
    const previous = [...reports].sort(
      (left, right) => right.version - left.version,
    )[0]
    if (!previous) {
      throw new MeetingManagementError([
        {
          field: "report",
          message: "Er is geen definitief verslag om te reviseren.",
        },
      ])
    }
    const report: Report = {
      id: createUuid(),
      meetingId,
      version: previous.version + 1,
      status: "Gereviseerd",
      draftDate: todayAsLocalDate(now) as LocalDate,
      finalDate: todayAsLocalDate(now) as LocalDate,
      authorActorId: actorId,
      audit: auditFields(now, actorId),
    }
    const records = cloneDomainCollections(state.records)
    records.reports.push(report)
    const previousItems =
      state.indices.reportItemsByReport.get(previous.id) ?? []
    records.reportItems.push({
      id: createUuid(),
      reportId: report.id,
      order: 1,
      section: "Revisie",
      contentType: "Correctie",
      objectType: "Report",
      objectId: previous.id,
      titleSnapshot: `Correctie op verslag versie ${previous.version}`,
      textSnapshot: normalizedReason,
      audit: auditFields(now, actorId),
    })
    for (const item of previousItems) {
      records.reportItems.push({
        ...item,
        id: createUuid(),
        reportId: report.id,
        order: item.order + 1,
        audit: auditFields(now, actorId),
      })
    }
    return { state: normalizeDomainState(records), record: report }
  }

  isAgendaObjectRelevant(
    state: NormalizedDomainState,
    meetingId: UUID,
    objectType: AgendaObjectType,
    objectId: UUID,
  ): boolean {
    const meeting = state.indices.meetingById.get(meetingId)
    return Boolean(
      meeting &&
      isAgendaObjectInMeetingScope(
        meeting,
        objectType,
        objectId,
        scopeReferences(state),
      ),
    )
  }
}
