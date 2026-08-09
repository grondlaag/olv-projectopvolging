import type { Entity, Repository, UUID } from "../../domain"

export class InMemoryRepository<T extends Entity> implements Repository<T> {
  readonly #records = new Map<UUID, T>()

  constructor(initialRecords: readonly T[] = []) {
    for (const record of initialRecords) {
      this.#records.set(record.id, structuredClone(record))
    }
  }

  async list(): Promise<readonly T[]> {
    return [...this.#records.values()].map((record) => structuredClone(record))
  }

  async get(id: UUID): Promise<T | undefined> {
    const record = this.#records.get(id)
    return record ? structuredClone(record) : undefined
  }

  async create(entity: T): Promise<T> {
    if (this.#records.has(entity.id)) {
      throw new Error(`Record met id ${entity.id} bestaat al.`)
    }

    const copy = structuredClone(entity)
    this.#records.set(entity.id, copy)
    return structuredClone(copy)
  }

  async update(id: UUID, patch: Partial<Omit<T, "id">>): Promise<T> {
    const current = this.#records.get(id)
    if (!current) {
      throw new Error(`Record met id ${id} bestaat niet.`)
    }

    const updated = { ...current, ...structuredClone(patch), id }
    this.#records.set(id, updated)
    return structuredClone(updated)
  }
}
