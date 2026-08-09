# Product brief — OLV Projectopvolging

## Productdoel

OLV Projectopvolging is een **client-side projectmanagementapplicatie** voor bouw-, infrastructuur- en beleidsprojecten binnen een zorginstelling.

De toepassing vervangt een te complexe Excel/VBA-oplossing.

De nieuwe scheiding is:

```text
Frontend = gebruik, visualisatie, invoer en bewerking
Excel    = draagbare database
```

Versie 1 wordt als statische webapp gehost op **GitHub Pages**.

Er is geen backend nodig voor de MVP.

## Kernprincipes

1. De gebruiker werkt in de webinterface.
2. Excel wordt geïmporteerd/geëxporteerd en is geen UI.
3. De browser verwerkt data lokaal.
4. De app werkt zonder backend.
5. De domeinlaag blijft onafhankelijk van Excel.
6. Opslag moet later vervangbaar zijn door O365-technologie.
7. Historiek, beslissingen en financiële mutaties blijven traceerbaar.
8. De UI is snel, rustig en professioneel.
9. Plan-pin is niet in scope.
10. GitHub Pages is het vaste hostingdoel voor versie 1.

## Hosting

- GitHub Pages;
- Vite build;
- deployment via GitHub Actions;
- statische `dist/`;
- hash-based routing;
- geen productie-Node-server.

GitHub Pages host **geen gebruikersdatabank**.

Operationele workbooks of vertrouwelijke data worden nooit gecommit.

## Dashboard

Toon minimaal:

- actieve projecten;
- open topics;
- kritieke topics;
- open acties;
- achterstallige acties;
- acties komende 14 dagen;
- komende mijlpalen;
- vertraagde planningitems;
- projecten met planningsrisico;
- budgetkerncijfers;
- grootste budgetafwijkingen;
- recente beslissingen;
- recente wijzigingen;
- geladen Excelbestand;
- dirty state.

## Portfolio

Hiërarchie:

```text
Hoofdstuk
└─ Cluster
   └─ Project
```

Project zonder cluster:

```text
Hoofdstuk
└─ Zonder cluster
   └─ Project
```

Functies:

- zoeken;
- filteren;
- groeperen;
- sorteren;
- open/gesloten;
- hoofdstuk;
- cluster;
- site;
- locatie;
- afdeling;
- projectcoördinator;
- fase;
- status;
- budgetstatus;
- planningstatus;
- kritieke topics;
- achterstallige acties.

Eén klik opent een project.

## Projectdossier

Bevat:

1. kerngegevens;
2. actuele stand;
3. beslissingen;
4. topics;
5. acties;
6. planning;
7. budget;
8. journaal;
9. documenten/bewijsmetadata;
10. overleg;
11. clusterhistoriek.

Voorkeurslayout:

- links context/topicnavigatie;
- midden dossierinhoud;
- rechts acties/metadata/detail;
- panelen inklapbaar.

## Topics

Topic hoort bij exact:

- één project; of
- één cluster.

Ondersteunt:

- titel;
- vaste context;
- eigenaar;
- status;
- prioriteit;
- actuele stand;
- chronologisch journaal;
- beslissingen;
- acties;
- bewijsmetadata;
- optionele timing;
- optionele budgetkoppeling.

Status:

- Open;
- Afgesloten;
- Geannuleerd.

Prioriteit:

- Laag;
- Normaal;
- Hoog;
- Kritiek.

## Updates en beslissingen

Maak onderscheid tussen:

- vaste context;
- actuele stand;
- chronologische bijdragen.

Types minimaal:

- Update;
- Beslissing;
- Projectstatus;
- Clusterstatus;
- Notitie;
- Overlegbijdrage;
- Planningwijziging;
- Budgetwijziging.

## Acties

Acties horen bij:

- project;
- cluster;
- topic;
- overleg.

Status:

- Open;
- Bezig;
- Wacht op derde;
- Wacht op beslissing;
- Afgerond;
- Geannuleerd.

Globale overzichten:

- per eigenaar;
- per project;
- achterstallig;
- deze week;
- komende 14 dagen;
- zonder deadline;
- wacht op beslissing.

## Planning en Gantt

Gantt ondersteunt:

- projecten;
- getimede topics;
- vrije mijlpalen;
- afhankelijkheden;
- week/maand/kwartaal/jaar;
- vandaag-lijn;
- voortgang;
- risico;
- vertraging;
- groepering;
- filtering.

Topic zonder timing verschijnt niet in de Gantt.

## Budget

Ondersteunt:

- goedgekeurd budget;
- raming;
- contract;
- bestelling;
- factuur;
- betaling;
- meerwerk;
- minwerk;
- correctie;
- contingentie;
- prognose eindkost;
- resterend budget;
- afwijkingen.

Ieder budgetrecord hoort bij één project.

`topicId` is optioneel en is een analytische koppeling, geen duplicaat.

## Overleg en verslag

Overleg ondersteunt:

- scope;
- datum;
- titel;
- deelnemers;
- agenda;
- updates;
- beslissingen;
- acties;
- verslag;
- volgende vergadering.

Verslagitems kunnen snapshots bevatten.

## Actoren

Types minimaal:

- Intern;
- Architect;
- Aannemer;
- Studiebureau;
- Leverancier;
- Overheid;
- Andere.

Actor kan tijdens invoer worden toegevoegd zonder contextverlies.

## Niet in scope

- plan-pin;
- CAD/SVG-planweergave;
- PDF-planannotatie;
- backend;
- serverdatabase;
- realtime multi-user;
- Entra ID-authenticatie;
- SharePoint-integratie;
- Dataverse;
- Graph API;
- native mobile app.

## Excel als database

Canonical formaat: `.xlsx`.

Gebruiker kan:

- leeg sjabloon downloaden;
- workbook importeren;
- validatierapport bekijken;
- data bewerken;
- database exporteren;
- lokale sessie herstellen.

## MVP

MVP is gereed wanneer:

- GitHub Pages deployment werkt;
- Excel import/export + roundtrip werkt;
- dashboardbasis werkt;
- portfolio werkt;
- projectbeheer werkt;
- cluster/actor inline toevoegen werkt;
- topics werken;
- updates/beslissingen werken;
- acties werken;
- planning + Gantt werkt;
- budget werkt;
- overleg, agenda en historische verslagversies werken;
- dirty state + sessieherstel werkt;
- design system consistent is;
- kernflows getest zijn.
