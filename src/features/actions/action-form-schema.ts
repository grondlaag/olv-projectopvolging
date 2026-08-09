import { z } from "zod"
import {
  actionStatuses,
  priorities,
  type ActionStatus,
  type LocalDate,
  type Priority,
  type UUID,
} from "../../domain"
import type { ActionInput, ActionUpdateInput } from "../../application/services"
import { localDateSchema, uuidSchema } from "../../validation"

const optionalDate = z
  .string()
  .refine(
    (value) => !value || localDateSchema.safeParse(value).success,
    "Gebruik een geldige datum.",
  )

export const actionFormSchema = z.object({
  title: z.string().trim().min(1, "Titel is verplicht."),
  description: z.string(),
  ownerActorId: z
    .string()
    .refine(
      (value) => uuidSchema.safeParse(value).success,
      "Eigenaar is verplicht.",
    ),
  deadline: optionalDate,
  status: z.enum(actionStatuses),
  priority: z.enum(priorities),
  completedAt: optionalDate,
})

export type ActionFormValues = z.input<typeof actionFormSchema>

export function actionValuesToInput(
  values: ActionFormValues,
  context: Pick<ActionInput, "objectType" | "objectId"> &
    Partial<Pick<ActionInput, "sourceMeetingId">>,
): ActionInput {
  return {
    ...context,
    title: values.title,
    ...(values.description ? { description: values.description } : {}),
    ownerActorId: values.ownerActorId as UUID,
    ...(values.deadline ? { deadline: values.deadline as LocalDate } : {}),
    status: values.status as ActionStatus,
    priority: values.priority as Priority,
    ...(values.completedAt
      ? { completedAt: values.completedAt as LocalDate }
      : {}),
  }
}

export function actionValuesToUpdateInput(
  values: ActionFormValues,
): ActionUpdateInput {
  return {
    title: values.title,
    ...(values.description ? { description: values.description } : {}),
    ownerActorId: values.ownerActorId as UUID,
    ...(values.deadline ? { deadline: values.deadline as LocalDate } : {}),
    status: values.status as ActionStatus,
    priority: values.priority as Priority,
    ...(values.completedAt
      ? { completedAt: values.completedAt as LocalDate }
      : {}),
  }
}
