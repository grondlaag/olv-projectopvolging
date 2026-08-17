# Visuele stijl — OLV Projectopvolging

## Ontwerpkarakter

De interface combineert:

- zorgvuldig architectuurdossier;
- hedendaagse zorgomgeving;
- professionele technische projectopvolging;
- rustige redactionele informatievormgeving.

Niet:

- generiek SaaS-dashboard;
- flashy startupapp;
- traditionele grijze ERP;
- kleurrijke consumentenapp;
- dichtgeslibde bouwsoftware.

Kernwoorden:

- rustig;
- deskundig;
- menselijk;
- architecturaal;
- helder;
- redactioneel;
- functioneel;
- betrouwbaar.

## Informatiehiërarchie

De gebruiker moet direct zien:

1. waar hij zich bevindt;
2. welk project/topic geselecteerd is;
3. wat de actuele toestand is;
4. wat aandacht vraagt;
5. wat de primaire actie is.

Decoratie is ondergeschikt aan informatie.

## Progressive disclosure

De applicatie toont standaard alleen wat nodig is om toestand, context en de
volgende handeling te begrijpen. Filters, metadata, historiek en secundaire
acties blijven beschikbaar zonder het primaire werkvlak te verdringen.

Gebruik door alle features dezelfde patronen:

- `Collapsible` voor een inhoudelijke sectie met een leesbare samenvatting in
  gesloten toestand;
- `FilterPanel` voor één compacte filterregel en permanent zichtbare,
  verwijderbare actieve filterchips;
- `SidePanel` voor agenda- en contextkolommen die zonder contextverlies kunnen
  worden ingeklapt;
- `KpiStrip` voor één horizontale, rustige cijferstrook;
- `OverflowMenu` voor bewerken, koppelen, timing, favoriet en verwijderen als
  deze niet de primaire handeling zijn;
- `Composer` voor update, beslissing en actie, standaard gesloten achter één
  duidelijke toevoegactie.

Een gesloten sectie verbergt nooit de betekenis van de toestand: titel,
relevante aantallen en noodzakelijke subtotalen blijven in de samenvatting
zichtbaar. Er is per werkvlak maximaal één dominante primaire actie.

## Kleuren

Centrale tokens:

```css
--color-brand-deep: #004c3f;
--color-brand-primary: #006b5a;
--color-brand-muted: #5fa8a6;
--color-brand-soft: #dcedec;
--color-brand-pale: #eff6f5;

--color-ink-strong: #18302c;
--color-ink: #334a46;
--color-ink-muted: #6b7f7b;
--color-ink-subtle: #8d9d99;

--color-surface: #ffffff;
--color-surface-soft: #f6f8f7;
--color-surface-muted: #eef2f1;
--color-surface-warm: #f6f3ee;

--color-border: #d7e0de;
--color-border-strong: #aabbb7;

--color-success: #397a58;
--color-success-soft: #e5f0e8;
--color-warning: #a46f22;
--color-warning-soft: #f7eedc;
--color-danger: #a14a43;
--color-danger-soft: #f6e7e5;
--color-info: #467a87;
--color-info-soft: #e4eef1;
```

Controleer WCAG 2.1 AA.

Status nooit alleen door kleur.

## Typografie

Voorkeur:

```css
Inter,
"Source Sans 3",
system-ui,
"Segoe UI",
Arial,
sans-serif
```

Richtwaarden:

| Element     |  Grootte | Gewicht |
| ----------- | -------: | ------: |
| Paginatitel | 28–34 px |     600 |
| Sectietitel | 18–22 px |     600 |
| Subsectie   | 15–17 px |     600 |
| Body        | 14–16 px |     400 |
| Tabel       | 13–14 px |     400 |
| Metadata    | 12–13 px |     400 |

Body line-height circa 1.5.

Journaal circa 1.6.

## Spacing

Basis 4 px.

```text
4
8
12
16
24
32
48
64
```

Gebruik witruimte vóór extra borders.

## App shell

