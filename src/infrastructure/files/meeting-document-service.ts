import { PDFDocument, StandardFonts, rgb } from "pdf-lib"
import type { MeetingDetailModel } from "../../application/queries"
import { formatLocalDate } from "../../utils"

export type MeetingDocumentKind = "agenda" | "report"

export interface MeetingDocument {
  title: string
  fileName: string
  plainText: string
  html: string
  lines: readonly { text: string; level: 0 | 1 | 2 }[]
}

function safeFileName(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9-_]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLocaleLowerCase("nl")
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;")
}

function agendaLines(model: MeetingDetailModel) {
  return model.agendaGroups.flatMap((group) => [
    {
      text: `${group.chapter?.title ?? "Zonder hoofdstuk"} / ${group.cluster?.title ?? "Zonder cluster"} / ${group.label}`,
      level: 1 as const,
    },
    ...group.items.flatMap((item) => [
      {
        text: `${item.order}. ${item.title} [${item.discussionStatus}]`,
        level: 2 as const,
      },
      ...(item.reason
        ? [{ text: `Aanleiding: ${item.reason}`, level: 0 as const }]
        : []),
    ]),
  ])
}

function reportLines(model: MeetingDetailModel) {
  if (!model.selectedReport)
    return [
      { text: "Er is nog geen conceptverslag opgebouwd.", level: 0 as const },
    ]
  const lines: { text: string; level: 0 | 1 | 2 }[] = []
  let section = ""
  for (const item of model.selectedReportItems) {
    if (item.section !== section) {
      section = item.section
      lines.push({ text: section, level: 1 })
    }
    lines.push({ text: item.titleSnapshot, level: 2 })
    if (item.textSnapshot) lines.push({ text: item.textSnapshot, level: 0 })
  }
  return lines
}

export function buildMeetingDocument(
  model: MeetingDetailModel,
  kind: MeetingDocumentKind,
): MeetingDocument {
  const title = `${kind === "agenda" ? "Agenda" : "Verslag"} · ${model.meeting.title}`
  const lines = [
    { text: title, level: 1 as const },
    {
      text: `${formatLocalDate(model.meeting.date)} · ${model.scopeLabel}`,
      level: 0 as const,
    },
    {
      text: `Voorzitter: ${model.chair?.displayName ?? "—"} · Verslaggever: ${model.reporter?.displayName ?? "—"}`,
      level: 0 as const,
    },
    ...(kind === "agenda" ? agendaLines(model) : reportLines(model)),
  ]
  const plainText = lines
    .map((line) => `${line.level === 2 ? "- " : ""}${line.text}`)
    .join("\n")
  const html = `<article style="font-family: Aptos, Arial, sans-serif; color: #24342d; line-height: 1.5">${lines
    .map((line) => {
      const text = escapeHtml(line.text).replaceAll("\n", "<br>")
      if (line.level === 1)
        return `<h2 style="margin: 20px 0 6px; color: #315c49">${text}</h2>`
      if (line.level === 2)
        return `<h3 style="margin: 12px 0 3px; font-size: 16px">${text}</h3>`
      return `<p style="margin: 3px 0 9px">${text}</p>`
    })
    .join("")}</article>`
  return {
    title,
    fileName: `${kind === "agenda" ? "agenda" : "verslag"}-${safeFileName(model.meeting.number ?? model.meeting.title)}.pdf`,
    plainText,
    html,
    lines,
  }
}

function pdfSafe(value: string): string {
  return value
    .replaceAll("·", "-")
    .replaceAll("—", "-")
    .replaceAll("…", "...")
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
}

function wrapText(
  text: string,
  maxWidth: number,
  font: { widthOfTextAtSize(value: string, size: number): number },
  size: number,
): string[] {
  const result: string[] = []
  for (const paragraph of pdfSafe(text).split("\n")) {
    const words = paragraph.split(/\s+/).filter(Boolean)
    let line = ""
    for (const word of words) {
      const candidate = line ? `${line} ${word}` : word
      if (line && font.widthOfTextAtSize(candidate, size) > maxWidth) {
        result.push(line)
        line = word
      } else {
        line = candidate
      }
    }
    result.push(line)
  }
  return result
}

export async function createMeetingPdfBytes(
  document: MeetingDocument,
): Promise<Uint8Array> {
  const pdf = await PDFDocument.create()
  const regular = await pdf.embedFont(StandardFonts.Helvetica)
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold)
  const pageSize: [number, number] = [595.28, 841.89]
  const margin = 54
  let page = pdf.addPage(pageSize)
  let y = pageSize[1] - margin

  for (const line of document.lines) {
    const size = line.level === 1 ? 15 : line.level === 2 ? 11 : 10
    const font = line.level ? bold : regular
    const leading = size * 1.38
    const before = line.level === 1 ? 12 : line.level === 2 ? 7 : 2
    y -= before
    const wrapped = wrapText(line.text, pageSize[0] - margin * 2, font, size)
    for (const row of wrapped) {
      if (y < margin + 24) {
        page = pdf.addPage(pageSize)
        y = pageSize[1] - margin
      }
      page.drawText(row, {
        x: margin,
        y,
        size,
        font,
        color: line.level === 1 ? rgb(0.19, 0.36, 0.29) : rgb(0.14, 0.2, 0.17),
      })
      y -= leading
    }
  }

  const pages = pdf.getPages()
  pages.forEach((current, index) => {
    current.drawText(`${index + 1} / ${pages.length}`, {
      x: pageSize[0] - margin - 28,
      y: 28,
      size: 8,
      font: regular,
      color: rgb(0.42, 0.46, 0.44),
    })
  })
  return pdf.save()
}

export async function downloadMeetingPdf(
  document: MeetingDocument,
): Promise<void> {
  const bytes = await createMeetingPdfBytes(document)
  const blob = new Blob([bytes as BlobPart], { type: "application/pdf" })
  const url = URL.createObjectURL(blob)
  const link = window.document.createElement("a")
  link.href = url
  link.download = document.fileName
  link.click()
  URL.revokeObjectURL(url)
}

export async function copyMeetingRichText(
  document: MeetingDocument,
): Promise<void> {
  if (typeof ClipboardItem !== "undefined" && navigator.clipboard?.write) {
    await navigator.clipboard.write([
      new ClipboardItem({
        "text/html": new Blob([document.html], { type: "text/html" }),
        "text/plain": new Blob([document.plainText], { type: "text/plain" }),
      }),
    ])
    return
  }
  await navigator.clipboard.writeText(document.plainText)
}
