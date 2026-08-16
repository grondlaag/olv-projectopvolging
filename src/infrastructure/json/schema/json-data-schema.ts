import { z } from "zod"
import {
  actionStatuses,
  actorTypes,
  agendaDiscussionStatuses,
  agendaObjectTypes,
  budgetStatuses,
  budgetTypes,
  meetingScopeTypes,
  meetingStatuses,
  objectTypes,
  planningKinds,
  planningStatuses,
  priorities,
  projectStatuses,
  projectSizes,
  recordStatuses,
  reportStatuses,
  topicStatuses,
  updateTypes,
  type DateTime,
} from "../../../domain"
import type { DomainCollections } from "../../../application/services/domain-state"
import {
  DATA_FILE_FORMAT,
  DATA_SCHEMA_VERSION,
} from "../../../config/data-format"
import { centsSchema, localDateSchema, uuidSchema } from "../../../validation"

export const JSON_DATA_FORMAT = DATA_FILE_FORMAT
export const JSON_DATA_SCHEMA_VERSION = DATA_SCHEMA_VERSION

const dateTimeSchema = z.iso.datetime().transform((value) => value as DateTime)

const auditSchema = z
  .object({
    createdAt: dateTimeSchema,
    createdByActorId: uuidSchema.optional(),
    updatedAt: dateTimeSchema,
    updatedByActorId: uuidSchema.optional(),
    active: z.boolean(),
  })
  .strict()

const audited = { id: uuidSchema, audit: auditSchema }

const chapterSchema = z
  .object({
    ...audited,
    code: z.string(),
    title: z.string(),
    order: z.number().safe().int(),
    status: z.enum(recordStatuses),
  })
  .strict()

const clusterSchema = z
  .object({
    ...audited,
    chapterId: uuidSchema,
    code: z.string(),
    title: z.string(),
    description: z.string(),
    status: z.enum(recordStatuses),
    currentUpdateId: uuidSchema.optional(),
    order: z.number().safe().int(),
  })
  .strict()

const projectSchema = z
  .object({
    ...audited,
    chapterId: uuidSchema,
    clusterId: uuidSchema.optional(),
    code: z.string(),
    title: z.string(),
    description: z.string(),
    status: z.enum(projectStatuses),
    phase: z.string(),
    site: z.string().optional(),
    location: z.string().optional(),
    department: z.string().optional(),
    coordinatorActorId: uuidSchema.optional(),
    startDate: localDateSchema.optional(),
    plannedEndDate: localDateSchema.optional(),
    actualEndDate: localDateSchema.optional(),
    progressPercent: z.number().min(0).max(100).optional(),
    size: z.enum(projectSizes).optional(),
    currentUpdateId: uuidSchema.optional(),
    documentsUrl: z.string().optional(),
  })
  .strict()

const projectClusterHistorySchema = z
  .object({
    ...audited,
    projectId: uuidSchema,
    clusterId: uuidSchema,
    validFrom: localDateSchema,
    validTo: localDateSchema.optional(),
    reason: z.string().optional(),
    authorActorId: uuidSchema.optional(),
  })
  .strict()

const actorSchema = z
  .object({
    ...audited,
    type: z.enum(actorTypes),
    displayName: z.string(),
    email: z.string().optional(),
    organization: z.string().optional(),
    role: z.string().optional(),
    active: z.boolean(),
  })
  .strict()

const topicSchema = z
  .object({
    ...audited,
    parentType: z.enum(["Project", "Cluster"]),
    projectId: uuidSchema.optional(),
    clusterId: uuidSchema.optional(),
    code: z.string(),
    title: z.string(),
    context: z.string(),
    ownerActorId: uuidSchema.optional(),
    priority: z.enum(priorities),
    status: z.enum(topicStatuses),
    order: z.number().safe().int(),
    currentUpdateId: uuidSchema.optional(),
  })
  .strict()

const updateSchema = z
  .object({
    ...audited,
    objectType: z.enum(objectTypes),
    objectId: uuidSchema,
    meetingId: uuidSchema.optional(),
    type: z.enum(updateTypes),
    date: localDateSchema,
    authorActorId: uuidSchema,
    text: z.string(),
  })
  .strict()

const actionSchema = z
  .object({
    ...audited,
    objectType: z.enum(objectTypes),
    objectId: uuidSchema,
    sourceMeetingId: uuidSchema.optional(),
    code: z.string(),
    title: z.string(),
    description: z.string().optional(),
    ownerActorId: uuidSchema,
    deadline: localDateSchema.optional(),
    status: z.enum(actionStatuses),
    priority: z.enum(priorities),
    completedAt: localDateSchema.optional(),
  })
  .strict()

const actionHistorySchema = z
  .object({
    ...audited,
    actionId: uuidSchema,
    changedAt: dateTimeSchema,
    changedByActorId: uuidSchema,
    field: z.string(),
    previousValue: z.string().optional(),
    newValue: z.string().optional(),
    reason: z.string().optional(),
  })
  .strict()

const evidenceSchema = z
  .object({
    ...audited,
    objectType: z.enum(objectTypes),
    objectId: uuidSchema,
    type: z.string(),
    title: z.string(),
    description: z.string().optional(),
    urlOrReference: z.string().optional(),
    date: localDateSchema.optional(),
    authorActorId: uuidSchema.optional(),
  })
  .strict()

