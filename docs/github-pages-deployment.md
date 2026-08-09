# GitHub Pages deployment

## Doel

OLV Projectopvolging wordt als statische Vite-app gehost via GitHub Pages.

## Consequenties

GitHub Pages levert statische:

- HTML;
- CSS;
- JavaScript;
- assets.

Daarom:

- geen backend runtime;
- geen server routes;
- geen server secrets;
- geen serverdatabase.

## Routing

Gebruik hash routing.

Voorbeeld:

```text
https://ACCOUNT.github.io/REPOSITORY/#/portfolio
```

Voorkeur:

```ts
createHashRouter(...)
```

Dit vermijdt afhankelijkheid van server-side SPA rewrites.

## Vite base

Voor:

```text
https://ACCOUNT.github.io/REPOSITORY/
```

gebruik:

```text
/REPOSITORY/
```

Maak configureerbaar:

```ts
import { defineConfig } from "vite"
import react from "@vitejs/plugin-react"

export default defineConfig({
  plugins: [react()],
  base: process.env.VITE_BASE_PATH ?? "/",
})
```

Workflow:

```yaml
env:
  VITE_BASE_PATH: /${{ github.event.repository.name }}/
```

Voor custom domain kan later `/` gebruikt worden.

## GitHub instellingen

```text
Settings
→ Pages
→ Build and deployment
→ Source
→ GitHub Actions
```

## Workflow

`.github/workflows/deploy.yml`:

1. checkout;
2. Node;
3. npm ci;
4. formatter check;
5. lint;
6. typecheck;
7. tests;
8. build;
9. configure Pages;
10. upload dist;
11. deploy.

## Assets

Vermijd root-absolute paden:

```html
<img src="/assets/logo.svg" />
```

Gebruik Vite imports of:

```ts
import.meta.env.BASE_URL
```

## Privacy

Operationele Exceldata:

- nooit committen;
- nooit in `public/`;
- nooit als echte testfixture;
- nooit door deployment uploaden.

Workbookdata wordt lokaal in de browser verwerkt.

## Build output

Alleen:

```text
dist/
```

naar Pages.

Niet deployen:

- workbooks;
- testoutput;
- Playwright traces;
- screenshots met echte data;
- secrets.

## Custom domain later

Bij custom domain:

- GitHub Pages domain configureren;
- Vite base `/`;
- HTTPS afdwingen;
- routing kan hash-based blijven.

## Lokale controle

```bash
npm run build
npm run preview
```

Controleer:

- root;
- hashroutes;
- assets;
- Excel import;
- Excel export;
- IndexedDB herstel.

De geautomatiseerde Pages-base-smoke in
`src/tests/pages-base-assets.test.ts` maakt een echte Vite-build onder een
repositorysubpad en controleert de fysieke script- en stylesheetassets.

Sinds fase 9 produceert Vite ook een Excel-moduleworker. De worker-URL wordt met
`new URL(..., import.meta.url)` opgebouwd en volgt daardoor automatisch dezelfde
repositorybase. De hoofdapp laadt ExcelJS niet tijdens normaal navigeren; import
of export start de worker pas op aanvraag.

`vite preview` is lokale buildcontrole, geen productieserver.

## Definition of done

- build groen;
- Pages workflow groen;
- site opent;
- hashroute opent;
- refresh op hashroute werkt;
- assets geen 404;
- Excelimport lokaal werkt;
- exportdownload werkt;
- workbookdata wordt niet naar netwerk gestuurd.
