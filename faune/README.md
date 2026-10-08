# FAUNE — Le carnet du vivant

Application web naturaliste française : photos personnelles d’animaux, collection d’espèces, fiches éducatives, taxonomie, carnet, carte et cercle d’amis.

Projet autonome créé à partir de zéro. Dans le dépôt GitHub du Pokédex, ce dossier `faune/` n’altère pas l’application existante à la racine.

## Démarrage

Node 22.13+ et pnpm 11.25+. Depuis ce dossier :

```sh
pnpm install --frozen-lockfile
pnpm dev
```

Le fonctionnement complet nécessite les bindings Cloudflare D1 `DB`, R2 `BUCKET` et une session de navigateur. Le mode test crée automatiquement un carnet individuel, sans inscription. Les comptes ChatGPT déjà connectés conservent leur espace existant. Les données de découverte sont accessibles sans base. Ne pas simuler une identité dans du code de production.

```sh
pnpm exec tsc --noEmit
pnpm build
```

Les migrations sont dans `drizzle/`. Elles sont appliquées automatiquement par Sites à la publication. Pour le Worker local, après le build :

```sh
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0000_giant_bastion.sql
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0001_hesitant_hellfire_club.sql
python tests/run-api.py
```

Le test lance lui-même un Worker local sur le port 8791, vérifie les identités du dispatcher puis deux sessions invitées sans en-tête d’identité. Il ne contacte aucune base de production. Chaque visiteur anonyme reçoit un secret aléatoire de 256 bits dans un cookie HttpOnly/SameSite=Lax, Secure en HTTPS, valable 180 jours ; seul son SHA-256 est conservé en base. Le code public d’invitation ne permet pas d’ouvrir le carnet. En dehors de Sites, supprimer la confiance dans les en-têtes d’identité ou la remplacer par des sessions vérifiées.

Le mode test nécessite un accès public au site. Aucune page ne déclenche de connexion ChatGPT/Google. Effacer les cookies, laisser expirer la session ou utiliser un autre navigateur fait perdre l’accès au carnet invité. Il n’existe pas encore de récupération ni de transfert vers un compte définitif. Les API de photos et de données continuent d’exiger une session valide et d’appliquer tous les contrôles de propriété.

## Documentation

- [Produit, architecture, limites et roadmap](docs/PRODUCT.md)
- [Sources et crédits](docs/CREDITS.md)
- [Vérifications](docs/VERIFICATION.md)

Les photos personnelles restent privées par défaut et les lectures sont autorisées côté serveur. Le GPS n’est jamais exposé aux amis. Le code ne contient aucun secret d’API. La reconnaissance automatique d’image par IA est une future intégration facultative : aucune analyse fictive n’est simulée.
