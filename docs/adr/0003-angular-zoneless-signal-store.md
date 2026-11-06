# ADR 0003 — Angular zoneless, NgRx Signal Store et Spartan UI

- **Date** : 2026-10-16
- **Statut** : acceptée

## Contexte

Le front doit rester léger (hébergement gratuit, mobile), accessible, et lisible pour un
recruteur qui parcourt le code.

## Décision

- **Angular 22 sans zone.js** : la détection de changements suit les signals.
- **NgRx Signal Store** pour l'état des pages (`rxMethod` pour les appels, mises à jour optimistes),
  fourni au niveau du composant de page plutôt qu'en global.
- **Spartan UI** (primitives accessibles « brain » + styles « helm » copiés dans le dépôt) et
  **Tailwind CSS 4**.
- Routes chargées à la demande, `@defer` pour ce qui est hors écran (graphiques, notifications).

## Conséquences

- Bundle initial de 499 ko (125 ko transférés), sans Spartan ni icônes (J37).
- Les composants helm étant copiés, on peut les corriger : `HlmInput` n'annonce plus « invalide »
  avant toute saisie (J35).
- Les tests doivent attendre explicitement le rendu différé (`@defer`) et les effets.
