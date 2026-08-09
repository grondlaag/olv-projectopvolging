# Excel-datacontract — OLV Projectopvolging

## Doel

Excel is in versie 1 de draagbare opslaglaag.

De app:

```text
.xlsx importeren
→ valideren
→ normaliseren
→ bewerken
→ opnieuw .xlsx genereren
```

De frontend gebruikt Excel nooit als UI.

## Canonical formaat

Canonical databaseformaat:

```text
.xlsx
```

`.xlsm` mag best-effort worden ingelezen, maar volledig behoud van VBA, shapes,
externe koppelingen of niet-ondersteunde workbookfeatures is geen MVP-garantie.

De actuele canonical schema-versie is `1.0.0`.

Lege optionele omschrijvingen van projecten en clusters en een lege projectfase
worden bij import als lege domeintekst genormaliseerd. Zo blijven de
domeinentiteiten volledig gevormd, terwijl het fase-3-formulier deze velden niet
kunstmatig verplicht maakt. Dit is een achterwaarts compatibele interpretatie
binnen schema `1.0.0`.

## Tabellen

Minimaal:

- `tblHoofdstukken`;
- `tblClusters`;
- `tblProjecten`;
- `tblProjectClusterHistoriek`;
- `tblActoren`;
- `tblTopics`;
- `tblUpdates`;
- `tblActies`;
- `tblActieHistoriek`;
- `tblBewijs`;
- `tblPlanning`;
- `tblPlanningAfhankelijkheden`;
- `tblBudget`;
- `tblBudgetMutaties`;
- `tblOverleggen`;
- `tblOverlegDeelnemers`;
- `tblAgendaItems`;
- `tblVerslagen`;
- `tblVerslagItems`;
- `tblConfig`;
- `tblKeuzelijsten`;
- `tblLogboek`.

Exacte tabel- en kolommappings zijn gecentraliseerd in één Excel schema module.
In schema `1.0.0` staat iedere beheerde named table op een eigen, gelijknamig
werkblad. De bron van waarheid is
`src/infrastructure/excel/schema/excel-schema.ts`; UI, domein en use cases kennen
geen kolomnamen.

Fase 6 gebruikt de bestaande tabellen `tblPlanning` en
`tblPlanningAfhankelijkheden` zonder schemaversiewijziging. Import valideert
maximaal één primaire topicentry, project/topicconsistentie, mijlpaal- en
periodevelden, dependency-projectgrenzen en cycli. Export/herimport behoudt
topic timing, vrije items, mijlpalen, voortgang, expliciete status en
finish-to-start-relaties semantisch. Afgeleide vertraging wordt niet naar Excel
geschreven.

Fase 7 gebruikt de bestaande tabellen `tblBudget` en `tblBudgetMutaties` zonder
schemaversiewijziging. Import valideert numerieke centprecisie, verplicht type
en datum, project/topicconsistentie, leverancieractor en mutatierelaties.
Bedragen worden in het domein als integer cents gehouden en in Excel numeriek
met twee decimalen geschreven. Er vindt geen silent financial repair plaats.

Fase 8 gebruikt `tblOverleggen`, `tblOverlegDeelnemers`, `tblAgendaItems`,
`tblVerslagen` en `tblVerslagItems` volledig. De bestaande optionele
agendakolom `beschrijving` bewaart `reason`; de additieve optionele kolom
`notities` bewaart `notes`; `status` bewaart `discussionStatus`. Deze uitbreiding
blijft binnen schema `1.0.0`: oude workbooks zonder `notities` importeren met een
niet-blokkerende kolomwaarschuwing en nieuwe exports voegen de kolom toe.

Import valideert centraal de meetingscope, actieve actoren, unieke deelnemers,
agendaobjecten binnen scope, unieke verslagversies en een `finalDate` voor
definitieve of gereviseerde verslagen. `tblUpdates.meetingId` en
`tblActies.sourceMeetingId` moeten naar een bestaand overleg verwijzen én hun
bronobject moet binnen dezelfde scope vallen. Definitieve snapshots worden niet
gereconstrueerd uit actuele bronrecords.

## Algemene auditkolommen

Waar relevant:

- `datum-aangemaakt`;
- `aangemaakt-door-guid`;
- `datum-gewijzigd`;
- `gewijzigd-door-guid`;
- `actief`.

## GUID

- als tekst schrijven;
- UUID v4 voor nieuwe records;
- uniek;
- nooit stilzwijgend regenereren.

## Datums

Domein gebruikt een consistente lokale kalenderdatumrepresentatie.

Excelmapping beheert conversie.

Geen locale string parsing als primaire strategie.

Roundtrip moet dezelfde kalenderdatum behouden.

## Bedragen

Domein:

```text
integer cents
```

Excel:

- numeriek bedrag met 2 decimalen;
- valuta-opmaak is presentatie.

## Keuzelijsten

Afspraak:

- kolomtitel beginnend met `*` = vaste systeemlijst;
- zonder `*` = vrij uitbreidbare lijst.

Parser normaliseert:

- whitespace;
- case voor duplicate detection;
- lege waarden.

Technische key en zichtbaar label worden logisch gescheiden.

## Config

`tblConfig` bevat minimaal:

