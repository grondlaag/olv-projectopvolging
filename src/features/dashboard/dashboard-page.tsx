import { useState } from "react"
import { Link } from "react-router-dom"
import { buildDashboardModel } from "../../application/queries"
import { ActionManagementService } from "../../application/services"
import { useAppStore } from "../../app/state/app-store"
import {
  Badge,
  Button,
  EmptyState,
  PageHeader,
} from "../../design-system/components"
import { formatLocalDate, todayAsLocalDate } from "../../utils"
import {
  actionStatuses,
  BUDGET_AGGREGATION_RULE_REQUIRED,
  type Action,
  type ActionStatus,
  type UUID,
} from "../../domain"
import "./dashboard-page.css"

const actionService = new ActionManagementService()

type DashboardActionItem = ReturnType<
  typeof buildDashboardModel
>["myActions"][number]

function actionRoute(item: DashboardActionItem) {
  if (item.topic && item.project)
    return "/projects/" + item.project.id + "/topics/" + item.topic.id
  if (item.topic && item.cluster)
    return "/clusters/" + item.cluster.id + "/topics/" + item.topic.id
  if (item.project) return "/projects/" + item.project.id
  if (item.cluster) return "/clusters/" + item.cluster.id
  return "/actions"
}

export function DashboardPage() {
  const session = useAppStore((state) => state.session)
  const setImportPanelOpen = useAppStore((state) => state.setImportPanelOpen)
  const [statusMessage, setStatusMessage] = useState("")

  if (!session) {
    return (
      <div className="dashboard-page">
        <PageHeader
          eyebrow="Overzicht"
          title="Dashboard"
          description="Operationeel overzicht van de lokaal geladen projectportefeuille."
        />
        <div className="dashboard-page__empty">
          <EmptyState
            title="Open een projectgegevensbestand"
            description="Kies een OLV JSON-gegevensbestand, controleer het validatierapport en bevestig het openen."
            action={
              <Button onClick={() => setImportPanelOpen(true)}>
                JSON openen of nieuw starten
              </Button>
            }
          />
        </div>
      </div>
    )
  }

  const currentActorId = session.state.records.config[0]?.currentActorId
  const currentActor = currentActorId
    ? session.state.indices.actorById.get(currentActorId)
    : undefined
  const model = buildDashboardModel(
    session.state,
    todayAsLocalDate(),
    currentActorId,
  )
  const actorName = (actorId: UUID) =>
    session.state.indices.actorById.get(actorId)?.displayName ??
    "Onbekende actor"
  const kpis = [
    [model.kpis.activeProjects, "Actieve projecten"],
    [
      model.kpis.openTopics,
      `Open topics · ${model.kpis.criticalTopics} kritiek`,
    ],
    [model.kpis.openActions, "Open acties"],
    [model.kpis.overdueActions, "Achterstallige acties"],
    [model.kpis.upcomingActions, "Acties komende 14 dagen"],
    [model.kpis.upcomingMilestones, "Mijlpalen komende 30 dagen"],
  ] as const

  function updateStatus(action: Action, status: ActionStatus) {
    const latest = useAppStore.getState().session?.state
    if (!latest || action.status === status) return
    try {
      const result = actionService.updateAction(latest, action.id, {
        title: action.title,
        ...(action.description ? { description: action.description } : {}),
        ownerActorId: action.ownerActorId,
        ...(action.deadline ? { deadline: action.deadline } : {}),
        status,
        priority: action.priority,
      })
      useAppStore.getState().replaceDomainState(result.state)
      setStatusMessage("Actiestatus bijgewerkt · JSON nog opslaan")
    } catch (error) {
      setStatusMessage(
        error instanceof Error
          ? error.message
          : "De actiestatus kon niet worden gewijzigd.",
      )
    }
  }

  return (
    <div className="dashboard-page">
      <PageHeader
        eyebrow="Portefeuilleoverzicht"
        title="Dashboard"
        description={`Actuele signalen uit ${session.fileName}.`}
        actions={<Badge tone="success">Schema {session.schemaVersion}</Badge>}
      />

      <section className="dashboard-kpis" aria-label="Kerncijfers">
        {kpis.map(([value, label]) => (
          <div className="dashboard-kpi" key={label}>
            <strong>{value}</strong>
            <span>{label}</span>
          </div>
        ))}
      </section>

      {statusMessage ? (
        <p className="dashboard-status" role="status">
          {statusMessage}
        </p>
      ) : null}

      <div className="dashboard-sections">
        <section className="dashboard-section dashboard-my-work">
          <div className="dashboard-section__heading">
            <div>
              <span>Persoonlijke werkvoorraad</span>
              <h2>Mijn werk</h2>
            </div>
            <Link to="/actions">Alle acties</Link>
          </div>
          {!currentActor ? (
            <p className="dashboard-section__empty">
              Kies in Instellingen wie je bent om hier je open acties te zien.{" "}
              <Link to="/settings">Actor instellen</Link>
            </p>
          ) : model.myActions.length ? (
            <>
              <p className="dashboard-my-work__intro">
                {model.myActions.length} eerstvolgende open acties voor{" "}
                <strong>{currentActor.displayName}</strong>.
              </p>
              <ul className="dashboard-action-list dashboard-my-work__list">
                {model.myActions.map((item) => (
                  <li key={item.action.id}>
                    <Link to={actionRoute(item)}>
                      <strong>{item.action.title}</strong>
                      <span>{item.contextLabel}</span>
                    </Link>
                    <div>
                      <time>{formatLocalDate(item.action.deadline)}</time>
                      <select
                        value={item.action.status}
                        aria-label={"Status van " + item.action.title}
                        onChange={(event) =>
                          updateStatus(
                            item.action,
                            event.target.value as ActionStatus,
                          )
                        }
                      >
                        {actionStatuses.map((status) => (
                          <option key={status}>{status}</option>
                        ))}
                      </select>
                    </div>
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <p className="dashboard-section__empty">
              Geen open acties voor {currentActor.displayName}.
            </p>
          )}
        </section>

        <section className="dashboard-section dashboard-meetings">
          <div className="dashboard-section__heading">
            <h2>Komende overlegmomenten</h2>
            <Link to="/meetings">Alle overlegmomenten</Link>
          </div>
          {model.upcomingMeetings.length ? (
            <ul className="dashboard-planning__list">
              {model.upcomingMeetings.map((meeting) => (
                <li key={meeting.id}>
                  <Link to={`/meetings/${meeting.id}`}>
                    <strong>{meeting.title}</strong>
                    <span>
                      {meeting.scopeType} · {meeting.type}
                    </span>
                  </Link>
                  <div>
                    <Badge
                      tone={
                        meeting.status === "Definitief" ? "success" : "info"
                      }
                    >
                      {meeting.status}
                    </Badge>
                    <time>{formatLocalDate(meeting.date)}</time>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="dashboard-section__empty">
              Geen volgend overleg gepland.
            </p>
          )}
        </section>

        <section className="dashboard-section dashboard-budget">
          <div className="dashboard-section__heading">
            <h2>Financiële signalen</h2>
            <Link to="/budget">Volledig budgetoverzicht</Link>
          </div>
          <div className="dashboard-budget__rule">
            <strong>Boven budget en grootste afwijkingen</strong>
            <span>{BUDGET_AGGREGATION_RULE_REQUIRED}</span>
          </div>
          <h3>
            Projecten zonder niet-geannuleerd ramingrecord ·{" "}
            {model.projectsWithoutEstimateRecord.length}
          </h3>
          {model.projectsWithoutEstimateRecord.length ? (
            <ul className="dashboard-projects">
              {model.projectsWithoutEstimateRecord
                .slice(0, 5)
                .map((project) => (
                  <li key={project.id}>
                    <Link to={`/projects/${project.id}/budget`}>
                      <span>{project.code}</span>
                      <strong>{project.title}</strong>
                    </Link>
                  </li>
                ))}
            </ul>
          ) : (
            <p className="dashboard-section__empty">
              Elk project heeft minstens één niet-geannuleerd ramingrecord.
            </p>
          )}
        </section>

        <section className="dashboard-section dashboard-planning">
          <div className="dashboard-section__heading">
            <h2>Planning die aandacht vraagt</h2>
            <Link to="/planning">Volledige planning</Link>
          </div>
          <div className="dashboard-planning__summary">
            <div>
              <strong>{model.delayedPlanningItems.length}</strong>
              <span>Items over tijd</span>
            </div>
            <div>
              <strong>{model.planningRiskProjects.length}</strong>
              <span>Projecten met planningsrisico</span>
            </div>
          </div>
          {model.delayedPlanningItems.length ? (
            <ul className="dashboard-planning__list">
              {model.delayedPlanningItems.slice(0, 5).map((entry) => (
                <li key={entry.id}>
                  <Link to={`/projects/${entry.projectId}/planning`}>
                    <strong>{entry.title}</strong>
                    <span>
                      {session.state.indices.projectById.get(entry.projectId)
                        ?.code ?? "Project"}
                    </span>
                  </Link>
                  <div>
                    <Badge tone="warning">Over tijd</Badge>
                    <time>{formatLocalDate(entry.plannedEndDate)}</time>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="dashboard-section__empty">
              Geen open planningitems met een overschreden einddatum.
            </p>
          )}
        </section>

        <section className="dashboard-section dashboard-planning">
          <div className="dashboard-section__heading">
            <h2>Komende mijlpalen</h2>
            <span>Volgende 30 dagen</span>
          </div>
          {model.upcomingMilestones.length ? (
            <ul className="dashboard-planning__list">
              {model.upcomingMilestones.slice(0, 5).map((entry) => (
                <li key={entry.id}>
                  <Link to={`/projects/${entry.projectId}/planning`}>
                    <strong>{entry.title}</strong>
                    <span>
                      {session.state.indices.projectById.get(entry.projectId)
                        ?.title ?? "Onbekend project"}
                    </span>
                  </Link>
                  <time>{formatLocalDate(entry.plannedEndDate)}</time>
                </li>
              ))}
            </ul>
          ) : (
            <p className="dashboard-section__empty">
              Geen open mijlpalen in de komende 30 dagen.
            </p>
          )}
        </section>

        <section className="dashboard-section">
          <div className="dashboard-section__heading">
            <h2>Projecten die aandacht vragen</h2>
            <span>{model.attentionProjects.length} zichtbaar</span>
          </div>
          {model.attentionProjects.length ? (
            <ul className="dashboard-list">
              {model.attentionProjects.map((row) => (
                <li key={row.project.id}>
                  <Link to={`/projects/${row.project.id}`}>
                    <strong>{row.project.code}</strong>
                    <span>{row.project.title}</span>
                  </Link>
                  <div>
                    {row.criticalTopicCount ? (
                      <Badge tone="danger">
                        {row.criticalTopicCount} kritiek
                      </Badge>
                    ) : null}
                    {row.overdueActionCount ? (
                      <Badge tone="warning">
                        {row.overdueActionCount} achterstallig
                      </Badge>
                    ) : null}
                    {row.planningAttentionCount ? (
                      <Badge tone="info">
                        {row.planningAttentionCount} planning
                      </Badge>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="dashboard-section__empty">
              Geen kritieke topics, achterstallige acties of planningssignalen.
            </p>
          )}
        </section>

        {model.recentMeetingDecisions.length ? (
          <section className="dashboard-section">
            <div className="dashboard-section__heading">
              <h2>Recente overlegbeslissingen</h2>
              <span>Laatste vijf</span>
            </div>
            <ol className="dashboard-journal">
              {model.recentMeetingDecisions.map((update) => (
                <li key={update.id}>
                  <time>{formatLocalDate(update.date)}</time>
                  <p>
                    <Link to={`/meetings/${update.meetingId}`}>
                      {update.text}
                    </Link>
                  </p>
                  <span>{actorName(update.authorActorId)}</span>
                </li>
              ))}
            </ol>
          </section>
        ) : null}

        <section className="dashboard-section dashboard-actions">
          <div className="dashboard-section__heading">
            <h2>Acties die aandacht vragen</h2>
            <Link to="/actions">Volledige actielijst</Link>
          </div>
          {model.attentionActions.length ? (
            <ul className="dashboard-action-list">
              {model.attentionActions.map((item) => {
                const target = item.topic
                  ? item.project
                    ? `/projects/${item.project.id}/topics/${item.topic.id}`
                    : item.cluster
                      ? `/clusters/${item.cluster.id}/topics/${item.topic.id}`
                      : "/actions"
                  : item.project
                    ? `/projects/${item.project.id}`
                    : item.cluster
                      ? `/clusters/${item.cluster.id}`
                      : "/actions"
                return (
                  <li key={item.action.id}>
                    <Link to={target}>
                      <strong>{item.action.title}</strong>
                      <span>
                        {item.owner?.displayName ?? "Onbekende actor"} ·{" "}
                        {item.contextLabel}
                      </span>
                    </Link>
                    <div>
                      <time>{formatLocalDate(item.action.deadline)}</time>
                      {item.action.status === "Wacht op beslissing" ? (
                        <Badge tone="warning">Wacht op beslissing</Badge>
                      ) : null}
                    </div>
                  </li>
                )
              })}
            </ul>
          ) : (
            <p className="dashboard-section__empty">
              Geen achterstallige, binnenkort vervallende of wachtende acties.
            </p>
          )}
        </section>

        <section className="dashboard-section">
          <div className="dashboard-section__heading">
            <h2>Recente beslissingen</h2>
            <span>Laatste vijf</span>
          </div>
          {model.recentDecisions.length ? (
            <ol className="dashboard-journal">
              {model.recentDecisions.map((update) => (
                <li key={update.id}>
                  <time>{formatLocalDate(update.date)}</time>
                  <p>{update.text}</p>
                  <span>{actorName(update.authorActorId)}</span>
                </li>
              ))}
            </ol>
          ) : (
            <p className="dashboard-section__empty">
              Nog geen beslissingen geregistreerd.
            </p>
          )}
        </section>

        <section className="dashboard-section">
          <div className="dashboard-section__heading">
            <h2>Recent gewijzigde projecten</h2>
            <span>Laatste vijf</span>
          </div>
          <ul className="dashboard-projects">
            {model.recentlyChangedProjects.map((project) => (
              <li key={project.id}>
                <Link to={`/projects/${project.id}`}>
                  <span>{project.code}</span>
                  <strong>{project.title}</strong>
                </Link>
                <time>
                  {new Intl.DateTimeFormat("nl-BE", {
                    day: "2-digit",
                    month: "short",
                  }).format(new Date(project.audit.updatedAt))}
                </time>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  )
}
