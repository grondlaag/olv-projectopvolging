import { describe, expect, it } from "vitest"
import {
  SettingsManagementError,
  SettingsManagementService,
} from "../application/services"
import { JsonDataFileGateway } from "../infrastructure/json"
import { createPortfolioTestSession, testIds } from "./test-data"

describe("instellingenbeheer", () => {
  it("beheert hoofdstuk, cluster, actor, huidige actor en keuzelijst", () => {
    const service = new SettingsManagementService()
    let state = new JsonDataFileGateway().createNewSession().state

    const chapter = service.createChapter(state, {
      code: "H4",
      title: "Digitale infrastructuur",
      active: true,
    })
    state = chapter.state
    const cluster = service.createCluster(state, {
      chapterId: chapter.record.id,
      code: "CL-DIG",
      title: "Digitale werkplek",
      description: "Beheerbare cluster",
      active: true,
    })
    state = cluster.state
    const actor = service.createActor(state, {
      displayName: "Beheerder JSON",
      type: "Intern",
      email: "beheerder@example.test",
      active: true,
    })
    state = actor.state
    const choice = service.createChoice(state, {
      listKey: "site",
      valueKey: "campus-west",
      label: "Campus West",
      active: true,
    })
    state = choice.state
    const general = service.updateGeneral(state, {
      defaultCurrency: "eur",
      currentActorId: actor.record.id,
    })

    expect(
      general.state.indices.chapterById.get(chapter.record.id)?.title,
    ).toBe("Digitale infrastructuur")
    expect(
      general.state.indices.clusterById.get(cluster.record.id)?.chapterId,
    ).toBe(chapter.record.id)
    expect(general.state.indices.actorById.get(actor.record.id)?.active).toBe(
      true,
    )
    expect(general.state.records.choiceLists).toContainEqual(choice.record)
    expect(general.record.defaultCurrency).toBe("EUR")
    expect(general.record.currentActorId).toBe(actor.record.id)
  })

  it("bewaakt unieke codes en verhindert onveilige deactivatie", () => {
    const service = new SettingsManagementService()
    const state = createPortfolioTestSession().state

    expect(() =>
      service.createChapter(state, {
        code: "H1",
        title: "Dubbel",
        active: true,
      }),
    ).toThrow("Deze hoofdstukcode bestaat al.")

    expect(() =>
      service.updateChapter(state, testIds.chapter, {
        code: "H1",
        title: "Gebouw en ruimte",
        active: false,
      }),
    ).toThrow(SettingsManagementError)

    expect(() =>
      service.updateActor(state, testIds.actorOne, {
        displayName: "Anna Coördinator",
        type: "Intern",
        active: false,
      }),
    ).toThrow("Deze actor kan niet worden gedeactiveerd")
  })

  it("laat een ongebruikt record veilig deactiveren en opnieuw activeren", () => {
    const service = new SettingsManagementService()
    let state = new JsonDataFileGateway().createNewSession().state
    const created = service.createChapter(state, {
      code: "TMP",
      title: "Tijdelijk",
      active: true,
    })
    state = created.state
    const disabled = service.updateChapter(state, created.record.id, {
      code: "TMP",
      title: "Tijdelijk",
      active: false,
    })
    expect(disabled.record.audit.active).toBe(false)
    expect(disabled.record.status).toBe("Inactive")

    const enabled = service.updateChapter(disabled.state, created.record.id, {
      code: "TMP",
      title: "Tijdelijk",
      active: true,
    })
    expect(enabled.record.audit.active).toBe(true)
    expect(enabled.record.status).toBe("Active")
  })
})
