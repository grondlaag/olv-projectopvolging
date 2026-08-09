import type {
  ExcelWorkbookGateway,
  ExportedExcelWorkbook,
  ImportedExcelSession,
  NormalizedDomainState,
} from "../../../application/services"

const workbookMime =
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"

interface WorkerSuccess<T> {
  id: number
  ok: true
  result: T
}

interface WorkerFailure {
  id: number
  ok: false
  error: string
}

type WorkerResponse<T> = WorkerSuccess<T> | WorkerFailure
type SerializableExport = Omit<ExportedExcelWorkbook, "blob">

let requestSequence = 0

function localTimestamp(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, "0")
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}_${pad(date.getHours())}-${pad(date.getMinutes())}`
}

export class WorkerExcelWorkbookGateway implements ExcelWorkbookGateway {
  async importFile(
    file: File,
    repairMode = false,
  ): Promise<ImportedExcelSession> {
    return this.importBuffer(await file.arrayBuffer(), file.name, repairMode)
  }

  importBuffer(
    buffer: ArrayBuffer,
    fileName: string,
    repairMode = false,
  ): Promise<ImportedExcelSession> {
    return this.run<ImportedExcelSession>(
      { operation: "import", buffer, fileName, repairMode },
      [buffer],
    )
  }

  async export(
    state: NormalizedDomainState,
    sourceBuffer?: ArrayBuffer,
  ): Promise<ExportedExcelWorkbook> {
    const result = await this.run<SerializableExport>({
      operation: "export",
      state,
      ...(sourceBuffer ? { sourceBuffer } : {}),
    })
    return {
      ...result,
      blob: new Blob([result.buffer], { type: workbookMime }),
    }
  }

  async exportTemplate(): Promise<ExportedExcelWorkbook> {
    const result = await this.run<SerializableExport>({
      operation: "template",
    })
    return {
      ...result,
      blob: new Blob([result.buffer], { type: workbookMime }),
    }
  }

  exportBackup(
    sourceBuffer: ArrayBuffer,
    sourceFileName: string,
  ): ExportedExcelWorkbook {
    const buffer = sourceBuffer.slice(0)
    const baseName = sourceFileName.replace(/\.(xlsx|xlsm)$/iu, "")
    return {
      buffer,
      blob: new Blob([buffer], { type: workbookMime }),
      fileName: `${baseName}_backup_${localTimestamp(new Date())}.xlsx`,
      issues: [],
      preservationWarnings: [],
    }
  }

  private async run<T>(
    payload: Record<string, unknown>,
    transfer: Transferable[] = [],
  ): Promise<T> {
    if (typeof Worker === "undefined") {
      const { BrowserExcelWorkbookGateway } =
        await import("../excel-workbook-gateway")
      const fallback = new BrowserExcelWorkbookGateway()
      if (payload.operation === "import") {
        return fallback.importBuffer(
          payload.buffer as ArrayBuffer,
          payload.fileName as string,
          payload.repairMode as boolean,
        ) as Promise<T>
      }
      if (payload.operation === "template")
        return fallback.exportTemplate() as Promise<T>
      return fallback.export(
        payload.state as NormalizedDomainState,
        payload.sourceBuffer as ArrayBuffer | undefined,
      ) as Promise<T>
    }

    const id = ++requestSequence
    const worker = new Worker(new URL("./excel.worker.ts", import.meta.url), {
      type: "module",
    })
    return new Promise<T>((resolve, reject) => {
      worker.onmessage = (event: MessageEvent<WorkerResponse<T>>) => {
        if (event.data.id !== id) return
        worker.terminate()
        if (event.data.ok) resolve(event.data.result)
        else reject(new Error(event.data.error))
      }
      worker.onerror = () => {
        worker.terminate()
        reject(
          new Error(
            "De lokale Excelverwerking kon niet worden gestart. Probeer opnieuw.",
          ),
        )
      }
      worker.postMessage({ id, ...payload }, { transfer })
    })
  }
}