- schema-versie;
- workbook-id;
- created-at;
- app-version;
- default-currency;
- eventueel current-actor-guid.

## Importpipeline

```text
ArrayBuffer
→ workbook inspectie
→ tabelinventaris
→ schemavalidatie
→ row mapping
→ Zod validation
→ referentiële validatie
→ normalized domain state
→ GUID-indices
```

Rapportniveaus:

- Blocking;
- Recoverable;
- Warning;
- Info.

## Strikte modus

Blokkeert bij:

- dubbele primaire GUID;
- ontbrekende verplichte tabel;
- ongeldige parentrelatie;
- topic met twee ouders;
- corrupte dependency;
- ongeldige financiële kernwaarde.

## Herstelmodus

Mag gecontroleerd herstellen:

- ontbrekende optionele auditwaarde;
- whitespace;
- bekende legacy alias;
- lege optionele kolom;
- legacy kolomnaam met expliciete migratieregel.

Elk herstel wordt gerapporteerd.

In fase 1 is alleen het trimmen van veilige tekstuele witruimte als automatische
repair geactiveerd. Auditdefaults, legacy aliases en legacy kolomnamen vereisen
eerst een expliciete migratieregel en worden daarom nog niet stilzwijgend
hersteld.

## Export

Voor export:

1. validate domain state;
2. validate referential integrity;
3. map records;
4. schrijf beheerde tabellen;
5. update schema-versie;
6. genereer workbook;
7. download via Blob.

Bestandsnaam:

```text
OLV_Projectopvolging_YYYY-MM-DD_HH-mm.xlsx
```

## Preservation

Onbekende werkbladen worden waar mogelijk best-effort behouden.

Geen harde garantie voor:

- macro's;
- shapes;
- complexe styles;
- pivots;
- externe links;
- unsupported features.

De veiligste productiebron is een dedicated OLV database workbook.

Bij export vanaf een geïmporteerde bron worden beheerde werkbladen opnieuw
opgebouwd en onbekende werkbladen best-effort meegenomen. Een downloadbare
back-up is een exacte kopie van de oorspronkelijke bronbytes; dit is nadrukkelijk
iets anders dan preservation in een nieuw gegenereerd workbook.

## Migratie

```text
oud workbook
→ inspectie
→ migratieplan
→ back-up aanbieden
→ bevestiging
→ migratie
→ validatie
→ log
```

Geen destructieve migratie zonder zichtbare melding.

## Roundtripacceptatie

Vergelijk na export/herimport:

- recordaantallen;
- IDs;
- relaties;
- datums;
- bedragen;
- statussen;
- audit;
- planningdependencies.

De semantische vergelijking sorteert records op GUID en objectvelden op key. Ze
vergelijkt domeinbetekenis, niet zipbytes, werkbladvolgorde of celopmaak.

Voor projectbeheer omvat de roundtrip bovendien het nieuwe project, een inline
aangemaakte cluster en actor, de projectrelaties en de open/gesloten
clusterhistoriek.

Voor topicbeheer omvat de roundtrip daarnaast:

```text
import fixture
→ nieuw projecttopic
→ actuele update
→ afzonderlijke beslissing
→ topic afsluiten
→ export
→ herimport
```

Na herimport blijven topic-ID, parentrelatie, eigenaar, status, beide
journaalrecords en `currentUpdateId` semantisch gelijk. Een actuele update die
inactief is of niet rechtstreeks bij hetzelfde topic hoort, is een blocking
referentiële fout.

Voor actiebeheer omvat de roundtrip daarnaast:

```text
import fixture
→ actie toevoegen
→ eigenaar wijzigen
→ deadline wijzigen
→ actie afronden
→ export
→ herimport
```

Na herimport blijven het record in `tblActies`, eigenaar, deadline, status,
afronddatum en de append-only wijzigingen in `tblActieHistoriek` semantisch
gelijk. Een actie met onbekende context, inactieve eigenaar of inconsistente
afronddatum is blocking.

Voor budgetbeheer omvat de roundtrip daarnaast:

```text
import fixture
→ goedgekeurd budget, raming en contract toevoegen
→ topicgekoppeld meerwerk toevoegen
→ bestaand bedrag corrigeren met BudgetMutation
→ export
→ herimport
```

Na herimport blijven cents, project- en topicrelatie, type, categorie, status,
datum, leverancier, referentie en volledige correctiehistoriek semantisch
gelijk. Een niet-numeriek bedrag, onbekend project, topic uit een ander project,
onbekende leverancier, ontbrekend type of ongeldige datum is blocking.

Voor overlegbeheer omvat de roundtrip daarnaast:

```text
import fixture
→ overleg met scope, deelnemers en geordende agenda maken
→ update, beslissing en actie aan overleg én broncontext koppelen
→ definitief verslag met snapshots en revisie maken
→ export
→ herimport
```

Na herimport blijven meetingscope, aanwezigheid, agendaorder en -koppelingen,
`meetingId`, `sourceMeetingId`, oplopende verslagversies en alle snapshotteksten
semantisch gelijk. Een ongeldige scope, gekoppeld agendaobject buiten scope,
dubbele verslagversie of ontbrekende finalisatiedatum is blocking.
