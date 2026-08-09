import { NavLink } from "react-router-dom"
import "./shell.css"

const navigationItems = [
  { to: "/dashboard", label: "Dashboard", marker: "D" },
  { to: "/portfolio", label: "Portfolio", marker: "P" },
  { to: "/actions", label: "Acties", marker: "A" },
  { to: "/planning", label: "Planning", marker: "PL" },
  { to: "/budget", label: "Budget", marker: "B" },
  { to: "/meetings", label: "Overleg", marker: "O" },
  { to: "/settings", label: "Instellingen", marker: "I" },
] as const

export function MainNavigation() {
  return (
    <nav className="main-navigation" aria-label="Hoofdnavigatie">
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
              <span aria-hidden="true">{item.marker}</span>
              {item.label}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  )
}
