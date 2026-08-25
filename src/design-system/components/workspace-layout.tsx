import type { HTMLAttributes, ReactNode } from "react"
import "./components.css"

export function WorkspacePage({
  children,
  className = "",
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={`workspace-page ${className}`.trim()} {...props}>
      {children}
    </div>
  )
}

export function ViewBar({
  primary,
  actions,
  children,
  ariaLabel = "Weergave en filters",
}: {
  primary?: ReactNode
  actions?: ReactNode
  children?: ReactNode
  ariaLabel?: string
}) {
  return (
    <section className="view-bar" aria-label={ariaLabel}>
      {primary ? <div className="view-bar__primary">{primary}</div> : null}
      {children ? <div className="view-bar__content">{children}</div> : null}
      {actions ? <div className="view-bar__actions">{actions}</div> : null}
    </section>
  )
}

export function WorkspaceGrid({
  navigation,
  children,
  inspector,
  className = "",
}: {
  navigation?: ReactNode
  children: ReactNode
  inspector?: ReactNode
  className?: string
}) {
  return (
    <div
      className={`workspace-grid${navigation ? " workspace-grid--navigation" : ""}${inspector ? " workspace-grid--inspector" : ""} ${className}`.trim()}
    >
      {navigation ? (
        <aside className="workspace-grid__navigation">{navigation}</aside>
      ) : null}
      <div className="workspace-grid__main">{children}</div>
      {inspector ? (
        <aside className="workspace-grid__inspector">{inspector}</aside>
      ) : null}
    </div>
  )
}