```text
┌─────────────────────────────────────────────┐
│ compacte header                             │
├────────────┬────────────────────────────────┤
│ navigatie  │ breadcrumb                     │
│            │ titel + contextacties          │
│            │ inhoud                         │
└────────────┴────────────────────────────────┘
```

Navigatie:

- Dashboard;
- Portfolio;
- Acties;
- Planning;
- Budget;
- Overleg;
- Instellingen.

Geen plan-pin.

## Header

Compact.

Bevat:

- productnaam;
- geopend JSON-gegevensbestand;
- dirty indicator;
- duidelijke acties **Openen** en **Back-up downloaden**, met toegankelijke
  namen die JSON expliciet benoemen;
- globale zoekfunctie;
- eventueel current actor.

Geen grote brandingbanner.

## Instellingen

Instellingen is een beheerwerkruimte, geen ruwe database-editor:

- compacte samenvatting bovenaan;
- maximaal vijf duidelijke categorie-tabs;
- hoofdstukken, clusters en actoren als rustige lijsten;
- toevoegen/bewerken in een smalle drawer naast de lijst;
- contextlabels en concrete deactivatiefouten;
- gegevensbestandsstatus en privacy-uitleg in een afzonderlijke sectie.

Inline hoofdstuk-, cluster- en actorbeheer in een project gebruikt dezelfde
drawermaat en laat het hoofdformulier zichtbaar. Geen modalstapeling.

## Kaarten

Alleen bij echte groepering.

- radius 4–8 px;
- dunne border;
- nauwelijks shadow;
- geen floating card wall.

## Tabellen

- sticky header;
- rustige rijhoogte;
- subtiele horizontale scheiding;
- hover;
- selectie met zachte blauwgroene achtergrond;
- resizebare kolommen waar nuttig;
- bedragen rechts;
- virtualisatie bij grote data.

Portfolio is primair een sterke tabel/list-view.

## Badges

Compact.

Voorbeelden:

```text
UITVOERING
HOOG
VERTRAAGD
WACHT OP BESLISSING
```

Niet elke metadatawaarde als pill.

## Knoppen

### Primair

- brand primary;
- witte tekst;
- beperkte radius;
- duidelijke focus.

### Secundair

- lichte achtergrond;
- border;
- brand text.

### Tertiair

- tekst/icoon.

### Destructief

- terughoudend rood;
- bevestiging.

## Formulieren

- label boven veld;
- hulptekst waar nuttig;
- fout direct onder veld;
- geen placeholder als enige label;
- logische secties;
- complexe form = expliciete save;
- actor/cluster inline toevoegen via drawer/popover.

## Projectdossier

Dezelfde rustige dossierkop blijft zichtbaar op overzicht, topics, journaal,
planning en budget. Header toont:

- code;
- titel;
- status;
- fase;
- coördinator;
- planningstatus;
- budgetstatus.

Actuele inhoudelijke toestand krijgt een rustige gemarkeerde zone met een
compacte invoerkaart voor een nieuw statusmoment. Dit staat nadrukkelijk los van
de levenscyclusstatus in de dossierkop.

Split-view:

```text
Topics / secties | centrale inhoud | acties / metadata
```

## Topics

Linkerlijst toont:

- titel;
- status;
- prioriteit;
- eigenaar;
- timingindicator;
- open actiecount.

Selectie via subtiele accentlijn.

Geen grote kaart per topic.

Nieuwe topics tonen de actieve actorselectie als eigenaar met een compacte
inline actie voor een nieuwe actor. Updates en beslissingen tonen de auteurkeuze
altijd zichtbaar; de gebruiker hoeft hiervoor niet eerst naar Instellingen.

## Journaal

Verticale tijdlijn.

Beslissing krijgt zachte afwijkende achtergrond en label.

## Gantt

- lichte grid;
- compacte rijen;
- duidelijke vandaag-lijn;
- mijlpaal als ruit;
- progress overlay;
- vertraging met icoon/label + kleur;
- beperkt semantisch palet;
- geen regenboogkleuren.

Zoom:

- week;
- maand;
- kwartaal;
- jaar.

