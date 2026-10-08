# Activer les cercles privés

Le carnet et les collections par lien fonctionnent sans cette étape. Les comptes, publications, encouragements et commentaires nécessitent un projet Supabase. Aucun projet de production ni fournisseur d’emails n’est créé automatiquement par ce dépôt.

## 1. Préparer le service

Créer un projet Supabase dans une région adaptée aux utilisateurs. Garder le mot de passe de base et les clés secrètes hors du dépôt. Choisir les limites et le plan selon l’usage attendu.

Dans **SQL Editor**, exécuter une fois le contenu de [001_private_circles.sql](../supabase/migrations/001_private_circles.sql) sur un projet neuf. Le fichier crée cinq tables `faune_*`, un schéma privé pour les fonctions d’autorisation et les politiques Row Level Security. Il est transactionnel et n’est pas destiné à être rejoué sur un schéma déjà installé.

Ne pas désactiver la RLS. Ne pas exposer le schéma `faune_private` à l’API. L’application utilise le schéma `public` avec le rôle authentifié ; les visiteurs anonymes n’ont aucun accès aux tables des cercles.

## 2. Configurer la connexion par email

Dans **Authentication**, activer le fournisseur email et autoriser les inscriptions souhaitées. Dans la configuration des URL :

- **Site URL** : `https://thithilacastagne.github.io/Pokedex-francois/`
- **Redirect URLs** : autoriser l’adresse de retour exacte `https://thithilacastagne.github.io/Pokedex-francois/?auth=1#circle` ; si le validateur de l’interface ne conserve pas le fragment, autoriser `https://thithilacastagne.github.io/Pokedex-francois/**` pour ce seul chemin.

Configurer un fournisseur SMTP de production et contrôler les limites d’envoi. Le service email par défaut de Supabase a des restrictions et ne constitue pas une configuration de distribution publique.

L’application demande un email de connexion. Le lien doit être ouvert dans le même navigateur que la demande, car l’authentification utilise PKCE. Si vous souhaitez aussi proposer un code à saisir, inclure `{{ .Token }}` dans le modèle d’email approprié. L’interface accepte un code si l’email en fournit un ; elle ne suppose pas que tous les modèles le contiennent.

## 3. Relier le site

Récupérer l’URL du projet et sa **publishable key** publique. La clé publique n’accorde que les accès autorisés par la RLS. Une clé `secret` ou `service_role` contournerait ces protections et ne doit jamais être placée dans le navigateur.

Pour développer, copier `.env.example` vers `.env`, renseigner les deux valeurs et redémarrer Vite. Le fichier `.env` est ignoré par Git. Le client accepte aussi `VITE_SUPABASE_ANON_KEY` pour les projets utilisant encore une clé publique `anon`.

Pour GitHub Pages, créer ces variables de dépôt dans **Settings → Secrets and variables → Actions → Variables** :

```text
VITE_SUPABASE_URL=https://votre-projet.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
```

Relancer **Publier faune.** sur `main`. Ces paramètres sont lus au build, pas après publication. N’ajouter aucune clé d’administration au workflow.

## 4. Vérifier avec deux comptes réels

Les tests du dépôt couvrent les règles PostgreSQL et l’interface avec une API simulée. Ils ne valident pas la livraison des emails, les URL de retour ou la configuration d’un projet Supabase réel. Avant d’inviter des proches :

1. Sur le site publié, demander un email, suivre le lien dans le même navigateur et vérifier le retour dans **Cercle connecté**. Essayer aussi le code si le modèle le propose.
2. Créer un cercle avec le premier compte. Depuis un autre navigateur, se connecter avec un deuxième compte et rejoindre avec le code d’invitation.
3. Publier une rencontre, d’abord sans photo puis avec une photo choisie. Vérifier que notes, lieux et date d’observation restent absents de la publication.
4. Ajouter un encouragement et un commentaire depuis le second compte. Vérifier la mise à jour du fil et la suppression d’un commentaire.
5. Partager, actualiser puis retirer le résumé de collection. Vérifier le résultat depuis l’autre compte.
6. Renouveler le code ; vérifier que l’ancien ne permet plus de rejoindre. Vérifier qu’un troisième compte non membre ne peut consulter aucune donnée du cercle, y compris via l’API.
7. Quitter le cercle avec le deuxième compte ; ses publications et interactions doivent disparaître. Se déconnecter et vérifier la fermeture de l’accès.

## Comportement et limites

- Chaque compte peut créer cinq cercles et appartenir à vingt cercles ; un cercle accepte cinquante membres.
- Le créateur peut retirer des membres et modérer les publications/commentaires. Il supprime son cercle pour le quitter ; le transfert de propriété n’est pas proposé.
- Le code d’invitation donne accès au cercle à un compte connecté. Les membres peuvent le transmettre. Le renouveler si nécessaire.
- Le fil montre les cinquante publications les plus récentes et se rafraîchit toutes les trente secondes lorsqu’il est visible. Il n’utilise pas de notifications push.
- Le partage du résumé de collection est manuel. Les carnets locaux ne sont pas synchronisés ni sauvegardés dans Supabase.
- Les photos partagées sont des copies JPEG sans métadonnées, réduites à 720 pixels et limitées à 320 000 caractères encodés. Elles sont conservées avec les publications en base. Surveiller le volume et prévoir une stratégie de stockage différente avant un usage à grande échelle.
- Quitter un cercle retire les contributions du membre à ce cercle. Effacer un carnet local n’efface aucune contribution distante.
- L’interface ne propose pas encore de suppression globale du compte. L’administrateur peut supprimer un utilisateur dans Supabase Auth ; les relations en cascade retirent ses cercles et ses contributions. Prévoir un contact pour les demandes des utilisateurs.
- La protection contre les abus d’inscription et l’envoi d’emails relève de la configuration Supabase : quotas, SMTP, surveillance et, si nécessaire, contrôle des inscriptions. Ce projet vise des petits cercles de proches.

Références : [connexion sans mot de passe](https://supabase.com/docs/guides/auth/auth-email-passwordless), [URL de retour](https://supabase.com/docs/guides/auth/redirect-urls), [Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security).
