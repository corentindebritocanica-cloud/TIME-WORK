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
- **Ajustement (même jour)** : le jour courant ne compte dans l'objectif que s'il est pointé ; sinon le badge affichait −7h06 toute la journée avant la saisie.

#### A7. Saisie « 2,30 » interprétée comme 2h18
- **Cause** : `parseTime()` traite la virgule comme un décimal. Pas de contrôle des minutes > 59 ni des heures > 24 dans la saisie CEGID.
- **Solution** : n'accepter que `2:30`, `2h30`, `2.5` ; refuser l'ambiguïté avec un message ; bornes sur h/m.
- **Statut** : corrigé le 2026-09-29
- **Correction appliquée** : Nouvelle fonction `parseDuration()` (renvoie `{minutes}` ou `{error}`) : accepte `2:30`, `2h30`, `2h`, `2`, `2.5`, `2,5` ; refuse `2,30`, `0`, minutes > 59, durées > 24 h, avec un message précis. `parseTime()` devient un raccourci. Aperçu en direct sous le champ Durée (`svTimeHint`, `aria-live`) ; message d'erreur exact à l'ajout. CEGID : `cegidFieldValue()` borne h ∈ [0,23] et m ∈ [0,59] ; valeur hors bornes affichée en erreur, non enregistrée et ignorée dans les totaux. Constante inutilisée `CEGID_TARGET_WEEK_MIN` supprimée. Vérifié : 13 cas unitaires OK.

#### A8. Réimport CSV = doublons
- **Solution** : clé de dédoublonnage (date + affaire + type + minutes) et avertissement dans l'aperçu.
- **Statut** : corrigé le 2026-09-29
- **Correction appliquée** : Multi-ensemble des saisies existantes (clé `date|affaireId|type|minutes`) construit dans `_histAnalyzeAndShow()` ; chaque ligne CSV correspondante consomme une occurrence et est ignorée (deux lignes identiques légitimes dans un même fichier restent importées). Nouvelle tuile « Déjà importées » + message quand rien n'est nouveau ; bouton de confirmation désactivé si 0 saisie. Vérifié : même CSV importé 2 fois → 2ᵉ import = 0 ajout, 3 doublons.

#### A9. Modification d'une saisie invalide ignorée sans retour
- **Solution** : bordure d'erreur + message, restauration de la valeur précédente.
- **Statut** : corrigé le 2026-09-29
- **Correction appliquée** : `updateEntry()` utilise `parseDuration()` ; en cas d'erreur : `showToast()` (nouveau composant `#app-toast`, `role=status` + `aria-live`), classe `is-invalid` 2,5 s, ancienne valeur remise dans le champ. Pas d'écriture si la durée est identique. Vérifié : « 2,30 » → 1h30 restauré + message ; « 2h15 » → 135 min + toast de succès.

#### A10. Vue « Heure CEGID » coupée à 150 %
- **Symptôme** : dans la fenêtre 1200×800 à 150 %, les cartes Lundi et Vendredi sont rognées et le total de la semaine est sous la ligne de flottaison (zone de défilement interne `max-height: calc(100vh - 200px)`).
- **Solution** : grille `repeat(5, minmax(0, 1fr))` + container queries, suppression du scroll interne.
- **Statut** : corrigé le 2026-09-29
- **Correction appliquée** : `.days-grid` en `grid repeat(5, minmax(0, 1fr))` + container queries (`.cegid-tab-content` = conteneur) ; cartes sans largeur fixe ; suppression de `max-height: calc(100vh - 200px)` et du scroll interne ; `.total-container` en `width: min(450px, 100%)`, `.calc-wrapper` en `min(680px, 100%)` ; ligne total/bouton en flex-wrap (`.cegid-total-row`). Badge de solde vide masqué (`:empty`). Vérifié à 1200×800, 960×640 (125 %), 800×533 (150 %) et 560×500 : 0 px de débordement, cartes et total entièrement visibles, aucun scroll interne.

#### A11. Deux écrans « Heure CEGID » aux chiffres différents
- **Constat** : l'un additionne les heures saisies à la main (`h_`/`m_`), l'autre les saisies projet. Les boutons Férié et Congé font exactement la même chose (7h06) sans garder le motif.
- **Solution** : renommer (« Pointage CEGID » vs « Heures imputées »), afficher l'écart entre les deux, stocker le motif d'absence.
- **Statut** : corrigé le 2026-09-29
- **Correction appliquée** : Renommage (carte portail, titre de fenêtre, onglet du Suivi). `svRenderCegid()` lit le pointage `h_/m_` et affiche « Pointé … · écart ±… » (vert si 0, or sinon) par jour et sur la tuile Total semaine. Boutons Férié / Congé distincts : `setCegidAutoTime(idx, reason)` pointe 7h06 et stocke `r_AAAA-MM-JJ = ferie | conge` ; second clic retire le motif ; saisie manuelle des heures ou « Effacer cette semaine » le retirent aussi. Préfixe `r_` ajouté à `SYNC_RE` (synchro Firestore), à la sauvegarde JSON et à la restauration (valeurs limitées à `ferie`/`conge`). Valeurs h/m réinjectées dans les champs désormais échappées. Vérifié en headless (motif stocké localement et dans le cloud, retiré après saisie manuelle, écarts corrects).

