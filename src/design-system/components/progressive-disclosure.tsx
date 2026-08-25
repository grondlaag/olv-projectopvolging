import { useEffect, useId, useRef, useState, type ReactNode } from "react"
import { useEscapeKey } from "../patterns"
import { Button } from "./button"
import "./components.css"

export interface CollapsibleProps {
  title: ReactNode
  summary?: ReactNode
  children: ReactNode
  defaultOpen?: boolean
  open?: boolean | undefined
  onOpenChange?: ((open: boolean) => void) | undefined
  className?: string
  eyebrow?: ReactNode
}

export function Collapsible({
  title,
  summary,
  children,
  defaultOpen = false,
  open,
  onOpenChange,
  className = "",
  eyebrow,
}: CollapsibleProps) {
  const [internalOpen, setInternalOpen] = useState(defaultOpen)
  const isOpen = open ?? internalOpen
  return (
    <details
      className={`collapsible ${className}`.trim()}
      open={isOpen}
      onToggle={(event) => {
        const nextOpen = event.currentTarget.open
        if (open === undefined) setInternalOpen(nextOpen)
        onOpenChange?.(nextOpen)
      }}
    >
      <summary>
        <span className="collapsible__heading">
          {eyebrow ? <small>{eyebrow}</small> : null}
          <strong>{title}</strong>
        </span>
        {summary ? (
          <span className="collapsible__summary">{summary}</span>
        ) : null}
        <span className="collapsible__chevron" aria-hidden="true">
          {"\u2304"}
        </span>
      </summary>
      <div className="collapsible__content">{children}</div>
    </details>
  )
}

export interface ActiveFilter {
  id: string
  label: string
  onRemove: () => void
}

export interface FilterPanelProps {
  children: ReactNode
  activeFilters?: readonly ActiveFilter[]
  actions?: ReactNode
  onClear?: () => void
  defaultOpen?: boolean
  className?: string
}

export function FilterPanel({
  children,
  activeFilters = [],
  actions,
  onClear,
  defaultOpen = false,
  className = "",
}: FilterPanelProps) {
  return (
    <section
      className={`filter-panel ${className}`.trim()}
      aria-label="Filters"
    >
      <Collapsible
        title="Filters"
        summary={`${activeFilters.length} actief`}
        defaultOpen={defaultOpen}
        className="filter-panel__disclosure"
      >
        <div className="filter-panel__fields">{children}</div>
        {actions || (onClear && activeFilters.length) ? (
          <footer className="filter-panel__actions">
            {onClear && activeFilters.length ? (
              <Button variant="tertiary" onClick={onClear}>
                Alle filters wissen
              </Button>
            ) : null}
            {actions}
          </footer>
        ) : null}
      </Collapsible>
      {activeFilters.length ? (
        <div className="filter-panel__chips" aria-label="Actieve filters">
          {activeFilters.map((filter) => (
            <button
              key={filter.id}
              type="button"
              aria-label={`${filter.label} verwijderen`}
              onClick={filter.onRemove}
            >
              <span>{filter.label}</span>
              <span aria-hidden="true">{"\u00d7"}</span>
              <span className="sr-only">filter verwijderen</span>
            </button>
          ))}
        </div>
      ) : null}
    </section>
  )
}

export interface SidePanelProps {
  title: ReactNode
  summary?: ReactNode
  children: ReactNode
  open?: boolean
  onOpenChange?: (open: boolean) => void
  className?: string
  ariaLabel?: string
}

export function SidePanel({
  title,
  summary,
  children,
  open = true,
  onOpenChange,
  className = "",
  ariaLabel,
}: SidePanelProps) {
  const contentId = useId()
  return (
    <aside
      className={`side-panel${open ? " is-open" : ""} ${className}`.trim()}
      aria-label={ariaLabel}
    >
      <header className="side-panel__header">
        <div>
          <strong>{title}</strong>
          {summary ? <span>{summary}</span> : null}
        </div>
        {onOpenChange ? (
          <Button
            variant="tertiary"
            aria-expanded={open}
            aria-controls={contentId}
            onClick={() => onOpenChange(!open)}
          >
            {open ? "Inklappen" : "Openen"}
          </Button>
        ) : null}
      </header>
      <div id={contentId} className="side-panel__content" hidden={!open}>
        {children}
      </div>
    </aside>
  )
}

