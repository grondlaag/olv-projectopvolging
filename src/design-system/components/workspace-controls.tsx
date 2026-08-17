import { useMemo, useState, type FormEvent } from "react"
import { useLocation, useNavigate } from "react-router-dom"
import {
  removeWorkspaceView,
  saveWorkspaceView,
  setTableColumnVisible,
  setTableDensity,
  toggleFavoriteWorkspaceLink,
  useWorkspacePreferences,
  type TableDensity,
  type WorkspaceLink,
  type WorkspacePage,
} from "../../app/preferences/workspace-preferences"
import { useEscapeKey } from "../patterns"
import { Button } from "./button"

function viewSearch(page: WorkspacePage, search: string): string {
  const parameters = new URLSearchParams(search)
  if (page === "actions") {
    parameters.delete("actie")
    parameters.delete("nieuw")
    parameters.delete("objectType")
    parameters.delete("objectId")
  }
  if (page === "meetings") parameters.delete("versie")
  return parameters.toString()
}

export function SavedViewsControl({ page }: { page: WorkspacePage }) {
  const location = useLocation()
  const navigate = useNavigate()
  const preferences = useWorkspacePreferences()
  const [creating, setCreating] = useState(false)
  const [name, setName] = useState("")
  const currentSearch = viewSearch(page, location.search)
  const views = useMemo(
    () => preferences.savedViews.filter((view) => view.page === page),
    [page, preferences.savedViews],
  )
  const selected = views.find((view) => view.search === currentSearch)

  function submit(event: FormEvent) {
    event.preventDefault()
    if (!name.trim()) return
    saveWorkspaceView(page, name, currentSearch)
    setName("")
    setCreating(false)
  }

  return (
    <div className="saved-views-control">
      <label>
        <span>Opgeslagen weergave</span>
        <select
          value={selected?.id ?? ""}
          onChange={(event) => {
            const view = views.find((item) => item.id === event.target.value)
            if (!view) return
            navigate(
              {
                pathname: location.pathname,
                search: view.search ? `?${view.search}` : "",
              },
              { replace: false },
            )
          }}
        >
          <option value="">Huidige selectie</option>
          {views.map((view) => (
            <option value={view.id} key={view.id}>
              {view.name}
            </option>
          ))}
        </select>
      </label>
      {creating ? (
        <form onSubmit={submit}>
          <label>
            <span>Naam van weergave</span>
            <input
              autoFocus
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Bijvoorbeeld Mijn open acties"
            />
          </label>
          <Button type="submit" disabled={!name.trim()}>
            Bewaren
          </Button>
          <Button variant="tertiary" onClick={() => setCreating(false)}>
            Annuleren
          </Button>
        </form>
      ) : (
        <Button variant="tertiary" onClick={() => setCreating(true)}>
          + Weergave bewaren
        </Button>
      )}
      {selected ? (
        <Button
          variant="tertiary"
          onClick={() => removeWorkspaceView(selected.id)}
        >
          Weergave verwijderen
        </Button>
      ) : null}
    </div>
  )
}

export interface TableColumnOption {
  id: string
  label: string
  required?: boolean
}

export function TableDisplayControl({
  table,
  columns,
}: {
  table: string
  columns: readonly TableColumnOption[]
}) {
  const [open, setOpen] = useState(false)
  const preferences = useWorkspacePreferences()
  const preference = preferences.tables[table] ?? {
    density: "comfortable" as TableDensity,
    hiddenColumns: [],
  }
  useEscapeKey(() => setOpen(false), open)

  return (
    <div className="table-display-control">
      <Button
        variant="tertiary"
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={() => setOpen((value) => !value)}
      >
        Tabelweergave
      </Button>
      {open ? (
        <div role="dialog" aria-label="Tabelweergave instellen">
          <fieldset>
            <legend>Rijdichtheid</legend>
            {(
              [
                ["comfortable", "Ruim"],
                ["compact", "Compact"],
              ] as const
            ).map(([value, label]) => (
              <label key={value}>
                <input
                  type="radio"
                  name={`${table}-density`}
                  checked={preference.density === value}
                  onChange={() => setTableDensity(table, value)}
                />
                <span>{label}</span>
              </label>
            ))}
          </fieldset>
          <fieldset>
            <legend>Zichtbare kolommen</legend>
            {columns.map((column) => (
              <label key={column.id}>
                <input
                  type="checkbox"
                  checked={!preference.hiddenColumns.includes(column.id)}
                  disabled={column.required}
                  onChange={(event) =>
                    setTableColumnVisible(
                      table,
                      column.id,
                      event.target.checked,
                    )
                  }
                />
                <span>{column.label}</span>
              </label>
            ))}
          </fieldset>
          <Button variant="tertiary" onClick={() => setOpen(false)}>
            Sluiten
          </Button>
        </div>
      ) : null}
    </div>
  )
}

export function FavoriteButton({
  route,
  label,
  kind,
}: Omit<WorkspaceLink, "visitedAt" | "favorite">) {
  const preferences = useWorkspacePreferences()
  const favorite = preferences.links.some(
    (item) => item.route === route && item.favorite,
  )
  return (
    <Button
      variant="tertiary"
      aria-pressed={favorite}
      onClick={() => toggleFavoriteWorkspaceLink({ route, label, kind })}
    >
      <span aria-hidden="true">{favorite ? "★" : "☆"}</span>{" "}
      {favorite ? "Favoriet" : "Als favoriet"}
    </Button>
  )
}
