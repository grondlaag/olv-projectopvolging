import { z } from "zod"
import {
  actorTypes,
  projectStatuses,
  type ActorType,
  type LocalDate,
  type ProjectStatus,
  type UUID,
} from "../../domain"
import { localDateSchema, uuidSchema } from "../../validation"
import type {
  ActorInput,
  ClusterInput,
  ProjectInput,
} from "../../application/services"

const optionalDate = z
  .string()
  .refine(
    (value) => !value || localDateSchema.safeParse(value).success,
    "Gebruik een geldige datum.",
  )

const optionalUuid = z
  .string()
  .refine(
    (value) => !value || uuidSchema.safeParse(value).success,
    "Kies een geldige waarde.",
  )

export const projectFormSchema = z
  .object({
    code: z.string().trim().min(1, "Projectcode is verplicht."),
    title: z.string().trim().min(1, "Titel is verplicht."),
    description: z.string(),
    chapterId: z
      .string()
      .refine(
        (value) => uuidSchema.safeParse(value).success,
        "Hoofdstuk is verplicht.",
      ),
    clusterId: optionalUuid,
    status: z.enum(projectStatuses),
    phase: z.string(),
    site: z.string(),
    location: z.string(),
    department: z.string(),
    coordinatorActorId: optionalUuid,
    startDate: optionalDate,
    plannedEndDate: optionalDate,
    actualEndDate: optionalDate,
    progressPercent: z.string().refine((value) => {
      if (!value) return true
      const progress = Number(value)
      return Number.isFinite(progress) && progress >= 0 && progress <= 100
    }, "Voortgang moet tussen 0 en 100 liggen."),
    documentsUrl: z
      .string()
      .refine(
        (value) => !value || z.url().safeParse(value).success,
        "Gebruik een volledige geldige URL.",
      ),
  })
  .superRefine((value, context) => {
    if (
      value.startDate &&
      value.plannedEndDate &&
      value.plannedEndDate < value.startDate
    ) {
      context.addIssue({
        code: "custom",
        path: ["plannedEndDate"],
        message: "De geplande einddatum mag niet vóór de startdatum liggen.",
      })
    }
  })

export type ProjectFormValues = z.input<typeof projectFormSchema>

export const clusterFormSchema = z.object({
  code: z.string().trim().min(1, "Clustercode is verplicht."),
  title: z.string().trim().min(1, "Clusternaam is verplicht."),
  description: z.string(),
})

export type ClusterFormValues = z.input<typeof clusterFormSchema>

export const actorFormSchema = z.object({
  displayName: z.string().trim().min(1, "Naam is verplicht."),
  type: z.enum(actorTypes),
  email: z
    .string()
    .refine(
      (value) => !value || z.email().safeParse(value).success,
      "Gebruik een geldig e-mailadres.",
    ),
  organization: z.string(),
  role: z.string(),
  active: z.boolean(),
})

export type ActorFormValues = z.input<typeof actorFormSchema>

export function projectValuesToInput(values: ProjectFormValues): ProjectInput {
  return {
    code: values.code,
    title: values.title,
    description: values.description,
    chapterId: values.chapterId as UUID,
    ...(values.clusterId ? { clusterId: values.clusterId as UUID } : {}),
    status: values.status as ProjectStatus,
    phase: values.phase,
    ...(values.site ? { site: values.site } : {}),
    ...(values.location ? { location: values.location } : {}),
    ...(values.department ? { department: values.department } : {}),
    ...(values.coordinatorActorId
      ? { coordinatorActorId: values.coordinatorActorId as UUID }
      : {}),
    ...(values.startDate ? { startDate: values.startDate as LocalDate } : {}),
    ...(values.plannedEndDate
      ? { plannedEndDate: values.plannedEndDate as LocalDate }
      : {}),
    ...(values.actualEndDate
      ? { actualEndDate: values.actualEndDate as LocalDate }
      : {}),
    ...(values.progressPercent
      ? { progressPercent: Number(values.progressPercent) }
      : {}),
    ...(values.documentsUrl ? { documentsUrl: values.documentsUrl } : {}),
  }
}

export function clusterValuesToInput(
  values: ClusterFormValues,
  chapterId: UUID,
): ClusterInput {
  return { ...values, chapterId }
}

export function actorValuesToInput(values: ActorFormValues): ActorInput {
  return { ...values, type: values.type as ActorType }
}
