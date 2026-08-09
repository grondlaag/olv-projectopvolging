# ADR-003 — Client-side applicatie op GitHub Pages

Status: Accepted

## Context

De applicatie moet zonder interne serverinfrastructuur hostbaar zijn.

## Beslissing

MVP is een statische React/Vite frontend op GitHub Pages.

Alle Excelverwerking gebeurt lokaal in de browser.

## Gevolgen

Voordelen:

- eenvoudige deployment;
- geen backendbeheer;
- Exceldata hoeft niet naar een server.

Beperkingen:

- geen serverdatabase;
- geen realtime multi-user;
- geen backendsecrets;
- O365-integratie later.
