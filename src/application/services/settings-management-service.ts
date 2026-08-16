import type {
  Actor,
  ActorType,
  AuditFields,
  Chapter,
  ChoiceList,
  Cluster,
  Config,
  DateTime,
  UUID,
} from "../../domain"
import { APP_VERSION } from "../../config/app-metadata"
import {
  normalizeDomainState,
  type NormalizedDomainState,
} from "./domain-state"
import { cloneDomainCollections } from "./semantic-comparison"

export interface ChapterSettingsInput {
  code: string
  title: string
  active: boolean
}

export interface ClusterSettingsInput {
  chapterId: UUID
  code: string
  title: string
  description?: string
  active: boolean
}

export interface ActorSettingsInput {
  displayName: string
  type: ActorType
  email?: string
  organization?: string
  role?: string
  active: boolean
}

export interface ChoiceListSettingsInput {
  listKey: string
  valueKey: string
  label: string
  active: boolean
}

export interface GeneralSettingsInput {
  defaultCurrency: string
  currentActorId?: UUID
}

export interface SettingsMutationOptions {
  now?: Date
  createUuid?: () => UUID
}

export interface SettingsMutationResult<T> {
  state: NormalizedDomainState
  record: T
}

export class SettingsManagementError extends Error {
  constructor(
    readonly field: string,
    message: string,
  ) {
    super(message)
    this.name = "SettingsManagementError"
  }
}

function uuid(): UUID {
  return crypto.randomUUID() as UUID
}

function required(value: string, field: string, label: string): string {
  const normalized = value.trim()
  if (!normalized)
    throw new SettingsManagementError(field, `${label} is verplicht.`)
  return normalized
}

function optional(value?: string): string | undefined {
  return value?.trim() || undefined
}

function currentActorId(state: NormalizedDomainState): UUID | undefined {
  return state.records.config[0]?.currentActorId
}

function audit(now: Date, actorId?: UUID, active = true): AuditFields {
  const timestamp = now.toISOString() as DateTime
  return {
    createdAt: timestamp,
    ...(actorId ? { createdByActorId: actorId } : {}),
    updatedAt: timestamp,
    ...(actorId ? { updatedByActorId: actorId } : {}),
    active,
  }
}

function updatedAudit(
  previous: AuditFields,
  now: Date,
  actorId: UUID | undefined,
  active: boolean,
): AuditFields {
  return {
    ...previous,
    updatedAt: now.toISOString() as DateTime,
    ...(actorId ? { updatedByActorId: actorId } : {}),
    active,
  }
}

function duplicate(
  values: readonly {
    id: UUID
    code?: string
    valueKey?: string
    listKey?: string
  }[],
  id: UUID | undefined,
  key: string,
  listKey?: string,
): boolean {
  const normalized = key.trim().toLocaleLowerCase("nl")
  return values.some(
    (item) =>
      item.id !== id &&
      (!listKey || item.listKey === listKey) &&
      (item.code ?? item.valueKey ?? "").trim().toLocaleLowerCase("nl") ===
        normalized,
  )
}

export class SettingsManagementService {
  createChapter(
    state: NormalizedDomainState,
    input: ChapterSettingsInput,
    options: SettingsMutationOptions = {},
  ): SettingsMutationResult<Chapter> {
    const code = required(input.code, "code", "Hoofdstukcode")
    const title = required(input.title, "title", "Hoofdstuktitel")
    if (duplicate(state.records.chapters, undefined, code)) {
      throw new SettingsManagementError(
        "code",
        "Deze hoofdstukcode bestaat al.",
      )
    }
    const now = options.now ?? new Date()
    const actorId = currentActorId(state)
    const record: Chapter = {
      id: (options.createUuid ?? uuid)(),
      code,
      title,
      order:
        Math.max(0, ...state.records.chapters.map((item) => item.order)) + 1,
      status: input.active ? "Active" : "Inactive",
      audit: audit(now, actorId, input.active),
    }
    const records = cloneDomainCollections(state.records)
    records.chapters.push(record)
    return { record, state: normalizeDomainState(records) }
  }

