import type { SVGProps } from "react"

export type IconName =
  | "dashboard"
  | "portfolio"
  | "actions"
  | "planning"
  | "budget"
  | "meetings"
  | "settings"
  | "search"
  | "plus"
  | "open"
  | "download"

const paths: Record<IconName, string> = {
  dashboard: "M3 3h7v7H3zM14 3h7v4h-7zM14 11h7v10h-7zM3 14h7v7H3z",
  portfolio: "M3 7h18v13H3zM8 7V4h8v3M3 12h18",
  actions: "M4 12l5 5L20 6",
  planning: "M4 5h16v16H4zM8 3v4M16 3v4M4 10h16M8 14h3M8 18h6",
  budget: "M4 6h16v12H4zM4 9h16M8 14h3M16 14h1",
  meetings:
    "M16 18c3 0 5-1.5 5-3.5S19 11 16 11s-5 1.5-5 3.5S13 18 16 18ZM8 12c2.8 0 5-1.6 5-3.5S10.8 5 8 5 3 6.6 3 8.5 5.2 12 8 12ZM2 20c0-3 2.7-5 6-5 1.1 0 2.1.2 3 .6",
  settings:
    "M12 8.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7ZM19 13.5v-3l-2.2-.7-.7-1.6 1.1-2-2.1-2.1-2 1.1-1.6-.7L10.5 2h-3l-.7 2.2-1.6.7-2-1.1-2.1 2.1 1.1 2-.7 1.6L0 10.5v3l2.2.7.7 1.6-1.1 2 2.1 2.1 2-1.1 1.6.7.7 2.2h3l.7-2.2 1.6-.7 2 1.1 2.1-2.1-1.1-2 .7-1.6Z",
  search: "M11 18a7 7 0 1 1 0-14 7 7 0 0 1 0 14ZM16 16l5 5",
  plus: "M12 5v14M5 12h14",
  open: "M3 7h7l2 2h9v11H3zM3 7V4h7l2 3",
  download: "M12 3v12M7 10l5 5 5-5M4 20h16",
}

export function Icon({
  name,
  ...props
}: { name: IconName } & SVGProps<SVGSVGElement>) {
  return (
    <svg
      aria-hidden="true"
      className="icon"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.65"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d={paths[name]} />
    </svg>
  )
}
