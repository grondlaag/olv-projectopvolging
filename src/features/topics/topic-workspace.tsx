import { useDeferredValue, useMemo, useState, type ReactNode } from "react"
import { useForm, type FieldPath, type UseFormSetError } from "react-hook-form"
import { Link, useNavigate, useSearchParams } from "react-router-dom"
import {
  buildAgendaSchedulingModel,
  buildTopicJournal,
  buildTopicListItems,
  defaultTopicFilters,
  filterTopicListItems,
  type TopicFilters,
} from "../../application/queries"
import {
  TopicManagementError,
  TopicManagementService,
} from "../../application/services"
import { useAppStore } from "../../app/state/app-store"
import {
  Badge,
  Button,
  EmptyState,
  FavoriteButton,
  SearchableSelect,
} from "../../design-system/components"
import { useEscapeKey } from "../../design-system/patterns"
import {
  buildBudgetLedgerSummary,
  formatEuroCents,
  priorities,
  topicStatuses,
  type Topic,
  type TopicParentType,
  type TopicStatus,
  type UUID,
} from "../../domain"
import { formatLocalDate, todayAsLocalDate } from "../../utils"
import { ActionContextSection } from "../actions/action-sections"
import { TopicTimingPanel } from "../planning/topic-timing-panel"
import { InlineActorPanel } from "../projects/project-form-page"
import { AgendaSchedulePanel } from "../meetings/agenda-schedule-panel"
import {
  ConversationComposer,
  ConversationFeed,
} from "../journal/conversation-composer"
import {
  topicFormSchema,
  topicValuesToInput,
  type TopicFormValues,
} from "./topic-form-schema"
import "./topic-workspace.css"

const topicService = new TopicManagementService()

interface TopicWorkspaceProps {
  parentType: TopicParentType
  parentId: UUID
  basePath: string
  selectedTopicId?: UUID
}

function applyIssues<T extends Record<string, unknown>>(
  issues: readonly { path: PropertyKey[]; message: string }[],
  setError: UseFormSetError<T>,
): void {
  for (const issue of issues) {
    const field = issue.path[0]
    if (typeof field !== "string") continue
    setError(field as FieldPath<T>, { message: issue.message })
  }
}

function topicTone(topic: Topic): "success" | "danger" | "info" {
  return topic.status === "Afgesloten"
    ? "success"
    : topic.status === "Geannuleerd"
      ? "danger"
      : "info"
}

function priorityTone(
  priority: Topic["priority"],
): "neutral" | "warning" | "danger" {
  return priority === "Kritiek"
    ? "danger"
    : priority === "Hoog"
      ? "warning"
      : "neutral"
}

interface PanelProps {
  eyebrow?: string
  title: string
  description: string
  onClose: () => void
  children: ReactNode
}

function TopicPanel({
  eyebrow = "In context toevoegen",
  title,
  description,
  onClose,
  children,
}: PanelProps) {
  useEscapeKey(onClose)
  return (
    <aside
      className="topic-panel"
      role="dialog"
      aria-modal="false"
      aria-labelledby="topic-panel-title"
    >
      <header>
        <div>
          <span>{eyebrow}</span>
          <h2 id="topic-panel-title">{title}</h2>
          <p>{description}</p>
        </div>
        <Button
          variant="tertiary"
          onClick={onClose}
          aria-label="Paneel sluiten"
        >
          Sluiten
        </Button>
      </header>
      {children}
    </aside>
  )
}

export interface NewTopicPanelProps {
  parentType: TopicParentType
  parentId: UUID
  topic?: Topic
  onClose: () => void
  onSaved: (topic: Topic) => void
}

