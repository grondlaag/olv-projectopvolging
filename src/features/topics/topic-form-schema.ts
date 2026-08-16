import { z } from "zod"
import type {
  TopicInput,
  TopicJournalEntryInput,
} from "../../application/services"
import {
  priorities,
  type LocalDate,
  type TopicParentType,
  type UUID,
} from "../../domain"
import { localDateSchema, uuidSchema } from "../../validation"

const optionalUuid = z
  .string()
  .refine(
    (value) => !value || uuidSchema.safeParse(value).success,
    "Kies een geldige actor.",
  )

const requiredActorUuid = z
  .string()
  .refine(
    (value) => uuidSchema.safeParse(value).success,
    "Kies een actieve auteur.",
  )

export const topicFormSchema = z.object({
  code: z.string().trim().min(1, "Topiccode is verplicht."),
  title: z.string().trim().min(1, "Titel is verplicht."),
  context: z.string().trim().min(1, "Vaste context is verplicht."),
  ownerActorId: optionalUuid,
  priority: z.enum(priorities),
})

export type TopicFormValues = z.input<typeof topicFormSchema>

export const topicJournalFormSchema = z.object({
  authorActorId: requiredActorUuid,
  type: z.enum(["Update", "Notitie", "Overlegbijdrage", "Beslissing"]),
  date: z
    .string()
    .refine(
      (value) => localDateSchema.safeParse(value).success,
      "Gebruik een geldige datum.",
    ),
  text: z.string().trim().min(1, "Tekst is verplicht."),
  makeCurrent: z.boolean(),
})

export type TopicJournalFormValues = z.input<typeof topicJournalFormSchema>

export function topicValuesToInput(
  values: TopicFormValues,
  parentType: TopicParentType,
  parentId: UUID,
): TopicInput {
  return {
    parentType,
    ...(parentType === "Project"
      ? { projectId: parentId }
      : { clusterId: parentId }),
    code: values.code,
    title: values.title,
    context: values.context,
    ...(values.ownerActorId
      ? { ownerActorId: values.ownerActorId as UUID }
      : {}),
    priority: values.priority,
  }
}

export function journalValuesToInput(
  values: TopicJournalFormValues,
): TopicJournalEntryInput {
  return {
    authorActorId: values.authorActorId as UUID,
    type: values.type,
    date: values.date as LocalDate,
    text: values.text,
    ...(values.makeCurrent ? { makeCurrent: true } : {}),
  }
}
