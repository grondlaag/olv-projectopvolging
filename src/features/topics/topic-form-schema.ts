import { z } from "zod"
import type { TopicInput } from "../../application/services"
import { priorities, type TopicParentType, type UUID } from "../../domain"
import { uuidSchema } from "../../validation"

const optionalUuid = z
  .string()
  .refine(
    (value) => !value || uuidSchema.safeParse(value).success,
    "Kies een geldige actor.",
  )

export const topicFormSchema = z.object({
  code: z.string().trim().min(1, "Topiccode is verplicht."),
  title: z.string().trim().min(1, "Titel is verplicht."),
  context: z.string().trim().min(1, "Vaste context is verplicht."),
  ownerActorId: optionalUuid,
  priority: z.enum(priorities),
})

export type TopicFormValues = z.input<typeof topicFormSchema>

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
