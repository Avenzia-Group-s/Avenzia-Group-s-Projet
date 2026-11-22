# Avenzia | Groups

Le dossier v3 contient le projet complet. Toutes les commandes partent de sa racine.

```text
apps/
  api/             API Fastify, OAuth Discord, sessions et permissions
  discord-bot/     Bot Discord, commandes et synchronisation des rôles
  desktop/         Interface React et application Windows Tauri
    src/           Interface commune au navigateur et à Windows
    src-tauri/     Code Rust, configuration Tauri et icônes générées
packages/
  database/        Client Prisma, schéma et migrations PostgreSQL
  shared/          Types, validation et règles de rôles partagés
scripts/           Installation, démarrage, diagnostic et build
.github/workflows/ Vérifications et compilation Windows sur GitHub
.env.example       Modèle de configuration
.env.local         Configuration locale privée
```

## Configuration et démarrage Windows

1. Lancez `scripts\setup.bat` pour installer les outils locaux et appliquer les migrations existantes.
2. Renseignez `.env.local` à la racine. `scripts\doctor.bat` indique les champs manquants.
3. Lancez `scripts\start-web.bat` pour démarrer PostgreSQL, l’API, le bot et l’interface navigateur.
4. Ouvrez [l’interface locale](http://127.0.0.1:1420). Vérifiez [l’API](http://localhost:3000/health), puis `/avenzia statut` dans Discord.

Le mode navigateur sert au développement. Il utilise le même code React, les mêmes permissions API et l’A2F Discord. Sa session de développement est stockée dans le navigateur.

`scripts\start-dev.bat` lance la version Tauri, qui compile Rust et conserve la session dans le coffre Windows. `scripts\start-dev.bat --services` lance l’API et le bot. Fermez les anciennes fenêtres Avenzia avant une nouvelle exécution.

L’API et le bot chargent `.env`, puis `.env.local`. Les valeurs de `.env.local` ont priorité sur celles de `.env`. Les variables système et GitHub Actions ont priorité sur les fichiers. Vite lit les fichiers à la racine et expose au navigateur uniquement les variables préfixées `VITE_`.

| Variable | Utilisation |
| --- | --- |
| DATABASE_URL | API et Prisma |
| API_PORT | Port d’écoute local de l’API |
| API_PUBLIC_URL | Adresse du callback OAuth Discord |
| API_URL | Adresse utilisée par le bot pour joindre l’API |
| VITE_API_URL | Adresse intégrée à l’interface |
| DISCORD_CLIENT_ID, DISCORD_CLIENT_SECRET | Connexion OAuth Discord |
| DISCORD_BOT_TOKEN | Connexion du bot et envoi des codes A2F |
| DISCORD_GUILD_ID, ROLE_*_ID | Serveur Discord et permissions |
| INTERNAL_API_SECRET | Secret partagé API et bot |
| TAURI_SIGNING_PRIVATE_KEY_PASSWORD | Signature des mises à jour |

Les secrets et leurs sauvegardes sont exclus de Git. Le dossier `.keys` doit être sauvegardé dans un emplacement privé.

## Mises à jour et hébergement

Pour intégrer la future API publique, renseignez `publication.json`, puis lancez `PUBLIER-GITHUB.bat`. Les réglages côté hébergement et Discord sont détaillés au début de [UPDATES.md](docs/UPDATES.md).

Consultez [UPDATES.md](docs/UPDATES.md) pour les mises à jour en place et [PTERODACTYL.md](docs/PTERODACTYL.md) pour l’egg Node.js 22. L’alternative Render Free et Neon Free est décrite dans [DEPLOY.md](docs/DEPLOY.md).

Après configuration, `scripts\\release.bat patch` prépare la version et déclenche la compilation signée sur GitHub. La release est publiée après vérification des artefacts.

## Compiler sur GitHub

### Installateur de test sur votre PC

Un envoi sur une branche `codex/**` lance automatiquement **Build Windows** et la CI. Après intégration du workflow sur la branche principale, vous pouvez aussi ouvrir **Actions → Build Windows → Run workflow**. Conservez `http://localhost:3000` comme adresse API pour tester avec les services de votre PC. Téléchargez ensuite **Avenzia-Windows-test** dans les artefacts de l’exécution.

Ce workflow génère les icônes, vérifie le code et compile l’installateur. Il produit un installateur de test contenant le client de mise à jour. Les signatures destinées à la distribution des mises à jour sont produites par le workflow Release signée.

### Release signée pour le staff

La configuration et les commandes sont détaillées dans [UPDATES.md](docs/UPDATES.md). Renseignez les secrets de signature via `scripts\configure-updates.bat`, puis publiez avec `scripts\release.bat patch`.

Le workflow **Release signée** contrôle les tests, les types, l’audit, la signature et la version, puis publie les fichiers pour l’updater.

GitHub compile l’application. PostgreSQL, l’API et le bot fonctionnent sur votre PC ou sur un hébergement. Les services Discord restent configurés sur cette machine.

Kaspersky a supprimé des exécutables de compilation locale. Les workflows utilisent des runners GitHub. Le fichier téléchargé sera également analysé par votre antivirus. Une éventuelle détection nécessite une vérification avec Kaspersky.

## Vérifications

```bat
npm run doctor
npm run typecheck
npm test
npm -w @avenzia/desktop run build
```

## Discord Developer Portal

1. *New Application* → onglet **OAuth2** : copiez Client ID / Secret ; ajoutez la redirection `http://localhost:3000/auth/discord/callback` (en prod : `https://<votre-api>/auth/discord/callback`).
2. Onglet **Bot** : copiez le token ; activez **Server Members Intent** (privilégié, obligatoire pour la synchro des rôles).
3. Invitation du bot : scopes `bot applications.commands`, permission `View Channels` uniquement (la commande `/avenzia sync` n'a besoin d'aucune permission Discord supplémentaire).
4. Activez le mode développeur Discord, puis copiez les ID du serveur et des rôles dans `.env.local` (`DISCORD_GUILD_ID`, `ROLE_*_ID`).
5. Créez le premier projet (rôle `Projet | Coucou`) via `POST /projects` avec un compte Fondateur/Co-fondateur (écran de création : Phase 2).

## Publication GitHub (`build.bat`)

Crée un jeton **fine-grained** limité à ce dépôt, permission *Contents : Read and write*, dans `GITHUB_TOKEN`.

Étapes : version +1 → `npm ci --ignore-scripts` → `npm audit` → typecheck → tests → `tauri build` signé (`--locked`) → commit/push de la version → release GitHub en brouillon → envoi de l'installateur, `.sig`, `SHA256SUMS.txt`, `latest.json` → publication. Un échec à n'importe quelle étape n'envoie **rien**.
Options : `--no-bump`, `--no-release`, `--no-git`.

## Mises à jour

L'app vérifie `releases/latest/download/latest.json` au démarrage. Le plugin refuse tout installateur dont la signature minisign ne correspond pas à la clé publique intégrée dans `tauri.conf.json`.
**Sauvegardez `.keys\updater.key` et son mot de passe** : les perdre interdit toute mise à jour future des installations existantes.

## A2F par message privé Discord

À chaque **nouvelle connexion**, après l'autorisation OAuth2, le bot envoie un code à 6 chiffres en MP. L'application affiche alors l'écran de saisie ; la session n'est ouverte qu'après validation. (Une session déjà enregistrée dans le coffre Windows ne redemande pas de code, jusqu'à déconnexion ou expiration.)

