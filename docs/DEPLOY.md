# Déploiement des services Avenzia

L’application Windows échange avec l’API. L’API utilise PostgreSQL et le bot synchronise les rôles avec cette API. Une adresse HTTPS publique permet aux utilisateurs d’accéder au même service depuis leurs PC.

## Pterodactyl

L’egg Avenzia Node.js 22 et la procédure sont fournis dans [PTERODACTYL.md](PTERODACTYL.md). Le programme choisit le port alloué par le panel et démarre l’API et le bot ensemble.

## Render Free et Neon Free

Cette configuration gratuite a été préparée pour un démarrage avec mise en veille acceptée. Render arrête le service gratuit après une période sans trafic entrant. Le bot est hors ligne pendant cette veille et le prochain accès HTTP réveille le service. L’application laisse davantage de temps à cette première requête.

La base PostgreSQL est hébergée chez Neon Free. Consultez les quotas actuels du plan avant le déploiement.

Sources des offres

- https://render.com/docs/free
- https://render.com/docs/your-first-deploy
- https://neon.com/pricing

### Base Neon

1. Créez un compte et un projet gratuit sur Neon.
2. Dans **Connect**, récupérez l’URL PostgreSQL directe, avec TLS.
3. Conservez cette connexion pour la variable privée `DATABASE_URL` de Render.

### Service Render

Le fichier `render.yaml` décrit le service. Vous pouvez aussi le créer manuellement dans **New → Web Service** avec les réglages suivants.

| Réglage | Valeur |
| --- | --- |
| Dépôt | Avenzia-Group-s/Avenzia-Group-s-Projet |
| Branche | codex/project-setup |
| Runtime | Node |
| Plan | Free |
| Build | npm ci --include=dev --ignore-scripts && npm run db:generate |
| Start | npm run start:hosted |
| Health check | /health |

Ajoutez les variables privées `DATABASE_URL`, `DISCORD_CLIENT_ID`, `DISCORD_CLIENT_SECRET`, `DISCORD_BOT_TOKEN`, `DISCORD_GUILD_ID`, les identifiants `ROLE_*_ID`, `DISCORD_INVITE_URL` et un `INTERNAL_API_SECRET` d’au moins 32 caractères. Activez `TWO_FA_ENABLED=true`, `API_HOST=0.0.0.0`, `API_TRUST_PROXY_HOPS=1` et utilisez Node.js 22.

Le programme utilise le `PORT` et le domaine public injectés par Render. Il applique les migrations PostgreSQL avant de démarrer les deux services.

### Activer l’accès depuis les applications

1. Vérifiez `https://VOTRE-SERVICE.onrender.com/health`.
2. Ajoutez `https://VOTRE-SERVICE.onrender.com/auth/discord/callback` dans les Redirects du portail Discord.
3. Configurez cette adresse dans GitHub avec `scripts\configure-updates.bat --api-url https://VOTRE-SERVICE.onrender.com`.
4. Publiez une version avec `scripts\release.bat patch`.

Les secrets se renseignent directement dans le tableau de bord privé de l’hébergeur. L’application Windows reçoit uniquement l’adresse publique de l’API.

## Hébergement sur votre PC

Votre PC peut également conserver les trois services. Une adresse HTTPS stable doit alors transmettre les requêtes publiques vers l’API locale, et le PC doit rester allumé.

Avec un domaine géré sur Cloudflare, un tunnel peut transmettre les requêtes vers `http://localhost:3000`. Configurez `API_PUBLIC_URL` et l’adresse intégrée aux releases avec ce domaine, puis enregistrez le callback Discord correspondant.

## Données et sauvegardes

PostgreSQL conserve les comptes, projets et sessions. Avant une bascule depuis la base locale, sauvegardez puis restaurez les données sur la base cible. Planifiez ensuite des sauvegardes régulières.

L’installation ou la mise à jour de l’application Windows conserve les données hébergées dans PostgreSQL.
