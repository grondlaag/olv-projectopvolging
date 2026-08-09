import { z } from "zod"
import type {
  BudgetCorrectionInput,
  BudgetRecordInput,
} from "../../application/services"
import {
  budgetStatuses,
  budgetTypes,
  parseEuroAmountToCents,
  type BudgetStatus,
  type BudgetType,
  type LocalDate,
  type UUID,
} from "../../domain"
import { localDateSchema, uuidSchema } from "../../validation"

const optionalUuid = z
  .string()
  .refine(
    (value) => !value || uuidSchema.safeParse(value).success,
    "Kies een geldige waarde.",
  )

const euroAmount = z
  .string()
  .refine(
    (value) => parseEuroAmountToCents(value) !== undefined,
    "Gebruik een positief eurobedrag met maximaal twee decimalen.",
  )

export const budgetFormSchema = z.object({
  type: z.enum(budgetTypes),
  category: z.string().trim().min(1, "Categorie is verplicht."),
  description: z.string().trim().min(1, "Omschrijving is verplicht."),
  amount: euroAmount,
  date: z
    .string()
    .refine(
      (value) => localDateSchema.safeParse(value).success,
      "Gebruik een geldige datum.",
    ),
  status: z.enum(budgetStatuses),
  reference: z.string(),
  supplierActorId: optionalUuid,
  topicId: optionalUuid,
})

export type BudgetFormValues = z.input<typeof budgetFormSchema>

export const budgetCorrectionFormSchema = z.object({
  amount: euroAmount,
  reason: z.string().trim().min(1, "Leg vast waarom dit een foutcorrectie is."),
})

export type BudgetCorrectionFormValues = z.input<
  typeof budgetCorrectionFormSchema
>

export function budgetValuesToInput(
  values: BudgetFormValues,
  projectId: UUID,
): BudgetRecordInput {
  return {
    projectId,
    ...(values.topicId ? { topicId: values.topicId as UUID } : {}),
    category: values.category,
    type: values.type as BudgetType,
    description: values.description,
    amountCents: parseEuroAmountToCents(values.amount)!,
    date: values.date as LocalDate,
    status: values.status as BudgetStatus,
    ...(values.reference ? { reference: values.reference } : {}),
    ...(values.supplierActorId
      ? { supplierActorId: values.supplierActorId as UUID }
      : {}),
  }
}

export function budgetCorrectionValuesToInput(
  values: BudgetCorrectionFormValues,
): BudgetCorrectionInput {
  return {
    newAmountCents: parseEuroAmountToCents(values.amount)!,
    reason: values.reason,
  }
}
