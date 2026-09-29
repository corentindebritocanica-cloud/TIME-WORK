# Problèmes rencontrés

Journal des problèmes rencontrés sur Time-Work et de leur résolution.

---

## 2026-09-29 — Migration vers GitHub Pages + Firestore

### 1. Heures CEGID absentes de la sauvegarde JSON
- **Symptôme** : la sauvegarde `backup_getinge_*.json` ne contenait que les
  affaires et les saisies ; les heures CEGID (clés `h_YYYY-MM-DD` / `m_YYYY-MM-DD`)
  n'existaient que dans le `localStorage` du navigateur.
- **Cause** : `exportAdminBackup()` n'exportait que `sp_affaires` et `sp_entries`.
- **Résolution** : l'export inclut désormais les heures CEGID (champ `cegid`).
  Pour la migration, décision de **repartir de zéro** sur les heures CEGID.

### 2. Données locales non partagées entre le HTML du bureau et le site en ligne
- **Symptôme** : les données du fichier `PORTAIL.HTML` ouvert en local
  (`file://`) ne sont pas visibles sur `github.io`.
- **Cause** : le `localStorage` est propre à chaque origine (fichier local ≠ site web).
- **Résolution** : stockage des données dans Firestore (`users/{uid}`),
  le `localStorage` ne sert plus que de cache.

### 3. Connexion Google refusée sur GitHub Pages (« unauthorized domain »)
- **Cause** : le domaine `corentindebritocanica-cloud.github.io` n'était pas
  dans les domaines autorisés de Firebase Authentication.
- **Résolution** : domaine ajouté dans Firebase → Authentication → Settings →
  Authorized domains.

### 4. Règles Firestore
- **Symptôme** : les règles par défaut du projet `lisa-cmpt` bloquaient
  toute lecture/écriture.
- **Résolution** : règles de `firestore.rules` publiées (chaque utilisateur
  n'accède qu'à son propre document).

### 5. Script `auto-push.sh` lié à Codespaces
- **Symptôme** : le script fait `cd /workspaces/Time-Work`, chemin qui
  n'existe qu'en Codespaces ; il échoue ailleurs (ex. VS Code sur Windows).
- **Contournement possible** : remplacer `cd "$REPO"` par `cd "$(dirname "$0")"`.
- **Statut** : non modifié.

### 6. Secrets exposés dans les instructions du projet Claude
- **Constat** : token GitHub et clé privée du compte de service Firebase
  collés en clair dans les instructions du projet.
- **À faire** : révoquer le token GitHub, supprimer la clé du compte de
  service (Google Cloud → IAM → Comptes de service → Clés), et les retirer
  des instructions.

---

## 2026-09-29 — Audit complet (design / architecture / code / Firestore)

Constats vérifiés par lecture du code et rendu headless (Chromium, fenêtre
1200×800 à 100 % et 150 %, jeu de test : 4 affaires, 200 saisies).
Statut de tous les points : **ouvert** (aucun code modifié lors de l'audit).

### Critiques

#### A1. Perte des données locales au premier login si on clique « Annuler »
- **Symptôme** : cloud vide + données locales → la question « Les envoyer vers Firestore ? » ; si on répond *Annuler*, toutes les clés locales sont effacées.
- **Cause** : `onUser()` enchaîne sur l'étape 4 (« le cloud fait foi ») qui supprime les clés locales puis recopie un cloud vide.
- **Solution** : sur refus, ne rien effacer (sortir en mode lecture seule ou reposer la question), ou exporter automatiquement un JSON avant écrasement.
- **Statut** : corrigé le 2026-09-29
- **Correction appliquée** : `confirm()` remplacé par `askChoice()` (`<dialog>` natif, Échap = annuler). « Annuler » → `signOut()` sans toucher au `localStorage` ; « Repartir de zéro » → téléchargement automatique de `backup_local_AAAA-MM-JJ.json` (format accepté par « Importer ») avant effacement. Vérifié en headless : Annuler, Échap, Repartir de zéro, Envoyer.

#### A2. Écrasement des saisies entre deux postes / deux onglets
- **Symptôme** : deux fenêtres ouvertes (bureau + portable, ou 2 onglets) → les saisies de l'une disparaissent.
- **Cause** : toutes les saisies tiennent dans une seule chaîne JSON `kv.sp_entries` réécrite en entier ; aucune écoute temps réel (`onSnapshot`) ; dernière écriture gagnante. Même effet si l'écriture échoue mais la lecture réussit au démarrage (l'étape 4 écrase les modifs en attente).
- **Solution** : modèle par mois avec écritures par champ (`entries.{id}`) + `onSnapshot` (voir Lot 2 du README).
- **Statut** : corrigé le 2026-09-29 (partiel — suite au lot 2)
- **Correction appliquée** : Étape 4 de `onUser()` : les clés présentes dans `pending` ne sont ni supprimées ni remplacées par la valeur cloud ; un `flush()` est replanifié. Vérifié en headless avec une écriture Firestore simulée en échec : la valeur locale survit au rechargement puis part dans le cloud dès que l'écriture réussit. La concurrence entre postes reste à traiter au lot 2.

