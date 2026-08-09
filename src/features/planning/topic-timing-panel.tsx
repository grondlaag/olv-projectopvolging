import { useForm, useWatch, type FieldPath } from "react-hook-form"
import {
  PlanningManagementError,
  PlanningManagementService,
} from "../../application/services"
import { useAppStore } from "../../app/state/app-store"
import { Button } from "../../design-system/components"
import { useEscapeKey } from "../../design-system/patterns"
import { planningStatuses, type PlanningEntry, type Topic } from "../../domain"
import {
  timingFormSchema,
  timingValuesToInput,
  type TimingFormValues,
} from "./planning-form-schema"
import "./planning.css"

const planningService = new PlanningManagementService()

interface TopicTimingPanelProps {
  topic: Topic
  planning?: PlanningEntry
  onClose: () => void
  onSaved: (entry: PlanningEntry) => void
}

export function TopicTimingPanel({
  topic,
  planning,
  onClose,
  onSaved,
}: TopicTimingPanelProps) {
  useEscapeKey(onClose)
  const replaceDomainState = useAppStore((state) => state.replaceDomainState)
  const {
    register,
    handleSubmit,
    control,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<TimingFormValues>({
    defaultValues: {
      startDate: planning?.startDate ?? "",
      plannedEndDate: planning?.plannedEndDate ?? "",
      progressPercent: planning?.progressPercent ?? 0,
      status: planning?.status ?? "Niet gestart",
      isMilestone: planning?.isMilestone ?? false,
    },
  })
  const milestone = useWatch({ control, name: "isMilestone" })

  const submit = handleSubmit((values) => {
    const parsed = timingFormSchema.safeParse(values)
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        const field = issue.path[0]
        if (typeof field === "string") {
          setError(field as FieldPath<TimingFormValues>, {
            message: issue.message,
          })
        }
      }
      return
    }
    const state = useAppStore.getState().session?.state
    if (!state) return
    try {
      const result = planningService.saveTopicTiming(
        state,
        topic.id,
        timingValuesToInput(parsed.data),
      )
      replaceDomainState(result.state)
      onSaved(result.record)
    } catch (error) {
      if (!(error instanceof PlanningManagementError)) return
      for (const issue of error.issues) {
        const field = (
          issue.field === "topicId" ? "plannedEndDate" : issue.field
        ) as FieldPath<TimingFormValues>
        setError(field, { message: issue.message })
      }
    }
  })

  return (
    <aside
      className="planning-panel"
      role="dialog"
      aria-modal="false"
      aria-labelledby="timing-panel-title"
    >
      <header className="planning-panel__header">
        <div>
          <span>Topicplanning</span>
          <h2 id="timing-panel-title">
            {planning ? "Timing bewerken" : "Timing toevoegen"}
          </h2>
          <p>
            {topic.code} · {topic.title}
          </p>
        </div>
        <Button variant="tertiary" onClick={onClose}>
          Sluiten
        </Button>
      </header>
      <form
        className="planning-form"
        onSubmit={(event) => void submit(event)}
        noValidate
      >
        <section>
          <h3>Timing</h3>
          <label className="planning-form__check">
            <input type="checkbox" {...register("isMilestone")} />
            <span>Dit topicmoment is een mijlpaal zonder duur</span>
          </label>
          {!milestone ? (
            <label>
              <span>Startdatum</span>
              <input
                type="date"
                {...register("startDate")}
                aria-invalid={Boolean(errors.startDate)}
              />
              {errors.startDate ? (
                <small role="alert">{errors.startDate.message}</small>
              ) : null}
            </label>
          ) : null}
          <label>
            <span>{milestone ? "Mijlpaaldatum" : "Geplande einddatum"}</span>
            <input
              type="date"
              {...register("plannedEndDate")}
              aria-invalid={Boolean(errors.plannedEndDate)}
            />
            {errors.plannedEndDate ? (
              <small role="alert">{errors.plannedEndDate.message}</small>
            ) : null}
          </label>
        </section>
        <section>
          <h3>Opvolging</h3>
          <label htmlFor="topic-timing-progress">
            <span>Voortgang</span>
            <div className="planning-form__number">
              <input
                id="topic-timing-progress"
                aria-label="Voortgang"
                type="number"
                min="0"
                max="100"
                {...register("progressPercent", { valueAsNumber: true })}
                aria-invalid={Boolean(errors.progressPercent)}
              />
              <span>%</span>
            </div>
            {errors.progressPercent ? (
              <small role="alert">{errors.progressPercent.message}</small>
            ) : null}
          </label>
          <label>
            <span>Status</span>
            <select {...register("status")}>
              {planningStatuses.map((status) => (
                <option key={status}>{status}</option>
              ))}
            </select>
          </label>
          <p className="planning-form__hint">
            Een overschreden einddatum wordt als waarschuwing getoond. De status
            blijft altijd jouw expliciete keuze.
          </p>
        </section>
        <footer>
          <Button type="submit" disabled={isSubmitting}>
            Timing opslaan
          </Button>
          <Button variant="tertiary" onClick={onClose}>
            Annuleren
          </Button>
        </footer>
      </form>
    </aside>
  )
}
