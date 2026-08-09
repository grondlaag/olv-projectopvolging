import {
  validateBudgetAmount,
  type AuditFields,
  type BudgetMutation,
  type BudgetRecord,
  type BudgetStatus,
  type BudgetType,
  type DateTime,
  type LocalDate,
  type UUID,
} from "../../domain"
import { todayAsLocalDate } from "../../utils"
import {
  normalizeDomainState,
  type NormalizedDomainState,
} from "./domain-state"
import { cloneDomainCollections } from "./semantic-comparison"

export interface BudgetRecordInput {
  projectId: UUID
  topicId?: UUID
  category: string
  type: BudgetType
  description: string
  amountCents: number
  date: LocalDate
  status: BudgetStatus
  reference?: string
  supplierActorId?: UUID
}

export interface BudgetCorrectionInput {
  newAmountCents: number
  reason: string
}

export interface BudgetMutationOptions {
  now?: Date
  createUuid?: () => UUID
}

export interface BudgetMutationResult<T> {
  state: NormalizedDomainState
  record: T
  mutation?: BudgetMutation
}

export interface BudgetManagementIssue {
  field: string
  message: string
}

export class BudgetManagementError extends Error {
  constructor(readonly issues: readonly BudgetManagementIssue[]) {
    super(issues[0]?.message ?? "De budgetinvoer is ongeldig.")
    this.name = "BudgetManagementError"
  }
}

function defaultUuid(): UUID {
  return crypto.randomUUID() as UUID
}

function requiredText(value: string): string {
  return value.trim()
}

function optionalText(value?: string): string | undefined {
  const normalized = value?.trim()
  return normalized ? normalized : undefined
}

function currentActorId(state: NormalizedDomainState): UUID | undefined {
  return state.records.config[0]?.currentActorId
}

function activeCurrentActorId(state: NormalizedDomainState): UUID {
  const actorId = currentActorId(state)
  const actor = actorId ? state.indices.actorById.get(actorId) : undefined
  if (!actor?.active || !actor.audit.active) {
    throw new BudgetManagementError([
      {
        field: "authorActorId",
        message:
          "Kies een actieve huidige actor voordat je een financiële fout corrigeert.",
      },
    ])
  }
  return actor.id
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

function normalizedRecordInput(input: BudgetRecordInput): BudgetRecordInput {
  const reference = optionalText(input.reference)
  return {
    projectId: input.projectId,
    ...(input.topicId ? { topicId: input.topicId } : {}),
    category: requiredText(input.category),
    type: input.type,
    description: requiredText(input.description),
    amountCents: input.amountCents,
    date: input.date,
    status: input.status,
    ...(reference ? { reference } : {}),
    ...(input.supplierActorId
      ? { supplierActorId: input.supplierActorId }
      : {}),
  }
}

function validateRecordInput(
  state: NormalizedDomainState,
  input: BudgetRecordInput,
): void {
  const issues: BudgetManagementIssue[] = []
  if (!state.indices.projectById.has(input.projectId)) {
    issues.push({ field: "projectId", message: "Project niet gevonden." })
  }
  if (!input.category) {
    issues.push({ field: "category", message: "Categorie is verplicht." })
  }
  if (!input.description) {
    issues.push({
      field: "description",
      message: "Omschrijving is verplicht.",
    })
  }
  if (input.topicId) {
    const topic = state.indices.topicById.get(input.topicId)
    if (!topic || !topic.audit.active || topic.projectId !== input.projectId) {
      issues.push({
        field: "topicId",
        message: "Het gekozen topic hoort niet bij dit project.",
      })
    }
  }
  if (input.supplierActorId) {
    const supplier = state.indices.actorById.get(input.supplierActorId)
    if (!supplier?.active || !supplier.audit.active) {
      issues.push({
        field: "supplierActorId",
        message: "De leverancier moet een actieve actor zijn.",
      })
    }
  }
  for (const issue of validateBudgetAmount(input.amountCents)) {
    issues.push({ field: issue.field, message: issue.message })
  }
  if (issues.length) throw new BudgetManagementError(issues)
}

export class BudgetManagementService {
  createRecord(
    state: NormalizedDomainState,
    rawInput: BudgetRecordInput,
    options: BudgetMutationOptions = {},
  ): BudgetMutationResult<BudgetRecord> {
    const input = normalizedRecordInput(rawInput)
    validateRecordInput(state, input)
    const now = options.now ?? new Date()
    const actorId = currentActorId(state)
    const record: BudgetRecord = {
      id: (options.createUuid ?? defaultUuid)(),
      ...input,
      audit: auditFields(now, actorId),
    }
    const records = cloneDomainCollections(state.records)
    records.budgets.push(record)
    return { state: normalizeDomainState(records), record }
  }

  correctAmount(
    state: NormalizedDomainState,
    budgetRecordId: UUID,
    input: BudgetCorrectionInput,
    options: BudgetMutationOptions = {},
  ): BudgetMutationResult<BudgetRecord> {
    const existing = state.indices.budgetById.get(budgetRecordId)
    if (!existing || !existing.audit.active) {
      throw new BudgetManagementError([
        { field: "budgetRecord", message: "Budgetitem niet gevonden." },
      ])
    }
    const issues: BudgetManagementIssue[] = []
    for (const issue of validateBudgetAmount(input.newAmountCents)) {
      issues.push({ field: "newAmountCents", message: issue.message })
    }
    const reason = requiredText(input.reason)
    if (!reason) {
      issues.push({ field: "reason", message: "Reden is verplicht." })
    }
    if (input.newAmountCents === existing.amountCents) {
      issues.push({
        field: "newAmountCents",
        message: "Het nieuwe bedrag moet verschillen van het huidige bedrag.",
      })
    }
    if (issues.length) throw new BudgetManagementError(issues)

    const now = options.now ?? new Date()
    const createUuid = options.createUuid ?? defaultUuid
    const actorId = activeCurrentActorId(state)
    const record: BudgetRecord = {
      ...existing,
      amountCents: input.newAmountCents,
      audit: updateAudit(existing.audit, now, actorId),
    }
    const mutation: BudgetMutation = {
      id: createUuid(),
      budgetRecordId: existing.id,
      changeType: "Foutcorrectie",
      deltaCents: input.newAmountCents - existing.amountCents,
      previousAmountCents: existing.amountCents,
      newAmountCents: input.newAmountCents,
      reason,
      date: todayAsLocalDate(now) as LocalDate,
      authorActorId: actorId,
      audit: auditFields(now, actorId),
    }
    const records = cloneDomainCollections(state.records)
    const index = records.budgets.findIndex(
      (candidate) => candidate.id === existing.id,
    )
    records.budgets[index] = record
    records.budgetMutations.push(mutation)
    return {
      state: normalizeDomainState(records),
      record,
      mutation,
    }
  }
}
