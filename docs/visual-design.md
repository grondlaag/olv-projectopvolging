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
- duidelijke acties **JSON openen** en **JSON opslaan**;
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

Header toont:

- code;
- titel;
- status;
- fase;
- coördinator;
- planningstatus;
- budgetstatus.

Actuele toestand krijgt een rustige gemarkeerde zone.

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

## Overleg en verslag

De voorbereiding groepeert brongebonden agendapunten als hoofdstuk → cluster →
project → topic. De verwerkingsmodus gebruikt op ruime schermen drie kolommen:
de agenda en selectie links, bespreking met één vaste invoerkaart centraal en
actuele stand plus bronjournaal rechts. Op smallere schermen stapelen deze
kolommen. Na save blijft de invoerkaart staan en wordt alleen de invoer
leeggemaakt.

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
- bestandsacties gebruiken menselijke labels “Openen” en “Back-up”, terwijl
  toegankelijke namen het JSON-karakter expliciet houden.

Portfolio toont zoeken en scopes altijd. Detailfilters staan achter “Filters”,
actieve keuzes blijven zichtbaar als verwijderbare chips en frequente selecties
zijn beschikbaar als rustige presets.

In een projectdossier biedt “Snel bijwerken” een contextvast formulier voor
status, fase, coördinator en voortgang. De wijziging gebeurt uitsluitend na
expliciete save; structurele gegevens blijven in het volledige projectformulier.

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
