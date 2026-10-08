# FAUNE — produit, architecture et lancement

Application neuve, indépendante du Pokédex précédent. Interface française responsive, pensée comme un carnet naturaliste photographique. Les données de démonstration sont fictives et ne sont jamais écrites dans les carnets personnels.

## Parcours livrés

- Compte personnel via la connexion ChatGPT de l’hébergement ; stockage D1 des observations, stockage R2 privé des images.
- Ajout et correction d’observations avec une à cinq photos, prise de vue via le navigateur, date/heure, région, notes, géolocalisation facultative.
- Images converties en JPEG, redimensionnées à 1 800 pixels maximum ; suppression des métadonnées côté navigateur et des segments EXIF/XMP/IPTC/commentaires côté serveur.
- Six fiches naturalistes embarquées, recherche taxonomique GBIF, saisie manuelle de n’importe quelle espèce, modification des données éducatives, résumé Wikipédia à la demande.
- Galerie regroupée par espèce, favoris, filtres groupe/région/date/conservation, tris, carnet chronologique, arbre taxonomique complet, carte OpenStreetMap.
- Profils, invitations par code ou lien, acceptation bilatérale, suppression de relation, fil réservé aux amis, réactions, commentaires supprimables.
- Privé par défaut. Vérification de propriété sur le serveur, y compris pour chaque lecture d’image. Aucune coordonnée transmise aux amis ; région masquée pour les observations sensibles. Coordonnées personnelles arrondies à 0,5 degré. Les coordonnées des observations sensibles sont supprimées.
- Export JSON des fiches et téléchargement individuel des photos.
- Animations sobres, réduction des mouvements, primitives accessibles pour les dialogues et sélections. Icônes et manifeste pour l’ajout à l’écran d’accueil.

## Limites explicites

La reconnaissance automatique d’une photographie par IA n’est pas connectée : l’interface indique clairement qu’il s’agit d’une recherche taxonomique. Aucun faux score de confiance n’est présenté.

Le statut de conservation n’est pas une copie complète et synchronisée de la Liste rouge. Les évaluations embarquées indiquent une source, un périmètre et une année de publication ; un statut inconnu reste « à vérifier ». La situation locale peut différer. Une intégration UICN sous licence et un référentiel territorial restent nécessaires pour une couverture mondiale continue.

Les photos originales ne sont pas archivées sans transformation. Les JPEG enregistrés sont les versions optimisées, dépourvues de métadonnées. L’export JSON ne contient pas leurs octets. Il n’y a pas de mode hors ligne d’écriture ni d’application App Store/Google Play.

L’hébergement est privé pour le propriétaire à la livraison. Les proches doivent être autorisés à visiter le site pour rejoindre le cercle. L’activation d’une audience plus large est une décision d’accès distincte. Une connexion ChatGPT est nécessaire avec cet hébergement.

Les flux sont limités à 200 publications récentes, le carnet à 2 000 observations chargées et les uploads à 3 000 photos par compte. L’application ne revendique ni un audit de sécurité indépendant, ni une conformité juridique certifiée, ni une validation en charge à grande échelle.

## Architecture code livrée

React 19 / TypeScript / Vinext, composants Shadcn, Tailwind et CSS dédié. Worker HTTP ; D1 SQLite avec migrations Drizzle ; R2 pour les fichiers ; identité fournie par le dispatcher de l’hébergement. Requêtes préparées et contrôles d’accès dans les API. API publiques d’enrichissement séparées des données personnelles. Leaflet pour la carte.

Cette application nécessite un serveur : GitHub conserve le code, mais GitHub Pages seul ne fournit pas D1/R2 ni l’authentification serveur. Le dossier `faune/` dans la branche GitHub est autonome. Le projet Sites utilise le même code dans sa propre racine.

L’authentification repose exclusivement sur les en-têtes de confiance injectés par Sites. Pour migrer hors de Sites, remplacer `app/chatgpt-auth.ts` par un fournisseur de sessions vérifiées ; ne jamais exposer un serveur acceptant directement des en-têtes d’identité fournis par les visiteurs.

## Option no-code

Pour une expérimentation sans développement : une interface FlutterFlow avec un stockage/authentification gérés et des fonctions serveur dédiées à la confidentialité. Les règles de lecture des photos, le masquage de coordonnées, les amitiés réciproques et la transformation EXIF doivent rester côté serveur. Un tableur public ou une simple règle d’affichage ne protège pas les fichiers. Cette alternative n’a pas été implémentée ici ; la version livrée est l’option code.

## Roadmap de lancement en six étapes

1. Tester le carnet personnel avec ses propres photos et corriger les dernières frictions métier.
2. Autoriser un petit groupe de proches, vérifier leurs connexions réelles et les invitations sur leurs appareils.
3. Brancher une reconnaissance IA choisie et budgétée, avec consentement pour l’envoi des images, suggestions corrigibles et tests sur espèces proches.
4. Étendre les données éducatives : sources datées, statuts UICN/territoriaux et politique actualisable des espèces sensibles.
5. Préparer l’ouverture : suppression complète de compte, export complet avec photos, sauvegardes/restauration, politique de confidentialité, quotas, limitation d’abus et modération.
6. Valider à plus grande échelle : tests iOS/Android réels, accessibilité approfondie, charge, suivi d’erreurs, puis éventuel mode hors ligne et distribution mobile.
