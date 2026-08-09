import ExcelJS from "exceljs"
import type { LoadedExcelWorkbook } from "./workbook-types"

function extension(fileName: string): string {
  const dot = fileName.lastIndexOf(".")
  return dot >= 0 ? fileName.slice(dot).toLowerCase() : ""
}

export class ExcelWorkbookLoader {
  async loadFile(file: File): Promise<LoadedExcelWorkbook> {
    return this.loadArrayBuffer(await file.arrayBuffer(), file.name)
  }

  async loadArrayBuffer(
    sourceBuffer: ArrayBuffer,
    fileName = "workbook.xlsx",
  ): Promise<LoadedExcelWorkbook> {
    const fileExtension = extension(fileName)
    if (fileExtension !== ".xlsx" && fileExtension !== ".xlsm") {
      throw new Error("Selecteer een .xlsx- of .xlsm-bestand.")
    }

    const workbook = new ExcelJS.Workbook()
    await workbook.xlsx.load(sourceBuffer as never)

    return {
      workbook,
      sourceBuffer: sourceBuffer.slice(0),
      fileName,
      format: fileExtension === ".xlsm" ? "xlsm" : "xlsx",
    }
  }
}
