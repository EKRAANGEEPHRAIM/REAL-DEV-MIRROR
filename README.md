# DevMirror

Plateforme de gestion de projets et de suivi de progression pour développeurs.

> Projet en cours de construction — voir le [plan jour par jour](docs/README.md).

## En ligne

- Application : https://real-dev-mirror-5q1b.vercel.app
- API : https://devmirror-api.onrender.com/api/v1/health
- Documentation de l'API (Swagger) : https://devmirror-api.onrender.com/api/docs

L'API est sur le plan gratuit de Render : après 15 minutes d'inactivité, la première
requête prend environ 30 secondes.

## Stack

| Couche          | Technologie                                          |
| --------------- | ---------------------------------------------------- |
| Frontend        | Angular 22 (standalone, zoneless), NgRx Signal Store |
| UI              | Spartan UI + Tailwind CSS, Lucide                    |
| Backend         | NestJS, Swagger, class-validator                     |
| Base de données | Prisma 7.10 + Neon PostgreSQL                        |
| Monorepo        | pnpm workspaces                                      |

## Structure

```text
apps/web     Angular 22
apps/api     NestJS + Prisma
libs/        code partagé (client API généré depuis Swagger)
docs/        cahier des charges, décisions d'architecture
```

## Démarrage

```bash
pnpm install
```

Les règles de code de la stack sont dans [.claude.code.md](.claude.code.md).