De globale planning plaatst vóór filters en Gantt één compacte cijferstrook met
planningdekking, item- en mijlpaalaantallen, aandachtspunten en periode. Dit is
een rustige samenvatting, geen extra dashboard met losse kaarten.

Hoofdstuk, cluster, project en onderliggende planningitems vormen één
uitklapbare boom in de vaste labelkolom van dezelfde Gantt. Er staat geen tweede
hiërarchiepaneel boven de tijdslijn. De disclosure opent onderliggende regels;
de recordnaam en de balk openen rechtstreeks het bronrecord.

## Budget

Bovenaan:

- goedgekeurd;
- actuele raming;
- vastgelegd;
- gefactureerd;
- prognose;
- resterend;
- afwijking.

Daaronder tabel.

Grafieken alleen als ze een echte vergelijking ondersteunen.

De globale financiële portefeuille gebruikt bovenaan vijf feitelijke
typesommen: Budget, Raming, Contract, Factuur en Betaling. Dit zijn sommen van
niet-geannuleerde records per exact type en geen impliciete prognose. Nulbedragen
worden als `—` weergegeven. De boom is standaard ingeklapt als Hoofdstuk →
Cluster → Project; gesloten hoofdstukken en clusters tonen projectaantal en de
vijf subtotalen. Filters, aanvullende groepering, uitzonderingen en uitleg over
de aggregatieguardrail zijn progressive disclosure.

## Overleg en verslag

De voorbereiding groepeert brongebonden agendapunten als hoofdstuk → cluster →
project → topic. De verwerkingsmodus gebruikt op ruime schermen drie kolommen:
de agenda en selectie links, bespreking met één vaste invoerkaart centraal en
actuele stand plus bronjournaal rechts. Op smallere schermen stapelen deze
kolommen. Na save blijft de invoerkaart staan en wordt alleen de invoer
leeggemaakt.

Tijdens verwerking toont een compacte vergaderbalk steeds huidig punt/totaal,
vorig, volgend en `Punt besproken`. Agenda en context zijn afzonderlijk
inklapbaar. De focusmodus verbergt beide zijpanelen tijdelijk en centreert het
actieve agendapunt met de composer; verlaten van focus herstelt de gekozen
zijpaneeltoestand.

Agenda en verslag hebben een echte client-side PDF-download met paginanummers.
`Kopieer voor Outlook` schrijft zowel `text/html` als `text/plain` naar het
klembord; browserprint blijft aanvullend beschikbaar.

Het projectjournaal is geen ononderbroken tijdlijn. Het groepeert eerst de
algemene projectopvolging en daarna ieder echt topic. Elke uitklapbare groep
toont actuele stand, aantallen, de universele invoerkaart, de drie recentste
bijdragen en pas op verzoek de volledige historiek. Er wordt geen fictief
"algemeen topic" opgeslagen.

De overlegwerkruimte is tekstgericht en puntsgewijs. Voorbereiding en verwerking
zijn herkenbare modi binnen hetzelfde dossier; ze openen geen keten van modals.
Deelnemers, agenda en afgeleide suggesties hebben een rustige hiërarchie en de
agenda gebruikt toegankelijke omhoog/omlaagbediening naast contextacties.

`Vervolgoverleg maken` staat als contextactie in ieder overlegdossier. Het
formulier toont zichtbaar welk bronoverleg wordt gebruikt en hoeveel open
agendapunten worden meegenomen. Het oude dossier blijft ongewijzigd.

Tabs, werkmodi, filters, groepering, zoom en gekozen verslagversie worden waar
relevant in hash-queryparameters bewaard. Een refresh, browser-terugactie of
gedeelde interne URL herstelt daardoor dezelfde werkcontext.

Projecten en topics bieden `Bespreken op overleg` als compacte contextactie. Een
smalle drawer toont het vaste bronrecord, reeds geplande overlegmomenten en
geldige toekomstige keuzes als rustig opgebouwde radiolijst. De gebruiker kan
een korte bespreekreden meegeven; het dossier blijft achter de drawer zichtbaar.

Het verslag oogt als een professioneel projectverslag, niet als een spreadsheet:

