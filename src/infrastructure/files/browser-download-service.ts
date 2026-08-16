import type { DataFileDownloadPort } from "../../application/services/data-file-service"

export class BrowserDownloadService implements DataFileDownloadPort {
  download(blob: Blob, fileName: string): void {
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement("a")
    anchor.href = url
    anchor.download = fileName
    anchor.click()
    URL.revokeObjectURL(url)
  }
}
