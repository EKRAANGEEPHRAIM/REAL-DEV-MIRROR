# ADR 0004 — Traduction maison plutôt qu'Angular i18n ou une bibliothèque

- **Date** : 2026-11-01
- **Statut** : acceptée

## Contexte

L'interface doit exister en français et en anglais, avec changement de langue **sans recharger**
la page et langue enregistrée dans le compte.

## Décision

- Pas d'`@angular/localize` : il produit un build par langue et impose un rechargement.
- Pas de bibliothèque (Transloco, ngx-translate) : environ 80 lignes suffisent.
- Un signal global `currentLanguage` et une fonction `translate(clé, paramètres)` :
  - clés typées depuis `fr.ts` (une clé inconnue ne compile pas) ;
  - pluriels `« singulier|pluriel »` choisis par `Intl.PluralRules` ;
  - dates, tri et dates relatives par `Intl`.
- Le français est embarqué ; l'anglais est chargé à la demande (≈ 5 ko).

## Conséquences

- Un test vérifie que chaque clé française existe en anglais, avec les mêmes paramètres et pluriels.
- Les messages d'erreur renvoyés par l'API restent en français (limite connue).
