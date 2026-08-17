import { useSyncExternalStore } from "react"

export const workspacePreferencesStorageKey =
  "olv-projectopvolging.workspace-preferences.v1"

export type WorkspacePage = "actions" | "planning" | "budget" | "meetings"
export type TableDensity = "comfortable" | "compact"

export interface SavedWorkspaceView {
  id: string
  page: WorkspacePage
  name: string
  search: string
  createdAt: string
}

export interface WorkspaceLink {
  route: string
  label: string
  kind: "Project" | "Topic" | "Overleg"
  visitedAt: string
  favorite: boolean
}

export interface TablePreference {
  density: TableDensity
  hiddenColumns: readonly string[]
}

interface WorkspacePreferences {
  savedViews: readonly SavedWorkspaceView[]
  links: readonly WorkspaceLink[]
  tables: Readonly<Record<string, TablePreference>>
}

const defaultPreferences: WorkspacePreferences = {
  savedViews: [],
  links: [],
  tables: {},
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value)
}

function isSavedWorkspaceView(value: unknown): value is SavedWorkspaceView {
  if (!isRecord(value)) return false
  return (
    typeof value.id === "string" &&
    ["actions", "planning", "budget", "meetings"].includes(
      String(value.page),
    ) &&
    typeof value.name === "string" &&
    typeof value.search === "string" &&
    typeof value.createdAt === "string"
  )
}

function isWorkspaceLink(value: unknown): value is WorkspaceLink {
  if (!isRecord(value)) return false
  return (
    typeof value.route === "string" &&
    value.route.startsWith("/") &&
    typeof value.label === "string" &&
    ["Project", "Topic", "Overleg"].includes(String(value.kind)) &&
    typeof value.visitedAt === "string" &&
    typeof value.favorite === "boolean"
  )
}

function isTablePreference(value: unknown): value is TablePreference {
  if (!isRecord(value)) return false
  return (
    ["comfortable", "compact"].includes(String(value.density)) &&
    Array.isArray(value.hiddenColumns) &&
    value.hiddenColumns.every((column) => typeof column === "string")
  )
}

function readPreferences(): WorkspacePreferences {
  if (typeof window === "undefined") return defaultPreferences
  try {
    const parsed = JSON.parse(
      window.localStorage.getItem(workspacePreferencesStorageKey) ?? "null",
    ) as Partial<WorkspacePreferences> | null
    if (!parsed || typeof parsed !== "object") return defaultPreferences
    const tables = isRecord(parsed.tables)
      ? Object.fromEntries(
          Object.entries(parsed.tables).filter((entry) =>
            isTablePreference(entry[1]),
          ),
        )
      : {}
    return {
      savedViews: Array.isArray(parsed.savedViews)
        ? parsed.savedViews.filter(isSavedWorkspaceView)
        : [],
      links: Array.isArray(parsed.links)
        ? parsed.links.filter(isWorkspaceLink)
        : [],
      tables,
    }
  } catch {
    return defaultPreferences
  }
}

let snapshot = readPreferences()
const listeners = new Set<() => void>()

function publish(next: WorkspacePreferences) {
  snapshot = next
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(
        workspacePreferencesStorageKey,
        JSON.stringify(next),
      )
    } catch {
      // Preferences are optional; the active project session remains usable.
    }
  }
  for (const listener of listeners) listener()
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function useWorkspacePreferences(): WorkspacePreferences {
  return useSyncExternalStore(
    subscribe,
    () => snapshot,
    () => snapshot,
  )
}

export function saveWorkspaceView(
  page: WorkspacePage,
  name: string,
  search: string,
) {
  const normalizedName = name.trim()
  if (!normalizedName) return
  const existing = snapshot.savedViews.find(
    (view) =>
      view.page === page &&
      view.name.toLocaleLowerCase("nl") ===
        normalizedName.toLocaleLowerCase("nl"),
  )
  const view: SavedWorkspaceView = {
    id: existing?.id ?? crypto.randomUUID(),
    page,
    name: normalizedName,
    search,
    createdAt: existing?.createdAt ?? new Date().toISOString(),
  }
  publish({
    ...snapshot,
    savedViews: [
      ...snapshot.savedViews.filter((item) => item.id !== view.id),
      view,
    ],
  })
}

export function removeWorkspaceView(viewId: string) {
  publish({
    ...snapshot,
    savedViews: snapshot.savedViews.filter((view) => view.id !== viewId),
  })
}

export function recordRecentWorkspaceLink(
  link: Omit<WorkspaceLink, "visitedAt" | "favorite">,
) {
  const existing = snapshot.links.find((item) => item.route === link.route)
  const next: WorkspaceLink = {
    ...link,
    visitedAt: new Date().toISOString(),
    favorite: existing?.favorite ?? false,
  }
  publish({
    ...snapshot,
    links: [next, ...snapshot.links.filter((item) => item.route !== link.route)]
      .sort((left, right) => right.visitedAt.localeCompare(left.visitedAt))
      .slice(0, 12),
  })
}

export function toggleFavoriteWorkspaceLink(
  link: Omit<WorkspaceLink, "visitedAt" | "favorite">,
) {
  const existing = snapshot.links.find((item) => item.route === link.route)
  const next: WorkspaceLink = {
    ...link,
    visitedAt: existing?.visitedAt ?? new Date().toISOString(),
    favorite: !(existing?.favorite ?? false),
  }
  publish({
    ...snapshot,
    links: [
      next,
      ...snapshot.links.filter((item) => item.route !== link.route),
    ],
  })
}

export function setTableDensity(table: string, density: TableDensity) {
  const current = snapshot.tables[table] ?? {
    density: "comfortable",
    hiddenColumns: [],
  }
  publish({
    ...snapshot,
    tables: { ...snapshot.tables, [table]: { ...current, density } },
  })
}

export function setTableColumnVisible(
  table: string,
  column: string,
  visible: boolean,
) {
  const current = snapshot.tables[table] ?? {
    density: "comfortable",
    hiddenColumns: [],
  }
  const hiddenColumns = visible
    ? current.hiddenColumns.filter((item) => item !== column)
    : [...new Set([...current.hiddenColumns, column])]
  publish({
    ...snapshot,
    tables: {
      ...snapshot.tables,
      [table]: { ...current, hiddenColumns },
    },
  })
}

export function resetWorkspacePreferences() {
  snapshot = defaultPreferences
  if (typeof window !== "undefined") {
    window.localStorage.removeItem(workspacePreferencesStorageKey)
  }
  for (const listener of listeners) listener()
}
