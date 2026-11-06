# ADR 0006 — Limitation de débit par compte, en plus de l'IP

- **Date** : 2026-11-05
- **Statut** : acceptée

## Contexte

Derrière Vercel puis Render, l'API lit l'IP du client dans `X-Forwarded-For`. Ce champ peut être
écrit par le client : en production, une fausse IP à chaque requête contournait la limite de
5 connexions par minute (voir [securite.md](../securite.md)).

## Options

- **Faire confiance à un nombre fixe de proxys** : la chaîne diffère selon que la requête passe par
  Vercel ou arrive directement sur Render. Une valeur fausse laisse le contournement, ou fait partager
  une IP à tous les visiteurs, et donc une seule limite pour tous.
- **Limiter aussi par compte** : indépendant du réseau.

## Décision

Limite par adresse email en plus de la limite par IP :

- 10 connexions par 15 minutes ;
- 3 emails « mot de passe oublié » par heure.

Le compte de démo, dont le mot de passe est public et partagé, n'est limité que par IP.

## Conséquences

- La force brute sur un compte et le bombardement d'une boîte mail sont bornés.
- Un attaquant peut bloquer temporairement la connexion d'un compte dont il connaît l'email
  (15 minutes au plus) : compromis accepté.
- La création de comptes en masse reste limitée par IP seulement.
