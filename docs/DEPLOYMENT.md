# Déployer faune.

## GitHub Pages existant

L’adresse du projet reste `https://thithilacastagne.github.io/Pokedex-francois/`. Le site statique ne nécessite aucune clé pour le carnet, l’album, la progression et le partage par lien.

Le workflow **Publier faune.** compile et publie les changements de `main`. Dans **Settings → Pages**, la source doit être **GitHub Actions**. Attendre la réussite du job `deploy` avant de considérer une version comme publiée. Une branche de travail ou une pull request ne modifie pas le site public.

Le workflow **Vérification de l’application** exécute les essais sur les branches et les pull requests. Attendre son succès avant d’intégrer une modification. Il conserve le site compilé et les résultats d’audit pendant sept jours.

## Avant publication

Avec Node.js 24 :

```sh
npm ci
npm test
npm run test:db
npm run build
npx playwright install chromium
npm run test:browser
npm run test:a11y
npm run test:cloud
npm run format:check
```

Le dossier `dist/` est prêt à héberger sous un chemin de projet ou à la racine. Les scripts de test utilisent leur propre serveur.

## Activation facultative du réseau privé

Le workflow de publication lit deux **variables de dépôt** dans **Settings → Secrets and variables → Actions → Variables** :

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`

Ce sont des paramètres publics de client, intégrés à la compilation. Ne jamais fournir une clé secrète ni `service_role`. Le schéma et les politiques d’accès doivent être installés avant d’activer le client. Suivre [CIRCLES_SETUP.md](CIRCLES_SETUP.md).

Après modification des variables, lancer **Actions → Publier faune. → Run workflow** sur `main`. Sans ces variables, le réseau connecté est clairement indiqué comme non activé ; le partage par lien reste disponible.

## Données conservées et mise à jour

La version 2 conserve le nom de base `pokedex-faune-private-v1`, le magasin `observations` et les sauvegardes version 1. Aucun effacement ou réimport n’est nécessaire à adresse identique. Le profil, les envies et les collections reçues sont stockés séparément dans le navigateur.

Une bannière propose d’appliquer les nouvelles versions. Le service worker garde aussi le cache de la génération précédente pour les onglets encore ouverts. Il ne supprime pas les données du carnet. Une sauvegarde régulière protège contre l’effacement ou l’éviction du stockage par le navigateur.

Un changement de domaine, de profil de navigateur ou d’appareil exige un export puis un import du carnet. Le fond de carte, les sources et le cercle connecté demandent Internet. Le carnet et les fiches sont disponibles hors ligne une fois le cache installé.

## Retour arrière

Revenir sur le commit de publication avec un nouveau commit `git revert`, puis laisser GitHub Pages republier. Ne pas réécrire l’historique et ne pas effacer les données du navigateur. La version précédente peut encore lire le carnet puisque son format est conservé.

Pour désactiver seulement le cercle connecté, retirer ses deux variables de dépôt et relancer la publication. Cela ne supprime pas les données du projet Supabase. Une migration SQL ne doit pas être annulée en supprimant des tables contenant des données sans sauvegarde ni décision explicite de l’administrateur.
