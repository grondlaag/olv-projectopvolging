# Releasechecklist 1.0

Datum release-audit: 2026-08-09

## Releasebesluit

Status: **voorwaardelijk groen totdat de afsluitende volledige kwaliteitsstraat
opnieuw is uitgevoerd**. De definitieve status wordt in het opleveringsrapport
vastgelegd.

## Product en scope

- [x] Fasen 0–8 vormen één coherente lokale workflow.
- [x] Geen nieuwe productmodule of parallel domeinmodel toegevoegd.
- [x] Geen plan-pin, PDF/SVG-pin of toekomstige fase geïmplementeerd.
- [x] Open financiële businessregels blijven expliciet `Regel vereist` conform
      ADR-006.
- [x] Applicatieversie staat op `1.0.0`; Excel-schema blijft `1.0.0`.

## UX en dagelijkse workflow

- [x] Auditmatrix A–V staat in `docs/ux-audit-phase9.md`.
- [x] Projectoverzicht toont actuele topics, aandacht, acties, planning, recente
      beslissingen, activiteit, budget en overleg zonder fictieve data.
- [x] Actuele stand, update en beslissing hebben contextuele quick entry.
- [x] Project-, topic-, actie-, budget- en overlegformulieren gebruiken dezelfde
      sectie-, drawer- en feedbackpatronen.
- [x] Relatieselecties zijn lokaal doorzoekbaar en bewaren parentformulierstate.
- [x] Actielijst bevat mijn/open/achterstallig/deze week/wacht op beslissing en
      snelle statuswijziging met historiek.
- [x] Globaal zoeken ondersteunt alle gevraagde recordtypen en directe routes.
- [x] Dirty/exportstatus gebruikt mensentaal en blijft op 768 px zichtbaar.

## Toegankelijkheid en responsive

- [x] Skip-link en zichtbare focusring aanwezig.
- [x] Globaal zoeken ondersteunt toetsenbord, pijlen, Enter en Esc.
- [x] Drawers ondersteunen Esc; gedeeld focusbeheer focust, begrenst Tab en
      herstelt focus naar de opener.
- [x] Productiepreview gecontroleerd op 1920, 1440, 1280, 1024 en 768 px.
- [x] Geautomatiseerd gecontroleerd: H1/hoofdtitel, veldlabels, knopnamen en geen
      documentbrede horizontale overflow.
- [x] Schermafbeeldingen visueel beoordeeld voor dashboard, portfolio,
      projectdossier, topic, acties, planning, budget en overleg.
- [x] Bestaande fase-8-flow controleert definitief verslag en printmedia.

## Data, Excel en herstel

- [x] Eén semantische hardeningroundtrip dekt alle 22 collecties, Unicode, lange
      tekst, datums, booleans, cents, volgorde, GUID-relaties en snapshots.
- [x] Masterbrowserflow bewaart project, actor, cluster, topic, updates,
      beslissing, actie, planning, budget, overleg, agenda, verslag en relaties.
- [x] Gevalideerde import vervangt de sessie pas na expliciete bevestiging.
- [x] Export markeert de sessie pas na een geslaagde download clean.
- [x] IndexedDB-herstel en before-unload-waarschuwing blijven getest.
- [x] Excelwerk draait in een beëindigbare Web Worker; fallback bestaat alleen
      voor omgevingen zonder Worker.
- [x] Object-URL voor downloads wordt direct ingetrokken.

## Performanceprofiel

Referentierun op de lokale ontwikkelmachine, Node 22.13.1:

| Meting | Resultaat |
| --- | ---: |
| Records | 500 projecten; 5.000 topics; 25.000 updates; 20.000 acties; 10.000 planning; 25.000 budget; 1.000 overleg |
| Indices opbouwen | 75,2 ms |
| Portfolioquery | 5,8 ms |
| Dashboardquery | 151,4 ms |
| Globaal zoeken | 159,4 ms |
| Project openen | 0,7 ms |
| Actiequery | 42,5 ms |
| Portfolio-Gantt | 16,6 ms |
| Budgetaggregatie | 40,0 ms |
| Excel-export | 14,55 s |
| Excel-import | 121,85 s |
| Werkboek / heap bij einde | 5,03 MB / 898,4 MB |
| Blocking importissues / aantallen | 0 / exact gelijk |

De querypaden blijven onder de na eerste profiling vastgelegde grens van 500 ms.
Voor de maximale synthetische fixture gelden diagnostische grenzen van 30 s voor
export, 180 s voor import en 1,2 GB heap. De importtijd is lang maar blokkeert de
UI niet meer door worker-offloading. Reguliere werkboeken zijn veel kleiner.

## Privacy en deployment

- [x] `npm run audit:release` controleert runtimebron, repository en `dist`.
- [x] Geen onverwachte fetch/XHR/WebSocket/EventSource/sendBeacon.
- [x] Geen spreadsheets buiten synthetische fixtures en gegenereerde, genegeerde
      testoutput.
- [x] Geen `.env`, mogelijke secrets of niet-synthetische runtime-e-mails.
- [x] Geen spreadsheets in `dist`.
- [x] Vite-base is configureerbaar en Pages-workflow gebruikt repositorysubpad.
- [x] Hashroutes hebben productie- en directe-route-smokes.
- [x] Worker- en overige assets worden via Vite-paden gebouwd.

## Afsluitende gates

- [ ] `npm run format:check`
- [ ] `npm run lint`
- [ ] `npm run typecheck`
- [ ] `npm run test -- --run`
- [ ] `npm run build`
- [ ] `npm run test:e2e`
- [x] `npm run audit:release`
- [x] `npm run audit:performance`

Deze vijf open vakken worden pas aangevinkt na de definitieve, ongewijzigde
releasekandidaat-run.