#### A3. XSS stockée (confirmée)
- **Symptôme** : un nom de machine `<img src=x onerror=…>` exécute du JS à l'ouverture du Dashboard (test headless positif).
- **Cause** : champs insérés dans `innerHTML` sans `esc()` : machine (camembert + légende « Machines »), noms de Load (badges, options, `onclick`), aperçu CSV (client, code, types inconnus, messages d'erreur).
- **Solution** : `esc()` partout à court terme ; à terme rendu via `textContent` / `<template>` et suppression des `onclick` inline.
- **Statut** : corrigé le 2026-09-29
- **Correction appliquée** : `esc()` ajouté sur machine (camembert, légende, « Top »), libellés de type et de Load (`svGetTypeLabel` renvoie désormais du HTML sûr), options de type, aperçu et erreurs de l'import CSV. Noms de Load validés par `/^[A-Z0-9_]{1,10}$/` (création, ajout). Nouvelle fonction `normalizeData()` appliquée au chargement et à l'import JSON : ids numériques, dates ISO, types `[A-Z0-9_]`, durées > 0 ; les éléments invalides sont ignorés et comptés. Suppression de Load et budgets passés en `data-*` + délégation d'événements. Vérifié en headless : charge piégée dans client, code, machine, Load, type, id de saisie et CSV → aucun script exécuté dans les 4 vues ni dans l'aperçu CSV.

#### A4. Règles Firestore sans liste blanche ni validation
- **Constat** : tout compte Google peut se connecter et créer son document `users/{uid}` ; aucune limite de taille ni de format.
- **Solution** : restreindre à ton adresse (`request.auth.token.email == …` et `email_verified`), valider les champs et types. Vérifier aussi que le projet `lisa-cmpt` n'héberge pas d'autre app : la règle `match /{document=**} { allow … if false }` bloquerait ses collections.
- **Statut** : corrigé le 2026-09-29
- **Correction appliquée** : `firestore.rules` réécrit : fonction `isOwner()` (uid + `email_verified` + liste blanche), écriture limitée aux champs `kv` (map) et `updatedAt`, suppression de `match /{document=**}` pour ne pas bloquer d'éventuelles autres apps du projet `lisa-cmpt`. Message d'accès refusé explicite dans l'app (affiche le compte utilisé). README : rappel qu'il faut republier les règles à chaque modification. Reste à faire côté console : coller et publier le fichier, puis tester dans le simulateur de règles.

### Fonctionnels

#### A5. Accordéons tronqués à 4 000 px
- **Symptôme** : une affaire avec 129 saisies mesure 8 977 px mais seuls 4 000 px s'affichent → plus de la moitié des saisies invisibles. Idem semaines (4 000 px) et jours CEGID (2 000 px).
- **Cause** : animation par `max-height` codée en dur.
- **Solution** : `<details>` natif ou `interpolate-size: allow-keywords` + `height: auto`.
- **Statut** : corrigé le 2026-09-29
- **Correction appliquée** : Suppression des `max-height` 4000 / 2000 px (CSS, templates, `svToggleAcc`, `svToggleCegidDay`). `:root { interpolate-size: allow-keywords }` + transition de `height` pilotée uniquement par la classe `.open` ; `visibility: hidden` quand replié pour que le contenu caché ne soit plus atteignable au clavier ; rotation du chevron des jours en CSS. Vérifié en headless : affaire de 210 saisies = 14 107 px de contenu, 14 107 px visibles ; semaines et jours idem ; repliés = 0 px.

#### A6. Solde global CEGID faux en cours de semaine
- **Symptôme** : un mardi avec 2 jours saisis (14h12) → solde « −21h18 ».
- **Cause** : toute semaine contenant au moins une heure compte pour 35h30, y compris la semaine en cours.
- **Solution** : objectif au prorata des jours échus (7h06/jour) ou exclure la semaine en cours du solde.
- **Statut** : corrigé le 2026-09-29
- **Correction appliquée** : Nouvelle fonction pure `computeBalance(days, todayIso)` utilisée par `calculateCegidHebdo()`. Choix assumé en plus du cahier : un jour futur déjà pointé (congé posé à l'avance) compte aussi dans l'objectif, sinon il gonflerait le solde de +7h06 jusqu'à la date. Calculs de dates en UTC (pas de décalage au changement d'heure). Info-bulle d'explication sur le badge. Vérifié : 6 cas (dont les 2 du cahier) OK.

#### A7. Saisie « 2,30 » interprétée comme 2h18
- **Cause** : `parseTime()` traite la virgule comme un décimal. Pas de contrôle des minutes > 59 ni des heures > 24 dans la saisie CEGID.
- **Solution** : n'accepter que `2:30`, `2h30`, `2.5` ; refuser l'ambiguïté avec un message ; bornes sur h/m.
- **Statut** : corrigé le 2026-09-29
- **Correction appliquée** : Nouvelle fonction `parseDuration()` (renvoie `{minutes}` ou `{error}`) : accepte `2:30`, `2h30`, `2h`, `2`, `2.5`, `2,5` ; refuse `2,30`, `0`, minutes > 59, durées > 24 h, avec un message précis. `parseTime()` devient un raccourci. Aperçu en direct sous le champ Durée (`svTimeHint`, `aria-live`) ; message d'erreur exact à l'ajout. CEGID : `cegidFieldValue()` borne h ∈ [0,23] et m ∈ [0,59] ; valeur hors bornes affichée en erreur, non enregistrée et ignorée dans les totaux. Constante inutilisée `CEGID_TARGET_WEEK_MIN` supprimée. Vérifié : 13 cas unitaires OK.

#### A8. Réimport CSV = doublons
- **Solution** : clé de dédoublonnage (date + affaire + type + minutes) et avertissement dans l'aperçu.

#### A9. Modification d'une saisie invalide ignorée sans retour
- **Solution** : bordure d'erreur + message, restauration de la valeur précédente.

#### A10. Vue « Heure CEGID » coupée à 150 %
- **Symptôme** : dans la fenêtre 1200×800 à 150 %, les cartes Lundi et Vendredi sont rognées et le total de la semaine est sous la ligne de flottaison (zone de défilement interne `max-height: calc(100vh - 200px)`).
- **Solution** : grille `repeat(5, minmax(0, 1fr))` + container queries, suppression du scroll interne.

#### A11. Deux écrans « Heure CEGID » aux chiffres différents
- **Constat** : l'un additionne les heures saisies à la main (`h_`/`m_`), l'autre les saisies projet. Les boutons Férié et Congé font exactement la même chose (7h06) sans garder le motif.
- **Solution** : renommer (« Pointage CEGID » vs « Heures imputées »), afficher l'écart entre les deux, stocker le motif d'absence.

### Architecture / code

#### A12. Mono-fichier global
- **Constat** : 2 715 lignes / 177 Ko, 84 fonctions globales, 45 `onclick` inline, 284 `style=""` inline, rendu par concaténation `innerHTML` complète (9 818 nœuds DOM pour 200 saisies, contenu replié compris).
- **Solution** : modules ES (store, rendu par composant, utilitaires purs testés), délégation d'événements.

#### A13. Synchro par monkey-patch de `Storage.prototype.setItem`
- **Constat** : fonctionne mais fragile ; `sp_dash_filter` (simple préférence d'affichage) est synchronisé par erreur via le préfixe `sp_`.
- **Solution** : store explicite + SDK Firestore modulaire avec `persistentLocalCache` (IndexedDB).

#### A14. SDK Firebase « compat » v10
- **Constat** : 3 scripts bloquants non modulaires, contraire au standard du projet (SDK modulaire v9+).
- **Solution** : imports ES depuis `gstatic.com/firebasejs/…/firebase-*.js`, chargés en différé.

#### A15. Doublons et code mort
- **Constat** : types définis 4 fois (tokens `--t-*`, `SV_COLORS`, `SV_TYPES`, `HIST_TYPES_LIST`) avec noms divergents (`CONCEP3D`/`CONCEPTION3D`, `VERIF`/`VERIFICATION`) ; ~10 règles CSS inutilisées (`.file-status`, `.affaire-table`, `.micro-input`, `.btn-pdf`…) ; `#view-suivi` déclaré 2 fois (marges autour de la barre sticky) ; `top: 55px` en dur pour la nav ; libellé de tâche VS Code corrompu (`� Commit & Push`).
- **Solution** : une seule table de types, purge du CSS mort, `position: sticky` sur un conteneur commun.

#### A16. Accessibilité et design system
- **Constat** : contrastes mesurés sous WCAG AA — texte `--tx-muted` 4,15:1, client des accordéons 3,38:1, légendes 3,09:1, blanc sur bouton bleu `#3d9eff` 2,79:1 ; textes de 9–10 px ; thème sombre uniquement ; police Inter chargée via `@import` Google Fonts au lieu de Segoe UI Variable ; ~20 `alert()`/`confirm()` natifs ; cartes du Dashboard non focusables ; boutons ✕ sans `aria-label` ; labels non reliés aux champs ; pas de `prefers-reduced-motion` ; aucun raccourci clavier ; pas de manifest PWA.
- **Solution** : Lot 3 du README.

---

## Lancement en mode application (Edge)

Raccourci Windows utilisé (champ *Cible*) :

```
"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe" --app="https://corentindebritocanica-cloud.github.io/TIME-WORK/" --window-size=1200,800 --window-position=360,140 --user-data-dir="C:\PERSO\TIME WORK CLOUD"
```

Si une ancienne version s'affiche après une mise à jour : **Ctrl+F5**.