- duidelijke overlegkop met datum en scope;
- opeenvolgende secties voor deelnemers, agenda, updates, beslissingen en
  acties;
- acties gegroepeerd per verantwoordelijke;
- ingetogen versie- en statusaanduiding;
- ruime tekstkolom en behoud van regeleinden in snapshots.

Printweergave verbergt applicatieshell, navigatie, formulieren en knoppen. Wit
papier, zwarte tekst, zinvolle page breaks en zichtbare versie-informatie zijn
leidend voor browserprint naar PDF.

## Dashboard

Max 4–6 primaire KPI's bovenaan.

Daarna:

- aandacht vereist;
- komende deadlines;
- recente beslissingen;
- budget/planning uitzonderingen.

Geen 20 losse tegels.

De eerste werkinhoud is “Mijn werk”: maximaal acht open acties van de ingestelde
huidige actor, geordend op achterstalligheid en deadline. Een veilige
statuswijziging kan daar direct, met zichtbare sessiestatus.

## Bedieningslaag en contextvaste invoer

De applicatiekop combineert zoeken en handelen:

- Ctrl/Cmd+K of / opent de zoek- en commandolaag;
- een lege zoeklaag biedt de belangrijkste creatieacties;
- “+ Nieuw” houdt project en overleg vanuit elke route bereikbaar;
- “+ Nieuw” toont dossiergebonden acties eerst en scheidt algemene creatie
  visueel met een rustige lijn;
- `N` opent de creatielaag, `?` het sneltoetsoverzicht en Escape sluit de
  actieve bedieningslaag;
- bestandsacties gebruiken menselijke labels “Openen” en “Back-up”, terwijl
  toegankelijke namen het JSON-karakter expliciet houden.

Portfolio toont zoeken en scopes altijd. Detailfilters staan achter “Filters”,
actieve keuzes blijven zichtbaar als verwijderbare chips en frequente selecties
zijn beschikbaar als rustige presets.

Recente en favoriete dossiers vormen een compacte lijst onder de
hoofdnavigatie. Toon maximaal vijf links, favorieten eerst. De ster is een
secundaire bediening en het volledige tekstlabel blijft het primaire klikdoel.

Benoemde weergaven staan naast de filters die ze bewaren. Tabelinstellingen
gebruiken één compacte popover voor rijhoogte en kolommen; verplichte
identiteitskolommen kunnen niet worden verborgen. Een actieve bulkselectie toont
één sticky werkbalk boven de tabel met aantal, wijzigingsvelden, bevestigen en
wissen. Selections mogen geen domeinmutatie veroorzaken vóór bevestiging.

“Project bewerken” opent vanuit elk dossieronderdeel dezelfde volledige editor.
Na expliciet bewaren keert de gebruiker terug naar het onderdeel van herkomst.
Een afwijkende verkorte editor is niet toegestaan, omdat verborgen velden dan
onbedoeld verloren kunnen gaan. Bij verlaten met niet-bewaarde invoer verschijnt
een rustige keuze tussen verder bewerken en invoer verwerpen.

## Responsive

Desktop primair.

Tablet:

- navigatie inklapbaar;
- split-view wordt drawer;
- tabellen horizontaal scrollbaar;
- Gantt horizontaal scrollbaar.

## Motion

Alleen functioneel.

Respecteer `prefers-reduced-motion`.

## Assets op GitHub Pages

- voorkeur systemfont of lokaal gebundeld font;
- geen verplichte externe font-CDN;
- iconen lokaal gebundeld;
- assets werken onder Vite base path.

## Aanvullende interactiepatronen

- Portfoliohoofdstukken en clusters zijn standaard open en apart inklapbaar.
- Ganttlabels en balken zijn hetzelfde klikdoel naar hun bronrecord.
- De XS-XXL-band toont aantallen en indicatieve VTE zonder extra chartwand.
- Topicdatums breken op smalle breedte af zonder titel of metadata te overlappen.
- Agenda- en verslag-PDF gebruiken een rustige documentkop, metadataband,
  sectiescheidingen, ruime tekstkolom en paginanummers.