export function NewTopicPanel({
  parentType,
  parentId,
  topic,
  onClose,
  onSaved,
}: NewTopicPanelProps) {
  const session = useAppStore((state) => state.session)
  const replaceDomainState = useAppStore((state) => state.replaceDomainState)
  const [actorMode, setActorMode] = useState(false)
  const {
    register,
    handleSubmit,
    setError,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<TopicFormValues>({
    defaultValues: topic
      ? {
          code: topic.code,
          title: topic.title,
          context: topic.context,
          ownerActorId: topic.ownerActorId ?? "",
          priority: topic.priority,
        }
      : {
          code: `TOP-${String(
            (session?.state.records.topics.filter((item) =>
              parentType === "Project"
                ? item.projectId === parentId
                : item.clusterId === parentId,
            ).length ?? 0) + 1,
          ).padStart(3, "0")}`,
          title: "",
          context: "",
          ownerActorId: "",
          priority: "Normaal",
        },
  })

  const activeActors = useMemo(
    () =>
      session?.state.records.actors
        .filter((actor) => actor.active && actor.audit.active)
        .sort((left, right) =>
          left.displayName.localeCompare(right.displayName, "nl"),
        ) ?? [],
    [session],
  )

  const submit = handleSubmit((values) => {
    const parsed = topicFormSchema.safeParse(values)
    if (!parsed.success) {
      applyIssues<TopicFormValues>(parsed.error.issues, setError)
      return
    }
    const latestState = useAppStore.getState().session?.state
    if (!latestState) return
    try {
      const input = topicValuesToInput(parsed.data, parentType, parentId)
      const result = topic
        ? topicService.updateTopic(latestState, topic.id, input)
        : topicService.createTopic(latestState, input)
      replaceDomainState(result.state)
      onSaved(result.record)
    } catch (error) {
      if (!(error instanceof TopicManagementError)) return
      for (const issue of error.issues) {
        const field = issue.field === "ownerActorId" ? issue.field : "title"
        setError(field, { message: issue.message })
      }
    }
  })

  if (actorMode) {
    return (
      <InlineActorPanel
        onClose={() => setActorMode(false)}
        onSaved={(actor) => {
          setValue("ownerActorId", actor.id, {
            shouldDirty: true,
            shouldValidate: true,
          })
          setActorMode(false)
        }}
        contextLabel={topic ? "Vanuit topicbewerking" : "Vanuit nieuw topic"}
        selectionDescription="De nieuwe actor wordt meteen als topic-eigenaar geselecteerd."
      />
    )
  }

  return (
    <TopicPanel
      eyebrow={topic ? "Topicgegevens" : "In context toevoegen"}
      title={topic ? "Topic bewerken" : "Nieuw topic"}
      description={
        topic
          ? "De broncontext en bestaande historiek blijven behouden."
          : `De ${parentType === "Project" ? "project" : "cluster"}context blijft geselecteerd.`
      }
      onClose={onClose}
    >
      <form
        className="topic-panel__form"
        onSubmit={(event) => void submit(event)}
        noValidate
      >
        <label>
          <span>Titel</span>
          <input {...register("title")} aria-invalid={Boolean(errors.title)} />
          {errors.title ? (
            <small role="alert">{errors.title.message}</small>
          ) : null}
        </label>
        <label>
          <span>Vaste context</span>
          <textarea
            rows={5}
            {...register("context")}
            aria-invalid={Boolean(errors.context)}
          />
          {errors.context ? (
            <small role="alert">{errors.context.message}</small>
          ) : null}
        </label>
        <SearchableSelect
          label="Eigenaar"
          emptyLabel="Nog niet toegewezen"
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
          <span>Prioriteit</span>
          <select {...register("priority")}>
            {priorities.map((priority) => (
              <option key={priority}>{priority}</option>
            ))}
          </select>
        </label>
        <details className="topic-panel__details">
          <summary>Meer opties</summary>
          <label>
            <span>Topiccode</span>
            <input {...register("code")} aria-invalid={Boolean(errors.code)} />
            {errors.code ? (
              <small role="alert">{errors.code.message}</small>
            ) : null}
          </label>
          <p>
            Status staat bij aanmaak op Open. Volgorde en auditgegevens worden
            automatisch beheerd.
          </p>
        </details>
        <footer>
          <Button type="submit" disabled={isSubmitting}>
            {topic ? "Wijzigingen opslaan" : "Topic opslaan"}
          </Button>
          <Button variant="tertiary" onClick={onClose}>
            Annuleren
          </Button>
        </footer>
      </form>
    </TopicPanel>
  )
}

export function TopicWorkspace({
  parentType,
  parentId,
  basePath,
  selectedTopicId,
}: TopicWorkspaceProps) {
  const navigate = useNavigate()
  const [searchParameters, setSearchParameters] = useSearchParams()
  const session = useAppStore((state) => state.session)
  const replaceDomainState = useAppStore((state) => state.replaceDomainState)
  const [filters, setFilters] = useState<TopicFilters>(defaultTopicFilters)
  const [selectedPanel, setPanel] = useState<
    "new" | "edit" | "timing" | "meeting"
  >()
  const panel = searchParameters.get("nieuw") === "1" ? "new" : selectedPanel
  const [statusMessage, setStatusMessage] = useState("")
  const deferredSearch = useDeferredValue(filters.search)

  const items = useMemo(
    () =>
      session ? buildTopicListItems(session.state, parentType, parentId) : [],
    [parentId, parentType, session],
  )
  const filteredItems = useMemo(
    () => filterTopicListItems(items, { ...filters, search: deferredSearch }),
    [deferredSearch, filters, items],
  )
  const selected =
    items.find((item) => item.topic.id === selectedTopicId) ?? filteredItems[0]
  const journal = useMemo(
    () =>
      session && selected
        ? buildTopicJournal(session.state, selected.topic.id)
        : [],
    [selected, session],
  )
  const budgetRecords = useMemo(
    () =>
      session && selected
        ? (session.state.indices.budgetByTopic.get(selected.topic.id) ?? [])
        : [],
    [selected, session],
  )
  const budgetSummary = useMemo(
    () => buildBudgetLedgerSummary(budgetRecords),
    [budgetRecords],
  )
  const agendaScheduling = useMemo(
    () =>
      session && selected
        ? buildAgendaSchedulingModel(
            session.state,
            "Topic",
            selected.topic.id,
            todayAsLocalDate(),
          )
        : undefined,
    [selected, session],
  )
  const ownerOptions = useMemo(
    () =>
      [
        ...new Map(
          items.flatMap((item) =>
            item.owner ? [[item.owner.id, item.owner]] : [],
          ),
        ).values(),
      ].sort((left, right) =>
        left.displayName.localeCompare(right.displayName, "nl"),
      ),
    [items],
  )

  if (!session) return null

  function openNewTopic() {
    const next = new URLSearchParams(searchParameters)
    next.set("nieuw", "1")
    setSearchParameters(next, { replace: true })
    setPanel("new")
  }

  function closeTopicPanel() {
    setPanel(undefined)
    if (searchParameters.has("nieuw")) {
      const next = new URLSearchParams(searchParameters)
      next.delete("nieuw")
      setSearchParameters(next, { replace: true })
    }
  }

  function selectTopic(topic: Topic) {
    setPanel(undefined)
    navigate(`${basePath}/topics/${topic.id}`)
  }

  function changeStatus(status: TopicStatus) {
    if (!selected) return
    try {
      const latestState = useAppStore.getState().session?.state
      if (!latestState) return
      const result = topicService.setTopicStatus(
        latestState,
        selected.topic.id,
        status,
      )
      replaceDomainState(result.state)
      setStatusMessage(
        status === "Open"
          ? "Topic heropend in de lokale sessie · back-up nodig"
          : `Topic ${status.toLocaleLowerCase("nl")} in de lokale sessie · back-up nodig`,
      )
    } catch (error) {
      setStatusMessage(
        error instanceof Error ? error.message : "Status wijzigen is mislukt.",
      )
    }
  }

  function archiveSelectedTopic() {
    if (
      !selected ||
      !window.confirm(
        "Dit topic verwijderen? Updates, beslissingen en acties blijven als historie bewaard.",
      )
    )
      return
    try {
      const latestState = useAppStore.getState().session?.state
      if (!latestState) return
      const result = topicService.archiveTopic(latestState, selected.topic.id)
      replaceDomainState(result.state)
      setStatusMessage(
        "Topic verwijderd; gekoppelde historie blijft bewaard · back-up nodig",
      )
      setPanel(undefined)
      navigate(parentType === "Project" ? `${basePath}/topics` : basePath)
    } catch (error) {
      setStatusMessage(
        error instanceof Error
          ? error.message
          : "Topic verwijderen is mislukt.",
      )
    }
  }

  return (
    <section
      className={`topic-workspace ${panel === "new" || panel === "edit" || panel === "timing" ? "topic-workspace--panel" : ""}`}
    >
      <div className="topic-workspace__body">
        <aside className="topic-list" aria-label="Topics">
          <header>
            <div>
              <span>
                {parentType === "Project" ? "Projecttopics" : "Clustertopics"}
              </span>
              <strong>{items.length}</strong>
            </div>
            <Button onClick={openNewTopic}>+ Nieuw topic</Button>
          </header>
          <div className="topic-list__filters">
            <label>
              <span>Zoeken</span>
              <input
                type="search"
                value={filters.search}
                placeholder="Code, titel of context"
                onChange={(event) =>
                  setFilters((current) => ({
                    ...current,
                    search: event.target.value,
                  }))
                }
              />
            </label>
            <div>
              <label>
                <span>Status</span>
                <select
                  value={filters.status}
                  onChange={(event) =>
                    setFilters((current) => ({
                      ...current,
                      status: event.target.value as TopicFilters["status"],
                    }))
                  }
                >
                  <option value="">Alle</option>
                  {topicStatuses.map((status) => (
                    <option key={status}>{status}</option>
                  ))}
                </select>
              </label>
              <label>
                <span>Prioriteit</span>
                <select
                  value={filters.priority}
                  onChange={(event) =>
                    setFilters((current) => ({
                      ...current,
                      priority: event.target.value as TopicFilters["priority"],
                    }))
                  }
                >
                  <option value="">Alle</option>
                  {priorities.map((priority) => (
                    <option key={priority}>{priority}</option>
                  ))}
                </select>
              </label>
            </div>
            <label>
              <span>Eigenaar</span>
              <select
                value={filters.ownerActorId}
                onChange={(event) =>
                  setFilters((current) => ({
                    ...current,
                    ownerActorId: event.target.value,
                  }))
                }
              >
                <option value="">Alle</option>
                {ownerOptions.map((owner) => (
                  <option key={owner.id} value={owner.id}>
                    {owner.displayName}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="topic-list__records">
            {filteredItems.length ? (
              filteredItems.map((item) => (
                <button
                  key={item.topic.id}
                  className={
                    item.topic.id === selected?.topic.id
                      ? "topic-list__record topic-list__record--selected"
                      : "topic-list__record"
                  }
                  onClick={() => selectTopic(item.topic)}
                  aria-label={`${item.topic.code} ${item.topic.title} openen`}
                >
                  <span className="topic-list__record-title">
                    <small>{item.topic.code}</small>
                    <strong>{item.topic.title}</strong>
                  </span>
                  <span className="topic-list__badges">
                    <Badge tone={topicTone(item.topic)}>
                      {item.topic.status}
                    </Badge>
                    <Badge tone={priorityTone(item.topic.priority)}>
                      {item.topic.priority}
                    </Badge>
                  </span>
                  <span className="topic-list__owner">
                    {item.owner?.displayName ?? "Niet toegewezen"}
                  </span>
                  <span className="topic-list__current">
                    {item.currentUpdate?.text ?? "Nog geen actuele stand"}
                  </span>
                  <span className="topic-list__meta">
                    <small>
                      {item.planning
                        ? `Timing · ${formatLocalDate(item.planning.plannedEndDate)}`
                        : "Geen timing"}
                    </small>
                    <small>{item.actionCount} acties</small>
                    <small>
                      Actief {formatLocalDate(item.lastActivityDate)}
                    </small>
                  </span>
                </button>
              ))
            ) : (
              <div className="topic-list__empty">
                <strong>Geen topics binnen deze selectie</strong>
                <span>Pas de filters aan of voeg een topic toe.</span>
              </div>
            )}
          </div>
        </aside>

        {selected ? (
          <main className="topic-detail">
            <header className="topic-detail__header">
              <div>
                <span>{selected.topic.code}</span>
                <h2>{selected.topic.title}</h2>
                <div>
                  <Badge tone={topicTone(selected.topic)}>
                    {selected.topic.status}
                  </Badge>
                  <Badge tone={priorityTone(selected.topic.priority)}>
                    {selected.topic.priority}
                  </Badge>
                </div>
              </div>
              <div className="topic-detail__actions">
                <FavoriteButton
                  route={`${basePath}/topics/${selected.topic.id}`}
                  label={`${selected.topic.code} · ${selected.topic.title}`}
                  kind="Topic"
                />
                <Button variant="secondary" onClick={() => setPanel("edit")}>
                  Topic bewerken
                </Button>
                <Button variant="secondary" onClick={() => setPanel("meeting")}>
                  Bespreken op overleg
                </Button>
                {selected.topic.projectId ? (
                  <Button variant="tertiary" onClick={() => setPanel("timing")}>
                    {selected.planning ? "Timing bewerken" : "+ Timing"}
                  </Button>
                ) : null}
                <Button variant="tertiary" onClick={archiveSelectedTopic}>
                  Topic verwijderen
                </Button>
              </div>
            </header>

            {statusMessage ? (
              <p className="topic-detail__saved" role="status">
                {statusMessage}
              </p>
            ) : null}

            <section
              className="topic-current"
              aria-labelledby="topic-current-title"
            >
              <header>
                <h3 id="topic-current-title">Actuele stand</h3>
                <div>
                  {selected.currentUpdate ? (
                    <time>{formatLocalDate(selected.currentUpdate.date)}</time>
                  ) : null}
                </div>
              </header>
              {selected.currentUpdate ? (
                <>
                  <p>{selected.currentUpdate.text}</p>
                  <small>
                    {session.state.indices.actorById.get(
                      selected.currentUpdate.authorActorId,
                    )?.displayName ?? "Onbekende auteur"}
                  </small>
                </>
              ) : (
                <div>
                  <strong>Nog geen actuele stand</strong>
                  <span>Voeg een update toe en markeer die als actueel.</span>
                </div>
              )}
            </section>

            <section
              className="topic-context"
              aria-labelledby="topic-context-title"
            >
              <h3 id="topic-context-title">Vaste context</h3>
              <p>{selected.topic.context}</p>
            </section>

            <ActionContextSection
              objectType="Topic"
              objectId={selected.topic.id}
              contextLabel={`${selected.topic.code} · ${selected.topic.title}`}
            />

            <ConversationComposer
              contextType="Topic"
              contextId={selected.topic.id}
              contextLabel={`${selected.topic.code} · ${selected.topic.title}`}
              onSaved={(message) =>
                setStatusMessage(`${message} · back-up nodig`)
              }
            />

            <section
              className="topic-journal"
              aria-labelledby="topic-journal-title"
            >
              <header>
                <div>
                  <span>Contextueel dossier</span>
                  <h3 id="topic-journal-title">Journaal</h3>
                </div>
                <div className="topic-journal__actions">
                  <strong>{journal.length}</strong>
                </div>
              </header>
              {journal.length || selected.actionCount ? (
                <ConversationFeed
                  updates={journal}
                  actions={
                    session.state.indices.actionsByObject.get(
                      `Topic:${selected.topic.id}`,
                    ) ?? []
                  }
                />
              ) : (
                <div className="topic-journal__empty">
                  <strong>Nog geen journaalbijdragen</strong>
                  <span>
                    Gebruik de invoerkaart hierboven voor een update, beslissing
                    of actie.
                  </span>
                </div>
              )}
            </section>
          </main>
        ) : (
          <main className="topic-detail topic-detail--empty">
            <EmptyState
              title={items.length ? "Selecteer een topic" : "Nog geen topics"}
              description={
                items.length
                  ? "Kies links een topic om de actuele stand en het journaal te openen."
                  : "Voeg het eerste topic toe binnen de geselecteerde context."
              }
              action={<Button onClick={openNewTopic}>+ Nieuw topic</Button>}
            />
          </main>
        )}

        {selected ? (
          <aside className="topic-metadata" aria-label="Topiccontext">
            <section>
              <h3>Opvolging</h3>
              <dl>
                <div>
                  <dt>Status</dt>
                  <dd>{selected.topic.status}</dd>
                </div>
                <div>
                  <dt>Prioriteit</dt>
                  <dd>{selected.topic.priority}</dd>
                </div>
                <div>
                  <dt>Eigenaar</dt>
                  <dd>{selected.owner?.displayName ?? "Niet toegewezen"}</dd>
                </div>
              </dl>
              <div className="topic-metadata__status-actions">
                {selected.topic.status === "Open" ? (
                  <>
                    <Button
                      variant="secondary"
                      onClick={() => changeStatus("Afgesloten")}
                    >
                      Topic afsluiten
                    </Button>
                    <Button
                      variant="tertiary"
                      onClick={() => changeStatus("Geannuleerd")}
                    >
                      Annuleren
                    </Button>
                  </>
                ) : (
                  <Button
                    variant="secondary"
                    onClick={() => changeStatus("Open")}
                  >
                    Topic heropenen
                  </Button>
                )}
              </div>
            </section>

            <section>
              <h3>Overleg</h3>
              <strong>
                {agendaScheduling?.scheduledMeetings.length ?? 0} keer ingepland
              </strong>
              {agendaScheduling?.scheduledMeetings.length ? (
                <ul className="topic-metadata__meetings">
                  {agendaScheduling.scheduledMeetings
                    .slice(0, 3)
                    .map(({ meeting, agendaItem }) => (
                      <li key={agendaItem.id}>
                        <Link to={`/meetings/${meeting.id}`}>
                          {meeting.title}
                        </Link>
                        <small>{formatLocalDate(meeting.date)}</small>
                      </li>
                    ))}
                </ul>
              ) : (
                <p>Nog niet aan een overlegagenda gekoppeld.</p>
              )}
              <Button variant="tertiary" onClick={() => setPanel("meeting")}>
                {agendaScheduling?.scheduledMeetings.length
                  ? "Nog een overleg kiezen"
                  : "Overleg kiezen"}
              </Button>
            </section>

            <section>
              <h3>Planning</h3>
              {selected.planning ? (
                <dl>
                  <div>
                    <dt>Status</dt>
                    <dd>{selected.planning.status}</dd>
                  </div>
                  <div>
                    <dt>Start</dt>
                    <dd>{formatLocalDate(selected.planning.startDate)}</dd>
                  </div>
                  <div>
                    <dt>Einde</dt>
                    <dd>{formatLocalDate(selected.planning.plannedEndDate)}</dd>
                  </div>
                </dl>
              ) : (
                <p>
                  {selected.topic.projectId
                    ? "Geen timing gekoppeld."
                    : "Een clustertopic heeft geen projectplanning."}
                </p>
              )}
            </section>

            <section>
              <h3>Budgetimpact</h3>
              <strong>{budgetSummary.recordCount} gekoppelde records</strong>
              <p>
                {budgetSummary.recordCount
                  ? `Netto meer/minwerk ${formatEuroCents(budgetSummary.changeOrderImpactCents)}. Overige netto-impact vereist nog een aggregatieregel.`
                  : "Geen budgetimpact geregistreerd."}
              </p>
              {selected.topic.projectId ? (
                <Link
                  to={`/projects/${selected.topic.projectId}/budget?topicId=${selected.topic.id}`}
                >
                  Bekijk budgetitems
                </Link>
              ) : null}
            </section>
          </aside>
        ) : null}
      </div>

      {panel === "new" || (panel === "edit" && selected) ? (
        <NewTopicPanel
          parentType={parentType}
          parentId={parentId}
          {...(panel === "edit" && selected ? { topic: selected.topic } : {})}
          onClose={closeTopicPanel}
          onSaved={(topic) => {
            setStatusMessage(
              panel === "edit"
                ? "Topic bijgewerkt in de lokale sessie · back-up nodig"
                : "Topic opgeslagen in de lokale sessie · back-up nodig",
            )
            setPanel(undefined)
            selectTopic(topic)
          }}
        />
      ) : null}
      {selected && panel === "timing" ? (
        <TopicTimingPanel
          topic={selected.topic}
          {...(selected.planning ? { planning: selected.planning } : {})}
          onClose={() => setPanel(undefined)}
          onSaved={() => {
            setStatusMessage(
              "Timing opgeslagen in de lokale sessie · back-up nodig",
            )
            setPanel(undefined)
          }}
        />
      ) : null}
      {selected && panel === "meeting" ? (
        <AgendaSchedulePanel
          objectType="Topic"
          objectId={selected.topic.id}
          sourceLabel={`${selected.topic.code} · ${selected.topic.title}`}
          onClose={() => setPanel(undefined)}
          onSaved={(message) => {
            setStatusMessage(`${message} · back-up nodig`)
            setPanel(undefined)
          }}
        />
      ) : null}
    </section>
  )
}
