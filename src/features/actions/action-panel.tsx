import { useState, type KeyboardEvent } from "react"
import { flushSync } from "react-dom"
import {
  useForm,
  useWatch,
  type FieldPath,
  type FieldValues,
  type UseFormSetError,
} from "react-hook-form"
import {
  ActionManagementError,
  ActionManagementService,
  ProjectManagementError,
  ProjectManagementService,
  type ActionContextType,
} from "../../application/services"
import { useAppStore } from "../../app/state/app-store"
import { Button, SearchableSelect } from "../../design-system/components"
import { useEscapeKey } from "../../design-system/patterns"
import {
  actionStatuses,
  actorTypes,
  priorities,
  type Action,
  type Actor,
  type UUID,
} from "../../domain"
import {
  actorFormSchema,
  actorValuesToInput,
  type ActorFormValues,
} from "../projects/project-form-schema"
import {
  actionFormSchema,
  actionValuesToInput,
  actionValuesToUpdateInput,
  type ActionFormValues,
} from "./action-form-schema"
import "./actions.css"

const actionService = new ActionManagementService()
const projectService = new ProjectManagementService()

function applyZodErrors<T extends FieldValues>(
  issues: readonly { path: PropertyKey[]; message: string }[],
  setError: UseFormSetError<T>,
): void {
  for (const issue of issues) {
    const field = issue.path[0]
    if (typeof field === "string") {
      setError(field as FieldPath<T>, { message: issue.message })
    }
  }
}

function actionValues(action?: Action): ActionFormValues {
  return {
    title: action?.title ?? "",
    description: action?.description ?? "",
    ownerActorId: action?.ownerActorId ?? "",
    deadline: action?.deadline ?? "",
    status: action?.status ?? "Open",
    priority: action?.priority ?? "Normaal",
    completedAt: action?.completedAt ?? "",
  }
}

interface InlineActorFormProps {
  onBack: () => void
  onSaved: (actor: Actor) => void
}

function InlineActorForm({ onBack, onSaved }: InlineActorFormProps) {
  const replaceDomainState = useAppStore((state) => state.replaceDomainState)
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<ActorFormValues>({
    defaultValues: {
      displayName: "",
      type: "Intern",
      email: "",
      organization: "",
      role: "",
      active: true,
    },
  })

  const submit = handleSubmit((values) => {
    const parsed = actorFormSchema.safeParse(values)
    if (!parsed.success) {
      applyZodErrors(parsed.error.issues, setError)
      return
    }
    const state = useAppStore.getState().session?.state
    if (!state) return
    try {
      const result = projectService.createActor(
        state,
        actorValuesToInput(parsed.data),
      )
      flushSync(() => replaceDomainState(result.state))
      onSaved(result.record)
    } catch (error) {
      if (error instanceof ProjectManagementError) {
        for (const issue of error.issues) {
          setError(issue.field as FieldPath<ActorFormValues>, {
            message: issue.message,
          })
        }
      }
    }
  })

  return (
    <div className="action-panel__actor">
      <header>
        <div>
          <span>Actiecontext blijft bewaard</span>
          <h2 id="action-panel-title">Nieuwe actor</h2>
        </div>
        <Button variant="tertiary" onClick={onBack}>
          Terug
        </Button>
      </header>
      <p>
        De nieuwe actor wordt lokaal bewaard en meteen als eigenaar
        geselecteerd.
      </p>
      <form onSubmit={(event) => void submit(event)} noValidate>
        <label>
          <span>Naam</span>
          <input
            autoFocus
            {...register("displayName")}
            aria-invalid={Boolean(errors.displayName)}
          />
          {errors.displayName ? (
            <small role="alert">{errors.displayName.message}</small>
          ) : null}
        </label>
        <label>
          <span>Type</span>
          <select {...register("type")}>
            {actorTypes.map((type) => (
              <option key={type}>{type}</option>
            ))}
          </select>
        </label>
        <label>
          <span>E-mail</span>
          <input type="email" {...register("email")} />
          {errors.email ? (
            <small role="alert">{errors.email.message}</small>
          ) : null}
        </label>
        <label>
          <span>Organisatie</span>
          <input {...register("organization")} />
        </label>
        <label>
          <span>Rol</span>
          <input {...register("role")} />
        </label>
        <label className="action-panel__checkbox">
          <input type="checkbox" {...register("active")} />
          <span>Actieve actor</span>
        </label>
        <div className="action-panel__footer">
          <Button type="submit" disabled={isSubmitting}>
            Actor opslaan
          </Button>
          <Button variant="tertiary" onClick={onBack}>
            Annuleren
          </Button>
        </div>
      </form>
    </div>
  )
}

export interface ActionPanelProps {
  objectType?: ActionContextType
  objectId?: UUID
  actionId?: UUID
  sourceMeetingId?: UUID
  contextLabel: string
  onClose: () => void
  onSaved?: (action: Action) => void
}

