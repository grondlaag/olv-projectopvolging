import { create } from "zustand"
import {
  defaultPortfolioFilters,
  type PortfolioFilters,
} from "../../application/queries"
import type {
  ImportedExcelSession,
  NormalizedDomainState,
  WorkbookSessionSnapshot,
} from "../../application/services"

interface AppState {
  loadedFileName: string | undefined
  session: ImportedExcelSession | undefined
  pendingImport: ImportedExcelSession | undefined
  recoveryCandidate: WorkbookSessionSnapshot | undefined
  dirty: boolean
  lastExportAt: string | undefined
  importPanelOpen: boolean
  portfolioFilters: PortfolioFilters
  setLoadedFile: (fileName?: string) => void
  setPendingImport: (session?: ImportedExcelSession) => void
  confirmPendingImport: () => void
  restoreSnapshot: (
    snapshot: WorkbookSessionSnapshot,
    session: ImportedExcelSession,
  ) => void
  discardRecovery: () => void
  setDirty: (dirty: boolean) => void
  replaceDomainState: (domainState: NormalizedDomainState) => void
  markExported: (exportedAt?: string) => void
  setImportPanelOpen: (open: boolean) => void
  setPortfolioFilters: (filters: PortfolioFilters) => void
  reset: () => void
}

const initialState = {
  loadedFileName: undefined,
  session: undefined,
  pendingImport: undefined,
  recoveryCandidate: undefined,
  dirty: false,
  lastExportAt: undefined,
  importPanelOpen: false,
  portfolioFilters: defaultPortfolioFilters,
} satisfies Pick<
  AppState,
  | "loadedFileName"
  | "session"
  | "pendingImport"
  | "recoveryCandidate"
  | "dirty"
  | "lastExportAt"
  | "importPanelOpen"
  | "portfolioFilters"
>

export const useAppStore = create<AppState>((set) => ({
  ...initialState,
  setLoadedFile: (loadedFileName) => set({ loadedFileName }),
  setPendingImport: (pendingImport) => set({ pendingImport }),
  confirmPendingImport: () =>
    set((state) => {
      if (!state.pendingImport) return state
      return {
        session: state.pendingImport,
        loadedFileName: state.pendingImport.fileName,
        pendingImport: undefined,
        recoveryCandidate: undefined,
        dirty: false,
        lastExportAt: undefined,
        importPanelOpen: false,
      }
    }),
  restoreSnapshot: (snapshot, session) =>
    set({
      session,
      loadedFileName: session.fileName,
      recoveryCandidate: undefined,
      dirty: snapshot.dirty,
      lastExportAt: snapshot.lastExportAt,
    }),
  discardRecovery: () => set({ recoveryCandidate: undefined }),
  setDirty: (dirty) => set({ dirty }),
  replaceDomainState: (domainState) =>
    set((state) =>
      state.session
        ? {
            session: { ...state.session, state: domainState },
            dirty: true,
          }
        : state,
    ),
  markExported: (exportedAt = new Date().toISOString()) =>
    set({ dirty: false, lastExportAt: exportedAt }),
  setImportPanelOpen: (importPanelOpen) => set({ importPanelOpen }),
  setPortfolioFilters: (portfolioFilters) => set({ portfolioFilters }),
  reset: () => set({ ...initialState }),
}))
