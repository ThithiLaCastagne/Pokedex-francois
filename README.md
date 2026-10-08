# Pokédex de la faune

Une application web et mobile installable pour conserver ses rencontres animales, apprendre à connaître les espèces et observer sans déranger. Interface française, responsive et utilisable sans compte.

## Fonctionnalités

- Photos personnelles : import JPEG/PNG/WebP, appareil photo mobile, galerie et suppression des métadonnées GPS.
- Observations : date, région facultative, notes, favoris, modification et suppression confirmée.
- 18 fiches éducatives avec habitat, alimentation, répartition, taxonomie et sources Wikipédia, GBIF, iNaturalist et UICN.
- Identification libre de toute autre espèce, informations éducatives personnelles et huit rangs taxonomiques facultatifs.
- Recherche sans accents, filtres par groupe animal/région/date/statut, arbre taxonomique et chronologie.
- Carte OpenStreetMap avec centres régionaux seulement : aucune coordonnée d’observation précise enregistrée.
- Sauvegarde JSON complète avec photos et restauration sans doublons.
- PWA installable et carnet disponible hors ligne après une première visite réussie. Le fond de carte nécessite Internet.

Les exemples de découverte sont clairement signalés et ne sont jamais ajoutés au carnet personnel.

## Confidentialité et limites

Les données sont enregistrées dans **IndexedDB sur cet appareil et ce navigateur**. Aucun compte, serveur de photos, outil publicitaire ou service d’identification IA ne reçoit les observations. Il n’y a pas encore de synchronisation entre appareils. Exportez une sauvegarde avant de changer d’appareil, d’adresse du site ou d’effacer les données du navigateur. La sauvegarde JSON contient des données personnelles et n’est pas chiffrée.

Le stockage local n’est pas un écran d’authentification : toute personne ayant accès au même profil de navigateur peut consulter le carnet. Les liens vers les sources et les tuiles OpenStreetMap utilisent des services externes, sans transmettre les photos personnelles.

Les photos sont réencodées à 1 800 pixels maximum et cinq photos par observation. Les originaux sur l’appareil restent inchangés. Limites : 15 Mo par fichier importé, 100 Mo pour le carnet local. Les fichiers HEIC doivent être convertis en JPEG avant l’import.

Les textes sont des synthèses éducatives originales. Les statuts ne sont pas des évaluations UICN en temps réel ; leurs réserves figurent dans les fiches. Les identifications manuelles restent à vérifier. Les illustrations et leurs crédits sont documentés dans [public/photos/CREDITS.md](public/photos/CREDITS.md).

## Développement

Prérequis : Node.js 24 et npm.

```sh
npm ci
npm run dev
```

Dans l’environnement Codex, utiliser `npm ci --cache /tmp/faune-npm-cache` si le répertoire de cache npm personnel n’est pas accessible. Aucun secret ou fichier `.env` n’est nécessaire.

## Vérification

```sh
npm test
npm run build
npm run preview
```

Le build génère `dist/` et un service worker avec les fichiers réels précachés. Les chemins sont relatifs pour permettre une publication dans un sous-répertoire, notamment GitHub Pages.

Les tests navigateur couvrent l’ajout, l’édition, les favoris, le nettoyage GPS, l’identification manuelle, la classification, le rechargement, la suppression, les sauvegardes et le parcours mobile :

```sh
npx playwright install chromium
# Démarrer npm run dev dans un autre terminal, puis :
npm run test:browser
```

Le script utilise `/usr/bin/chromium` lorsqu’il est disponible. `TEST_URL` permet de tester une autre adresse et `CHROMIUM_PATH` un autre Chromium.

## Publication

La CI vérifie les tests et le build. Le workflow GitHub Pages publie `dist/` lors des pushs sur `main`, lorsque Pages utilise la source **GitHub Actions**. Voir [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md).

## Structure

`src/App.tsx` orchestre les vues ; `src/components/` contient formulaire, fiches, arbre et carte ; `src/storage.ts` conserve et valide le carnet ; `src/data.ts` contient les fiches et les régions ; `scripts/build-sw.mjs` construit le cache hors ligne.
