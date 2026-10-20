# @devmirror/api-client

Types TypeScript de l'API, générés depuis l'OpenAPI de NestJS. Le front les importe
avec `import type { User } from '@devmirror/api-client'` : rien n'est ajouté au bundle.

## Régénérer après un changement de l'API

```bash
pnpm api-client:generate   # à la racine du monorepo
```

1. compile l'API (`nest build`) ;
2. exporte `openapi.json` sans serveur ni base (mode `preview` de Nest) ;
3. génère `src/schema.d.ts` avec `openapi-typescript`.

La CI échoue si les fichiers générés ne correspondent plus à l'API.
