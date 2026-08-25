import { NavLink } from "react-router-dom"
import {
  toggleFavoriteWorkspaceLink,
  useWorkspacePreferences,
} from "../../app/preferences/workspace-preferences"
import { Icon, type IconName } from "./icon"
import "./shell.css"

const navigationItems = [
  { to: "/dashboard", label: "Dashboard", icon: "dashboard" },
  { to: "/portfolio", label: "Portfolio", icon: "portfolio" },
  { to: "/actions", label: "Acties", icon: "actions" },
  { to: "/planning", label: "Planning", icon: "planning" },
  { to: "/budget", label: "Budget", icon: "budget" },
  { to: "/meetings", label: "Overleg", icon: "meetings" },
] as const

export function MainNavigation() {
  const preferences = useWorkspacePreferences()
  const favoriteLinks = preferences.links.filter((item) => item.favorite)
  const quickLinks = [
    ...favoriteLinks,
    ...preferences.links.filter((item) => !item.favorite),
  ].slice(0, 5)
  return (
    <aside className="main-navigation">
      <nav aria-label="Hoofdnavigatie">
        <p className="main-navigation__label">Werkruimte</p>
        <ul className="main-navigation__list">
          {navigationItems.map((item) => (
            <li key={item.to}>
              <NavLink
                className={({ isActive }) =>
                  `main-navigation__link${isActive ? " main-navigation__link--active" : ""}`
                }
                to={item.to}
              >
                <Icon name={item.icon as IconName} />
                {item.label}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
      {quickLinks.length ? (
        <nav className="main-navigation__quick" aria-label="Snel bereikbaar">
          <p className="main-navigation__label">Snel bereikbaar</p>
          <ul>
            {quickLinks.map((item) => (
              <li key={item.route}>
                <NavLink to={item.route} title={item.label}>
                  <small>{item.kind}</small>
                  <span>{item.label}</span>
                </NavLink>
                <button
                  type="button"
                  aria-label={`${item.favorite ? "Verwijder" : "Maak"} ${item.label} ${item.favorite ? "uit favorieten" : "favoriet"}`}
                  aria-pressed={item.favorite}
                  onClick={() =>
                    toggleFavoriteWorkspaceLink({
                      route: item.route,
                      label: item.label,
                      kind: item.kind,
                    })
                  }
                >
                  <span aria-hidden="true">{item.favorite ? "★" : "☆"}</span>
                </button>
              </li>
            ))}
          </ul>
        </nav>
      ) : null}
      <nav className="main-navigation__settings" aria-label="Beheer">
        <NavLink
          className={({ isActive }) =>
            `main-navigation__link${isActive ? " main-navigation__link--active" : ""}`
          }
          to="/settings"
        >
          <Icon name="settings" />
          Instellingen
        </NavLink>
      </nav>
    </aside>
  )
}
