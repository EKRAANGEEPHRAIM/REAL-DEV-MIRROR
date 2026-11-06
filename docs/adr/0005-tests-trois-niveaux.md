# ADR 0005 — Tests sur trois niveaux, tous en CI

- **Date** : 2026-10-31
- **Statut** : acceptée

## Contexte

Un projet solo sans testeur : la CI doit attraper les régressions fonctionnelles, visuelles et
d'accessibilité avant la production.

## Décision

1. **Unitaires** (Vitest) : services de l'API avec Prisma simulé, seuil de **70 % par fichier**
   vérifié en CI ; composants et stores du front.
2. **e2e de l'API** (Vitest + Supertest) contre une **branche Neon dédiée** aux tests.
3. **Playwright** sur le build de production servi en statique :
   - **audit** : API simulée dans le navigateur, 15 pages × 4 largeurs, anglais, mode sombre,
     axe-core (WCAG 2.2 AA), aucun défilement horizontal ni contenu rogné, aucune violation de
     la Content-Security-Policy ;
   - **parcours** : inscription → projet → tâches → tableau de bord → suppression du compte,
     contre la vraie API et la base de test ; rejouable contre la production (`E2E_BASE_URL`).

## Conséquences

- Environ 650 tests et contrôles à chaque PR (v1.0.0), en 3 jobs parallèles.
- Les tests de l'API et le parcours dépendent d'une base distante : délais d'attente élargis.
- L'audit ne vérifie pas l'API ; le parcours ne couvre pas toutes les pages : les deux se complètent.