export function ActionPanel({
  objectType,
  objectId,
  actionId,
  sourceMeetingId,
  contextLabel,
  onClose,
  onSaved,
}: ActionPanelProps) {
  const session = useAppStore((state) => state.session)
  const replaceDomainState = useAppStore((state) => state.replaceDomainState)
  const [actorMode, setActorMode] = useState(false)
  const action = actionId
    ? session?.state.indices.actionById.get(actionId)
    : undefined
  const activeActors =
    session?.state.records.actors.filter(
      (actor) => actor.active && actor.audit.active,
    ) ?? []
  const {
    register,
    handleSubmit,
    setError,
    setValue,
    control,
    formState: { errors, isSubmitting },
  } = useForm<ActionFormValues>({ defaultValues: actionValues(action) })
  const status = useWatch({ control, name: "status" })
  useEscapeKey(actorMode ? () => setActorMode(false) : onClose)

  if (!session || (actionId && !action)) return null

  const submit = handleSubmit((values) => {
    const parsed = actionFormSchema.safeParse(values)
    if (!parsed.success) {
      applyZodErrors(parsed.error.issues, setError)
      return
    }
    const state = useAppStore.getState().session?.state
    if (!state) return
    try {
      const result = action
        ? actionService.updateAction(
            state,
            action.id,
            actionValuesToUpdateInput(parsed.data),
          )
        : objectType && objectId
          ? actionService.createAction(
              state,
              actionValuesToInput(parsed.data, {
                objectType,
                objectId,
                ...(sourceMeetingId ? { sourceMeetingId } : {}),
              }),
            )
          : undefined
      if (!result) return
      flushSync(() => replaceDomainState(result.state))
      onSaved?.(result.record)
      onClose()
    } catch (error) {
      if (error instanceof ActionManagementError) {
        for (const issue of error.issues) {
          setError(issue.field as FieldPath<ActionFormValues>, {
            message: issue.message,
          })
        }
      }
    }
  })

  function shortcutSubmit(event: KeyboardEvent<HTMLFormElement>) {
    if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
      event.preventDefault()
      event.currentTarget.requestSubmit()
    }
  }

  return (
    <aside
      className="action-panel"
      role="dialog"
      aria-modal="false"
      aria-labelledby="action-panel-title"
    >
      {actorMode ? (
        <InlineActorForm
          onBack={() => setActorMode(false)}
          onSaved={(actor) => {
            setValue("ownerActorId", actor.id, {
              shouldDirty: true,
              shouldValidate: true,
            })
            setActorMode(false)
          }}
        />
      ) : (
        <>
          <header className="action-panel__header">
            <div>
              <span>{action ? action.code : "Nieuwe actie"}</span>
              <h2 id="action-panel-title">
                {action ? "Actie bewerken" : "Actie toevoegen"}
              </h2>
              <p>{contextLabel}</p>
            </div>
            <Button
              variant="tertiary"
              onClick={onClose}
              aria-label="Actiepaneel sluiten"
            >
              Sluiten
            </Button>
          </header>
          <form
            className="action-panel__form"
            onSubmit={(event) => void submit(event)}
            onKeyDown={shortcutSubmit}
            noValidate
          >
            <div className="action-panel__primary">
              <label>
                <span>Titel</span>
                <input
                  autoFocus
                  {...register("title")}
                  aria-invalid={Boolean(errors.title)}
                />
                {errors.title ? (
                  <small role="alert">{errors.title.message}</small>
                ) : null}
              </label>
              <SearchableSelect
                label="Eigenaar"
                emptyLabel="Kies een eigenaar"
                options={activeActors.map((actor) => ({
                  value: actor.id,
                  label: actor.displayName,
                }))}
                action={
                  <Button variant="tertiary" onClick={() => setActorMode(true)}>
                    + Nieuwe actor
                  </Button>
                }
                aria-invalid={Boolean(errors.ownerActorId)}
                error={
                  errors.ownerActorId ? (
                    <small role="alert">{errors.ownerActorId.message}</small>
                  ) : null
                }
                {...register("ownerActorId")}
              />
              <label>
                <span>
                  Deadline <em>optioneel</em>
                </span>
                <input type="date" {...register("deadline")} />
              </label>
            </div>

            <details className="action-panel__details" open={Boolean(action)}>
              <summary>Meer details</summary>
              <div>
                <label>
                  <span>Omschrijving</span>
                  <textarea rows={5} {...register("description")} />
                </label>
                <label>
                  <span>Status</span>
                  <select {...register("status")}>
                    {actionStatuses.map((value) => (
                      <option key={value}>{value}</option>
                    ))}
                  </select>
                </label>
                <label>
                  <span>Prioriteit</span>
                  <select {...register("priority")}>
                    {priorities.map((value) => (
                      <option key={value}>{value}</option>
                    ))}
                  </select>
                </label>
                {status === "Afgerond" ? (
                  <label>
                    <span>
                      Afronddatum <em>leeg = vandaag</em>
                    </span>
                    <input type="date" {...register("completedAt")} />
                  </label>
                ) : null}
              </div>
            </details>

            <div className="action-panel__footer">
              <small>Ctrl/Cmd + Enter om op te slaan · Esc om te sluiten</small>
              <Button type="submit" disabled={isSubmitting}>
                {action ? "Wijzigingen opslaan" : "Actie opslaan"}
              </Button>
              <Button variant="tertiary" onClick={onClose}>
                Annuleren
              </Button>
            </div>
          </form>
        </>
      )}
    </aside>
  )
}
