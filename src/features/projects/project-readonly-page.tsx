import { useMemo, useState } from "react"
import { Link, useLocation, useParams, useSearchParams } from "react-router-dom"
import {
  buildProjectBudgetModel,
  buildProjectJournal,
  buildProjectJournalGroups,
  buildProjectOverview,
  buildTopicListItems,
  filterProjectJournal,
  meetingsForProject,
  type ProjectJournalFilter,
} from "../../application/queries"
import { useAppStore } from "../../app/state/app-store"
import {
  Badge,
  Button,
  EmptyState,
  ErrorState,
  FilterPanel,
  SidePanel,
} from "../../design-system/components"
import type {
  Cluster,
  Project,
  ProjectClusterHistory,
  UUID,
} from "../../domain"
import { formatEuroCents, projectSizeFte } from "../../domain"
import { TopicWorkspace } from "../topics/topic-workspace"
import { ProjectActionSection } from "../actions/action-sections"
import { AgendaSchedulePanel } from "../meetings/agenda-schedule-panel"
import {
  ConversationComposer,
  ConversationFeed,
} from "../journal/conversation-composer"
import {
  ProjectDossierHeader,
  type ProjectDossierTab,
} from "./project-dossier-header"
import { formatLocalDate, todayAsLocalDate } from "../../utils"
import "./project-readonly-page.css"

interface ProjectOverviewProps {
  project: Project
  cluster?: Cluster
  history: readonly ProjectClusterHistory[]
  onSaved: (message: string) => void
}

