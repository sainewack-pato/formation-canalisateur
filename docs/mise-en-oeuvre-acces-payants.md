# Mise en œuvre du verrouillage — GIE I2DS

## Ce qui est préparé
- `supabase/migrations/20261018_paid_module_access.sql` : crée deux tables isolées et protégées; ajoute l'accès aux trois comptes déjà autorisés sans écraser les entrées existantes.
- `supabase/functions/get-paid-modules/index.ts` : fonction serveur qui exige une session valide, vérifie `module_access`, puis retourne le contenu stocké dans `paid_module_content`.
- `supabase/migrations/20261018_seed_paid_module_content.sql` : prépare l'insertion des sept modules payants dans la table protégée.
- `js/data.js` : dans cette branche, les contenus complets et les quiz spécifiques m02 à m08 ainsi que le quiz final sont retirés du fichier public; les titres restent pour afficher les cartes verrouillées.
- `js/app.js` : dans cette branche, l'application tente de charger les modules autorisés via la fonction Edge, charge aussi le quiz final depuis le contenu privé de m08, et n'active l'accès complet que si les sept modules et le quiz final sont retournés.

## Très important
Cette préparation n'est pas encore une fonctionnalité complète et ne doit pas être publiée. Le contenu des modules m02 à m08 se trouve encore dans le fichier public `js/data.js`. Tant qu'il y reste, les contenus peuvent être téléchargés même si l'interface affiche un cadenas.

## Ordre sûr pour finir
1. Vérifier les trois UID prévus dans la migration avant exécution. Ils proviennent de l'audit préalable des comptes.
2. Exécuter la migration dans le SQL Editor du projet Supabase existant. Ne pas désactiver RLS.
3. Exécuter le fichier `supabase/migrations/20261018_seed_paid_module_content.sql` après la migration principale; vérifier que les 7 modules sont présents dans `paid_module_content`.
4. Déployer la fonction Edge avec les secrets du projet. Ne jamais mettre `SUPABASE_SERVICE_ROLE_KEY` dans GitHub ni dans le navigateur.
5. Modifier `js/app.js` pour appeler la fonction et charger les contenus payants seulement après autorisation. Conserver m01 et le quiz global nécessaires au module gratuit.
6. Retirer du fichier public les contenus et quiz propres aux modules m02 à m08. Vérifier que les quiz globaux n'exposent pas de réponses/contenus payants qui doivent rester protégés.
7. Tester un nouvel utilisateur sans accès (doit obtenir 403), puis les trois comptes autorisés (doivent recevoir les 7 modules). Tester inscription, progression, quiz et attestation.
8. Publier seulement après réussite des tests.

## Paiement manuel
Après avoir vérifié la preuve Wave reçue par WhatsApp, l'administrateur ajoute l'UID de l'apprenant dans `public.module_access` via Supabase. Aucun paiement automatique n'est configuré ici.

## Limites de ce lot
Les fichiers de code et les scripts sont préparés dans la branche de test, mais les scripts SQL ne sont pas exécutés et la fonction Edge n'est pas déployée dans Supabase. Le flux n'est donc pas encore opérationnel. Ne pas fusionner dans `main` avant la fin des étapes 3 à 7.
