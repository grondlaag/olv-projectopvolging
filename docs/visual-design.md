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

Centrale Grondlaag-tokens:

```css
--color-paper: #f6f4ef;
--color-panel: #ece9e2;
--color-elevated: #fffdf9;
--color-accent: #f2d96b;
--color-accent-soft: #f7edb0;

--color-ink-strong: #171714;
--color-ink: #2b2b2b;
--color-ink-muted: #6a6a64;
--color-ink-subtle: #8a877f;

--color-border: #d6d2c8;
--color-border-strong: #b8b3a8;

--color-success: #456b50;
--color-warning: #8a6324;
--color-danger: #934b43;
--color-info: #4d6972;
```

Het Grondlaag-geel markeert de primaire actie, huidige selectie en functionele
focus. Het is geen algemene decoratiekleur. Bestaande `brand`-aliassen wijzen
centraal naar dit neutrale contract zodat feature-CSS tijdens gefaseerde
migratie coherent blijft.

Controleer WCAG 2.1 AA. Zwarte tekst op geel is verplicht; witte tekst op geel
is niet toegestaan.

Status nooit alleen door kleur.

## Typografie

Voorkeur:

```css
Inter,
system-ui,
sans-serif
```

Compacte metadata, codes, badges en toetsen gebruiken de lokale monostack
`IBM Plex Mono`, `SFMono-Regular`, Consolas, monospace. Externe font-CDN's zijn
niet vereist.

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

De shell volgt het Grondlaag-werkbankmodel:

- papierkleur als canvas en verhoogd wit voor de compacte header;
- een vaste beige navigatiekolom op desktop;
- een lokaal SVG-icoon plus zichtbaar label per bestemming;
- een gele actieve bestemming met zwarte tekst en een harde, subtiele offset;
- recente dossiers onder de primaire navigatie en Instellingen vast onderaan;
- op tablet een smalle iconenrail en op mobiel een horizontale navigatiestrook.

Elke route gebruikt dezelfde basisopbouw: `WorkspacePage` voor de
contentbreedte, optioneel `ViewBar` voor weergave/filteracties en
`WorkspaceGrid` voor navigatie, hoofdinhoud en inspector. Features mogen deze
primitieven uitbreiden, maar maken geen afwijkende paginashell.

Hoofdwerkruimtes volgen steeds dezelfde verticale logica:

1. `PageHeader` met context en primaire actie;
2. één `KpiStrip` met feitelijke kerncijfers;
3. indien van toepassing één standaard ingeklapte `FilterPanel`;
4. aanvullende uitleg of weergavebediening;
5. de primaire tabel, boom, tijdslijn of dossierinhoud.

Een feature bouwt geen eigen filterkaart of KPI-tegels. Zoeken, snelle
selecties, detailfilters, opgeslagen weergaven en actieve filterchips leven
binnen dezelfde `FilterPanel`. Actieve filters blijven buiten de ingeklapte
inhoud zichtbaar en afzonderlijk verwijderbaar. `KpiStrip` gebruikt overal
dezelfde label-, waarde- en ondersteunende-teksthiërarchie; kleur is alleen een
aanvullend semantisch signaal.

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

- radius 4–6 px;
- dunne border;
- een harde offset-shadow alleen voor verhoogde werkpanelen;
- geen floating card wall.

## Tabellen

- sticky header;
- rustige rijhoogte;
- subtiele horizontale scheiding;
- hover;
- selectie met een zachte gele achtergrond en expliciet tekst-/focuscontrast;
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

- Grondlaag-geel;
- zwarte tekst en zwarte border;
- beperkte radius;
- duidelijke focus.

### Secundair

- verhoogd wit;
- neutrale border;
- zwarte tekst.

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

De projectcontext heeft overal exact dezelfde vier werkruimtes: **Dashboard**,
**Journaal**, **Planning** en **Budget**. Dossierheader, KPI-strip,
tabnavigatie en inhoudsbreedte blijven tussen deze pagina's gelijk. Het Journaal
is de primaire operationele werkruimte: actieve topics staan open en worden op
hun oorspronkelijke aanmaakdatum gesorteerd, nieuwste eerst; gesloten topics
staan in één ingeklapte sectie. Nieuwe activiteit of heropening wijzigt die
vaste volgorde niet.
Selectie opent een contextpaneel rechts en stapelt dat paneel onder de inhoud op
smalle schermen. Inline bediening krijgt voorrang op modals.

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

Ieder open topic toont direct één compacte verticale tijdlijn met alle entries
op `createdAt`, nieuwste eerst. Updates, acties, beslissingsvragen en beslissingen
worden nooit in afzonderlijke lanes gegroepeerd. Ze delen datumkolom,
typografie, separators en spacing. Alleen actie, beslissingsvraag en beslissing
krijgen respectievelijk een zeer licht oranje, amber en groen volbreedteaccent.
Multiline Markdown blijft als paragrafen, nadruk, lijsten, links, inline code en
checklists leesbaar. Onder ieder open topic staat een eigen compacte composer.
Selectie opent rechts het contextuele Properties Panel; mobiel wordt dit een
bottom sheet.

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
project → agendapunt in compacte, inklapbare tekstsecties. De verwerkingsmodus
toont de bespreking centraal. Agenda en eigenschappen zijn zijpanelen die
standaard gesloten zijn; het eigenschappenpaneel opent pas na selectie van een
topic of entry. Op smallere schermen stapelen deze delen. Na save blijft de
composer staan en wordt alleen de invoer leeggemaakt.

Tijdens verwerking toont een compacte vergaderbalk steeds vorig, huidig
punt/totaal, volgend en een dropdownnavigator. De bespreekstatus is een compacte
select met `Te bespreken`, `Besproken`, `Doorgeschoven`, `Ter info` en
`Geannuleerd`; bij doorschuiven is de datum van het volgende overleg zichtbaar.
De composer begint onmiddellijk met `Schrijf verder…` en ondersteunt Markdown,
slashcommando's, vermeldingen, tags en bijlagelinks zonder typekeuze vooraf.

Agenda en verslag hebben een echte client-side PDF-download met paginanummers.
`Kopieer voor Outlook` schrijft zowel `text/html` als `text/plain` naar het
klembord; browserprint blijft aanvullend beschikbaar.

Het projectjournaal groepeert alleen per echt topic. Binnen een topic blijft de
volledige historische entryflow ononderbroken en standaard zichtbaar. Er wordt
geen fictief "algemeen topic" opgeslagen en er zijn geen afzonderlijke
actie-, beslissing- of historieksecties.

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
- dezelfde hoofdstuk-, cluster-, project- en agendapunthiërarchie als de andere
  overlegmodi;
- updates, beslissingsvragen, beslissingen en acties direct onder hun
  agendapunt;
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
