import { IndexedDbSessionSnapshotRepository } from "../../infrastructure/indexed-db"

export const sessionSnapshotRepository =
  new IndexedDbSessionSnapshotRepository()

export async function discardPersistedSession(): Promise<void> {
  await sessionSnapshotRepository.clear()
}