- Code valable **5 min**, usage unique, stocké uniquement sous forme de HMAC (jamais en clair).
- **5 essais** maximum (compteur atomique côté serveur), puis le flux est verrouillé ; renvoi limité à 3 codes, 1 par minute.
- Fail-closed : si le MP ne peut pas être envoyé (MP fermés, Discord indisponible), la connexion échoue, sans contournement.
- Les membres doivent autoriser les MP des membres du serveur (Discord > Paramètres du serveur > Confidentialité).
- `DISCORD_BOT_TOKEN` est obligatoire côté API quand la 2FA est active. Désactivation possible : `TWO_FA_ENABLED=false` (déconseillé).
- Événements journalisés : `auth.2fa.sent`, `resent`, `failed`, `locked`.

**Mise à jour d'une installation existante** : `scripts\env.bat` puis `npm run db:migrate -- --name twofa`, et ajoutez `TWO_FA_ENABLED=true` dans `.env.local`.

## Sécurité en place

OAuth2 + `state` + PKCE ; secret Discord uniquement côté API ; jeton de session stocké haché en base et dans le coffre Windows côté client ; accès projets recalculé côté API à chaque requête depuis les rôles Discord ; projet non autorisé → 404 ; routes bot protégées par secret partagé (comparaison à temps constant) ; rate limiting ; helmet ; CSP Tauri ; capacités Tauri minimales.

## État d'avancement

Phase 1 : fondations (voir ci-dessous). Phases 2 à 5 (tâches, notes, cahier des charges, salons, MP, calendrier, exports, audit UI, WebSockets…) : **non implémentées**.
