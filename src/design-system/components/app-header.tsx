import {
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
} from "react"
import { useLocation, useNavigate } from "react-router-dom"
import { buildGlobalSearchResults } from "../../application/queries"
import { currentAppRoute } from "../../app/routing"
import { useAppStore } from "../../app/state/app-store"
import { jsonDataFileService } from "../../app/providers/data-file-services"
import type { UUID } from "../../domain"
import { Badge } from "./badge"
import { Button } from "./button"
import { Icon } from "./icon"
import "./shell.css"

interface QuickCreateItem {
  title: string
  description: string
  route: string
  contextual?: boolean
}

function actionCreateRoute(
  objectType: "Project" | "Cluster" | "Topic" | "Meeting",
  objectId: string,
  returnTo: string,
): string {
  const parameters = new URLSearchParams({
    nieuw: "1",
    objectType,
    objectId,
    returnTo,
  })
  return `/actions?${parameters.toString()}`
}

export function AppHeader() {
  const navigate = useNavigate()
  const location = useLocation()
  const [search, setSearch] = useState("")
  const [searchOpen, setSearchOpen] = useState(false)
  const [activeResult, setActiveResult] = useState(0)
  const [saving, setSaving] = useState(false)
  const [saveFeedback, setSaveFeedback] = useState("")
  const [quickCreateOpen, setQuickCreateOpen] = useState(false)
  const [keyboardHelpOpen, setKeyboardHelpOpen] = useState(false)
  const searchInput = useRef<HTMLInputElement>(null)
  const deferredSearch = useDeferredValue(search)
  const dirty = useAppStore((state) => state.dirty)
  const loadedFileName = useAppStore((state) => state.loadedFileName)
  const session = useAppStore((state) => state.session)
  const lastSavedAt = useAppStore((state) => state.lastSavedAt)
  const setImportPanelOpen = useAppStore((state) => state.setImportPanelOpen)
  const setPortfolioFilters = useAppStore((state) => state.setPortfolioFilters)
  const markSaved = useAppStore((state) => state.markSaved)
  const config = session?.state.records.config[0]
  const currentActor =
    session && config?.currentActorId
      ? session.state.indices.actorById.get(config.currentActorId)
      : undefined
  const searchResults = useMemo(
    () =>
      session ? buildGlobalSearchResults(session.state, deferredSearch) : [],
    [deferredSearch, session],
  )
  const quickCreateItems = useMemo<readonly QuickCreateItem[]>(() => {
    const fallback: QuickCreateItem[] = [
      {
        title: "Project",
        description: "Nieuw projectdossier",
        route: "/projects/new",
      },
      {
        title: "Overleg",
        description: "Nieuw overlegmoment",
        route: "/meetings/new",
      },
    ]
    if (!session) return fallback

    const returnTo = currentAppRoute(location)
    const topicMatch = location.pathname.match(
      /^\/(?:projects|clusters)\/[^/]+\/topics\/([^/]+)$/,
    )
    const projectMatch = location.pathname.match(/^\/projects\/([^/]+)/)
    const clusterMatch = location.pathname.match(/^\/clusters\/([^/]+)/)
    const meetingMatch = location.pathname.match(/^\/meetings\/([^/]+)$/)
    const topicId = topicMatch?.[1] as UUID | undefined
    const projectId = projectMatch?.[1] as UUID | "new" | undefined
    const clusterId = clusterMatch?.[1] as UUID | undefined
    const meetingId = meetingMatch?.[1] as UUID | "new" | undefined
    const topic = topicId
      ? session.state.indices.topicById.get(topicId)
      : undefined
    const project =
      projectId && projectId !== "new"
        ? session.state.indices.projectById.get(projectId)
        : undefined
    const cluster = clusterId
      ? session.state.indices.clusterById.get(clusterId)
      : undefined
    const meeting =
      meetingId && meetingId !== "new"
        ? session.state.indices.meetingById.get(meetingId)
        : undefined
    const contextual: QuickCreateItem[] = []

    if (topic) {
      contextual.push({
        title: "Actie bij dit topic",
        description: topic.title,
        route: actionCreateRoute("Topic", topic.id, returnTo),
        contextual: true,
      })
    } else if (project) {
      contextual.push(
        {
          title: "Topic in dit project",
          description: `${project.code} · ${project.title}`,
          route: `/projects/${project.id}/topics?nieuw=1`,
          contextual: true,
        },
        {
          title: "Actie bij dit project",
          description: `${project.code} · ${project.title}`,
          route: actionCreateRoute("Project", project.id, returnTo),
          contextual: true,
        },
        {
          title: "Overleg voor dit project",
          description: "Projectscope is al ingevuld",
          route: `/meetings/new?scopeType=Project&scopeId=${project.id}`,
          contextual: true,
        },
      )
    } else if (cluster) {
      contextual.push(
        {
          title: "Topic in deze cluster",
          description: `${cluster.code} · ${cluster.title}`,
          route: `/clusters/${cluster.id}?nieuw=1`,
          contextual: true,
        },
        {
          title: "Actie bij deze cluster",
          description: `${cluster.code} · ${cluster.title}`,
          route: actionCreateRoute("Cluster", cluster.id, returnTo),
          contextual: true,
        },
        {
          title: "Overleg voor deze cluster",
          description: "Clusterscope is al ingevuld",
          route: `/meetings/new?scopeType=Cluster&scopeId=${cluster.id}`,
          contextual: true,
        },
      )
    } else if (meeting) {
      contextual.push(
        {
          title: "Actie uit dit overleg",
          description: meeting.title,
          route: actionCreateRoute("Meeting", meeting.id, returnTo),
          contextual: true,
        },
        {
          title: "Vervolgoverleg",
          description: "Neem scope en open agendapunten mee",
          route: `/meetings/new?vervolgVan=${meeting.id}`,
          contextual: true,
        },
      )
    }
    return [...contextual, ...fallback]
  }, [location, session])

  useEffect(() => {
    function focusSearch(event: globalThis.KeyboardEvent) {
      const target = event.target
      const isTextInput =
        target instanceof HTMLElement &&
        target.matches("input, textarea, select, [contenteditable='true']")
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault()
        searchInput.current?.focus()
        setSearchOpen(true)
      } else if (event.key === "/" && !isTextInput) {
        event.preventDefault()
        searchInput.current?.focus()
        setSearchOpen(true)
      } else if (
        event.key.toLocaleLowerCase("nl") === "n" &&
        !event.ctrlKey &&
        !event.metaKey &&
        !event.altKey &&
        !isTextInput
      ) {
        event.preventDefault()
        setQuickCreateOpen(true)
      } else if (event.key === "?" && !isTextInput) {
        event.preventDefault()
        setKeyboardHelpOpen(true)
      } else if (event.key === "Escape") {
        setSearchOpen(false)
        setQuickCreateOpen(false)
        setKeyboardHelpOpen(false)
      }
    }
    window.addEventListener("keydown", focusSearch)
    return () => window.removeEventListener("keydown", focusSearch)
  }, [])

  function openResult(route: string) {
    setSearchOpen(false)
    setActiveResult(0)
    navigate(route)
  }

  function openCreateRoute(route: string) {
    setQuickCreateOpen(false)
    navigate(route, { state: { returnTo: location.pathname } })
  }

  function submitSearch(event: FormEvent) {
    event.preventDefault()
    if (searchResults[activeResult]) {
      openResult(searchResults[activeResult].route)
      return
    }
    const normalizedSearch = search.trim()
    setPortfolioFilters({
      ...useAppStore.getState().portfolioFilters,
      search: normalizedSearch,
    })
    const parameters = new URLSearchParams()
    if (normalizedSearch) parameters.set("zoek", normalizedSearch)
    setSearchOpen(false)
    navigate(`/portfolio${parameters.size ? `?${parameters}` : ""}`)
  }

  async function saveDataFile() {
    if (!session) return
    setSaving(true)
    setSaveFeedback("")
    try {
      const exported = jsonDataFileService.exportAndDownload(session.state)
      markSaved(exported.fileName)
      setSaveFeedback(
        `JSON opgeslagen om ${new Intl.DateTimeFormat("nl-BE", { hour: "2-digit", minute: "2-digit" }).format(new Date())}`,
      )
    } catch (cause) {
      setSaveFeedback(
        cause instanceof Error
          ? cause.message
          : "JSON kon niet worden opgeslagen. De lokale wijzigingen zijn behouden.",
      )
    } finally {
      setSaving(false)
    }
  }

  function searchKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Escape") {
      setSearchOpen(false)
      return
    }
    if (!searchResults.length) return
    if (event.key === "Enter") {
      event.preventDefault()
      const result = searchResults[activeResult]
      if (result) openResult(result.route)
      return
    }
    if (event.key === "ArrowDown") {
      event.preventDefault()
      setActiveResult((current) => (current + 1) % searchResults.length)
    }
    if (event.key === "ArrowUp") {
      event.preventDefault()
      setActiveResult(
        (current) =>
          (current - 1 + searchResults.length) % searchResults.length,
      )
    }
  }

  return (
    <header className="app-header">
      <div className="app-header__brand">
        <span className="app-header__mark" aria-hidden="true">
          OLV
        </span>
        <div className="app-header__brand-copy">
          <strong>OLV Projectopvolging</strong>
          <span>Projectportfolio</span>
        </div>
      </div>

      <form
        className="app-header__search"
        onSubmit={submitSearch}
        role="search"
      >
        <label htmlFor="global-search">Globaal zoeken</label>
        <div className="app-header__search-control">
          <input
            ref={searchInput}
            id="global-search"
            value={search}
            placeholder="Zoek project, topic, actie of overleg…"
            role="combobox"
            aria-expanded={searchOpen}
            aria-controls="global-search-results"
            aria-activedescendant={
              searchOpen && searchResults[activeResult]
                ? `global-result-${searchResults[activeResult].id}`
                : undefined
            }
            autoComplete="off"
            onFocus={() => setSearchOpen(true)}
            onKeyDown={searchKeyDown}
            onChange={(event) => {
              setSearch(event.target.value)
              setActiveResult(0)
              setSearchOpen(true)
            }}
          />
          <Button variant="tertiary" type="submit">
            <Icon name="search" />
            Zoeken
          </Button>
        </div>
        {searchOpen ? (
          <div
            className="global-search-results"
            id="global-search-results"
            role="listbox"
          >
            {search.trim().length < 2 ? (
              <div className="global-search-commands">
                <div>
                  <span>Snel maken</span>
                  {quickCreateItems.map((item) => (
                    <button
                      type="button"
                      key={item.route}
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => openCreateRoute(item.route)}
                    >
                      <strong>{item.title}</strong>
                      <small>{item.description}</small>
                    </button>
                  ))}
                </div>
                <p>
                  Typ minstens twee tekens om projecten, topics, acties en
                  overleg te vinden. Gebruik de pijltjestoetsen en Enter om te
                  openen.
                </p>
              </div>
            ) : searchResults.length ? (
              searchResults.map((result, index) => (
                <button
                  type="button"
                  role="option"
                  aria-selected={index === activeResult}
                  id={`global-result-${result.id}`}
                  key={result.id}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => openResult(result.route)}
                >
                  <span>{result.type}</span>
                  <strong>{result.title}</strong>
                  <small>{result.context}</small>
                </button>
              ))
            ) : (
              <p>
                Geen directe resultaten. Druk Enter om in Portfolio te zoeken.
              </p>
            )}
          </div>
        ) : null}
      </form>

      <div className="app-header__session" aria-label="Gegevenssessie">
        <div className="app-header__quick-create">
          <Button
            variant="secondary"
            aria-expanded={quickCreateOpen}
            aria-haspopup="menu"
            onClick={() => setQuickCreateOpen((open) => !open)}
          >
            <Icon name="plus" />+ Nieuw
          </Button>
          {quickCreateOpen ? (
            <div className="app-header__quick-menu" role="menu">
              {quickCreateItems.map((item, index) => (
                <button
                  type="button"
                  role="menuitem"
                  className={
                    index > 0 &&
                    !item.contextual &&
                    quickCreateItems[index - 1]?.contextual
                      ? "app-header__quick-menu-separator"
                      : undefined
                  }
                  key={item.route}
                  onClick={() => openCreateRoute(item.route)}
                >
                  <strong>{item.title}</strong>
                  <span>{item.description}</span>
                </button>
              ))}
            </div>
          ) : null}
        </div>
        <Button
          variant="tertiary"
          aria-label="Sneltoetsen tonen"
          onClick={() => setKeyboardHelpOpen(true)}
        >
          ?
        </Button>
        <div className="app-header__session-copy">
          <span className="app-header__file">
            {loadedFileName ?? "Geen gegevensbestand geopend"}
          </span>
          <span className="app-header__export-time">
            {lastSavedAt
              ? `JSON opgeslagen om ${new Intl.DateTimeFormat("nl-BE", { hour: "2-digit", minute: "2-digit" }).format(new Date(lastSavedAt))}`
              : "Nog niet opgeslagen"}
          </span>
        </div>
        {currentActor ? (
          <span className="app-header__actor">{currentActor.displayName}</span>
        ) : null}
        <Badge tone={dirty ? "warning" : "success"}>
          {dirty ? "Back-up nodig" : "Back-up bijgewerkt"}
        </Badge>
        <Button
          variant="tertiary"
          aria-label="JSON openen"
          onClick={() => setImportPanelOpen(true)}
        >
          <Icon name="open" />
          Openen
        </Button>
        <Button
          aria-label="JSON opslaan"
          onClick={() => void saveDataFile()}
          disabled={!session || saving || session.hasBlockingIssues}
        >
          <Icon name="download" />
          {saving ? "Downloaden…" : "Back-up downloaden"}
        </Button>
      </div>
      {saveFeedback ? (
        <p
          className="app-header__feedback"
          role={
            saveFeedback.startsWith("Opslaan is geblokkeerd")
              ? "alert"
              : "status"
          }
        >
          {saveFeedback}
        </p>
      ) : null}
      {keyboardHelpOpen ? (
        <div
          className="keyboard-help-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setKeyboardHelpOpen(false)
          }}
        >
          <section
            className="keyboard-help"
            role="dialog"
            aria-modal="true"
            aria-labelledby="keyboard-help-title"
          >
            <header>
              <div>
                <span>Sneller werken</span>
                <h2 id="keyboard-help-title">Sneltoetsen</h2>
              </div>
              <Button
                variant="tertiary"
                aria-label="Sneltoetsen sluiten"
                onClick={() => setKeyboardHelpOpen(false)}
              >
                Sluiten
              </Button>
            </header>
            <dl>
              <div>
                <dt>
                  <kbd>Ctrl</kbd> + <kbd>K</kbd> of <kbd>/</kbd>
                </dt>
                <dd>Globaal zoeken</dd>
              </div>
              <div>
                <dt>
                  <kbd>N</kbd>
                </dt>
                <dd>Contextgevoelig nieuw record</dd>
              </div>
              <div>
                <dt>
                  <kbd>Ctrl</kbd> + <kbd>Enter</kbd>
                </dt>
                <dd>Snelle invoer opslaan waar beschikbaar</dd>
              </div>
              <div>
                <dt>
                  <kbd>Esc</kbd>
                </dt>
                <dd>Paneel of menu sluiten</dd>
              </div>
              <div>
                <dt>
                  <kbd>?</kbd>
                </dt>
                <dd>Dit overzicht tonen</dd>
              </div>
            </dl>
          </section>
        </div>
      ) : null}
    </header>
  )
}
