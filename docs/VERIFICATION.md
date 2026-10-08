# Vérification de la version 2

Les résultats ci-dessous concernent la version livrée, pas une certification de tous les navigateurs ni une validation d’un service cloud de production.

| Vérification              | Résultat et périmètre                                                                                                                                             |
| ------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Tests unitaires           | 27 tests : données existantes, collection, déduplication, badges, validation et partage                                                                           |
| PostgreSQL                | 50 assertions exécutées avec PGlite sur le vrai schéma SQL : isolation, anonymes, identités, invitations, modération, cascades et limites des données             |
| Parcours du carnet        | Ajout, édition, favoris, photos, retrait des métadonnées GPS, identification libre, rechargement, sauvegarde, suppression et restauration                         |
| Collections               | Deux navigateurs indépendants, lien Unicode, comparaison, enregistrement, actualisation, rejet des liens malformés, export PNG                                    |
| Hors ligne                | Application compilée sous `/Pokedex-francois/`, rechargement et navigation sans réseau, observations préservées                                                   |
| Mise à jour PWA           | Nouvelle version proposée explicitement, ancien cache utilisé avant acceptation, bascule vers le nouveau, conservation du carnet et fonctionnement hors ligne     |
| Responsive                | Cinq vues à 320, 375, 390, 768, 1 024 et 1 440 pixels sans débordement horizontal                                                                                 |
| Accessibilité automatisée | Zéro violation axe-core WCAG 2 A/AA et 2.1 AA sur les cinq vues à 390 et 1 440 pixels et sur le formulaire d’observation                                          |
| Interface du cercle       | Session restaurée, création, publication explicite, encouragements, commentaires, collection, renouvellement du code et suppressions, contre une API REST simulée |

## Reproduire

Les commandes sont dans le [README](../README.md). La CI installe Chromium et lance ces vérifications. Les scripts de navigateur servent leur build sur un port local libre ; aucun serveur externe n’est nécessaire. Les captures et l’audit JSON sont écrits dans `test-results/`.

L’exécution locale initiale a utilisé Chromium 133 sous Linux avec des tailles de fenêtre simulant le mobile. Elle ne remplace pas des essais sur appareils iOS/Android réels. L’audit axe-core ne couvre pas toute l’accessibilité : les lecteurs d’écran, les agrandissements système et les usages tactiles méritent aussi une vérification humaine.

## Performances

Sur les builds comparés, le JavaScript initial est passé d’environ **142 Ko gzip à 103 Ko gzip**, en comptant le nouveau module partagé : environ **27 % de moins**. Ce chiffre concerne le chargement initial, pas tous les fichiers téléchargés par le cache hors ligne. Le chargement du SDK du cercle, de la carte et des vues secondaires est différé. Les polices latines embarquées représentent environ 62 Ko, contre 127 Ko auparavant.

Ces tailles sont des mesures de compilation. Elles ne constituent pas un score Lighthouse ni une mesure des Core Web Vitals sur de vrais utilisateurs. Le précache hors ligne télécharge aussi des ressources secondaires en arrière-plan.

## Ce qui demande encore un service réel

L’authentification email, la délivrabilité SMTP, les URL de retour et les opérations entre deux vrais comptes Supabase doivent être validées après configuration du projet. Aucun email réel n’a été envoyé pendant les tests. Le parcours à suivre figure dans [CIRCLES_SETUP.md](CIRCLES_SETUP.md).
