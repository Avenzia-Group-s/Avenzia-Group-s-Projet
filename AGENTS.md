# Consignes pour les agents (Codex, etc.)

Projet : Avenzia | Groups — monorepo npm workspaces (Tauri 2 + React, Fastify + Prisma, discord.js).
Lire `README.md` et `docs/DEPLOY.md` avant toute modification.

## Règles non négociables
- **Aucun secret dans le dépôt ni dans les prompts** : jamais `.env.local`, `.keys/`, tokens Discord/GitHub. Ne jamais les afficher, committer ou recréer avec de vraies valeurs.
- **Permissions toujours vérifiées côté API** (`apps/api`). Ne jamais se contenter de masquer un bouton. Refus par défaut. Un projet non autorisé répond **404**.
- L'accès projet vient **uniquement** des rôles Discord mappés (`hasProjectAccess` dans `packages/shared`). Le Staff n'a aucun accès automatique.
- Ne pas affaiblir l'A2F (`apps/api/src/routes/auth.ts`, `lib/twofa.ts`) : code haché, 5 essais, usage unique, échec fermé.
- Ne pas modifier `scripts/build.mjs`, `scripts/setup.ps1` ni la clé publique dans `tauri.conf.json` sans demande explicite.
- Toute nouvelle route : schéma `zod`, `requireAuth`, test.

## Commandes
- `npm install --ignore-scripts` puis `npm run db:generate`
- `npm run typecheck` · `npm test`
- Les `.bat` ciblent Windows : ne pas les exécuter dans un environnement Linux.

## Roadmap
Phase 1 faite (auth, A2F, rôles, projets, bot, updater). À faire : Phase 2 (création de projet UI, membres, tâches/Kanban, notes, cahier des charges, idées), Phase 3 (salons, MP, annonces, notifications, WebSockets), Phase 4 (calendrier, exports), Phase 5 (admin, audit UI, durcissement).
Chaque phase : fonctionnalités réelles + tests, pas de données factices présentées comme réelles.