function ProjectOverview({
  project,
  cluster,
  history,
  onSaved,
}: ProjectOverviewProps) {
  const session = useAppStore((state) => state.session)!
  const [metadataOpen, setMetadataOpen] = useState(false)
  const overview = useMemo(
    () => buildProjectOverview(session.state, project.id, todayAsLocalDate()),
    [project.id, session],
  )
  const budget = useMemo(
    () => buildProjectBudgetModel(session.state, project.id),
    [project.id, session],
  )
  const currentUpdate = project.currentUpdateId
    ? session.state.indices.updateById.get(project.currentUpdateId)
    : undefined
  const projectTopics = useMemo(
    () =>
      buildTopicListItems(session.state, "Project", project.id)
        .filter((item) => item.topic.status === "Open")
        .slice(0, 6),
    [project.id, session],
  )
  const projectJournal = useMemo(
    () => buildProjectJournal(session.state, project.id),
    [project.id, session],
  )
  const recentDecisions = projectJournal
    .filter((entry) => entry.update.type === "Beslissing")
    .slice(0, 3)
  const recentActivity = projectJournal.slice(0, 5)
  const projectActions =
    session.state.indices.actionsByProject.get(project.id) ?? []
  const waitingDecisionCount = projectActions.filter(
    (action) => action.status === "Wacht op beslissing",
  ).length
  const delayedPlanningCount = (
    session.state.indices.planningByProject.get(project.id) ?? []
  ).filter(
    (entry) =>
      entry.audit.active &&
      entry.plannedEndDate < todayAsLocalDate() &&
      entry.status !== "Afgerond" &&
      entry.status !== "Geannuleerd",
  ).length
  const projectMeetings = useMemo(
    () => meetingsForProject(session.state, project.id),
    [project.id, session],
  )
  const upcomingMeetings = projectMeetings
    .filter((meeting) => meeting.date >= todayAsLocalDate())
    .sort((left, right) => left.date.localeCompare(right.date))
    .slice(0, 3)
  const recentMeetings = projectMeetings
    .filter((meeting) => meeting.date < todayAsLocalDate())
    .slice(0, 3)
  const meetingIds = new Set(projectMeetings.map((meeting) => meeting.id))
  const recentMeetingDecisions = session.state.records.updates
    .filter(
      (update) =>
        update.type === "Beslissing" &&
        Boolean(update.meetingId && meetingIds.has(update.meetingId)),
    )
    .sort((left, right) => right.date.localeCompare(left.date))
    .slice(0, 3)

  return (
    <div className="project-overview">
      <div className="project-overview__layout">
        <main className="project-overview__main">
          <section className="project-readonly__current">
            <div className="project-readonly__section-title">
              <span>Actuele inhoudelijke projectstand</span>
              {currentUpdate ? (
                <time>{formatLocalDate(currentUpdate.date)}</time>
              ) : null}
            </div>
            {currentUpdate?.audit.active &&
            currentUpdate.objectType === "Project" &&
            currentUpdate.objectId === project.id ? (
              <p>{currentUpdate.text}</p>
            ) : (
              <div className="project-readonly__empty-copy">
                <strong>Nog geen actuele projectstand vastgelegd</strong>
                <span>
                  Topicupdates worden in hun eigen dossier bijgehouden; een
                  projectstatus verschijnt hier zodra die aanwezig is.
                </span>
              </div>
            )}
            <p className="project-readonly__current-explanation">
              Dit statusmoment beschrijft de inhoudelijke stand van het project.
              De levenscyclusstatus in de dossierkop blijft een apart
              bestuurbaar veld.
            </p>
            <ConversationComposer
              contextType="Project"
              contextId={project.id}
              contextLabel={`${project.code} · ${project.title}`}
              compact
              launcherLabel={
                currentUpdate
                  ? "+ Statusmoment toevoegen"
                  : "+ Actuele stand toevoegen"
              }
              onSaved={onSaved}
            />
          </section>

          <section className="project-readonly__section project-attention">
            <div className="project-readonly__section-heading">
              <h2>Aandacht vereist</h2>
              <span>
                {overview.criticalTopicCount +
                  overview.overdueActionCount +
                  waitingDecisionCount +
                  delayedPlanningCount}{" "}
                signalen
              </span>
            </div>
            {overview.criticalTopicCount ||
            overview.overdueActionCount ||
            waitingDecisionCount ||
            delayedPlanningCount ? (
              <ul>
                {overview.criticalTopicCount ? (
                  <li>
                    <Link to={`/projects/${project.id}/topics`}>
                      <strong>
                        {overview.criticalTopicCount} kritieke topics
                      </strong>
                      <span>
                        Bekijk welke actuele toestand opvolging vraagt.
                      </span>
                    </Link>
                  </li>
                ) : null}
                {overview.overdueActionCount ? (
                  <li>
                    <button
                      type="button"
                      onClick={() =>
                        document
                          .getElementById("project-actions-title")
                          ?.scrollIntoView({ block: "start" })
                      }
                    >
                      <strong>
                        {overview.overdueActionCount} achterstallige acties
                      </strong>
                      <span>
                        Deadline is verstreken en de actie is nog open.
                      </span>
                    </button>
                  </li>
                ) : null}
                {waitingDecisionCount ? (
                  <li>
                    <button
                      type="button"
                      onClick={() =>
                        document
                          .getElementById("project-actions-title")
                          ?.scrollIntoView({ block: "start" })
                      }
                    >
                      <strong>
                        {waitingDecisionCount} acties wachten op beslissing
                      </strong>
                      <span>Besluitvorming is nodig om verder te kunnen.</span>
                    </button>
                  </li>
                ) : null}
                {delayedPlanningCount ? (
                  <li>
                    <Link to={`/projects/${project.id}/planning`}>
                      <strong>
                        {delayedPlanningCount} planningitems over tijd
                      </strong>
                      <span>De geplande einddatum is verstreken.</span>
                    </Link>
                  </li>
                ) : null}
              </ul>
            ) : (
              <div className="project-readonly__empty-copy">
                <strong>Geen dringende signalen</strong>
                <span>
                  Er zijn geen kritieke topics, achterstallige acties of
                  vertraagde planningitems.
                </span>
              </div>
            )}
          </section>

          <section className="project-readonly__section">
            <h2>Omschrijving</h2>
            <p>{project.description || "Geen omschrijving geregistreerd."}</p>
          </section>

          <section className="project-readonly__section">
            <h2>Kernplanning</h2>
            <dl className="project-readonly__dates">
              <div>
                <dt>Startdatum</dt>
                <dd>{formatLocalDate(project.startDate)}</dd>
              </div>
              <div>
                <dt>Geplande einddatum</dt>
                <dd>{formatLocalDate(project.plannedEndDate)}</dd>
              </div>
              <div>
                <dt>Actuele einddatum</dt>
                <dd>{formatLocalDate(project.actualEndDate)}</dd>
              </div>
              <div>
                <dt>Voortgang</dt>
                <dd className="project-readonly__progress">
                  <progress max="100" value={project.progressPercent ?? 0} />
                  <span>{project.progressPercent ?? 0}%</span>
                </dd>
              </div>
              <div>
                <dt>Projectomvang</dt>
                <dd>
                  {project.size
                    ? `${project.size} · ${projectSizeFte[project.size].toLocaleString("nl-BE")} VTE indicatief`
                    : "Niet ingeschaald"}
                </dd>
              </div>
            </dl>
          </section>

          <section className="project-readonly__section">
            <div className="project-readonly__section-heading">
              <h2>Actuele topics</h2>
              <Link to={`/projects/${project.id}/topics`}>
                Alle topics bekijken
              </Link>
            </div>
            {projectTopics.length ? (
              <ol className="project-topic-notes">
                {projectTopics.map((item) => (
                  <li key={item.topic.id}>
                    <Link
                      to={`/projects/${project.id}/topics/${item.topic.id}`}
                    >
                      <span>
                        <strong>{item.topic.title}</strong>
                        <small>
                          {item.topic.priority} ·{" "}
                          {item.owner?.displayName ?? "Niet toegewezen"}
                        </small>
                      </span>
                      <p>{item.currentUpdate?.text ?? item.topic.context}</p>
                      <small>
                        {item.openActionCount} open acties · actief{" "}
                        {formatLocalDate(item.lastActivityDate)}
                      </small>
                    </Link>
                  </li>
                ))}
              </ol>
            ) : (
              <div className="project-readonly__empty-copy">
                <strong>Nog geen open topics voor dit project</strong>
                <span>
                  Voeg het eerste topic toe om context, acties en beslissingen
                  samen op te volgen.
                </span>
              </div>
            )}
          </section>

          <ProjectActionSection
            projectId={project.id}
            contextLabel={`${project.code} · ${project.title}`}
          />

          <section className="project-readonly__section project-recent">
            <div className="project-readonly__section-heading">
              <h2>Recente beslissingen</h2>
              <Link to={`/projects/${project.id}/journal`}>
                Volledig journaal
              </Link>
            </div>
            {recentDecisions.length ? (
              <ol>
                {recentDecisions.map((entry) => (
                  <li key={entry.update.id}>
                    <time>{formatLocalDate(entry.update.date)}</time>
                    <div>
                      <strong>{entry.update.text}</strong>
                      <span>{entry.sourceLabel}</span>
                    </div>
                  </li>
                ))}
              </ol>
            ) : (
              <p>Nog geen beslissingen geregistreerd.</p>
            )}
          </section>

          <section className="project-readonly__section project-recent">
            <div className="project-readonly__section-heading">
              <h2>Recente activiteit</h2>
              <span>Laatste vijf bijdragen</span>
            </div>
            {recentActivity.length ? (
              <ol>
                {recentActivity.map((entry) => (
                  <li key={entry.update.id}>
                    <time>{formatLocalDate(entry.update.date)}</time>
                    <div>
                      <strong>{entry.update.text}</strong>
                      <span>
                        {entry.update.type} · {entry.sourceLabel}
                      </span>
                    </div>
                  </li>
                ))}
              </ol>
            ) : (
              <p>Nog geen activiteit in het projectjournaal.</p>
            )}
          </section>

          <section className="project-readonly__section project-budget-summary">
            <div className="project-readonly__section-heading">
              <h2>Budget</h2>
              <Link to={`/projects/${project.id}/budget`}>
                Projectbudget openen
              </Link>
            </div>
            <dl>
              <div>
                <dt>Goedgekeurd</dt>
                <dd>—</dd>
              </div>
              <div>
                <dt>Prognose</dt>
                <dd>—</dd>
              </div>
              <div>
                <dt>Afwijking</dt>
                <dd>—</dd>
              </div>
              <div>
                <dt>Netto meer/minwerk</dt>
                <dd>
                  {formatEuroCents(budget?.summary.changeOrderImpactCents ?? 0)}
                </dd>
              </div>
              <div>
                <dt>Budgetitems</dt>
                <dd>{budget?.summary.recordCount ?? 0}</dd>
              </div>
            </dl>
            <p className="project-budget-summary__note">
              Prognose en afwijking wachten op een besliste rekenregel.
            </p>
          </section>

          <section className="project-readonly__section project-meeting-summary">
            <div className="project-readonly__section-heading">
              <h2>Overleg</h2>
              <Link to="/meetings">Alle overlegmomenten</Link>
            </div>
            {projectMeetings.length ? (
              <div className="project-meeting-summary__grid">
                <div>
                  <h3>Komend</h3>
                  {upcomingMeetings.length ? (
                    <ol>
                      {upcomingMeetings.map((meeting) => (
                        <li key={meeting.id}>
                          <Link to={`/meetings/${meeting.id}`}>
                            <strong>{meeting.title}</strong>
                            <small>{formatLocalDate(meeting.date)}</small>
                          </Link>
                        </li>
                      ))}
                    </ol>
                  ) : (
                    <p>Geen volgend overleg gepland.</p>
                  )}
                </div>
                <div>
                  <h3>Recente verslagen</h3>
                  {recentMeetings.length ? (
                    <ol>
                      {recentMeetings.map((meeting) => {
                        const report = [
                          ...(session.state.indices.reportsByMeeting.get(
                            meeting.id,
                          ) ?? []),
                        ].sort((left, right) => right.version - left.version)[0]
                        return (
                          <li key={meeting.id}>
                            <Link
                              to={`/meetings/${meeting.id}${report ? `?versie=${report.version}` : ""}`}
                            >
                              <strong>{meeting.title}</strong>
                              <small>
                                {report
                                  ? `Versie ${report.version} · ${report.status}`
                                  : "Nog geen verslag"}
                              </small>
                            </Link>
                          </li>
                        )
                      })}
                    </ol>
                  ) : (
                    <p>Nog geen recente overlegmomenten.</p>
                  )}
                </div>
                <div>
                  <h3>Recente beslissingen</h3>
                  {recentMeetingDecisions.length ? (
                    <ol>
                      {recentMeetingDecisions.map((decision) => (
                        <li key={decision.id}>
                          <Link to={`/meetings/${decision.meetingId}`}>
                            <strong>{decision.text}</strong>
                            <small>{formatLocalDate(decision.date)}</small>
                          </Link>
                        </li>
                      ))}
                    </ol>
                  ) : (
                    <p>Nog geen overlegbeslissingen.</p>
                  )}
                </div>
              </div>
            ) : (
              <div className="project-readonly__empty-copy">
                <strong>Nog geen overleg voor dit project</strong>
                <span>
                  Project-, cluster- en hoofdstukoverleg verschijnt hier zodra
                  het is aangemaakt.
                </span>
              </div>
            )}
          </section>

          <section className="project-readonly__section">
            <h2>Clusterhistoriek</h2>
            {history.length ? (
              <ol className="project-readonly__history">
                {history.map((item) => {
                  const historyCluster = session.state.indices.clusterById.get(
                    item.clusterId,
                  )
                  return (
                    <li key={item.id}>
                      <span aria-hidden="true" />
                      <div>
                        <strong>
                          {historyCluster?.title ?? "Onbekende cluster"}
                        </strong>
                        <small>{item.reason ?? "Clusterkoppeling"}</small>
                      </div>
                      <time>
                        {formatLocalDate(item.validFrom)} —{" "}
                        {item.validTo ? formatLocalDate(item.validTo) : "heden"}
                      </time>
                    </li>
                  )
                })}
              </ol>
            ) : (
              <div className="project-readonly__empty-copy">
                <strong>Geen clusterhistoriek</strong>
                <span>
                  Dit project is zonder cluster aangemaakt of heeft nog geen
                  clusterkoppeling gehad.
                </span>
              </div>
            )}
          </section>

          <section className="project-readonly__section">
            <h2>Verdere opvolging</h2>
            <div className="project-readonly__placeholders">
              <div>
                <strong>Planning</strong>
                <span>Detailplanning en Gantt blijven hier alleen-lezen.</span>
              </div>
            </div>
          </section>
        </main>

        <SidePanel
          className="project-readonly__metadata"
          title="Projectgegevens"
          summary={cluster?.title ?? "Zonder cluster"}
          open={metadataOpen}
          onOpenChange={setMetadataOpen}
          ariaLabel="Projectmetadata"
        >
          <dl>
            <div>
              <dt>Cluster</dt>
              <dd>{cluster?.title ?? "Zonder cluster"}</dd>
            </div>
            <div>
              <dt>Site</dt>
              <dd>{project.site ?? "—"}</dd>
            </div>
            <div>
              <dt>Locatie</dt>
              <dd>{project.location ?? "—"}</dd>
            </div>
            <div>
              <dt>Afdeling</dt>
              <dd>{project.department ?? "—"}</dd>
            </div>
            <div>
              <dt>Volgende mijlpaal</dt>
              <dd>
                {overview.nextMilestone
                  ? `${overview.nextMilestone.title} · ${formatLocalDate(overview.nextMilestone.plannedEndDate)}`
                  : "—"}
              </dd>
            </div>
            <div>
              <dt>Documenten</dt>
              <dd>
                {project.documentsUrl ? (
                  <a
                    href={project.documentsUrl}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Open documenten
                  </a>
                ) : (
                  "—"
                )}
              </dd>
            </div>
          </dl>
        </SidePanel>
      </div>
    </div>
  )
}