const planningSchema = z
  .object({
    ...audited,
    projectId: uuidSchema,
    topicId: uuidSchema.optional(),
    kind: z.enum(planningKinds),
    title: z.string(),
    startDate: localDateSchema.optional(),
    plannedEndDate: localDateSchema,
    actualEndDate: localDateSchema.optional(),
    progressPercent: z.number().min(0).max(100).optional(),
    status: z.enum(planningStatuses),
    isMilestone: z.boolean(),
    order: z.number().safe().int(),
  })
  .strict()

const planningDependencySchema = z
  .object({
    ...audited,
    predecessorPlanningId: uuidSchema,
    successorPlanningId: uuidSchema,
    type: z.literal("FinishToStart"),
  })
  .strict()

const budgetSchema = z
  .object({
    ...audited,
    projectId: uuidSchema,
    topicId: uuidSchema.optional(),
    category: z.string(),
    type: z.enum(budgetTypes),
    description: z.string(),
    amountCents: centsSchema,
    date: localDateSchema,
    status: z.enum(budgetStatuses),
    reference: z.string().optional(),
    supplierActorId: uuidSchema.optional(),
  })
  .strict()

const budgetMutationSchema = z
  .object({
    ...audited,
    budgetRecordId: uuidSchema,
    changeType: z.string(),
    deltaCents: z.number().safe().int().optional(),
    previousAmountCents: centsSchema.optional(),
    newAmountCents: centsSchema.optional(),
    reason: z.string(),
    date: localDateSchema,
    authorActorId: uuidSchema,
  })
  .strict()

const meetingSchema = z
  .object({
    ...audited,
    type: z.string(),
    scopeType: z.enum(meetingScopeTypes),
    scopeId: uuidSchema.optional(),
    number: z.string().optional(),
    title: z.string(),
    date: localDateSchema,
    chairActorId: uuidSchema.optional(),
    reporterActorId: uuidSchema.optional(),
    status: z.enum(meetingStatuses),
    nextMeetingDate: localDateSchema.optional(),
  })
  .strict()

const meetingParticipantSchema = z
  .object({
    ...audited,
    meetingId: uuidSchema,
    actorId: uuidSchema,
    role: z.string().optional(),
    attended: z.boolean(),
  })
  .strict()

const agendaItemSchema = z
  .object({
    ...audited,
    meetingId: uuidSchema,
    order: z.number().safe().int(),
    title: z.string(),
    reason: z.string().optional(),
    notes: z.string().optional(),
    objectType: z.enum(agendaObjectTypes).optional(),
    objectId: uuidSchema.optional(),
    discussionStatus: z.enum(agendaDiscussionStatuses),
  })
  .strict()

const reportSchema = z
  .object({
    ...audited,
    meetingId: uuidSchema,
    version: z.number().safe().int().positive(),
    status: z.enum(reportStatuses),
    draftDate: localDateSchema.optional(),
    finalDate: localDateSchema.optional(),
    authorActorId: uuidSchema,
    pdfReference: z.string().optional(),
  })
  .strict()

const reportItemSchema = z
  .object({
    ...audited,
    reportId: uuidSchema,
    order: z.number().safe().int(),
    section: z.string(),
    contentType: z.string(),
    objectType: z.enum(objectTypes).optional(),
    objectId: uuidSchema.optional(),
    titleSnapshot: z.string(),
    textSnapshot: z.string(),
  })
  .strict()

const configSchema = z
  .object({
    ...audited,
    schemaVersion: z.string(),
    dataSetId: uuidSchema,
    createdAt: dateTimeSchema,
    appVersion: z.string(),
    defaultCurrency: z.string(),
    currentActorId: uuidSchema.optional(),
  })
  .strict()

const choiceListSchema = z
  .object({
    ...audited,
    listKey: z.string(),
    valueKey: z.string(),
    label: z.string(),
    order: z.number().safe().int(),
    system: z.boolean(),
    active: z.boolean(),
  })
  .strict()

const logSchema = z
  .object({
    ...audited,
    level: z.enum(["Blocking", "Recoverable", "Warning", "Info"]),
    message: z.string(),
    objectType: z.enum(objectTypes).optional(),
    objectId: uuidSchema.optional(),
    occurredAt: dateTimeSchema,
  })
  .strict()

export const domainCollectionsSchema = z
  .object({
    chapters: z.array(chapterSchema),
    clusters: z.array(clusterSchema),
    projects: z.array(projectSchema),
    projectClusterHistory: z.array(projectClusterHistorySchema),
    actors: z.array(actorSchema),
    topics: z.array(topicSchema),
    updates: z.array(updateSchema),
    actions: z.array(actionSchema),
    actionHistory: z.array(actionHistorySchema),
    evidence: z.array(evidenceSchema),
    planning: z.array(planningSchema),
    planningDependencies: z.array(planningDependencySchema),
    budgets: z.array(budgetSchema),
    budgetMutations: z.array(budgetMutationSchema),
    meetings: z.array(meetingSchema),
    meetingParticipants: z.array(meetingParticipantSchema),
    agendaItems: z.array(agendaItemSchema),
    reports: z.array(reportSchema),
    reportItems: z.array(reportItemSchema),
    config: z.array(configSchema),
    choiceLists: z.array(choiceListSchema),
    log: z.array(logSchema),
  })
  .strict()

export const jsonDataEnvelopeSchema = z
  .object({
    format: z.literal(JSON_DATA_FORMAT),
    schemaVersion: z.literal(JSON_DATA_SCHEMA_VERSION),
    exportedAt: dateTimeSchema,
    appVersion: z.string(),
    dataSetId: uuidSchema,
    records: domainCollectionsSchema,
  })
  .strict()

export type JsonDataEnvelope = Omit<
  z.infer<typeof jsonDataEnvelopeSchema>,
  "records"
> & { records: DomainCollections }
