// IndexedDB session adapters are intentionally deferred beyond Phase 0.
import type {
  SessionSnapshotRepository,
  WorkbookSessionSnapshot,
} from "../../application/services"

const databaseName = "olv-projectopvolging"
const storeName = "session-snapshots"
const activeSessionKey = "active"

function requestResult<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result)
    request.onerror = () =>
      reject(request.error ?? new Error("IndexedDB-bewerking is mislukt."))
  })
}

function transactionComplete(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve()
    transaction.onabort = () =>
      reject(transaction.error ?? new Error("IndexedDB-transactie is gestopt."))
    transaction.onerror = () =>
      reject(transaction.error ?? new Error("IndexedDB-transactie is mislukt."))
  })
}

async function openDatabase(): Promise<IDBDatabase | undefined> {
  if (typeof indexedDB === "undefined") return undefined
  const request = indexedDB.open(databaseName, 1)
  request.onupgradeneeded = () => {
    if (!request.result.objectStoreNames.contains(storeName)) {
      request.result.createObjectStore(storeName)
    }
  }
  return requestResult(request)
}

export class IndexedDbSessionSnapshotRepository implements SessionSnapshotRepository {
  async load(): Promise<WorkbookSessionSnapshot | undefined> {
    const database = await openDatabase()
    if (!database) return undefined
    try {
      const transaction = database.transaction(storeName, "readonly")
      const completed = transactionComplete(transaction)
      const value = await requestResult(
        transaction.objectStore(storeName).get(activeSessionKey),
      )
      await completed
      if (!value || typeof value !== "object") return undefined
      const snapshot = value as WorkbookSessionSnapshot
      return snapshot.version === 1 ? snapshot : undefined
    } finally {
      database.close()
    }
  }

  async save(snapshot: WorkbookSessionSnapshot): Promise<void> {
    const database = await openDatabase()
    if (!database) return
    try {
      const transaction = database.transaction(storeName, "readwrite")
      const completed = transactionComplete(transaction)
      transaction.objectStore(storeName).put(snapshot, activeSessionKey)
      await completed
    } finally {
      database.close()
    }
  }

  async clear(): Promise<void> {
    const database = await openDatabase()
    if (!database) return
    try {
      const transaction = database.transaction(storeName, "readwrite")
      const completed = transactionComplete(transaction)
      transaction.objectStore(storeName).delete(activeSessionKey)
      await completed
    } finally {
      database.close()
    }
  }
}
