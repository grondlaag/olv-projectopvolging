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
  const html = `<article style="max-width:760px;font-family:Aptos,Arial,sans-serif;color:#24342d;line-height:1.55;background:#fff"><header style="padding:28px 32px;background:#004c3f;color:#fff;border-radius:6px 6px 0 0"><div style="font-size:12px;letter-spacing:.12em;text-transform:uppercase;opacity:.8">OLV Projectopvolging</div><h1 style="margin:8px 0 0;font-size:26px;line-height:1.2">${escapeHtml(title)}</h1></header><div style="padding:14px 32px;background:#eff6f5;border-bottom:1px solid #d7e0de"><strong>${escapeHtml(formatLocalDate(model.meeting.date))}</strong><span style="margin:0 10px;color:#6b7f7b">â€¢</span>${escapeHtml(model.scopeLabel)}<br><span style="font-size:13px;color:#526b66">Voorzitter: ${escapeHtml(model.chair?.displayName ?? "â€”")} &nbsp;&nbsp; Verslaggever: ${escapeHtml(model.reporter?.displayName ?? "â€”")}</span></div><main style="padding:20px 32px 32px">${lines
    .slice(3)
    .map((line) => {
      const text = escapeHtml(line.text).replaceAll("\n", "<br>")
      if (line.level === 1)
        return `<h2 style="margin:24px 0 8px;padding-bottom:6px;border-bottom:2px solid #5fa8a6;color:#004c3f;font-size:18px">${text}</h2>`
      if (line.level === 2)
        return `<h3 style="margin:14px 0 4px;padding-left:12px;border-left:3px solid #dcedec;font-size:15px">${text}</h3>`
      return `<p style="margin:4px 0 12px;color:#334a46">${text}</p>`
    })
    .join("")}</main></article>`
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
  const drawPageHeader = (current: typeof page, continuation = false) => {
    current.drawRectangle({
      x: 0,
      y: pageSize[1] - 112,
      width: pageSize[0],
      height: 112,
      color: rgb(0, 0.3, 0.25),
    })
    current.drawText(
      continuation
        ? `${pdfSafe(document.title)} - vervolg`
        : pdfSafe(document.title),
      {
        x: margin,
        y: pageSize[1] - 58,
        size: continuation ? 15 : 22,
        font: bold,
        color: rgb(1, 1, 1),
      },
    )
    current.drawText("OLV PROJECTOPVOLGING", {
      x: margin,
      y: pageSize[1] - 30,
      size: 8,
      font: bold,
      color: rgb(0.72, 0.86, 0.83),
    })
  }
  drawPageHeader(page)
  let y = pageSize[1] - 140

  for (const line of document.lines.slice(1)) {
    const size = line.level === 1 ? 15 : line.level === 2 ? 11 : 10
    const font = line.level ? bold : regular
    const leading = size * 1.38
    const before = line.level === 1 ? 12 : line.level === 2 ? 7 : 2
    y -= before
    const wrapped = wrapText(line.text, pageSize[0] - margin * 2, font, size)
    for (const row of wrapped) {
      if (y < margin + 24) {
        page = pdf.addPage(pageSize)
        drawPageHeader(page, true)
        y = pageSize[1] - 140
      }
      if (line.level === 1) {
        page.drawLine({
          start: { x: margin, y: y - 4 },
          end: { x: pageSize[0] - margin, y: y - 4 },
          thickness: 1.4,
          color: rgb(0.37, 0.66, 0.65),
        })
      }
      page.drawText(row, {
        x: margin,
        y,
        size,
        font,
        color: line.level === 1 ? rgb(0, 0.3, 0.25) : rgb(0.14, 0.2, 0.17),
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
