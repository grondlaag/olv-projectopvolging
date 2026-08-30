import { Fragment, type ReactNode } from "react"

function safeHref(value: string): string | undefined {
  const href = value.trim()
  return /^(https?:\/\/|mailto:|#\/)/i.test(href) ? href : undefined
}

function inlineMarkdown(text: string): ReactNode[] {
  const token = /(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`|\[[^\]]+\]\([^)]+\))/g
  return text
    .split(token)
    .filter(Boolean)
    .map((part, index) => {
      if (part.startsWith("**") && part.endsWith("**")) {
        return <strong key={index}>{part.slice(2, -2)}</strong>
      }
      if (part.startsWith("*") && part.endsWith("*")) {
        return <em key={index}>{part.slice(1, -1)}</em>
      }
      if (part.startsWith("`") && part.endsWith("`")) {
        return <code key={index}>{part.slice(1, -1)}</code>
      }
      const link = /^\[([^\]]+)\]\(([^)]+)\)$/.exec(part)
      if (link) {
        const href = safeHref(link[2]!)
        return href ? (
          <a key={index} href={href} target="_blank" rel="noreferrer">
            {link[1]}
          </a>
        ) : (
          <Fragment key={index}>{link[1]}</Fragment>
        )
      }
      return <Fragment key={index}>{part}</Fragment>
    })
}

export function MarkdownContent({ children }: { children: string }) {
  const lines = children.replace(/\r\n?/g, "\n").split("\n")
  const blocks: ReactNode[] = []
  let index = 0

  while (index < lines.length) {
    const line = lines[index]!
    if (!line.trim()) {
      index += 1
      continue
    }
    const heading = /^(#{1,3})\s+(.+)$/.exec(line)
    if (heading) {
      const content = inlineMarkdown(heading[2]!)
      blocks.push(
        heading[1]!.length === 1 ? (
          <h3 key={index}>{content}</h3>
        ) : heading[1]!.length === 2 ? (
          <h4 key={index}>{content}</h4>
        ) : (
          <h5 key={index}>{content}</h5>
        ),
      )
      index += 1
      continue
    }
    const list = /^\s*(?:[-*]|\d+\.)\s+(.+)$/.exec(line)
    if (list) {
      const ordered = /^\s*\d+\./.test(line)
      const items: ReactNode[] = []
      while (index < lines.length) {
        const candidate = lines[index]!
        const match = ordered
          ? /^\s*\d+\.\s+(.+)$/.exec(candidate)
          : /^\s*[-*]\s+(.+)$/.exec(candidate)
        if (!match) break
        const checklist = /^\[([ xX])\]\s+(.+)$/.exec(match[1]!)
        items.push(
          <li key={index} className={checklist ? "is-checklist" : undefined}>
            {checklist ? (
              <>
                <input
                  type="checkbox"
                  checked={checklist[1]!.toLowerCase() === "x"}
                  readOnly
                  aria-label={checklist[2]}
                />
                <span>{inlineMarkdown(checklist[2]!)}</span>
              </>
            ) : (
              inlineMarkdown(match[1]!)
            )}
          </li>,
        )
        index += 1
      }
      blocks.push(
        ordered ? (
          <ol key={`l-${index}`}>{items}</ol>
        ) : (
          <ul key={`l-${index}`}>{items}</ul>
        ),
      )
      continue
    }
    const paragraph: string[] = []
    while (
      index < lines.length &&
      lines[index]!.trim() &&
      !/^(#{1,3})\s+/.test(lines[index]!) &&
      !/^\s*(?:[-*]|\d+\.)\s+/.test(lines[index]!)
    ) {
      paragraph.push(lines[index]!)
      index += 1
    }
    blocks.push(
      <p key={`p-${index}`}>
        {paragraph.map((part, partIndex) => (
          <Fragment key={partIndex}>
            {partIndex ? <br /> : null}
            {inlineMarkdown(part)}
          </Fragment>
        ))}
      </p>,
    )
  }

  return <div className="markdown-content">{blocks}</div>
}