interface ProjectJournalProps {
  project: Project
}

export function LegacyProjectJournal({ project }: ProjectJournalProps) {
  const session = useAppStore((state) => state.session)!
  const [filter, setFilter] = useState<ProjectJournalFilter>("all")
  const entries = useMemo(
    () => buildProjectJournal(session.state, project.id),
    [project.id, session],
  )
  const filteredEntries = useMemo(
    () => filterProjectJournal(entries, filter),
    [entries, filter],
  )

  return (
    <section
      className="project-journal"
      aria-labelledby="project-journal-title"
    >
      <header>
        <div>
          <span>Gecombineerde tijdlijn</span>
          <h2 id="project-journal-title">Projectjournaal</h2>
          <p>
            Project- en topicbijdragen staan samen, zonder de broncontext te
            verliezen.
          </p>
        </div>
        <strong>{filteredEntries.length}</strong>
      </header>
      <FilterPanel
        activeFilters={
          filter === "all"
            ? []
            : [
                {
                  id: "journal",
                  label: `Journaal: ${filter}`,
                  onRemove: () => setFilter("all"),
                },
              ]
        }
        onClear={() => setFilter("all")}
      >
        <fieldset className="filter-panel__scope">
          <legend>Journaalfilter</legend>
          {(
            [
              ["all", "Alles"],
              ["updates", "Updates"],
              ["decisions", "Beslissingen"],
              ["topics", "Topics"],
            ] as const
          ).map(([value, label]) => (
            <label key={value}>
              <input
                type="radio"
                name="journal-filter"
                checked={filter === value}
                onChange={() => setFilter(value)}
              />
              <span>{label}</span>
            </label>
          ))}
        </fieldset>
      </FilterPanel>
      {filteredEntries.length ? (
        <ol className="project-journal__timeline">
          {filteredEntries.map((entry) => {
            const author = session.state.indices.actorById.get(
              entry.update.authorActorId,
            )
            return (
              <li
                key={entry.update.id}
                className={
                  entry.update.type === "Beslissing"
                    ? "project-journal__entry project-journal__entry--decision"
                    : "project-journal__entry"
                }
              >
                <span aria-hidden="true" />
                <article>
                  <header>
                    <div>
                      <Badge
                        tone={
                          entry.update.type === "Beslissing"
                            ? "warning"
                            : "neutral"
                        }
                      >
                        {entry.update.type}
                      </Badge>
                      <small>
                        {entry.sourceType} ·{" "}
                        {entry.topicId ? (
                          <Link
                            to={`/projects/${project.id}/topics/${entry.topicId}`}
                          >
                            {entry.sourceLabel}
                          </Link>
                        ) : (
                          entry.sourceLabel
                        )}
                      </small>
                    </div>
                    <time>{formatLocalDate(entry.update.date)}</time>
                  </header>
                  <p>{entry.update.text}</p>
                  <small>{author?.displayName ?? "Onbekende auteur"}</small>
                </article>
              </li>
            )
          })}
        </ol>
      ) : (
        <EmptyState
          title="Geen journaalbijdragen binnen dit filter"
          description="Nieuwe topicupdates en beslissingen verschijnen hier automatisch."
        />
      )}
    </section>
  )
}

