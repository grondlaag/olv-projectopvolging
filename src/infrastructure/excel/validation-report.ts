export const validationLevels = [
  "Blocking",
  "Recoverable",
  "Warning",
  "Info",
] as const

export type ValidationLevel = (typeof validationLevels)[number]

export interface ExcelValidationIssue {
  level: ValidationLevel
  code: string
  message: string
  tableName?: string
  rowNumber?: number
  columnName?: string
  repaired?: boolean
}

export class ValidationReport {
  readonly issues: ExcelValidationIssue[] = []

  add(issue: ExcelValidationIssue): void {
    this.issues.push(issue)
  }

  addMany(issues: readonly ExcelValidationIssue[]): void {
    this.issues.push(...issues)
  }

  get hasBlockingIssues(): boolean {
    return this.issues.some((issue) => issue.level === "Blocking")
  }

  count(level: ValidationLevel): number {
    return this.issues.filter((issue) => issue.level === level).length
  }
}
