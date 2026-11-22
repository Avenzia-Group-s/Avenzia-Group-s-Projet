# Hébergement Pterodactyl

## Egg conseillé

L’egg fourni dans `deploy/pterodactyl/egg-avenzia.json` lance l’API et le bot dans un même serveur Node.js 22.

Image du conteneur

```text
ghcr.io/ptero-eggs/yolks:nodejs_22
```

Un administrateur du panel importe le JSON dans **Nests → Import Egg**, puis crée un serveur avec cet egg. Sélectionnez Node.js 22, une allocation réseau pour l’API et une mémoire adaptée aux deux services. Prévoyez 1 Go pour commencer et mesurez la consommation réelle.

Le serveur doit autoriser les connexions sortantes HTTPS vers Discord, GitHub et npm, ainsi que la connexion PostgreSQL à votre base externe.

## Port et adresse HTTPS

Le programme utilise automatiquement `SERVER_PORT`, fourni par Pterodactyl, et écoute sur `0.0.0.0`. Le bot appelle l’API par la boucle locale du même conteneur.

Demandez à votre hébergeur une URL HTTPS stable qui transmet les requêtes vers cette allocation. Par exemple, l’adresse `https://avenzia.votre-hebergeur.fr` doit atteindre le port alloué au serveur.

Cette URL devient `API_PUBLIC_URL`. Avec un reverse proxy géré par l’hébergeur, renseignez le nombre de proxys de confiance dans `API_TRUST_PROXY_HOPS`, généralement 1. Confirmez cette valeur avec l’hébergeur.

## PostgreSQL

Utilisez une base PostgreSQL proposée par l’hébergeur ou Neon Free. Dans Neon, créez un projet gratuit et récupérez une connexion directe PostgreSQL dans **Connect**, avec le chiffrement TLS activé.

Collez la connexion dans la variable privée `DATABASE_URL` du serveur Pterodactyl. Les migrations sont appliquées au démarrage par `prisma migrate deploy`.

La base conserve les données partagées par tous les utilisateurs. Pour reprendre des données locales existantes, sauvegardez et restaurez PostgreSQL avant de basculer les utilisateurs vers la nouvelle API.

## Variables du serveur

Renseignez dans **Startup** les champs de l’egg avec vos valeurs locales correspondantes.

- `API_PUBLIC_URL` contient l’URL HTTPS publique de l’API.
- `DATABASE_URL` contient la connexion PostgreSQL.
- `DISCORD_CLIENT_ID`, `DISCORD_CLIENT_SECRET`, `DISCORD_BOT_TOKEN` et `DISCORD_GUILD_ID` configurent Discord.
- `ROLE_FOUNDER_ID`, `ROLE_COFOUNDER_ID`, `ROLE_STAFF_ID` et `DISCORD_INVITE_URL` reprennent votre serveur.
- `INTERNAL_API_SECRET` contient au moins 32 caractères aléatoires.
- `TWO_FA_ENABLED` reste à `true`.
- `AUTO_UPDATE=1` actualise le code avec `git pull --ff-only` au prochain démarrage.

Conservez les secrets dans le panel privé. Le dépôt GitHub est public.

Le code est récupéré depuis la branche `codex/project-setup`. Les dépendances sont installées depuis le lockfile, puis Prisma est généré. Le démarrage lance les migrations, l’API et le bot.

## Avec l’egg Node.js générique

Le catalogue communautaire propose **node.js generic**.

Sources

- https://eggs.pterodactyl.io/egg/generic-node-js-generic/
- https://github.com/pterodactyl/generic-eggs/tree/main/nodejs

Si votre hébergeur utilise cet egg, demandez une commande de démarrage personnalisée

```sh
npm ci --include=dev --ignore-scripts && npm run db:generate && exec node scripts/start-hosted.mjs
```

Le monorepo complet doit être présent dans `/home/container`. Les outils de développement sont inclus car le runtime utilise actuellement `tsx` pour exécuter les services TypeScript.

## Validation et distribution

1. Ouvrez `https://VOTRE-API/health` et vérifiez `{"ok":true}`.
2. Vérifiez `Avenzia Bot connecté` dans la console et `/avenzia statut` dans Discord.
3. Dans le Developer Portal, ajoutez `https://VOTRE-API/auth/discord/callback` aux Redirects OAuth2.
4. Depuis le PC de développement, lancez `scripts\configure-updates.bat --api-url https://VOTRE-API`.
5. Publiez une nouvelle version avec `scripts\release.bat patch`.

La mise à jour distribuée intègre cette adresse API. Les autres personnes peuvent alors se connecter à l’API hébergée. Une fois la bascule validée, arrêtez les anciens services locaux pour conserver une seule instance du bot.
