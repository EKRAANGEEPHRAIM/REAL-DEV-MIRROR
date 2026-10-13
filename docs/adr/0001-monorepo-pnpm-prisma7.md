# ADR 0001 — Monorepo pnpm et Prisma 7

- **Date** : 2026-10-14
- **Statut** : acceptée

## Contexte

DevMirror contient un frontend Angular et une API NestJS qui partagent un contrat REST.
Prisma 8 est en release candidate (sortie officielle prévue en octobre 2026) ; Prisma 7 est stable.

## Décision

- Un seul dépôt géré avec **pnpm workspaces** : `apps/web`, `apps/api`, `libs/api-client`.
- Le client TypeScript du front est **généré depuis le Swagger** de l'API.
- **Prisma 7.10** épinglé (`~7.10.0`) ; migration vers Prisma 8 réévaluée après sa sortie stable.

## Conséquences

- Une seule CI et un seul historique ; les types du front suivent l'API automatiquement.
- Configuration initiale un peu plus longue qu'avec deux dépôts séparés.
- Pas d'installation de `prisma` sans version : `npm i prisma` installe Prisma 8.
