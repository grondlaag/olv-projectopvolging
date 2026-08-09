# ADR-004 — Hash routing op GitHub Pages

Status: Accepted

## Context

GitHub Pages is statische hosting zonder applicatiespecifieke SPA rewrite.

## Beslissing

Gebruik `HashRouter` of `createHashRouter`.

## Gevolgen

Routes:

```text
/#/portfolio
/#/projects/<id>
```

Voordeel:

- refresh werkt zonder server rewrite;
- lage deploymentcomplexiteit.

Nadeel:

- `#` in URL.

Voor deze interne app primeert betrouwbaarheid.