### Architecture / code

#### A12. Mono-fichier global
- **Constat** : 2 715 lignes / 177 Ko, 84 fonctions globales, 45 `onclick` inline, 284 `style=""` inline, rendu par concaténation `innerHTML` complète (9 818 nœuds DOM pour 200 saisies, contenu replié compris).
- **Solution** : modules ES (store, rendu par composant, utilitaires purs testés), délégation d'événements.

#### A13. Synchro par monkey-patch de `Storage.prototype.setItem`
- **Constat** : fonctionne mais fragile ; `sp_dash_filter` (simple préférence d'affichage) est synchronisé par erreur via le préfixe `sp_`.
- **Solution** : store explicite + SDK Firestore modulaire avec `persistentLocalCache` (IndexedDB).
- **Statut** : corrigé le 2026-09-29
- **Correction appliquée** : Suppression des 3 scripts `firebase-*-compat.js` et du bloc `TWCloud` qui interceptait `Storage.prototype.setItem`. Nouveaux modules : `js/firebase.js` (`initializeFirestore` + `persistentLocalCache` + `persistentMultipleTabManager`), `js/store.js` (source unique : lecture `getAffaires/getEntries/getDay(s)/getSettings`, écriture `createAffaire/updateAffaire/deleteAffaire/addEntry/updateEntry/deleteEntry/removeLoad/setDay/setSettings/bulkAdd/replaceAll`, abonnement aux changements distants, état de synchro), `js/cloud.js` (connexion, choix au premier lancement, migration, pastille). Le script de index.html ne touche plus au `localStorage` pour les données : 25 accès remplacés par le store ; `onDataChanged()` réaffiche les vues ouvertes quand un autre poste/onglet modifie les données, en attendant la fin d'une saisie en cours. Vérifié sur émulateurs Firebase avec le vrai SDK : 2 onglets synchronisés en 0,09 s, déconnexion OK.

#### A14. SDK Firebase « compat » v10
- **Constat** : 3 scripts bloquants non modulaires, contraire au standard du projet (SDK modulaire v9+).
- **Solution** : imports ES depuis `gstatic.com/firebasejs/…/firebase-*.js`, chargés en différé.
- **Statut** : corrigé le 2026-09-29
- **Correction appliquée** : Suppression des 3 scripts `firebase-*-compat.js` et du bloc `TWCloud` qui interceptait `Storage.prototype.setItem`. Nouveaux modules : `js/firebase.js` (`initializeFirestore` + `persistentLocalCache` + `persistentMultipleTabManager`), `js/store.js` (source unique : lecture `getAffaires/getEntries/getDay(s)/getSettings`, écriture `createAffaire/updateAffaire/deleteAffaire/addEntry/updateEntry/deleteEntry/removeLoad/setDay/setSettings/bulkAdd/replaceAll`, abonnement aux changements distants, état de synchro), `js/cloud.js` (connexion, choix au premier lancement, migration, pastille). Le script de index.html ne touche plus au `localStorage` pour les données : 25 accès remplacés par le store ; `onDataChanged()` réaffiche les vues ouvertes quand un autre poste/onglet modifie les données, en attendant la fin d'une saisie en cours. Vérifié sur émulateurs Firebase avec le vrai SDK : 2 onglets synchronisés en 0,09 s, déconnexion OK.

#### A15. Doublons et code mort
- **Constat** : types définis 4 fois (tokens `--t-*`, `SV_COLORS`, `SV_TYPES`, `HIST_TYPES_LIST`) avec noms divergents (`CONCEP3D`/`CONCEPTION3D`, `VERIF`/`VERIFICATION`) ; ~10 règles CSS inutilisées (`.file-status`, `.affaire-table`, `.micro-input`, `.btn-pdf`…) ; `#view-suivi` déclaré 2 fois (marges autour de la barre sticky) ; `top: 55px` en dur pour la nav ; libellé de tâche VS Code corrompu (`� Commit & Push`).
- **Solution** : une seule table de types, purge du CSS mort, `position: sticky` sur un conteneur commun.

#### A16. Accessibilité et design system
- **Constat** : contrastes mesurés sous WCAG AA — texte `--tx-muted` 4,15:1, client des accordéons 3,38:1, légendes 3,09:1, blanc sur bouton bleu `#3d9eff` 2,79:1 ; textes de 9–10 px ; thème sombre uniquement ; police Inter chargée via `@import` Google Fonts au lieu de Segoe UI Variable ; ~20 `alert()`/`confirm()` natifs ; cartes du Dashboard non focusables ; boutons ✕ sans `aria-label` ; labels non reliés aux champs ; pas de `prefers-reduced-motion` ; aucun raccourci clavier ; pas de manifest PWA.
- **Solution** : Lot 3 du README.
- **Statut** : corrigé le 2026-09-29 (partiel — suite au lot 2)
- **Correction appliquée** : Tokens : `--tx-muted` 0,45 → 0,64 ; nouveau `--blue-strong` (#1a66d0, 5,45:1 sous texte blanc) pour boutons pleins, puce active, onglet actif, total CEGID, pastille du jour ; `--blue` #3d9eff → #6cb8ff, `--red` #ff5252 → #ff8f8f ; 11 couleurs de types + palette des Loads éclaircies (tokens CSS et table `SV_COLORS` alignés). Suppression des atténuations par `opacity` sur du texte (libellés de tuiles, boutons ✕, compteurs) ; ~24 blancs à 0,3–0,55 remplacés par `--tx-muted` ; séparateurs et flèches décoratifs en `aria-hidden`. 47 tailles de 7 à 10 px portées à 11 px. Vérification : script de contraste maison (compose les fonds semi-transparents et teste chaque arrêt de dégradé) : 207 défauts avant → 0 ; axe-core `color-contrast` : 0. Contrôles désactivés exclus (exemptés par WCAG).

---

## 2026-09-29 — Lot 2 (couche données) : problèmes rencontrés

#### M1. Migration des données existantes
- **Besoin** : passer du document unique `users/{uid}.kv` (ou du cache local de l'ancienne version) au modèle `users/{uid}` + `months/{AAAA-MM}` sans aucun risque de perte.
- **Risques identifiés** : conversion partielle, re-migration écrasant des saisies plus récentes, ancienne fenêtre de l'app réécrivant `kv` après la conversion.

#### B1. Identifiants devenus des chaînes dans les gestionnaires inline
- **Symptôme** : les nouveaux identifiants UUID cassaient les `onclick="updateEntry(123,…)"` (argument non numérique).
- **Solution** : tous les identifiants sont des chaînes (anciens nombres convertis) ; passage dans les gestionnaires via `jsId()`, qui n'accepte que `[A-Za-z0-9_-]`.

#### B2. Pointage tapé au clavier écrasé par un instantané Firestore
- **Cause** : l'écriture d'un jour est différée de 500 ms (une écriture par frappe serait coûteuse) ; un instantané arrivant entre-temps remplaçait la valeur locale en mémoire.
- **Solution** : `applyMonthDoc()` conserve la valeur locale des jours dont l'écriture est encore en attente ; envoi immédiat à la fermeture de la fenêtre (`pagehide`) et à la déconnexion.

#### B3. `setDoc(…, { merge: true })` ne supprime pas une clé de map imbriquée
- **Symptôme** : retirer un budget d'une affaire le laissait dans Firestore (fusion profonde).
- **Solution** : les affaires sont écrites avec `update(FieldPath('affaires', id), valeur)`, qui remplace l'affaire entière ; saisies et jours ont une forme canonique complète (champs toujours présents, `reason: null` explicite).

#### B4. Clés Firestore réinjectées dans des attributs `id` HTML
- **Risque** : une clé d'affaire contenant `">…` aurait cassé le HTML (XSS).
- **Solution** : le store ignore toute clé qui ne respecte pas `ID_RE` et toute date non ISO (test : clé piégée ignorée, aucun script exécuté).

#### B5. Environnement de test (sans impact sur l'app en production)
- **Symptôme** : modules ES refusés en `file://` ; émulateur Firebase en échec au rechargement à chaud des règles (appel local routé vers le proxy réseau).
- **Solution** : tests servis par `python3 -m http.server`, SDK 12.19 mis en cache local, émulateurs relancés (et non rechargés à chaud) à chaque changement de règles, `NO_PROXY=localhost,127.0.0.1`.

---

## Lancement en mode application (Edge)

Raccourci Windows utilisé (champ *Cible*) :

```
"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe" --app="https://corentindebritocanica-cloud.github.io/TIME-WORK/" --window-size=1200,800 --window-position=360,140 --user-data-dir="C:\PERSO\TIME WORK CLOUD"
```

Si une ancienne version s'affiche après une mise à jour : **Ctrl+F5**.
