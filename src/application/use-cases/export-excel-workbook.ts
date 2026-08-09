import type {
  ExcelWorkbookGateway,
  ExportedExcelWorkbook,
  NormalizedDomainState,
} from "../services"

export class ExportExcelWorkbookUseCase {
  constructor(private readonly gateway: ExcelWorkbookGateway) {}

  execute(
    state: NormalizedDomainState,
    sourceBuffer?: ArrayBuffer,
  ): Promise<ExportedExcelWorkbook> {
    return this.gateway.export(state, sourceBuffer)
  }
}
