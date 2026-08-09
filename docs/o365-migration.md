# O365-migratievoorbereiding

## Uitgangspunt

Versie 1 gebruikt Excel als browser-side opslagadapter.

Latere doelarchitectuur:

```text
zelfde frontend + use cases
+
andere repositoryimplementatie
```

## Mogelijke mapping

### SharePoint Lists

Geschikt voor:

- projecten;
- clusters;
- topics;
- acties;
- planning;
- budgetmetadata;
- overleg;
- actoren;
- keuzelijsten.

### Documentbibliotheken

Geschikt voor:

- bewijsstukken;
- verslagen;
- projectdocumenten.

### Microsoft Graph

Geschikt voor:

- gebruikers;
- Entra ID actor mapping;
- SharePoint toegang;
- documentmetadata.

### Dataverse

Interessant bij:

- strengere relaties;
- grotere schaal;
- Power Platform;
- security roles;
- complexere workflow.

## Repositorycontract

UI weet niet of data uit Excel of SharePoint komt.

```ts
interface ProjectRepository {
  list(): Promise<Project[]>
  get(id: UUID): Promise<Project | undefined>
  create(input: NewProject): Promise<Project>
  update(id: UUID, patch: ProjectPatch): Promise<Project>
}
```

## Concurrency

Excel MVP:

- één actieve browsercontext;
- lokale dirty state.

O365 later:

- ETag/version;
- optimistic concurrency;
- conflictmelding;
- merge/retry;
- serveraudit.

## Authenticatie

Niet nodig in GitHub Pages MVP.

Later:

- MSAL/Entra ID;
- actor ↔ Entra object ID;
- auth in infrastructuur/app provider;
- domein blijft Actor-ID gebruiken.

## GitHub Pages later

De frontend kan technisch op GitHub Pages blijven indien organisatiebeleid dit toelaat.

Dan afzonderlijk beoordelen:

- tenantconfiguratie;
- CORS;
- informatiebeveiliging;
- authenticatie;
- publieke beschikbaarheid van de app-shell.

Geen O365-secret in repository of browserbundle.

## Migratiepad

1. Excel schema stabiliseren.
2. Repositoryinterfaces stabiliseren.
3. O365 storage PoC.
4. Mapping workbook → remote records.
5. Migratietool.
6. Datamigratie.
7. Remote repository wordt primaire bron.
8. Excel blijft import/export of rapportformaat.

## Niet nu bouwen

- Graph calls;
- SharePoint REST;
- MSAL;
- Dataverse SDK;
- remote sync;
- offline conflict engine.

Alleen architecturale seams voorzien.
