# Mises à jour d’Avenzia

## Adresse publique et publication en un clic

1. À la racine du projet, ouvrez `publication.json`. Remplacez uniquement la valeur de `apiUrl` par l’adresse HTTPS fournie par l’hébergeur, sans chemin.

   ```json
   { "apiUrl": "https://api.votre-domaine.fr" }
   ```

2. Dans Pterodactyl, ouvrez le serveur **Avenzia | API → Fichiers → avenzia → .env.local**. Modifiez la ligne existante `API_PUBLIC_URL` avec cette même adresse, puis redémarrez l’API. Renseignez le nombre de proxys de confiance suivant les indications de l’hébergeur dans `API_TRUST_PROXY_HOPS`.
3. Dans Discord Developer Portal, application Avenzia → **OAuth2 → Redirects → Add Redirect**, ajoutez `https://api.votre-domaine.fr/auth/discord/callback` et enregistrez.
4. Double-cliquez sur **PUBLIER-GITHUB.bat**, à la racine du projet.

Le lanceur vérifie `/health` et le callback réellement généré par l’API. Ce contrôle ouvre un flux OAuth de test qui expire automatiquement après dix minutes. Il ne vérifie pas la liste des Redirects enregistrée dans le portail Discord. Le script refuse une adresse de démonstration ou une API qui génère encore un callback local.

Il vérifie la présence des secrets de signature déjà configurés sur GitHub, puis met à jour `VITE_API_URL` et `RELEASE_TARGET=public` dans les variables du dépôt. Il enregistre automatiquement la modification de `publication.json`, augmente la version et envoie le commit et le tag pour déclencher **Release signée**.

Les autres modifications du code doivent être enregistrées dans un commit avant le lancement. Le script utilise la connexion GitHub de Git sur ce PC. Aucun token ne se renseigne dans `publication.json`.

Le résultat paraît dans **GitHub → Actions → Release signée**, puis dans **Releases** après validation. Les utilisateurs reçoivent ensuite cette version via les mises à jour intégrées.

Pour contrôler uniquement le fichier, sans réseau ni publication

```bat
PUBLIER-GITHUB.bat --check
```

Pour vérifier l’API et le callback sans modifier GitHub ni créer de version

```bat
PUBLIER-GITHUB.bat --verify
```

## Parcours utilisateur

Avenzia recherche une mise à jour au lancement, avant la connexion Discord, puis périodiquement et lors du retour dans la fenêtre.

Une bannière annonce la version disponible. **Mettre à jour** télécharge l’installateur, vérifie sa signature, l’installe en place et redémarre Avenzia. Les paramètres et la session restent dans leurs emplacements habituels.

Les paramètres affichent aussi la version installée, les notes de version et une recherche manuelle. Les erreurs permettent de réessayer. Une installation réussie suivie d’un échec de redémarrage propose uniquement de relancer l’application.

La première version locale de test utilise `http://localhost:3000`. Pour distribuer à d’autres personnes, configurez une API HTTPS publique selon `docs/PTERODACTYL.md` ou `docs/DEPLOY.md`.

## Signature

L’application conserve la clé publique d’origine. La clé privée et son mot de passe sont enregistrés dans les secrets GitHub Actions, après chiffrement côté client avec la clé publique du dépôt.

Les secrets portent les noms

- `TAURI_SIGNING_PRIVATE_KEY`
- `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`

Le pipeline contrôle les tests, les types, l’audit npm, le manifeste, les signatures et l’empreinte SHA-256 avant de publier la release. Il vérifie aussi que la version annoncée correspond à la version signée.

Sauvegardez la clé privée d’origine et son mot de passe dans un emplacement privé pour conserver la continuité des mises à jour.

## Configuration GitHub

Depuis le dossier du projet

```bat
scripts\configure-updates.bat --api-url https://VOTRE-API
```

Le script utilise la connexion GitHub déjà configurée pour Git. Il envoie uniquement la clé et le mot de passe de signature aux secrets du dépôt. Les paramètres publics `VITE_API_URL` et `RELEASE_TARGET` sont enregistrés dans les variables GitHub Actions.

Pour une première validation sur le PC hébergeant les services

```bat
scripts\configure-updates.bat --local-test
```

Pour consulter uniquement l’état de configuration

```bat
scripts\configure-updates.bat --check
```

Le mode local prépare une release destinée au PC où l’API est démarrée. Le mode public exige une adresse HTTPS stable.

## Publier une nouvelle version

Enregistrez les changements de code dans un commit, puis lancez

```bat
scripts\release.bat patch
```

La commande synchronise les versions de l’application, de Tauri, de Cargo et des lockfiles. Elle crée un commit et un tag, puis les envoie à GitHub.

Un tag `vX.Y.Z` lance **Release signée**. Le build s’exécute sur Windows, crée une release en brouillon et y dépose l’installateur, sa signature, `latest.json` et `SHA256SUMS.txt`. La release devient publique après validation cryptographique des artefacts.

Si l’envoi du tag échoue après sa préparation locale, relancez la même commande. Elle reprend l’envoi du tag préparé.

Les mises à jour des services API et bot se déploient sur leur hébergement. Les migrations PostgreSQL sont appliquées par leur programme de démarrage.

## Installations existantes

Les clients 0.1.0 connectés peuvent rechercher la première release signée depuis **Paramètres → Mises à jour**. La nouvelle version rend ensuite ce parcours disponible dès l’écran de connexion.

Les installateurs de test produits par **Build Windows** contiennent le client de mise à jour. Le workflow de test produit un installateur sans fichier de signature associé. Les packages destinés à l’updater sont générés par **Release signée**.
