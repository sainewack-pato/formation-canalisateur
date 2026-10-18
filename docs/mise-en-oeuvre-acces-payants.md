# Mise en œuvre du verrouillage — GIE I2DS

## Ce qui est préparé
- `supabase/migrations/20261018_paid_module_access.sql` : crée deux tables isolées et protégées; ajoute l'accès aux trois comptes déjà autorisés sans écraser les entrées existantes.
- `supabase/functions/get-paid-modules/index.ts` : fonction serveur qui exige une session valide, vérifie `module_access`, puis retourne le contenu stocké dans `paid_module_content`.

## Très important
Cette préparation n'est pas encore une fonctionnalité complète et ne doit pas être publiée. Le contenu des modules m02 à m08 se trouve encore dans le fichier public `js/data.js`. Tant qu'il y reste, les contenus peuvent être téléchargés même si l'interface affiche un cadenas.

## Ordre sûr pour finir
1. Vérifier les trois UID prévus dans la migration avant exécution. Ils proviennent de l'audit préalable des comptes.
2. Exécuter la migration dans le SQL Editor du projet Supabase existant. Ne pas désactiver RLS.
3. Déplacer les contenus exacts des modules m02 à m08 de `js/data.js` vers `paid_module_content` en JSON valide; vérifier que les 7 modules sont présents.
4. Déployer la fonction Edge avec les secrets du projet. Ne jamais mettre `SUPABASE_SERVICE_ROLE_KEY` dans GitHub ni dans le navigateur.
5. Modifier `js/app.js` pour appeler la fonction et charger les contenus payants seulement après autorisation. Conserver m01 et le quiz global nécessaires au module gratuit.
6. Retirer du fichier public les contenus et quiz propres aux modules m02 à m08. Vérifier que les quiz globaux n'exposent pas de réponses/contenus payants qui doivent rester protégés.
7. Tester un nouvel utilisateur sans accès (doit obtenir 403), puis les trois comptes autorisés (doivent recevoir les 7 modules). Tester inscription, progression, quiz et attestation.
8. Publier seulement après réussite des tests.

## Paiement manuel
Après avoir vérifié la preuve Wave reçue par WhatsApp, l'administrateur ajoute l'UID de l'apprenant dans `public.module_access` via Supabase. Aucun paiement automatique n'est configuré ici.

## Limites de ce lot
Les fichiers préparent le schéma et le contrôle serveur; ils ne déplacent pas encore les contenus et ne déploient rien sur Supabase. Ne pas fusionner dans `main` avant la fin des étapes 3 à 7.
