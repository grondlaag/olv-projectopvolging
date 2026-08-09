/// <reference lib="webworker" />

import type { NormalizedDomainState } from "../../../application/services"
import { BrowserExcelWorkbookGateway } from "../excel-workbook-gateway"

type WorkerRequest =
  | {
      id: number
      operation: "import"
      buffer: ArrayBuffer
      fileName: string
      repairMode: boolean
    }
  | {
      id: number
      operation: "export"
      state: NormalizedDomainState
      sourceBuffer?: ArrayBuffer
    }
  | { id: number; operation: "template" }

const gateway = new BrowserExcelWorkbookGateway()

self.onmessage = async (event: MessageEvent<WorkerRequest>) => {
  const request = event.data
  try {
    if (request.operation === "import") {
      const session = await gateway.importBuffer(
        request.buffer,
        request.fileName,
        request.repairMode,
      )
      self.postMessage(
        { id: request.id, ok: true, result: session },
        { transfer: [session.sourceBuffer] },
      )
      return
    }
    const exported =
      request.operation === "export"
        ? await gateway.export(request.state, request.sourceBuffer)
        : await gateway.exportTemplate()
    const serializable = {
      buffer: exported.buffer,
      fileName: exported.fileName,
      issues: exported.issues,
      preservationWarnings: exported.preservationWarnings,
    }
    self.postMessage(
      { id: request.id, ok: true, result: serializable },
      { transfer: [serializable.buffer] },
    )
  } catch (cause) {
    self.postMessage({
      id: request.id,
      ok: false,
      error:
        cause instanceof Error
          ? cause.message
          : "De Excelbewerking is mislukt.",
    })
  }
}
