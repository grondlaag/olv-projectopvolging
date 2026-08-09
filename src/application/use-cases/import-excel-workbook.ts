import type { ExcelWorkbookGateway, ImportedExcelSession } from "../services"

export class ImportExcelWorkbookUseCase {
  constructor(private readonly gateway: ExcelWorkbookGateway) {}

  execute(file: File, repairMode = false): Promise<ImportedExcelSession> {
    return this.gateway.importFile(file, repairMode)
  }
}
