# Verrouillage des modules payants — GIE I2DS

## Décision fonctionnelle
- Module m01 gratuit après connexion.
- Modules m02 à m08 accessibles uniquement après validation manuelle du paiement par GIE I2DS.
- Tarif de la formation complète : 20 000 FCFA.
- Les trois comptes déjà validés doivent conserver l'accès complet.
- Ne pas modifier WordPress ni le modèle d'attestation.

## État vérifié du code actuel
- `js/data.js` contient les contenus des huit modules et est publié sur GitHub Pages.
- `renderModules()` affiche tous les modules sans contrôle de paiement.
- `openModule(id)` ouvre le contenu sans contrôle de paiement.
- `progressions` est utilisé pour la progression, pas comme source fiable de validation de paiement.
- Le paiement Wave et le contact WhatsApp sont déjà présents dans `index.html`.

## Pourquoi un simple cadenas ne suffit pas
Tant que les contenus m02 à m08 sont dans `js/data.js`, ils sont téléchargeables par tout visiteur. Le verrouillage visuel seul n'est donc pas une protection réelle.

## Mise en œuvre sûre proposée
1. Créer dans Supabase une table dédiée aux autorisations d'accès, avec RLS activé.
2. Créer une table dédiée aux contenus payants des modules, avec lecture autorisée uniquement pour les utilisateurs disposant d'un accès validé.
3. Déplacer les contenus complets m02 à m08 hors du fichier public `js/data.js` vers cette table protégée. Laisser m01 dans le fichier public.
4. Modifier `js/app.js` pour charger les contenus payants depuis Supabase après vérification de l'accès et afficher un cadenas pour les modules verrouillés.
5. Conserver la validation manuelle par l'administrateur. Après preuve de paiement, l'administrateur inscrit l'utilisateur dans la table des accès autorisés via le tableau de bord Supabase.
6. Tester dans cette branche avec un compte de test non payé, puis vérifier les trois comptes déjà autorisés.
7. Publier seulement après validation explicite.

## Important — aucune modification de production
Ce document est une préparation. Il ne crée aucune table, ne modifie aucune règle Supabase, et ne change pas la version publiée de GitHub Pages. Ne pas fusionner la branche avant d'avoir préparé et testé la migration de contenu.
