import { DataFileService } from "../../application/services"
import { BrowserDownloadService } from "../../infrastructure/files"
import { JsonDataFileGateway } from "../../infrastructure/json"

export const jsonDataFileService = new DataFileService(
  new JsonDataFileGateway(),
  new BrowserDownloadService(),
)
