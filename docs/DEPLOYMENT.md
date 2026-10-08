# Déploiement de Pokédex de la faune

L’application est un site statique construit avec Vite. Les observations et les
photos personnelles restent dans le navigateur de l’utilisateur. Ce déploiement
ne nécessite ni base de données distante ni clé secrète. Le navigateur conserve
les données pour une origine donnée : exporter une sauvegarde avant de changer
d’adresse, de navigateur ou d’appareil.

## Vérifier et compiler

Avec Node.js 24 et npm :

```sh
npm ci
npm test
npm run build
```

Le dossier `dist/` contient le site prêt à héberger. La configuration Vite utilise
des chemins relatifs pour permettre un hébergement à la racine ou sous le chemin
du dépôt. Le workflow GitHub `Vérification de l’application` teste et compile
chaque push et conserve ce dossier comme artefact téléchargeable.

## GitHub Pages

Après intégration du code dans GitHub, un administrateur peut activer Pages dans
**Settings → Pages → Build and deployment → Source → GitHub Actions**. Le workflow
`Publier Pokédex de la faune` vérifie puis publie `dist/` à chaque push sur `main`.
Il peut aussi être lancé dans **Actions → Publier Pokédex de la faune → Run workflow**
après l’activation de Pages. Ses permissions `pages: write` et `id-token: write`
sont limitées au job de déploiement, associé à l’environnement `github-pages`.

L’activation initiale de Pages exige un accès administrateur au dépôt. Le jeton
automatique `GITHUB_TOKEN` d’un workflow ne peut pas l’effectuer : le paramètre
`enablement` de l’[action officielle configure-pages](https://github.com/actions/configure-pages/blob/v5/action.yml)
exige un autre jeton doté des permissions adéquates. Le workflow fourni utilise
donc le jeton automatique pour publier sur un site déjà activé, sans demander de
secret supplémentaire.

L’adresse publique et l’état de publication sont affichés par GitHub Pages.
Un chemin d’hébergement prévisible n’est pas une preuve que le site est publié :
attendre un déploiement réussi et ouvrir l’adresse annoncée avant de la partager.

## Autre hébergeur statique

Netlify, Cloudflare Pages et Vercel peuvent également importer ce dépôt GitHub.
Utiliser Node.js 24, la commande de compilation `npm run build` et le dossier de
sortie `dist`. Aucun fichier `.env` n’est nécessaire pour cette version locale.
L’hébergeur fournit l’URL HTTPS après le premier déploiement réussi.

## Ce qui dépend d’une connexion Internet

Les photos personnelles et le carnet fonctionnent localement après chargement
de l’application. Les images d’exemple sont livrées avec le site. La première
installation PWA, les fonds de carte, les liens vers les sources et les recherches
de fiches en ligne demandent une connexion Internet. Les observations locales
restent consultables lorsqu’un service externe est indisponible.
