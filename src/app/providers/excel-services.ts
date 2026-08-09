import { ExcelWorkbookService } from "../../application/services"
import { BrowserDownloadService } from "../../infrastructure/excel/export/browser-download-service"
import { WorkerExcelWorkbookGateway } from "../../infrastructure/excel/workers"

const gateway = new WorkerExcelWorkbookGateway()
const downloadService = new BrowserDownloadService()

export const excelWorkbookService = new ExcelWorkbookService(
  gateway,
  downloadService,
)
