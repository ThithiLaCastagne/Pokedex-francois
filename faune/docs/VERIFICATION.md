# Vérification — 8 octobre 2026

## Serveur et confidentialité

`python tests/run-api.py` : **30 assertions réussies** sur le Worker compilé, avec trois identités de test synthétiques et une base locale. Les profils de test ne sont pas envoyés en production.

Scénarios : accès anonyme refusé, upload JPEG valide, retrait des métadonnées, photo privée inaccessible aux tiers, création et lecture d’une observation, arrondi des coordonnées, isolation entre comptes, modification et réutilisation d’image non autorisées refusées, invitation et acceptation d’ami, partage sélectif, absence de coordonnées dans le flux d’un ami, réactions et commentaires autorisés, protection d’une espèce sensible, retrait d’ami révoquant le flux et les images, suppression d’une observation et de sa photo, rejet d’un fichier non JPEG.

Les identités sont injectées uniquement dans le serveur local de test pour reproduire le contrat des en-têtes du dispatcher Sites. Ces tests ne remplacent pas une recette avec deux comptes réels après ouverture de l’accès.

## Interface

Contrôle dans le navigateur de développement : écran de bureau d’environ 1 360 × 940 et viewport intégré mobile de 390 × 844. Galerie, filtre Oiseaux, fiche éducative, source et taxonomie, navigation mobile et carte consultées. Formulaire vérifié jusqu’à la dernière étape avec une fixture locale non enregistrée : photos existantes, recherche, sélection d’espèce au clavier et à la souris, date, région, notes et protection. Le menu d’espèce a été corrigé pour conserver le focus dans le dialogue. Les routes et pages de fixture ont été retirées avant publication.

La recherche locale s’affiche immédiatement. Les appels externes GBIF ont rencontré une indisponibilité dans l’environnement de développement ; le message de repli et la sélection locale ont été vérifiés. La disponibilité réelle des API tierces reste à surveiller.

WebMCP est exposé si le navigateur prend en charge `document.modelContext`. Le navigateur de vérification n’a exposé aucun outil ; ce chemin n’est pas déclaré validé.

## Livraison

Le contrôle TypeScript et la compilation de production sont exécutés par le workflow avant la création de la version hébergée. Les migrations livrées ne contiennent que le schéma. Aucun contenu de démonstration ni profil de test n’est inséré en production.

Il reste à réaliser une recette sur téléphones iOS/Android physiques, un parcours communautaire avec deux comptes ChatGPT réels autorisés, et une revue indépendante avant une ouverture large. Voir `PRODUCT.md` pour les limites et la roadmap.
