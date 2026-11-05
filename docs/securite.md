# Sécurité

Vérification faite au J38 (novembre 2026), sur la production (Vercel + Render) et le code.
Les tests e2e cités tournent à chaque PR.

## Résultats

| Sujet               | Constat                                                                                                                                                                                                                                                 | Suite donnée                                                                                                                                                                                                        |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Limitation de débit | **Contournable** : derrière Vercel puis Render, l'IP vient de `X-Forwarded-For` (`trust proxy`), que le client peut écrire. Vérifié en production : 7 connexions ratées avec une fausse IP chacune, aucun 429 (contre un 429 dès la 5ᵉ sans l'en-tête). | Limite **par compte** en plus de la limite par IP : 10 connexions / 15 min et 3 emails « mot de passe oublié » / heure par adresse. `test/rate-limit.e2e-spec.ts` rejoue l'attaque.                                 |
| Cookie de session   | `dm_refresh` : `httpOnly`, `Secure` en production, `SameSite=Strict`, limité à `/api/v1/auth`. Le front appelle l'API en même origine (réécriture Vercel).                                                                                              | Conforme.                                                                                                                                                                                                           |
| CORS                | Une origine non autorisée ne reçoit pas `Access-Control-Allow-Origin` ; seul le front Vercel est autorisé, avec identifiants.                                                                                                                           | Conforme.                                                                                                                                                                                                           |
| Secrets             | Historique Git complet analysé (55 commits) : aucune clé réelle ; seules des valeurs de test (`localhost`, hôte Neon fictif). Seul `.env.example` est suivi.                                                                                            | Conforme.                                                                                                                                                                                                           |
| En-têtes du front   | Pas de Content-Security-Policy.                                                                                                                                                                                                                         | CSP stricte (`script-src 'self'`, aucun script en ligne), `Permissions-Policy`, `Cross-Origin-Opener-Policy`. Le serveur des tests Playwright applique les mêmes en-têtes et l'audit échoue à la moindre violation. |
| En-têtes de l'API   | helmet : CSP, HSTS, `nosniff`, `Referrer-Policy`, COOP.                                                                                                                                                                                                 | Conforme.                                                                                                                                                                                                           |
| Compte de démo      | Identifiants publics.                                                                                                                                                                                                                                   | Mot de passe, suppression, profil, avatar et « déconnecter toutes les sessions » refusés (403) ; aucun email de réinitialisation. `test/demo.e2e-spec.ts`.                                                          |

## Choix et limites

- **Pas de correction par l'IP seule.** Faire confiance à un nombre précis de proxys suppose de
  connaître la chaîne exacte, différente selon que la requête passe par Vercel ou arrive
  directement sur Render. Une valeur fausse laisserait le contournement, ou ferait partager une
  seule IP à tous les visiteurs. La limite par compte ne dépend pas du réseau.
- **Reste contournable par IP** : la création de comptes en masse et la limite générale de
  100 requêtes par minute. Une parade possible : un captcha à l'inscription.
- **IPv6** : les adresses sont regroupées par bloc /64 (comportement de `@nestjs/throttler`).
- **CSP** : `style-src 'unsafe-inline'` reste nécessaire aux styles injectés par Angular ; les
  images de notes sont acceptées en `https:` (Markdown nettoyé par DOMPurify).

## Rejouer la vérification

```bash
pnpm --filter @devmirror/api test:e2e        # attaque X-Forwarded-For, compte de démo
pnpm --filter @devmirror/web e2e --project=audit   # aucune violation de la CSP
curl -s -D - -o /dev/null https://real-dev-mirror-5q1b.vercel.app/login   # en-têtes
```