export interface KpiStripItem {
  id: string
  label: ReactNode
  value: ReactNode
  supportingText?: ReactNode
  tone?: "neutral" | "positive" | "attention"
}

export function KpiStrip({
  items,
  ariaLabel = "Kerncijfers",
  className = "",
}: {
  items: readonly KpiStripItem[]
  ariaLabel?: string
  className?: string
}) {
  return (
    <dl
      className={`kpi-strip ${className}`.trim()}
      aria-label={ariaLabel}
      role="region"
    >
      {items.map((item) => (
        <div key={item.id} data-tone={item.tone ?? "neutral"}>
          <dt>{item.label}</dt>
          <dd>{item.value}</dd>
          {item.supportingText ? <small>{item.supportingText}</small> : null}
        </div>
      ))}
    </dl>
  )
}

export function OverflowMenu({
  children,
  label = "Meer acties",
  className = "",
}: {
  children: ReactNode
  label?: string
  className?: string
}) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  useEscapeKey(() => setOpen(false), open)

  useEffect(() => {
    if (!open) return
    const closeOutside = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener("pointerdown", closeOutside)
    return () => document.removeEventListener("pointerdown", closeOutside)
  }, [open])

  return (
    <div className={`overflow-menu ${className}`.trim()} ref={rootRef}>
      <Button
        variant="tertiary"
        className="overflow-menu__trigger"
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
      >
        <span aria-hidden="true">{"\u22ef"}</span>
      </Button>
      {open ? (
        <div
          className="overflow-menu__content"
          role="menu"
          aria-label={label}
          onClick={(event) => {
            if ((event.target as HTMLElement).closest("button, a")) {
              setOpen(false)
            }
          }}
        >
          {children}
        </div>
      ) : null}
    </div>
  )
}

export interface ComposerTab<T extends string> {
  id: T
  label: string
}

export interface ComposerProps<T extends string> {
  launcherLabel?: string
  title: ReactNode
  context?: ReactNode
  tabs: readonly ComposerTab<T>[]
  activeTab: T
  onTabChange: (tab: T) => void
  children: ReactNode
  open?: boolean | undefined
  defaultOpen?: boolean
  onOpenChange?: ((open: boolean) => void) | undefined
  disabled?: boolean
  className?: string
}

export function Composer<T extends string>({
  launcherLabel = "+ Update toevoegen",
  title,
  context,
  tabs,
  activeTab,
  onTabChange,
  children,
  open,
  defaultOpen = false,
  onOpenChange,
  disabled = false,
  className = "",
}: ComposerProps<T>) {
  const [internalOpen, setInternalOpen] = useState(defaultOpen)
  const isOpen = open ?? internalOpen
  const setOpen = (nextOpen: boolean) => {
    if (open === undefined) setInternalOpen(nextOpen)
    onOpenChange?.(nextOpen)
  }

  if (!isOpen) {
    return (
      <div className={`composer composer--closed ${className}`.trim()}>
        <Button onClick={() => setOpen(true)} disabled={disabled}>
          {launcherLabel}
        </Button>
      </div>
    )
  }

  return (
    <section className={`composer composer--open ${className}`.trim()}>
      <header className="composer__header">
        <div>
          <span>{title}</span>
          {context ? <strong>{context}</strong> : null}
        </div>
        <Button
          variant="tertiary"
          aria-label="Invoer sluiten"
          onClick={() => setOpen(false)}
        >
          Sluiten
        </Button>
      </header>
      <div className="composer__tabs" role="group" aria-label="Soort bijdrage">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            aria-pressed={activeTab === tab.id}
            className={activeTab === tab.id ? "is-active" : ""}
            onClick={() => onTabChange(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <div className="composer__body">{children}</div>
    </section>
  )
}
