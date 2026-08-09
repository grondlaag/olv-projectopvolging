import { describe, expect, it } from "vitest"
import { InMemoryRepository } from "../infrastructure/repositories"
import type { UUID } from "../domain"

interface TestRecord {
  id: UUID
  title: string
}

const recordId = "2d18f4aa-d3cd-4f62-8260-2452f7722ec4" as UUID

describe("InMemoryRepository", () => {
  it("slaat records typeveilig op zonder interne referenties uit te lekken", async () => {
    const repository = new InMemoryRepository<TestRecord>()
    const original = { id: recordId, title: "Eerste titel" }

    const created = await repository.create(original)
    created.title = "Lokale mutatie"

    expect(await repository.get(recordId)).toEqual(original)
    expect(
      await repository.update(recordId, { title: "Nieuwe titel" }),
    ).toEqual({
      id: recordId,
      title: "Nieuwe titel",
    })
  })
})
