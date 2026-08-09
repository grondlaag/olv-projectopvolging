import { EXCEL_SCHEMA_VERSION } from "../schema"

export interface ExcelMigrationPlan {
  sourceVersion?: string
  targetVersion: string
  required: boolean
  supported: boolean
  steps: readonly string[]
}

export class ExcelMigrationService {
  plan(sourceVersion?: string): ExcelMigrationPlan {
    if (sourceVersion === EXCEL_SCHEMA_VERSION) {
      return {
        sourceVersion,
        targetVersion: EXCEL_SCHEMA_VERSION,
        required: false,
        supported: true,
        steps: [],
      }
    }

    return {
      ...(sourceVersion === undefined ? {} : { sourceVersion }),
      targetVersion: EXCEL_SCHEMA_VERSION,
      required: true,
      supported: false,
      steps: [
        "Maak eerst een back-up.",
        "Gebruik een expliciete migratieregel voor deze schemaversie.",
      ],
    }
  }
}
