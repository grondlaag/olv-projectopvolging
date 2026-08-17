# Teststrategie — OLV Projectopvolging

## Doel

De suite bewijst domeinregels, hoofdflows, draagbare JSON-roundtrips,
GitHub Pages-compatibiliteit, privacy, toegankelijkheid en performance.

## Verplichte releasechecks

```bash
npm run format:check
npm run lint
npm run typecheck
npm run test -- --run
npm run build
npm run test:e2e
npm run audit:performance
npm run audit:release
```

Een check wordt alleen als geslaagd gerapporteerd wanneer hij in de actuele
worktree is uitgevoerd.

## Testlagen

### Unit

Pure domein- en applicationlogica:

- project- en clusterinvarianten plus clusterhistoriek;
- topics, current update, journaal en beslissingen;
- expliciete actieve auteurkeuze, onderscheid tussen auteur en auditactor en
  update-invoer zonder ingestelde huidige actor;
- acties en append-only historie;
- planning, afhankelijkheden en cyclusdetectie;
- globale planningssamenvatting en filtergebonden tellingen;
- centsconversie, budgetaggregaties, topicdubbeltelling en mutaties;
- overlegscope, deelnemers, agenda en verslagsnapshots;
- contextueel project/topic op een geldige overlegagenda plaatsen en duplicaten
  blokkeren;
- verplichte project/topicbron, gegroepeerde agenda en leesbare legacy-punten;
- universele invoerkaart voor update, beslissing en actie;
- Outlook-HTML en geldige PDF-bytes voor agenda en verslag;
- instellingen, duplicaten en veilige deactivatie;
- normalized indices en selectors.
- progressive-disclosurecomponenten: gesloten standaardtoestand, zichtbare
  filterchips, toegankelijke composer, KPI-semantiek, overflow en zijpanelen;
- directe overlegbediening voor focusmodus en `Punt besproken` via de bestaande
  agenda-service.

### Integratie

- JSON syntax-, schema- en referentievalidatie;
- JSON open → mutate → save → reopen → semantic compare;
- IndexedDB snapshot v2 en herstel van een legacy-v1-snapshot;
- instellingenpagina tegen de echte store;
- projectformulier met inline hoofdstuk, cluster en actor;
- dirty state en handmatige save;
- router en GitHub Pages base-assets.

### End-to-end

Playwright gebruikt de gebouwde productieapp. De hoofdflows openen de
synthetische JSON-fixture, voeren echte UI-mutaties uit, downloaden JSON, openen
de download opnieuw en controleren kritieke records en relaties.

## JSON-fixtures

Canonical synthetische fixture:

```text
src/tests/fixtures/json/small-valid.json
```

Ze wordt reproduceerbaar gegenereerd met `npm run fixtures:json` en bevat onder
meer Unicode, lokale datums, integer cents, optionele relaties en alle relevante
collecties. Operationele data is verboden in fixtures.

Ongeldige JSON-situaties worden bij voorkeur in de test zelf opgebouwd, zodat
syntax-, structurele en relationele fouten compact en expliciet blijven:

- ongeldige JSON-syntax;
- verkeerde formaatsignatuur of schemaversie;
- ontbrekende/extra properties;
- dubbel GUID;
- verbroken hoofdstuk-, cluster-, project- of actorrelatie;
- topic uit ander budgetproject;
- planningcyclus;
- ongeldige financiële waarde;
- config/envelope dataSetId-mismatch.

## Legacy-Excelregressie

De bestaande tests en synthetische bestanden onder `src/tests/fixtures/excel`
blijven voorlopig draaien om de reeds gebouwde mappinglogica niet ongemerkt te
breken. Ze bewijzen geen productieflow en de tijdelijke browserroute bestaat niet
meer. Nieuwe functionele tests gebruiken JSON. Een toekomstige opschoning mag de
legacyadapter pas verwijderen na een expliciete migratiebeslissing.

## Project- en instellingenacceptatie

Minimaal geautomatiseerd:

- nieuwe gegevensset bevat actieve standaardhoofdstukken;
- hoofdstuk selecteren in een nieuw project;
- hoofdstuk inline toevoegen zonder formulierverlies;
- cluster inline toevoegen en onmiddellijk selecteren;
- project zonder cluster;
- ongeldige cluster/hoofdstukcombinatie;
- actor inline toevoegen;
- instellingen: hoofdstuk, cluster, actor en keuzewaarde beheren;
- gebruikte structuur/actor niet ongeldig kunnen deactiveren;
- project opslaan, dirty state, JSON downloaden en opnieuw vinden.

Playwrightspec `json-settings-project.spec.ts` is de gerichte regressie voor de
oorspronkelijke hoofdstuk/cluster/settings-bug.

## JSON-roundtripacceptatie

