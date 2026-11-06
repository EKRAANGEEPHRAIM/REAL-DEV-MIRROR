# ADR 0002 — Session : jeton d'accès en mémoire, refresh token en cookie httpOnly

- **Date** : 2026-10-18
- **Statut** : acceptée

## Contexte

Le front (Vercel) et l'API (Render) sont sur deux hébergeurs. Un jeton stocké dans
`localStorage` est lisible par tout script injecté (XSS) ; un cookie seul expose au CSRF.

## Décision

- **Jeton d'accès JWT de 15 minutes**, gardé en mémoire par le front, envoyé en `Authorization`.
- **Refresh token opaque de 7 jours** dans un cookie `httpOnly`, `Secure`, `SameSite=Strict`,
  limité au chemin `/api/v1/auth` ; haché (SHA-256) en base.
- **Rotation à chaque usage** : un refresh token déjà utilisé révoque toute la famille de sessions
  (détection de vol).
- Le front appelle l'API **en même origine** grâce à une réécriture Vercel (`/api/*` → Render) :
  `SameSite=Strict` suffit contre le CSRF.

## Conséquences

- Aucun secret lisible par JavaScript ; un rechargement de page restaure la session par le cookie.
- Un indice booléen en `localStorage` (« une session a été ouverte ici ») évite d'attendre un refresh
  voué à l'échec pour les visiteurs sans compte (J37).
- Changer de mot de passe supprime les autres sessions plutôt que de les révoquer : un ancien jeton
  ne déclenche pas la détection de vol.
