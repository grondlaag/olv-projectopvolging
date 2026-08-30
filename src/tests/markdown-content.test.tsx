import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { MarkdownContent } from "../features/journal/markdown-content"

describe("journaal-Markdown", () => {
  it("rendert meerdere paragrafen, nadruk, lijsten, code, links en checklists", () => {
    const { container } = render(
      <MarkdownContent>{`# Nieuwe fiche

**Nog te controleren** en *afstemmen* met \`EPB\`.

- maatvoering
- [x] brandweerstand

1. nakijken
2. bevestigen

[Open dossier](https://example.test/dossier)`}</MarkdownContent>,
    )

    expect(
      screen.getByRole("heading", { name: "Nieuwe fiche" }),
    ).toBeInTheDocument()
    expect(screen.getByText("Nog te controleren").tagName).toBe("STRONG")
    expect(screen.getByText("afstemmen").tagName).toBe("EM")
    expect(screen.getByText("EPB").tagName).toBe("CODE")
    expect(
      screen.getByRole("checkbox", { name: "brandweerstand" }),
    ).toBeChecked()
    expect(screen.getByRole("link", { name: "Open dossier" })).toHaveAttribute(
      "href",
      "https://example.test/dossier",
    )
    expect(container.querySelectorAll("ul li")).toHaveLength(2)
    expect(container.querySelectorAll("ol li")).toHaveLength(2)
  })
})
