import { z } from "zod"
import type { AgendaItemInput, MeetingInput } from "../../application/services"
import {
  agendaDiscussionStatuses,
  agendaObjectTypes,
  meetingScopeTypes,
  type AgendaObjectType,
  type LocalDate,
  type UUID,
} from "../../domain"
import { localDateSchema, uuidSchema } from "../../validation"

const optionalUuid = z
  .string()
  .refine(
    (value) => !value || uuidSchema.safeParse(value).success,
    "Kies een geldig record.",
  )

const optionalDate = z
  .string()
  .refine(
    (value) => !value || localDateSchema.safeParse(value).success,
    "Gebruik een geldige datum.",
  )

export const meetingFormSchema = z
  .object({
    type: z.string().trim().min(1, "Overlegtype is verplicht."),
    scopeType: z.enum(meetingScopeTypes),
    scopeId: optionalUuid,
    number: z.string(),
    title: z.string().trim().min(1, "Titel is verplicht."),
    date: z
      .string()
      .refine(
        (value) => localDateSchema.safeParse(value).success,
        "Datum is verplicht.",
      ),
    chairActorId: optionalUuid,
    reporterActorId: optionalUuid,
    nextMeetingDate: optionalDate,
    participantActorIds: z.array(z.string()),
  })
  .superRefine((values, context) => {
    if (values.scopeType === "Portfolio" && values.scopeId) {
      context.addIssue({
        code: "custom",
        path: ["scopeId"],
        message: "Een portfolio-overleg heeft geen scope-ID.",
      })
    }
    if (values.scopeType !== "Portfolio" && !values.scopeId) {
      context.addIssue({
        code: "custom",
        path: ["scopeId"],
        message: "Kies een scope.",
      })
    }
  })

export type MeetingFormValues = z.input<typeof meetingFormSchema>

export function meetingValuesToInput(values: MeetingFormValues): MeetingInput {
  return {
    type: values.type,
    scopeType: values.scopeType,
    ...(values.scopeId ? { scopeId: values.scopeId as UUID } : {}),
    ...(values.number ? { number: values.number } : {}),
    title: values.title,
    date: values.date as LocalDate,
    ...(values.chairActorId
      ? { chairActorId: values.chairActorId as UUID }
      : {}),
    ...(values.reporterActorId
      ? { reporterActorId: values.reporterActorId as UUID }
      : {}),
    status: "Concept",
    ...(values.nextMeetingDate
      ? { nextMeetingDate: values.nextMeetingDate as LocalDate }
      : {}),
    participants: values.participantActorIds.map((actorId) => ({
      actorId: actorId as UUID,
      attended: false,
    })),
  }
}

export const agendaItemFormSchema = z
  .object({
    title: z.string().trim().min(1, "Titel is verplicht."),
    reason: z.string(),
    notes: z.string(),
    discussionStatus: z.enum(agendaDiscussionStatuses),
    objectType: z.union([z.literal(""), z.enum(agendaObjectTypes)]),
    objectId: optionalUuid,
  })
  .superRefine((values, context) => {
    if (Boolean(values.objectType) !== Boolean(values.objectId)) {
      context.addIssue({
        code: "custom",
        path: ["objectId"],
        message: "Kies een bronrecord of maak het agendapunt vrij.",
      })
    }
  })

export type AgendaItemFormValues = z.input<typeof agendaItemFormSchema>

export function agendaValuesToInput(
  values: AgendaItemFormValues,
): AgendaItemInput {
  return {
    title: values.title,
    ...(values.reason ? { reason: values.reason } : {}),
    ...(values.notes ? { notes: values.notes } : {}),
    discussionStatus: values.discussionStatus,
    ...(values.objectType
      ? { objectType: values.objectType as AgendaObjectType }
      : {}),
    ...(values.objectId ? { objectId: values.objectId as UUID } : {}),
  }
}

export const meetingContributionSchema = z.object({
  type: z.enum(["Update", "Beslissing"]),
  date: z
    .string()
    .refine(
      (value) => localDateSchema.safeParse(value).success,
      "Datum is verplicht.",
    ),
  text: z.string().trim().min(1, "Tekst is verplicht."),
  makeCurrent: z.boolean(),
})

export type MeetingContributionValues = z.input<
  typeof meetingContributionSchema
>
