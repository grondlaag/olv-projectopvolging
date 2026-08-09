import type { ReactNode } from "react"
import { Button } from "./button"
import "./components.css"

interface FeedbackStateProps {
  marker: string
  title: string
  description: string
  children?: ReactNode
  tone?: "neutral" | "danger"
}

function FeedbackState({
  marker,
  title,
  description,
  children,
  tone = "neutral",
}: FeedbackStateProps) {
  return (
    <section className={`feedback-state feedback-state--${tone}`}>
      <span className="feedback-state__marker" aria-hidden="true">
        {marker}
      </span>
      <div>
        <h2 className="feedback-state__title">{title}</h2>
        <p className="feedback-state__description">{description}</p>
        {children}
      </div>
    </section>
  )
}

export interface EmptyStateProps {
  title: string
  description: string
  action?: ReactNode
}

export function EmptyState({ title, description, action }: EmptyStateProps) {
  return (
    <FeedbackState marker="○" title={title} description={description}>
      {action}
    </FeedbackState>
  )
}

export interface ErrorStateProps {
  title?: string
  description: string
  onRetry?: () => void
}

export function ErrorState({
  title = "Er ging iets mis",
  description,
  onRetry,
}: ErrorStateProps) {
  return (
    <FeedbackState
      marker="!"
      title={title}
      description={description}
      tone="danger"
    >
      {onRetry ? (
        <Button variant="secondary" onClick={onRetry}>
          Opnieuw proberen
        </Button>
      ) : null}
    </FeedbackState>
  )
}

export interface LoadingStateProps {
  label?: string
}

export function LoadingState({
  label = "Bezig met laden…",
}: LoadingStateProps) {
  return (
    <div className="loading-state" role="status">
      <span className="loading-state__indicator" aria-hidden="true" />
      <span>{label}</span>
    </div>
  )
}