  updateChapter(
    state: NormalizedDomainState,
    chapterId: UUID,
    input: ChapterSettingsInput,
    options: SettingsMutationOptions = {},
  ): SettingsMutationResult<Chapter> {
    const existing = state.indices.chapterById.get(chapterId)
    if (!existing)
      throw new SettingsManagementError("chapter", "Hoofdstuk niet gevonden.")
    const code = required(input.code, "code", "Hoofdstukcode")
    const title = required(input.title, "title", "Hoofdstuktitel")
    if (duplicate(state.records.chapters, chapterId, code)) {
      throw new SettingsManagementError(
        "code",
        "Deze hoofdstukcode bestaat al.",
      )
    }
    if (
      !input.active &&
      (state.records.projects.some(
        (item) => item.audit.active && item.chapterId === chapterId,
      ) ||
        state.records.clusters.some(
          (item) => item.audit.active && item.chapterId === chapterId,
        ))
    ) {
      throw new SettingsManagementError(
        "active",
        "Dit hoofdstuk kan niet worden gedeactiveerd zolang actieve projecten of clusters ernaar verwijzen.",
      )
    }
    const now = options.now ?? new Date()
    const record: Chapter = {
      ...existing,
      code,
      title,
      status: input.active ? "Active" : "Inactive",
      audit: updatedAudit(
        existing.audit,
        now,
        currentActorId(state),
        input.active,
      ),
    }
    const records = cloneDomainCollections(state.records)
    records.chapters[
      records.chapters.findIndex((item) => item.id === chapterId)
    ] = record
    return { record, state: normalizeDomainState(records) }
  }

  createCluster(
    state: NormalizedDomainState,
    input: ClusterSettingsInput,
    options: SettingsMutationOptions = {},
  ): SettingsMutationResult<Cluster> {
    const chapter = state.indices.chapterById.get(input.chapterId)
    if (!chapter?.audit.active) {
      throw new SettingsManagementError(
        "chapterId",
        "Kies een actief hoofdstuk.",
      )
    }
    const code = required(input.code, "code", "Clustercode")
    const title = required(input.title, "title", "Clusternaam")
    const siblings = state.records.clusters.filter(
      (item) => item.chapterId === input.chapterId,
    )
    if (duplicate(siblings, undefined, code)) {
      throw new SettingsManagementError(
        "code",
        "Deze clustercode bestaat al binnen het hoofdstuk.",
      )
    }
    const now = options.now ?? new Date()
    const actorId = currentActorId(state)
    const record: Cluster = {
      id: (options.createUuid ?? uuid)(),
      chapterId: input.chapterId,
      code,
      title,
      description: optional(input.description) ?? "",
      order: Math.max(0, ...siblings.map((item) => item.order)) + 1,
      status: input.active ? "Active" : "Inactive",
      audit: audit(now, actorId, input.active),
    }
    const records = cloneDomainCollections(state.records)
    records.clusters.push(record)
    return { record, state: normalizeDomainState(records) }
  }

