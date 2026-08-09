// @vitest-environment node

import { existsSync } from "node:fs"
import { readdir, readFile } from "node:fs/promises"
import { resolve } from "node:path"
import { describe, expect, it } from "vitest"
import { build } from "vite"

describe("GitHub Pages base assets", () => {
  it("bouwt alle productieassets onder het repositorysubpad", async () => {
    const base = "/olv-projectopvolging/"
    const outputDirectory = resolve(
      process.cwd(),
      "test-results/pages-base-dist",
    )
    await build({
      base,
      build: {
        outDir: outputDirectory,
        emptyOutDir: true,
      },
    })

    const html = await readFile(resolve(outputDirectory, "index.html"), "utf8")
    const assetUrls = [...html.matchAll(/(?:src|href)="([^"]+)"/g)]
      .map((match) => match[1] ?? "")
      .filter((url) => url.includes("/assets/"))

    expect(assetUrls.length).toBeGreaterThan(0)
    expect(assetUrls.every((url) => url.startsWith(base))).toBe(true)
    for (const assetUrl of assetUrls) {
      expect(
        existsSync(resolve(outputDirectory, assetUrl.slice(base.length))),
      ).toBe(true)
    }

    const assetDirectory = resolve(outputDirectory, "assets")
    const assets = await readdir(assetDirectory)
    const workerAsset = assets.find((name) => name.startsWith("excel.worker-"))
    expect(workerAsset).toBeDefined()
    const javascript = await Promise.all(
      assets
        .filter((name) => name.endsWith(".js") && name !== workerAsset)
        .map((name) => readFile(resolve(assetDirectory, name), "utf8")),
    )
    expect(
      javascript.some((source) =>
        source.includes(`${base}assets/${workerAsset}`),
      ),
    ).toBe(true)
  }, 30_000)
})
