import { Link, useParams } from "react-router-dom"
import { useAppStore } from "../../app/state/app-store"
import {
  Badge,
  Button,
  EmptyState,
  ErrorState,
  PageHeader,
} from "../../design-system/components"
import type { UUID } from "../../domain"
import { TopicWorkspace } from "../topics/topic-workspace"
import { ActionContextSection } from "../actions/action-sections"
import "./cluster-topics-page.css"

export function ClusterTopicsPage() {
  const { clusterId, topicId } = useParams<{
    clusterId: string
    topicId?: string
  }>()
  const session = useAppStore((state) => state.session)
  const setImportPanelOpen = useAppStore((state) => state.setImportPanelOpen)
  const cluster = clusterId
    ? session?.state.indices.clusterById.get(clusterId as UUID)
    : undefined

  if (!session) {
    return (
      <EmptyState
        title="Cluster kan nog niet worden geopend"
        description="Open eerst het bijbehorende JSON-gegevensbestand."
        action={
          <Button onClick={() => setImportPanelOpen(true)}>
            JSON openen of nieuw starten
          </Button>
        }
      />
    )
  }
  if (!cluster) {
    return (
      <ErrorState
        title="Cluster niet gevonden"
        description="Dit cluster-ID bestaat niet in de geopende gegevensset."
      />
    )
  }

  const chapter = session.state.indices.chapterById.get(cluster.chapterId)
  const topics = session.state.indices.topicsByCluster.get(cluster.id) ?? []

  return (
    <article className="cluster-topics-page">
      <nav className="cluster-topics-page__breadcrumb" aria-label="Kruimelpad">
        <Link to="/portfolio">Portfolio</Link>
        <span aria-hidden="true">/</span>
        <span>{chapter?.title ?? "Onbekend hoofdstuk"}</span>
        <span aria-hidden="true">/</span>
        <span aria-current="page">{cluster.code}</span>
      </nav>
      <PageHeader
        eyebrow={cluster.code}
        title={cluster.title}
        description="Clustercontext · projectoverstijgende topics"
      />
      <div className="cluster-topics-page__summary">
        <div>
          <span>Hoofdstuk</span>
          <strong>{chapter?.title ?? "—"}</strong>
        </div>
        <div>
          <span>Status</span>
          <Badge tone={cluster.status === "Active" ? "success" : "neutral"}>
            {cluster.status === "Active" ? "Actief" : "Inactief"}
          </Badge>
        </div>
        <div>
          <span>Topics</span>
          <strong>{topics.length}</strong>
        </div>
      </div>
      {cluster.description ? (
        <p className="cluster-topics-page__description">
          {cluster.description}
        </p>
      ) : null}
      <ActionContextSection
        objectType="Cluster"
        objectId={cluster.id}
        contextLabel={`${cluster.code} · ${cluster.title}`}
      />
      <TopicWorkspace
        parentType="Cluster"
        parentId={cluster.id}
        basePath={`/clusters/${cluster.id}`}
        {...(topicId ? { selectedTopicId: topicId as UUID } : {})}
      />
    </article>
  )
}
