# Où héberger l'API et le bot (sans serveur dédié)

L'API n'est pas un service à « obtenir » : c'est `apps/api` de ce dépôt. Elle doit tourner **quelque part joignable en HTTPS**, avec PostgreSQL et le bot (`apps/discord-bot`, qui doit rester connecté 24h/24).

## Option A — Votre PC + Cloudflare Tunnel (gratuit, pour démarrer)
Prérequis : un compte Cloudflare gratuit et un **nom de domaine** dont le DNS est sur Cloudflare (le domaine lui-même est payant chez un registrar). Le PC doit rester allumé avec API + bot + PostgreSQL (`scripts\start-dev.bat`).

1. Installer `cloudflared`, puis : `cloudflared tunnel login`
2. `cloudflared tunnel create avenzia`
3. `cloudflared tunnel route dns avenzia api.votredomaine.fr`
4. `config.yml` :
   ```yaml
   tunnel: avenzia
   credentials-file: C:\Users\VOUS\.cloudflared\<ID>.json
   ingress:
     - hostname: api.votredomaine.fr
       service: http://localhost:3000
     - service: http_status:404
   ```
5. `cloudflared tunnel run avenzia` (ou `cloudflared service install` pour un démarrage automatique)

## Option B — Hébergement cloud (24h/24)
Un petit VPS (ex. OVH, Hetzner) avec Docker, ou une plateforme (Railway, Render, Fly.io) + PostgreSQL géré (Neon, Supabase…). **Vérifiez les tarifs et limites actuels** avant de choisir : le plan gratuit met souvent les services en veille, ce qui coupe le bot Discord.

## Test uniquement : tunnel rapide
`cloudflared tunnel --url http://localhost:3000` donne une URL `*.trycloudflare.com` aléatoire, sans compte, mais **différente à chaque lancement** et sans garantie de disponibilité : inutilisable en production.

## Configuration à faire une fois l'URL connue (ex. https://api.votredomaine.fr)
1. `.env.local` : `API_PUBLIC_URL=https://api.votredomaine.fr` et `VITE_API_URL=https://api.votredomaine.fr`
2. Discord Developer Portal > OAuth2 > Redirects : ajouter `https://api.votredomaine.fr/auth/discord/callback`
3. `scripts\build.bat` : vérifie que `VITE_API_URL` est en HTTPS et autorise cette adresse dans la CSP de l'app.
4. Le bot doit tourner au même endroit que l'API (`API_URL=http://localhost:3000`).

## Sauvegardes
Planifiez `pg_dump` régulier de la base ; les sessions et l'audit y sont stockés.