De gatewaytests controleren:

- exact 22 collecties;
- GUID- en relatiebehoud;
- integer cents zonder floating-pointconversie;
- datum- en datetimebehoud;
- booleans en afwezige optionele velden;
- UTF-8-tekst met accenten;
- cluster-, actie- en budgethistoriek;
- verslag- en report-itemsnapshots;
- leesbare pretty-printed uitvoer;
- verkeerde extensie en blocking validation.

## Playwright-hoofdflows

- JSON openen en sessie herstellen;
- dashboard, portfolio en projectdossier;
- instellingen en nieuw project met inline structuur;
- topics, updates en beslissingen;
- inline actor toevoegen aan een update met behoud van ingevoerde tekst;
- acties en actiehistoriek;
- planning, globale cijferstrook, Gantt en afhankelijkheden;
- gecombineerde planningboom/Gantt, uitklappen en URL-herstel van filter en zoom;
- budget, correcties en topicimpact;
- overleg, agenda en definitief verslag;
- project en topic vanuit het brondossier voor overleg inplannen;
- master save/reopen met alle relaties;
- responsive en toetsenbordtoegankelijke productiepreview;
- GitHub Pages repositorybase.
- commandolaag en globale “+ Nieuw”-acties;
- “Mijn werk” met directe statusupdate;
- compacte portfoliofilters, snelle selectie en filterchips;
- canonieke projecteditor vanuit planning met behoud van omvang en terugkeerroute;
- bescherming tegen verlies van niet-bewaarde project- en overleginvoer;
- volledige topicbewerking met behoud van broncontext en historiek;
- rechtstreeks adresseerbare topic- en actiedetails;
- persistente hash-querycontext voor instellingen, acties, planning, budget en
  overleg;
- lokale benoemde weergaven, tabeldichtheid en kolomzichtbaarheid zonder
  wijziging van operationele JSON of dirty state;
- recente dossiers en favorieten in de applicatieshell;
- sneltoetsen voor zoeken, contextgevoelig creëren en hulp;
- contextuele topic-, actie- en overleginvoer met geldige vaste broncontext en
  veilige terugkeerroute;
- expliciete actiebulkmutatie met individuele actiehistoriek;
- vervolgoverleg met bronrelatie, gelijke scope en carry-over van uitsluitend
  open, gekoppelde agendapunten.

Screenshots komen alleen in `test-results` en bevatten uitsluitend synthetische
data.

## Performance

`npm run audit:performance` bouwt een synthetische grote state en meet:

- normalized indices;
- portfolio- en dashboardqueries;
- globaal zoeken en project openen;
- acties, Gantt en budgetaggregaties;
- volledige JSON-serialisatie en -validatie bij opnieuw openen;
- bestandsgrootte en heapgebruik;
- recordcount na roundtrip.

Richtwaarden op de huidige synthetische set:

- gewone geïndexeerde query: < 150 ms;
- JSON opslaan: < 5 s;
- JSON opnieuw openen en valideren: < 10 s;
- blocking issues: 0;
- recordcounts na roundtrip: gelijk.

Een overschrijding is een profiling-signaal en geen reden voor stille
validatieversoepeling.

## Privacy- en release-audit

`npm run audit:release` blokkeert:

- onverwachte netwerk-API's in runtimecode;
- operationele spreadsheets buiten de synthetische legacyfixtures;
- operationele OLV-JSON-bestanden buiten de synthetische JSON-fixturemap;
- datafiles in `dist`;
- `.env`-bestanden, mogelijke secrets en niet-synthetische runtime-e-mails.

De buildtest controleert aanvullend dat repositorybase-assets bestaan en dat
geen Excel-worker of ExcelJS-chunk in de productie-assets verschijnt.

## Handmatige acceptatie

Voor release:

1. start een nieuwe gegevensset;
2. beheer hoofdstuk, cluster, actor en keuzelijsten;
3. maak een project met en zonder cluster;
4. doorloop dossier, topic, actie, planning, budget en overleg;
5. bewaar als JSON en open de download opnieuw;
6. controleer dirty/saved-status en refreshherstel;
7. controleer 1920, 1440, 1280, 1024 en 768 px;
8. controleer toetsenbord, focus, labels, lege states en Nederlandstalige fouten;
9. controleer dat DevTools Network geen projectdata verzendt.
10. controleer dat budgetgroepen, topiccontext en overlegzijpanelen zonder
    contextverlies openen en sluiten, en dat focusmodus het centrale punt
    dominant maakt.

Nieuwe gerichte regressies controleren conceptverslagopbouw zonder huidige
actor, brongebonden actie-/beslissingslagen, XS-XXL/VTE-samenvatting,
inklapbare portfoliohiÃ«rarchie en audit-safe archiveren van topic en budget.