  updateCluster(
    state: NormalizedDomainState,
    clusterId: UUID,
    input: ClusterSettingsInput,
    options: SettingsMutationOptions = {},
  ): SettingsMutationResult<Cluster> {
    const existing = state.indices.clusterById.get(clusterId)
    if (!existing)
      throw new SettingsManagementError("cluster", "Cluster niet gevonden.")
    if (!state.indices.chapterById.get(input.chapterId)?.audit.active) {
      throw new SettingsManagementError(
        "chapterId",
        "Kies een actief hoofdstuk.",
      )
    }
    const code = required(input.code, "code", "Clustercode")
    const title = required(input.title, "title", "Clusternaam")
    const siblings = state.records.clusters.filter(
      (item) => item.chapterId === input.chapterId,
    )
    if (duplicate(siblings, clusterId, code)) {
      throw new SettingsManagementError(
        "code",
        "Deze clustercode bestaat al binnen het hoofdstuk.",
      )
    }
    if (
      !input.active &&
      (state.records.projects.some(
        (item) => item.audit.active && item.clusterId === clusterId,
      ) ||
        state.records.topics.some(
          (item) => item.audit.active && item.clusterId === clusterId,
        ))
    ) {
      throw new SettingsManagementError(
        "active",
        "Deze cluster kan niet worden gedeactiveerd zolang actieve projecten of topics ernaar verwijzen.",
      )
    }
    if (
      input.chapterId !== existing.chapterId &&
      (state.records.projects.some((item) => item.clusterId === clusterId) ||
        state.records.topics.some((item) => item.clusterId === clusterId))
    ) {
      throw new SettingsManagementError(
        "chapterId",
        "Een gebruikte cluster kan niet naar een ander hoofdstuk worden verplaatst.",
      )
    }
    const now = options.now ?? new Date()
    const record: Cluster = {
      ...existing,
      chapterId: input.chapterId,
      code,
      title,
      description: optional(input.description) ?? "",
      status: input.active ? "Active" : "Inactive",
      audit: updatedAudit(
        existing.audit,
        now,
        currentActorId(state),
        input.active,
      ),
    }
    const records = cloneDomainCollections(state.records)
    records.clusters[
      records.clusters.findIndex((item) => item.id === clusterId)
    ] = record
    return { record, state: normalizeDomainState(records) }
  }

  createActor(
    state: NormalizedDomainState,
    input: ActorSettingsInput,
    options: SettingsMutationOptions = {},
  ): SettingsMutationResult<Actor> {
    const displayName = required(input.displayName, "displayName", "Naam")
    const now = options.now ?? new Date()
    const actorId = currentActorId(state)
    const email = optional(input.email)
    const organization = optional(input.organization)
    const role = optional(input.role)
    const record: Actor = {
      id: (options.createUuid ?? uuid)(),
      displayName,
      type: input.type,
      ...(email ? { email } : {}),
      ...(organization ? { organization } : {}),
      ...(role ? { role } : {}),
      active: input.active,
      audit: audit(now, actorId, input.active),
    }
    const records = cloneDomainCollections(state.records)
    records.actors.push(record)
    return { record, state: normalizeDomainState(records) }
  }

  updateActor(
    state: NormalizedDomainState,
    actorId: UUID,
    input: ActorSettingsInput,
    options: SettingsMutationOptions = {},
  ): SettingsMutationResult<Actor> {
    const existing = state.indices.actorById.get(actorId)
    if (!existing)
      throw new SettingsManagementError("actor", "Actor niet gevonden.")
    if (!input.active) {
      const inUse =
        state.records.config.some((item) => item.currentActorId === actorId) ||
        state.records.projects.some(
          (item) => item.audit.active && item.coordinatorActorId === actorId,
        ) ||
        state.records.topics.some(
          (item) => item.audit.active && item.ownerActorId === actorId,
        ) ||
        state.records.actions.some(
          (item) => item.audit.active && item.ownerActorId === actorId,
        ) ||
        state.records.meetings.some(
          (item) =>
            item.audit.active &&
            (item.chairActorId === actorId || item.reporterActorId === actorId),
        ) ||
        state.records.meetingParticipants.some(
          (item) => item.audit.active && item.actorId === actorId,
        )
      if (inUse) {
        throw new SettingsManagementError(
          "active",
          "Deze actor kan niet worden gedeactiveerd zolang die een actieve rol of huidige gebruikerscontext heeft.",
        )
      }
    }
    const now = options.now ?? new Date()
    const email = optional(input.email)
    const organization = optional(input.organization)
    const role = optional(input.role)
    const record: Actor = {
      ...existing,
      displayName: required(input.displayName, "displayName", "Naam"),
      type: input.type,
      active: input.active,
      audit: updatedAudit(
        existing.audit,
        now,
        currentActorId(state),
        input.active,
      ),
    }
    if (email) record.email = email
    else delete record.email
    if (organization) record.organization = organization
    else delete record.organization
    if (role) record.role = role
    else delete record.role
    const records = cloneDomainCollections(state.records)
    records.actors[records.actors.findIndex((item) => item.id === actorId)] =
      record
    return { record, state: normalizeDomainState(records) }
  }