interface GroupedProjectJournalProps {
  project: Project
  onSaved: (message: string) => void
}

function GroupedProjectJournal({
  project,
  onSaved,
}: GroupedProjectJournalProps) {
  const session = useAppStore((state) => state.session)!
  const [filter, setFilter] = useState<"active" | "all" | "attention">("active")
  const groups = useMemo(
    () => buildProjectJournalGroups(session.state, project.id),
    [project.id, session],
  )
  const visibleGroups = useMemo(
    () =>
      groups.filter((group) => {
        if (group.kind === "project" || filter === "all") return true
        if (filter === "attention")
          return (
            group.topic?.priority === "Kritiek" ||
            group.actions.some(
              (action) =>
                action.status !== "Afgerond" &&
                action.status !== "Geannuleerd" &&
                Boolean(
                  action.deadline && action.deadline < todayAsLocalDate(),
                ),
            )
          )
        return group.topic?.status === "Open"
      }),
    [filter, groups],
  )
  const total = groups.reduce(
    (count, group) =>
      count +
      group.updates.length +
      group.decisions.length +
      group.actions.length,
    0,
  )

  return (
    <section
      className="project-journal"
      aria-labelledby="project-journal-title"
    >
      <header>
        <div>
          <span>Werkcontext boven chronologie</span>
          <h2 id="project-journal-title">Projectjournaal</h2>
          <p>
            Elke topic houdt zijn actuele stand, updates, beslissingen, acties
            en overlegmomenten bij elkaar.
          </p>
        </div>
        <strong>{total}</strong>
      </header>
      <FilterPanel
        activeFilters={
          filter === "active"
            ? []
            : [
                {
                  id: "journal-groups",
                  label:
                    filter === "attention" ? "Aandacht nodig" : "Alle topics",
                  onRemove: () => setFilter("active"),
                },
              ]
        }
        onClear={() => setFilter("active")}
      >
        <fieldset className="filter-panel__scope">
          <legend>Toon</legend>
          {(
            [
              ["active", "Open topics"],
              ["attention", "Aandacht nodig"],
              ["all", "Alle topics"],
            ] as const
          ).map(([value, label]) => (
            <label key={value}>
              <input
                type="radio"
                name="journal-group-filter"
                checked={filter === value}
                onChange={() => setFilter(value)}
              />
              <span>{label}</span>
            </label>
          ))}
        </fieldset>
      </FilterPanel>
      {visibleGroups.length ? (
        <div className="project-journal__groups">
          {visibleGroups.map((group, index) => {
            const updates = [...group.updates, ...group.decisions]
            const activityCount = updates.length + group.actions.length
            const openActions = group.actions.filter(
              (action) =>
                action.status !== "Afgerond" && action.status !== "Geannuleerd",
            ).length
            return (
              <details
                key={group.id}
                className="project-journal__group"
                open={index === 0 || group.topic?.priority === "Kritiek"}
              >
                <summary>
                  <div>
                    <small>
                      {group.kind === "project" ? "Projectbreed" : group.code}
                    </small>
                    <strong>{group.title}</strong>
                    {group.currentUpdate ? (
                      <span>{group.currentUpdate.text}</span>
                    ) : null}
                  </div>
                  <dl>
                    <div>
                      <dt>Bijdragen</dt>
                      <dd>{activityCount}</dd>
                    </div>
                    <div>
                      <dt>Open acties</dt>
                      <dd>{openActions}</dd>
                    </div>
                    <div>
                      <dt>Overleggen</dt>
                      <dd>{group.meetings.length}</dd>
                    </div>
                  </dl>
                </summary>
                <div className="project-journal__group-body">
                  <div className="project-journal__group-heading">
                    <div>
                      <span>Actuele stand</span>
                      <p>
                        {group.currentUpdate?.text ??
                          "Nog geen actuele stand vastgelegd."}
                      </p>
                    </div>
                    {group.topic ? (
                      <Link
                        to={`/projects/${project.id}/topics/${group.topic.id}`}
                      >
                        Open topicdossier
                      </Link>
                    ) : null}
                  </div>
                  <ConversationComposer
                    contextType={group.kind === "project" ? "Project" : "Topic"}
                    contextId={group.topic?.id ?? project.id}
                    contextLabel={`${group.code} · ${group.title}`}
                    compact
                    onSaved={onSaved}
                  />
                  <ConversationFeed
                    updates={updates}
                    actions={group.actions}
                    limit={3}
                  />
                  {activityCount > 3 ? (
                    <details className="project-journal__more">
                      <summary>Alle {activityCount} bijdragen tonen</summary>
                      <ConversationFeed
                        updates={updates}
                        actions={group.actions}
                      />
                    </details>
                  ) : null}
                  {group.meetings.length ? (
                    <div className="project-journal__meetings">
                      <span>Besproken op</span>
                      {group.meetings.slice(0, 4).map((meeting) => (
                        <Link key={meeting.id} to={`/meetings/${meeting.id}`}>
                          {formatLocalDate(meeting.date)} · {meeting.title}
                        </Link>
                      ))}
                    </div>
                  ) : null}
                </div>
              </details>
            )
          })}
        </div>
      ) : (
        <EmptyState
          title="Geen topics binnen deze selectie"
          description="Kies alle topics of leg een nieuwe topic vast."
        />
      )}
    </section>
  )
}

