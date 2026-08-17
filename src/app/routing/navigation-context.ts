import type { Location } from "react-router-dom"

export function currentAppRoute(
  location: Pick<Location, "pathname" | "search">,
): string {
  return `${location.pathname}${location.search}`
}

export function withReturnTo(path: string, returnTo: string): string {
  const parameters = new URLSearchParams({ returnTo })
  return `${path}?${parameters.toString()}`
}

export function safeReturnTo(
  candidate: string | null | undefined,
  fallback: string,
): string {
  if (!candidate?.startsWith("/") || candidate.startsWith("//")) {
    return fallback
  }
  return candidate
}
