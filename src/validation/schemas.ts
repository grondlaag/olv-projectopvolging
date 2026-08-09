import { z } from "zod"
import {
  actionStatuses,
  budgetStatuses,
  budgetTypes,
  planningKinds,
  planningStatuses,
  priorities,
  projectStatuses,
  topicStatuses,
  validateActionCompletion,
  validateBudgetAmount,
  validatePlanningEntry,
  validateProject,
  validateTopicParent,
  type LocalDate,
  type UUID,
  type ValidationResult,
} from "../domain"

const localDatePattern = /^\d{4}-\d{2}-\d{2}$/

function isCalendarDate(value: string): boolean {
  if (!localDatePattern.test(value)) return false

  const [year, month, day] = value.split("-").map(Number)
  if (year === undefined || month === undefined || day === undefined)
    return false

  const date = new Date(Date.UTC(year, month - 1, day))
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  )
}

function addDomainIssues(
  issues: ValidationResult,
  context: z.RefinementCtx,
): void {
  for (const issue of issues) {
    context.addIssue({
      code: "custom",
      message: issue.message,
      path: [issue.field],
      params: { domainCode: issue.code },
    })
  }
}

export const uuidSchema = z.uuid().transform((value) => value as UUID)

export const newUuidSchema = z
  .string()
  .regex(
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    "Een nieuw record vereist een UUID v4.",
  )
  .transform((value) => value as UUID)

export const localDateSchema = z
  .string()
  .refine(isCalendarDate, "Gebruik een geldige datum als YYYY-MM-DD.")
  .transform((value) => value as LocalDate)

export const progressSchema = z.number().min(0).max(100)
export const centsSchema = z.number().safe().int().nonnegative()

export const projectBoundarySchema = z
  .object({
    chapterId: uuidSchema.optional(),
    clusterId: uuidSchema.optional(),
    progressPercent: progressSchema.optional(),
    status: z.enum(projectStatuses).optional(),
  })
  .strict()
  .superRefine((project, context) => {
    addDomainIssues(
      validateProject({
        chapterId: project.chapterId,
        progressPercent: project.progressPercent,
      }),
      context,
    )
  })

export const topicBoundarySchema = z
  .object({
    parentType: z.enum(["Project", "Cluster"]),
    projectId: uuidSchema.optional(),
    clusterId: uuidSchema.optional(),
    priority: z.enum(priorities).optional(),
    status: z.enum(topicStatuses).optional(),
  })
  .strict()
  .superRefine((topic, context) => {
    addDomainIssues(validateTopicParent(topic), context)
  })

export const actionBoundarySchema = z
  .object({
    status: z.enum(actionStatuses),
    completedAt: localDateSchema.optional(),
  })
  .strict()
  .superRefine((action, context) => {
    addDomainIssues(validateActionCompletion(action), context)
  })

export const planningBoundarySchema = z
  .object({
    kind: z.enum(planningKinds),
    startDate: localDateSchema.optional(),
    plannedEndDate: localDateSchema.optional(),
    progressPercent: progressSchema.optional(),
    status: z.enum(planningStatuses).optional(),
    isMilestone: z.boolean(),
  })
  .strict()
  .superRefine((entry, context) => {
    addDomainIssues(validatePlanningEntry(entry), context)
  })

export const budgetBoundarySchema = z
  .object({
    projectId: uuidSchema,
    topicId: uuidSchema.optional(),
    amountCents: centsSchema,
    type: z.enum(budgetTypes),
    status: z.enum(budgetStatuses),
    date: localDateSchema,
  })
  .strict()
  .superRefine((budget, context) => {
    addDomainIssues(validateBudgetAmount(budget.amountCents), context)
  })