interface ProjectReadonlyPageProps {
  view?: Extract<ProjectDossierTab, "overview" | "topics" | "journal">
}

export function ProjectReadonlyPage({
  view: routeView,
}: ProjectReadonlyPageProps) {
  const { projectId, topicId } = useParams<{
    projectId: string
    topicId?: string
  }>()
  const location = useLocation()
  const [searchParameters] = useSearchParams()
  const session = useAppStore((state) => state.session)
  const dirty = useAppStore((state) => state.dirty)
  const setImportPanelOpen = useAppStore((state) => state.setImportPanelOpen)
  const [agendaPanelOpen, setAgendaPanelOpen] = useState(false)
  const [sessionStatus, setSessionStatus] = useState("")
  const project = projectId
    ? session?.state.indices.projectById.get(projectId as UUID)
    : undefined
  const history = useMemo(() => {
    if (!session || !project) return []
    return [
      ...(session.state.indices.projectClusterHistoryByProject.get(
        project.id,
      ) ?? []),
    ].sort((left, right) => right.validFrom.localeCompare(left.validFrom))
  }, [project, session])

  if (!session) {
    return (
      <EmptyState
        title="Project kan nog niet worden geopend"
        description="Herstel een lokale sessie of open eerst het bijbehorende JSON-gegevensbestand."
        action={
          <Button onClick={() => setImportPanelOpen(true)}>
            JSON openen of nieuw starten
          </Button>
        }
      />
    )
  }
  if (!project) {
    return (
      <ErrorState
        title="Project niet gevonden"
        description="Dit project-ID bestaat niet in de geopende gegevensset."
      />
    )
  }

  const cluster = project.clusterId
    ? session.state.indices.clusterById.get(project.clusterId)
    : undefined
  const overview = buildProjectOverview(
    session.state,
    project.id,
    todayAsLocalDate(),
  )
  const requestedView = searchParameters.get("weergave")
  const view = topicId
    ? "topics"
    : requestedView === "topics" || requestedView === "journaal"
      ? requestedView === "journaal"
        ? "journal"
        : requestedView
      : (routeView ?? "overview")
  const savedInNavigation = Boolean(
    (location.state as { saved?: boolean } | null)?.saved,
  )

  return (
    <article className="project-readonly">
      <ProjectDossierHeader
        project={project}
        activeTab={view === "overview" ? "dashboard" : "journal"}
        openTopicCount={overview.openTopicCount}
        actions={
          <Button variant="secondary" onClick={() => setAgendaPanelOpen(true)}>
            Project bespreken op overleg
          </Button>
        }
      />

      {dirty || savedInNavigation ? (
        <div className="project-readonly__session-status" role="status">
          <span aria-hidden="true">✓</span>
          <div>
            <strong>
              {sessionStatus
                ? `${sessionStatus} · back-up nodig`
                : "Bewaard in lokale sessie · back-up nodig"}
            </strong>
            <small>
              De wijziging staat lokaal klaar en zit nog niet in een gedownload
              JSON-bestand.
            </small>
          </div>
        </div>
      ) : null}

      <div className="project-overview-strip" aria-label="Dossierkerncijfers">
        <div>
          <strong>{overview.openTopicCount}</strong>
          <span>Open topics</span>
        </div>
        <div>
          <strong>{overview.criticalTopicCount}</strong>
          <span>Kritieke topics</span>
        </div>
        <div>
          <strong>{overview.openActionCount}</strong>
          <span>Open acties</span>
        </div>
        <div className={overview.overdueActionCount ? "is-attention" : ""}>
          <strong>{overview.overdueActionCount}</strong>
          <span>Achterstallig</span>
        </div>
        <div>
          <strong>
            {overview.nextMilestone
              ? formatLocalDate(overview.nextMilestone.plannedEndDate)
              : "—"}
          </strong>
          <span>Volgende mijlpaal</span>
        </div>
      </div>

      {view === "topics" ? (
        <TopicWorkspace
          parentType="Project"
          parentId={project.id}
          basePath={`/projects/${project.id}`}
          {...(topicId ? { selectedTopicId: topicId as UUID } : {})}
        />
      ) : view === "journal" ? (
        <GroupedProjectJournal project={project} onSaved={setSessionStatus} />
      ) : (
        <ProjectOverview
          project={project}
          history={history}
          onSaved={setSessionStatus}
          {...(cluster ? { cluster } : {})}
        />
      )}

      {agendaPanelOpen ? (
        <AgendaSchedulePanel
          objectType="Project"
          objectId={project.id}
          sourceLabel={`${project.code} · ${project.title}`}
          onClose={() => setAgendaPanelOpen(false)}
          onSaved={(message) => {
            setSessionStatus(message)
            setAgendaPanelOpen(false)
          }}
        />
      ) : null}
    </article>
  )
}
