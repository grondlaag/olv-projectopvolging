import { create } from "zustand"
import {
  defaultPortfolioFilters,
  type PortfolioFilters,
} from "../../application/queries"
import type {
  DataFileSession,
  NormalizedDomainState,
  RecoverableSessionSnapshot,
} from "../../application/services"

interface AppState {
  loadedFileName: string | undefined
  session: DataFileSession | undefined
  pendingSession: DataFileSession | undefined
  recoveryCandidate: RecoverableSessionSnapshot | undefined
  dirty: boolean
  lastSavedAt: string | undefined
  importPanelOpen: boolean
  portfolioFilters: PortfolioFilters
  setLoadedFile: (fileName?: string) => void
  setPendingSession: (session?: DataFileSession) => void
  confirmPendingSession: () => void
  restoreSnapshot: (
    snapshot: RecoverableSessionSnapshot,
    session: DataFileSession,
  ) => void
  discardRecovery: () => void
  setDirty: (dirty: boolean) => void
  replaceDomainState: (domainState: NormalizedDomainState) => void
  markSaved: (fileName?: string, savedAt?: string) => void
  setImportPanelOpen: (open: boolean) => void
  setPortfolioFilters: (filters: PortfolioFilters) => void
  reset: () => void
}

const initialState = {
  loadedFileName: undefined,
  session: undefined,
  pendingSession: undefined,
  recoveryCandidate: undefined,
  dirty: false,
  lastSavedAt: undefined,
  importPanelOpen: false,
  portfolioFilters: defaultPortfolioFilters,
} satisfies Pick<
  AppState,
  | "loadedFileName"
  | "session"
  | "pendingSession"
  | "recoveryCandidate"
  | "dirty"
  | "lastSavedAt"
  | "importPanelOpen"
  | "portfolioFilters"
>

export const useAppStore = create<AppState>((set) => ({
  ...initialState,
  setLoadedFile: (loadedFileName) => set({ loadedFileName }),
  setPendingSession: (pendingSession) => set({ pendingSession }),
  confirmPendingSession: () =>
    set((state) => {
      if (!state.pendingSession) return state
      return {
        session: state.pendingSession,
        loadedFileName: state.pendingSession.fileName,
        pendingSession: undefined,
        recoveryCandidate: undefined,
        dirty: state.pendingSession.origin === "new",
        lastSavedAt: undefined,
        importPanelOpen: false,
      }
    }),
  restoreSnapshot: (snapshot, session) =>
    set({
      session,
      loadedFileName: session.fileName,
      recoveryCandidate: undefined,
      dirty: snapshot.dirty,
      lastSavedAt:
        snapshot.version === 1 ? snapshot.lastExportAt : snapshot.lastSavedAt,
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
  markSaved: (fileName, savedAt = new Date().toISOString()) =>
    set((state) => ({
      dirty: false,
      lastSavedAt: savedAt,
      ...(fileName ? { loadedFileName: fileName } : {}),
      ...(state.session && fileName
        ? { session: { ...state.session, fileName, origin: "import" } }
        : {}),
    })),
  setImportPanelOpen: (importPanelOpen) => set({ importPanelOpen }),
  setPortfolioFilters: (portfolioFilters) => set({ portfolioFilters }),
  reset: () => set({ ...initialState }),
}))
