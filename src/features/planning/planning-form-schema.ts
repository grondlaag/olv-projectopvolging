import { z } from "zod"
import {
  planningStatuses,
  type LocalDate,
  type PlanningStatus,
  type UUID,
} from "../../domain"

const datePattern = /^\d{4}-\d{2}-\d{2}$/

export const timingFormSchema = z
  .object({
    startDate: z.string(),
    plannedEndDate: z
      .string()
      .regex(datePattern, "Kies een geldige eind- of mijlpaaldatum."),
    progressPercent: z
      .number()
      .min(0, "Voortgang is minimaal 0%.")
      .max(100, "Voortgang is maximaal 100%."),
    status: z.enum(planningStatuses),
    isMilestone: z.boolean(),
  })
  .superRefine((value, context) => {
    if (!value.isMilestone && !datePattern.test(value.startDate)) {
      context.addIssue({
        code: "custom",
        path: ["startDate"],
        message: "Een periode vereist een geldige startdatum.",
      })
    }
    if (
      !value.isMilestone &&
      datePattern.test(value.startDate) &&
      value.plannedEndDate < value.startDate
    ) {
      context.addIssue({
        code: "custom",
        path: ["plannedEndDate"],
        message: "De einddatum mag niet vóór de startdatum liggen.",
      })
    }
    if (
      value.isMilestone &&
      value.progressPercent !== 0 &&
      value.progressPercent !== 100
    ) {
      context.addIssue({
        code: "custom",
        path: ["progressPercent"],
        message: "De voortgang van een mijlpaal is 0 of 100%.",
      })
    }
  })

export type TimingFormValues = z.infer<typeof timingFormSchema>
export type ValidTimingFormValues = TimingFormValues

export interface PlanningEntryFormValues extends TimingFormValues {
  title: string
  kind: "Milestone" | "Custom"
}

export const planningEntryFormSchema = timingFormSchema.and(
  z.object({
    title: z.string().trim().min(1, "Titel is verplicht."),
    kind: z.enum(["Milestone", "Custom"]),
  }),
)

export function timingValuesToInput(values: ValidTimingFormValues) {
  return {
    ...(!values.isMilestone
      ? { startDate: values.startDate as LocalDate }
      : {}),
    plannedEndDate: values.plannedEndDate as LocalDate,
    progressPercent: values.progressPercent,
    status: values.status as PlanningStatus,
    isMilestone: values.isMilestone,
  }
}

export const dependencyFormSchema = z
  .object({
    predecessorPlanningId: z.string().min(1, "Kies een voorganger."),
    successorPlanningId: z.string().min(1, "Kies een opvolger."),
  })
  .superRefine((value, context) => {
    if (
      value.predecessorPlanningId &&
      value.predecessorPlanningId === value.successorPlanningId
    ) {
      context.addIssue({
        code: "custom",
        path: ["successorPlanningId"],
        message: "Een planningitem kan niet van zichzelf afhangen.",
      })
    }
  })

export type DependencyFormValues = z.input<typeof dependencyFormSchema>

export function dependencyValuesToInput(values: DependencyFormValues) {
  return {
    predecessorPlanningId: values.predecessorPlanningId as UUID,
    successorPlanningId: values.successorPlanningId as UUID,
  }
}
