import { z } from "zod"
import { actorTypes, type UUID } from "../../domain"
import { uuidSchema } from "../../validation"
import type {
  ActorSettingsInput,
  ChapterSettingsInput,
  ChoiceListSettingsInput,
  ClusterSettingsInput,
  GeneralSettingsInput,
} from "../../application/services"

export const configurableChoiceLists = [
  { key: "project-phase", label: "Projectfase" },
  { key: "site", label: "Site" },
  { key: "location", label: "Locatie" },
  { key: "department", label: "Afdeling" },
  { key: "budget-category", label: "Budgetcategorie" },
  { key: "meeting-type", label: "Overlegtype" },
] as const

const choiceListKeys = configurableChoiceLists.map((item) => item.key) as [
  (typeof configurableChoiceLists)[number]["key"],
  ...(typeof configurableChoiceLists)[number]["key"][],
]

export const chapterSettingsSchema = z.object({
  code: z.string().trim().min(1, "Hoofdstukcode is verplicht."),
  title: z.string().trim().min(1, "Hoofdstuktitel is verplicht."),
  active: z.boolean(),
})

export const clusterSettingsSchema = z.object({
  chapterId: z
    .string()
    .refine(
      (value) => uuidSchema.safeParse(value).success,
      "Hoofdstuk is verplicht.",
    ),
  code: z.string().trim().min(1, "Clustercode is verplicht."),
  title: z.string().trim().min(1, "Clusternaam is verplicht."),
  description: z.string(),
  active: z.boolean(),
})

export const actorSettingsSchema = z.object({
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

export const choiceSettingsSchema = z.object({
  listKey: z.enum(choiceListKeys),
  valueKey: z
    .string()
    .trim()
    .min(1, "Technische sleutel is verplicht.")
    .regex(
      /^[a-z0-9][a-z0-9-]*$/u,
      "Gebruik kleine letters, cijfers en koppeltekens.",
    ),
  label: z.string().trim().min(1, "Label is verplicht."),
  active: z.boolean(),
})

export const generalSettingsSchema = z.object({
  defaultCurrency: z
    .string()
    .trim()
    .regex(/^[A-Za-z]{3}$/u, "Gebruik een ISO-valutacode van drie letters."),
  currentActorId: z
    .string()
    .refine(
      (value) => !value || uuidSchema.safeParse(value).success,
      "Kies een geldige actor.",
    ),
})

export type ChapterSettingsValues = z.input<typeof chapterSettingsSchema>
export type ClusterSettingsValues = z.input<typeof clusterSettingsSchema>
export type ActorSettingsValues = z.input<typeof actorSettingsSchema>
export type ChoiceSettingsValues = z.input<typeof choiceSettingsSchema>
export type GeneralSettingsValues = z.input<typeof generalSettingsSchema>

export function chapterSettingsInput(
  values: ChapterSettingsValues,
): ChapterSettingsInput {
  return values
}

export function clusterSettingsInput(
  values: ClusterSettingsValues,
): ClusterSettingsInput {
  return { ...values, chapterId: values.chapterId as UUID }
}

export function actorSettingsInput(
  values: ActorSettingsValues,
): ActorSettingsInput {
  return values
}

export function choiceSettingsInput(
  values: ChoiceSettingsValues,
): ChoiceListSettingsInput {
  return values
}

export function generalSettingsInput(
  values: GeneralSettingsValues,
): GeneralSettingsInput {
  return {
    defaultCurrency: values.defaultCurrency,
    ...(values.currentActorId
      ? { currentActorId: values.currentActorId as UUID }
      : {}),
  }
}
