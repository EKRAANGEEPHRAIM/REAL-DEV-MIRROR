# Documentation DevMirror

- **Cahier des charges et plan jour par jour** (document de travail, accès privé) :
  https://claude.ai/code/artifact/6e3c7483-e04f-46a1-8f33-35b1e267a297
- **Règles de la stack** : [../.claude.code.md](../.claude.code.md)
- **Déploiement** (Neon, GitHub, Render, Vercel) et compte de démo : [deploiement.md](deploiement.md)
- **Sécurité** (vérification du J38, choix et limites) : [securite.md](securite.md)

## Décisions d'architecture (ADR)

| ADR                                               | Décision                                                     |
| ------------------------------------------------- | ------------------------------------------------------------ |
| [0001](adr/0001-monorepo-pnpm-prisma7.md)         | Monorepo pnpm, client généré depuis Swagger, Prisma 7        |
| [0002](adr/0002-session-jwt-refresh-cookie.md)    | Jeton d'accès en mémoire, refresh token en cookie httpOnly   |
| [0003](adr/0003-angular-zoneless-signal-store.md) | Angular zoneless, NgRx Signal Store, Spartan UI              |
| [0004](adr/0004-i18n-maison.md)                   | Traduction maison plutôt qu'Angular i18n ou une bibliothèque |
| [0005](adr/0005-tests-trois-niveaux.md)           | Tests sur trois niveaux, tous en CI                          |
| [0006](adr/0006-limite-par-compte.md)             | Limitation de débit par compte, en plus de l'IP              |
