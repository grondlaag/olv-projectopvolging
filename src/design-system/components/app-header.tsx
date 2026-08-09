import {
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
} from "react"
import { useNavigate } from "react-router-dom"
import { buildGlobalSearchResults } from "../../application/queries"
import { useAppStore } from "../../app/state/app-store"
import { Badge } from "./badge"
import { Button } from "./button"
import "./shell.css"

export function AppHeader() {
  const navigate = useNavigate()
  const [search, setSearch] = useState("")
  const [searchOpen, setSearchOpen] = useState(false)
  const [activeResult, setActiveResult] = useState(0)
  const [exporting, setExporting] = useState(false)
  const [exportFeedback, setExportFeedback] = useState("")
  const searchInput = useRef<HTMLInputElement>(null)
  const deferredSearch = useDeferredValue(search)
  const dirty = useAppStore((state) => state.dirty)
  const loadedFileName = useAppStore((state) => state.loadedFileName)
  const session = useAppStore((state) => state.session)
  const lastExportAt = useAppStore((state) => state.lastExportAt)
  const setImportPanelOpen = useAppStore((state) => state.setImportPanelOpen)
  const setPortfolioFilters = useAppStore((state) => state.setPortfolioFilters)
  const markExported = useAppStore((state) => state.markExported)
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

  useEffect(() => {
    function focusSearch(event: globalThis.KeyboardEvent) {
      const target = event.target as HTMLElement | null
      const isTextInput =
        target?.matches("input, textarea, select, [contenteditable='true']") ??
        false
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault()
        searchInput.current?.focus()
        setSearchOpen(true)
      } else if (event.key === "/" && !isTextInput) {
        event.preventDefault()
        searchInput.current?.focus()
        setSearchOpen(true)
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

  async function exportWorkbook() {
    if (!session) return
    setExporting(true)
    setExportFeedback("")
    try {
      const { excelWorkbookService } =
        await import("../../app/providers/excel-services")
      await excelWorkbookService.exportAndDownload(
        session.state,
        session.sourceBuffer,
      )
      markExported()
      setExportFeedback(
        `Excel geëxporteerd om ${new Intl.DateTimeFormat("nl-BE", { hour: "2-digit", minute: "2-digit" }).format(new Date())}`,
      )
    } catch {
      setExportFeedback(
        "Excel kon niet worden geëxporteerd. De lokale wijzigingen zijn behouden.",
      )
    } finally {
      setExporting(false)
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
            aria-expanded={searchOpen && search.trim().length >= 2}
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
            Zoeken
          </Button>
        </div>
        {searchOpen && search.trim().length >= 2 ? (
          <div
            className="global-search-results"
            id="global-search-results"
            role="listbox"
          >
            {searchResults.length ? (
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

      <div className="app-header__session" aria-label="Werkbooksessie">
        <div className="app-header__session-copy">
          <span className="app-header__file">
            {loadedFileName ?? "Geen bestand geladen"}
          </span>
          <span className="app-header__export-time">
            {lastExportAt
              ? `Excel geëxporteerd om ${new Intl.DateTimeFormat("nl-BE", { hour: "2-digit", minute: "2-digit" }).format(new Date(lastExportAt))}`
              : "Nog niet geëxporteerd"}
          </span>
        </div>
        {currentActor ? (
          <span className="app-header__actor">{currentActor.displayName}</span>
        ) : null}
        <Badge tone={dirty ? "warning" : "success"}>
          {dirty ? "Wijzigingen nog niet geëxporteerd" : "Geen wijzigingen"}
        </Badge>
        <Button variant="secondary" onClick={() => setImportPanelOpen(true)}>
          Excel laden
        </Button>
        <Button
          onClick={() => void exportWorkbook()}
          disabled={!session || exporting || session.hasBlockingIssues}
        >
          {exporting ? "Exporteren…" : "Exporteren"}
        </Button>
      </div>
      {exportFeedback ? (
        <p
          className="app-header__feedback"
          role={exportFeedback.startsWith("Excel kon") ? "alert" : "status"}
        >
          {exportFeedback}
        </p>
      ) : null}
    </header>
  )
}
