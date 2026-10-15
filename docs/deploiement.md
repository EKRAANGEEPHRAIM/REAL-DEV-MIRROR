# Déploiement

| Couche   | Hébergeur | Configuration              | Base Neon      |
| -------- | --------- | -------------------------- | -------------- |
| Frontend | Vercel    | `apps/web/vercel.json`     | —              |
| API      | Render    | `render.yaml` (Blueprint)  | branche `main` |
| CI       | GitHub    | `.github/workflows/ci.yml` | branche `test` |
| Local    | —         | `apps/api/.env`            | branche `dev`  |

Chaque environnement a sa propre branche Neon : les tests e2e et le développement
ne touchent jamais les données de production.

## 1. Neon : une branche par environnement

Dans le projet Neon, créer les branches `dev` et `test` à partir de `main`, puis
copier l'URL poolée (bouton **Connect**) de chacune :

- `main` → Render (`DATABASE_URL`)
- `dev` → `apps/api/.env` en local
- `test` → secret GitHub `DATABASE_URL_TEST`

## 2. GitHub : secret pour les tests e2e

**Settings > Secrets and variables > Actions > New repository secret**

- Nom : `DATABASE_URL_TEST`
- Valeur : URL poolée de la branche Neon `test`

Sans ce secret, le job `api-e2e` est ignoré avec un avertissement ; le job `quality`
(format, lint, tests unitaires, build) tourne toujours.

## 3. Render : API

1. **New > Blueprint**, choisir le dépôt : Render lit `render.yaml`.
2. Renseigner les variables demandées :
   - `DATABASE_URL` : URL poolée de la branche Neon `main`
   - `CORS_ORIGIN` : URL Vercel du front (étape 4) ; mettre une valeur provisoire puis la corriger
3. Le build applique les migrations (`prisma migrate deploy`) avant le démarrage.
4. Vérifier : `https://<service>.onrender.com/api/v1/health` renvoie `"database": "up"`.

Plan gratuit : le service se met en veille après 15 minutes sans trafic ; la première
requête suivante prend environ 30 secondes.

## 4. Vercel : front

1. **Add New > Project**, importer le dépôt.
2. **Root Directory** : `apps/web` (Vercel lit `apps/web/vercel.json`).
3. Déployer, puis reporter l'URL obtenue dans `CORS_ORIGIN` sur Render.

## Après le déploiement

- Chaque push sur `main` redéploie Render et Vercel automatiquement.
- Une nouvelle migration Prisma est appliquée en production au déploiement suivant.