  createChoice(
    state: NormalizedDomainState,
    input: ChoiceListSettingsInput,
    options: SettingsMutationOptions = {},
  ): SettingsMutationResult<ChoiceList> {
    const listKey = required(input.listKey, "listKey", "Keuzelijst")
    const valueKey = required(input.valueKey, "valueKey", "Technische sleutel")
    const label = required(input.label, "label", "Label")
    if (duplicate(state.records.choiceLists, undefined, valueKey, listKey)) {
      throw new SettingsManagementError(
        "valueKey",
        "Deze sleutel bestaat al in de keuzelijst.",
      )
    }
    const now = options.now ?? new Date()
    const siblings = state.records.choiceLists.filter(
      (item) => item.listKey === listKey,
    )
    const record: ChoiceList = {
      id: (options.createUuid ?? uuid)(),
      listKey,
      valueKey,
      label,
      order: Math.max(0, ...siblings.map((item) => item.order)) + 1,
      system: false,
      active: input.active,
      audit: audit(now, currentActorId(state), input.active),
    }
    const records = cloneDomainCollections(state.records)
    records.choiceLists.push(record)
    return { record, state: normalizeDomainState(records) }
  }

  updateChoice(
    state: NormalizedDomainState,
    choiceId: UUID,
    input: ChoiceListSettingsInput,
    options: SettingsMutationOptions = {},
  ): SettingsMutationResult<ChoiceList> {
    const existing = state.records.choiceLists.find(
      (item) => item.id === choiceId,
    )
    if (!existing)
      throw new SettingsManagementError(
        "choice",
        "Keuzelijstwaarde niet gevonden.",
      )
    if (existing.system) {
      throw new SettingsManagementError(
        "choice",
        "Een vaste systeemwaarde kan niet worden gewijzigd.",
      )
    }
    const listKey = required(input.listKey, "listKey", "Keuzelijst")
    const valueKey = required(input.valueKey, "valueKey", "Technische sleutel")
    if (duplicate(state.records.choiceLists, choiceId, valueKey, listKey)) {
      throw new SettingsManagementError(
        "valueKey",
        "Deze sleutel bestaat al in de keuzelijst.",
      )
    }
    const now = options.now ?? new Date()
    const record: ChoiceList = {
      ...existing,
      listKey,
      valueKey,
      label: required(input.label, "label", "Label"),
      active: input.active,
      audit: updatedAudit(
        existing.audit,
        now,
        currentActorId(state),
        input.active,
      ),
    }
    const records = cloneDomainCollections(state.records)
    records.choiceLists[
      records.choiceLists.findIndex((item) => item.id === choiceId)
    ] = record
    return { record, state: normalizeDomainState(records) }
  }

  updateGeneral(
    state: NormalizedDomainState,
    input: GeneralSettingsInput,
    options: SettingsMutationOptions = {},
  ): SettingsMutationResult<Config> {
    const existing = state.records.config[0]
    if (!existing)
      throw new SettingsManagementError("config", "Configuratie ontbreekt.")
    const currency = input.defaultCurrency.trim().toUpperCase()
    if (!/^[A-Z]{3}$/u.test(currency)) {
      throw new SettingsManagementError(
        "defaultCurrency",
        "Gebruik een ISO-valutacode van drie letters.",
      )
    }
    if (
      input.currentActorId &&
      !state.indices.actorById.get(input.currentActorId)?.active
    ) {
      throw new SettingsManagementError(
        "currentActorId",
        "Kies een actieve actor.",
      )
    }
    const now = options.now ?? new Date()
    const record: Config = {
      ...existing,
      defaultCurrency: currency,
      appVersion: APP_VERSION,
      audit: updatedAudit(existing.audit, now, currentActorId(state), true),
    }
    if (input.currentActorId) record.currentActorId = input.currentActorId
    else delete record.currentActorId
    const records = cloneDomainCollections(state.records)
    records.config[0] = record
    return { record, state: normalizeDomainState(records) }
  }
}
