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
- **Mise à jour 2026-09-29** : script supprimé du repo (ainsi que `.vscode/tasks.json`), jugé inutile — problème clos.

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
- **Statut** : corrigé le 2026-09-29
- **Correction appliquée** : Modèle orienté requêtes : un document par mois (saisies + jours pointés), affaires et réglages dans `users/{uid}`. Écritures par champ (`entries.<id>`, `days.<date>`, `affaires.<id>` via `FieldPath`), jamais de réécriture d'un bloc entier. `onSnapshot` sur le document utilisateur et la collection `months` (≈ 12 lectures / an au démarrage, puis seuls les documents modifiés). Identifiants `crypto.randomUUID()`. Règles : liste blanche conservée, `months/{AAAA-MM}` validé (id, champs `entries`/`days`/`updatedAt`), ancien format `kv` refusé une fois `migratedAt` posé. `firestore.indexes.json` : exemptions d'indexation des champs map. Vérifié sur émulateurs : 2 postes (profils séparés) créent 10 saisies simultanées → 10 visibles des deux côtés en 0,74 s ; suppression sur A + modification sur B conservées ; pointage visible sur B en 0,56 s ; focus préservé pendant une saisie ; hors ligne → reconnexion : 3 saisies envoyées en 0,5 s ; règles : ancien format, id de mois invalide, champ inconnu et autre compte refusés.

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
- **Statut** : corrigé le 2026-09-29
- **Correction appliquée** : Réécriture complète du front (2 800 lignes mono-fichier → coquille HTML de 80 lignes + 22 modules). Rendu via le gabarit `html`` qui échappe toute valeur interpolée (`innerHTML` n'existe plus qu'une fois, dans `mount()`, pour ces fragments sûrs). Événements délégués par `data-action`, retirés au démontage de la vue (`AbortController`). Accordéons natifs `<details>` dont le contenu n'est construit qu'à l'ouverture. Types : table unique `js/domain/types.js` (code, libellé, classe de couleur) alignée sur des tokens `--type-<CODE>`. Supprimés : ~10 règles CSS mortes, doublons `SV_COLORS` / `HIST_TYPES_LIST` / tokens divergents, `#view-suivi` en double, `top: 55px` en dur, couleurs en dur. (`auto-push.sh` et `.vscode/tasks.json` avaient déjà été supprimés.) Vérifié : 42 tests unitaires, 43 + 13 vérifications fonctionnelles de bout en bout sur émulateurs Firebase, 0 erreur JS.

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
- **Statut** : corrigé le 2026-09-29
- **Correction appliquée** : Réécriture complète du front (2 800 lignes mono-fichier → coquille HTML de 80 lignes + 22 modules). Rendu via le gabarit `html`` qui échappe toute valeur interpolée (`innerHTML` n'existe plus qu'une fois, dans `mount()`, pour ces fragments sûrs). Événements délégués par `data-action`, retirés au démontage de la vue (`AbortController`). Accordéons natifs `<details>` dont le contenu n'est construit qu'à l'ouverture. Types : table unique `js/domain/types.js` (code, libellé, classe de couleur) alignée sur des tokens `--type-<CODE>`. Supprimés : ~10 règles CSS mortes, doublons `SV_COLORS` / `HIST_TYPES_LIST` / tokens divergents, `#view-suivi` en double, `top: 55px` en dur, couleurs en dur. (`auto-push.sh` et `.vscode/tasks.json` avaient déjà été supprimés.) Vérifié : 42 tests unitaires, 43 + 13 vérifications fonctionnelles de bout en bout sur émulateurs Firebase, 0 erreur JS.

#### A16. Accessibilité et design system
- **Constat** : contrastes mesurés sous WCAG AA — texte `--tx-muted` 4,15:1, client des accordéons 3,38:1, légendes 3,09:1, blanc sur bouton bleu `#3d9eff` 2,79:1 ; textes de 9–10 px ; thème sombre uniquement ; police Inter chargée via `@import` Google Fonts au lieu de Segoe UI Variable ; ~20 `alert()`/`confirm()` natifs ; cartes du Dashboard non focusables ; boutons ✕ sans `aria-label` ; labels non reliés aux champs ; pas de `prefers-reduced-motion` ; aucun raccourci clavier ; pas de manifest PWA.
- **Solution** : Lot 3 du README.
- **Statut** : corrigé le 2026-09-29 (partiel — suite au lot 2)
- **Correction appliquée** : Tokens : `--tx-muted` 0,45 → 0,64 ; nouveau `--blue-strong` (#1a66d0, 5,45:1 sous texte blanc) pour boutons pleins, puce active, onglet actif, total CEGID, pastille du jour ; `--blue` #3d9eff → #6cb8ff, `--red` #ff5252 → #ff8f8f ; 11 couleurs de types + palette des Loads éclaircies (tokens CSS et table `SV_COLORS` alignés). Suppression des atténuations par `opacity` sur du texte (libellés de tuiles, boutons ✕, compteurs) ; ~24 blancs à 0,3–0,55 remplacés par `--tx-muted` ; séparateurs et flèches décoratifs en `aria-hidden`. 47 tailles de 7 à 10 px portées à 11 px. Vérification : script de contraste maison (compose les fonds semi-transparents et teste chaque arrêt de dégradé) : 207 défauts avant → 0 ; axe-core `color-contrast` : 0. Contrôles désactivés exclus (exemptés par WCAG).
- **Statut** : corrigé le 2026-09-29
- **Correction appliquée** : `css/app.css` : couches reset → tokens → base → components → views → utilities, toutes les valeurs en tokens, thème clair complet (couleurs de types recalculées pour 4,5:1 sur fond blanc), `prefers-reduced-motion`, en-tête compatible WCO (`app-region`, `env(titlebar-area-*)`), barres de progression en SVG (aucun style inline). PWA : `manifest.webmanifest`, `sw.js` (réseau d'abord pour l'app, cache d'abord pour le SDK versionné), icônes. UX : dialogues natifs (focus piégé, Échap), erreurs affichées sur les champs, toasts `role=status` avec action Annuler (saisie, affaire, semaine), saisie rapide avec autocomplétion et mémorisation de la dernière affaire, raccourcis (Ctrl+K, Alt+H/P/S, 1–4, ←/→/T, Ctrl+F, Ctrl+S, ?). Accessibilité : landmarks, `<h1>` par vue, onglets liés (`aria-current`), libellés reliés, `aria-label` sur les boutons-icônes, lien d'évitement. Vérifié : contrastes 0 défaut sur 8 écrans × 2 thèmes (script maison) ; axe-core WCAG 2.1 AA + bonnes pratiques : 0 violation ; aucun débordement horizontal sur 6 vues × 3 échelles (100/125/150 %) × 2 thèmes ; service worker : 30/30 fichiers servis hors ligne.

---

## 2026-09-29 — Lot 2 (couche données) : problèmes rencontrés

#### M1. Migration des données existantes
- **Besoin** : passer du document unique `users/{uid}.kv` (ou du cache local de l'ancienne version) au modèle `users/{uid}` + `months/{AAAA-MM}` sans aucun risque de perte.
- **Risques identifiés** : conversion partielle, re-migration écrasant des saisies plus récentes, ancienne fenêtre de l'app réécrivant `kv` après la conversion.
- **Statut** : corrigé le 2026-09-29
- **Correction appliquée** : Voir `js/migrate.js` et `js/cloud.js`. Fenêtre d'accord explicite (« Plus tard » / Échap = déconnexion sans rien modifier), sauvegarde `backup_avant_migration_*.json`, écriture par lots ≤ 400, relecture `getDocFromServer/getDocsFromServer`, comparaison de 6 totaux (affaires, saisies, minutes, jours, minutes pointées, motifs), puis suppression de `kv` + pose de `migratedAt` en une seule écriture. Cache local de l'ancienne version : même conversion via le choix « Envoyer vers le cloud » (A1 conservé). Vérifié sur émulateurs : 40 affaires / 2 000 saisies / 215 jours / 11 motifs convertis en 2,0 s, totaux identiques, pas de 2ᵉ migration au rechargement ; annulation → kv intact ; règles non publiées → migration refusée avec message explicite, kv intact, 0 mois créé.

#### B1. Identifiants devenus des chaînes dans les gestionnaires inline
- **Symptôme** : les nouveaux identifiants UUID cassaient les `onclick="updateEntry(123,…)"` (argument non numérique).
- **Solution** : tous les identifiants sont des chaînes (anciens nombres convertis) ; passage dans les gestionnaires via `jsId()`, qui n'accepte que `[A-Za-z0-9_-]`.
- **Statut** : corrigé le 2026-09-29

#### B2. Pointage tapé au clavier écrasé par un instantané Firestore
- **Cause** : l'écriture d'un jour est différée de 500 ms (une écriture par frappe serait coûteuse) ; un instantané arrivant entre-temps remplaçait la valeur locale en mémoire.
- **Solution** : `applyMonthDoc()` conserve la valeur locale des jours dont l'écriture est encore en attente ; envoi immédiat à la fermeture de la fenêtre (`pagehide`) et à la déconnexion.
- **Statut** : corrigé le 2026-09-29

#### B3. `setDoc(…, { merge: true })` ne supprime pas une clé de map imbriquée
- **Symptôme** : retirer un budget d'une affaire le laissait dans Firestore (fusion profonde).
- **Solution** : les affaires sont écrites avec `update(FieldPath('affaires', id), valeur)`, qui remplace l'affaire entière ; saisies et jours ont une forme canonique complète (champs toujours présents, `reason: null` explicite).
- **Statut** : corrigé le 2026-09-29

#### B4. Clés Firestore réinjectées dans des attributs `id` HTML
- **Risque** : une clé d'affaire contenant `">…` aurait cassé le HTML (XSS).
- **Solution** : le store ignore toute clé qui ne respecte pas `ID_RE` et toute date non ISO (test : clé piégée ignorée, aucun script exécuté).
- **Statut** : corrigé le 2026-09-29

#### B5. Environnement de test (sans impact sur l'app en production)
- **Symptôme** : modules ES refusés en `file://` ; émulateur Firebase en échec au rechargement à chaud des règles (appel local routé vers le proxy réseau).
- **Solution** : tests servis par `python3 -m http.server`, SDK 12.19 mis en cache local, émulateurs relancés (et non rechargés à chaud) à chaque changement de règles, `NO_PROXY=localhost,127.0.0.1`.
- **Statut** : corrigé le 2026-09-29

---

## 2026-09-29 — Lot 3 (front-end) : problèmes rencontrés

#### C1. Couleurs des tuiles écrasées par l'ordre des couches CSS
- **Symptôme** : libellés et valeurs des tuiles en blanc au lieu de la couleur de leur type.
- **Cause** : `.tile { --tc: … }` (couche `components`) l'emportait sur `.t-DE { --tc: … }` (couche `tokens`, déclarée avant).
- **Solution** : plus de valeur par défaut posée sur le composant ; utilisation de `var(--tc, var(--text))`.
- **Statut** : corrigé le 2026-09-29

#### C2. En-tête débordant à 150 % de mise à l'échelle
- **Symptôme** : 38 px de défilement horizontal sur toutes les vues en fenêtre 1200×800 à 150 %.
- **Solution** : en-tête compact sous 900 px (libellés masqués visuellement mais conservés pour les lecteurs d'écran, icônes avec infobulle).
- **Statut** : corrigé le 2026-09-29

#### C3. Bouton de suppression imbriqué dans le `<summary>` d'un accordéon
- **Constat** : axe-core « nested-interactive » (élément interactif dans un élément interactif), et risque de suppression accidentelle.
- **Solution** : « Supprimer l'affaire… » déplacé dans les réglages de l'affaire, avec confirmation puis « Annuler ».
- **Statut** : corrigé le 2026-09-29

#### C4. Vue jamais ouverte indisponible si la connexion tombe
- **Cause** : vues chargées à la demande (`import()` dynamique).
- **Solution** : service worker (cache des fichiers de l'app) + préchargement des vues en tâche de fond une fois l'app prête.
- **Statut** : corrigé le 2026-09-29

#### C5. Attributs booléens vides dans le gabarit `html```
- **Symptôme** : `aria-pressed=""` au lieu de `"false"` (le gabarit rend `false` comme chaîne vide, pour les affichages conditionnels).
- **Solution** : conversion explicite `String(bool)` pour les attributs ARIA.
- **Statut** : corrigé le 2026-09-29

#### C6. Deux navigations portant le même nom sur l'Accueil
- **Constat** : axe-core « landmark-unique » (`<nav>` de l'en-tête et des cartes toutes deux nommées « Applications »).
- **Solution** : nav de l'Accueil renommée « Ouvrir une application ».
- **Statut** : corrigé le 2026-09-29

#### C7. Application bloquée sur « Chargement… » après la mise en ligne du lot 3
- **Symptôme** : écran de chargement figé, aucun message, aucun bouton de connexion.
- **Cause** : GitHub Pages sert les fichiers avec `cache-control: max-age=600`. Le navigateur a pris le **nouveau** `js/app.js` mais gardé l'**ancien** `js/cloud.js` en cache (sans les exports `startCloud` / `logout`). L'édition de liens des modules ES a échoué (`does not provide an export named 'logout'`) : aucune ligne de code ne s'exécute, donc aucun message. Reproduit en local (test `t_stale.py`).
- **Solution** :
  1. `index.html` : démarrage par un chargeur protégé `import('./js/app.js')`. En cas d'échec, rechargement forcé (`fetch(…, {cache:'reload'})`) de tous les fichiers de l'app **une seule fois** (drapeau `sessionStorage`) puis `location.reload()` ; si ça échoue encore, message explicite « L'application n'a pas pu démarrer (…) — Ctrl+F5 ».
  2. `sw.js` : les fichiers de l'app sont revalidés auprès du serveur (`cache: 'no-cache'`) au lieu d'accepter la copie HTTP du navigateur ; VERSION `tw-2026-09-29-lot3b`.
  3. `js/cloud.js` : si Firestore ne répond pas en 15 s, message + bouton **Recharger** au lieu d'un écran figé.
- **Vérifié** : cache périmé une fois → réparation automatique jusqu'à l'écran de connexion ; cache périmé en permanence → message clair.
- **Statut** : corrigé le 2026-09-29

#### C8. Thème clair non souhaité
- **Constat** : retour utilisateur — le thème clair automatique (suivant le réglage Windows) ne convient pas, l'ancien thème sombre était préféré.
- **Solution** : bloc `prefers-color-scheme: light` supprimé de `css/app.css`, `color-scheme: dark` et une seule `theme-color` (`#0b1628`) dans `index.html`. Contrastes revérifiés (0 erreur).
- **Statut** : corrigé le 2026-09-29

#### C9. Raccourcis clavier jugés inutiles
- **Constat** : retour utilisateur — `Alt+H/P/S`, `1`–`4`, `←`/`→`/`T`, `Ctrl+F`, `Ctrl+S` et l'aide `?` ne servent pas (et `←`/`→`, chiffres pouvaient surprendre).
- **Solution** : gestionnaires `onKey` retirés des vues, aide `?` et badges de touches supprimés, attributs `aria-keyshortcuts` retirés. Seul `Ctrl+K` (saisie rapide) est conservé. Tests e2e adaptés (46/46).
- **Statut** : corrigé le 2026-09-29

#### C10. Page d'accueil jugée inutile (choix Pointage / Suivi à chaque ouverture)
- **Constat** : retour utilisateur — le menu d'accueil impose un clic de plus à chaque ouverture.
- **Solution** : page d'accueil supprimée, ouverture directe sur le Tableau de bord ; Pointage CEGID devient le 5ᵉ onglet (après « Heures imputées »). Les fonctions qui vivaient sur l'accueil (sauvegarde JSON, restauration, import CSV) ont été déplacées dans un menu **💾 Données** de l'en-tête pour ne rien perdre. Les anciennes adresses (`#/`, `#/pointage`, raccourcis de l'icône) sont redirigées.
- **Point d'attention** : avec 5 onglets, la barre passait sur deux lignes à 150 % (800 px). Titre « Suivi projet » masqué visuellement (conservé pour les lecteurs d'écran) et marges des onglets réduites sous 820 px : une seule ligne à 100 / 125 / 150 %.
- **Statut** : corrigé le 2026-09-29

---

## 2026-09-29 — Version iPhone (PWA Safari) : problèmes rencontrés

#### D1. Plantage au démarrage dans Safari : `requestIdleCallback` inexistant
- **Symptôme** (test WebKit au format iPhone) : après la connexion, retour à l'écran de connexion avec « Erreur : Can't find variable: requestIdleCallback ».
- **Cause** : le préchargement des vues utilisait `requestIdleCallback`, absent de Safari.
- **Solution** : repli `window.requestIdleCallback ?? (cb => setTimeout(cb, 1500))` dans `js/app.js`.
- **Statut** : corrigé le 2026-09-29

#### D2. Connexion Google impossible dans Safari / PWA iOS depuis GitHub Pages
- **Cause** : Safari bloque le stockage tiers. La connexion Firebase (popup ou redirection) passe par `lisa-cmpt.firebaseapp.com`, un autre domaine que `github.io` : le résultat de connexion n'est pas relu. La popup est en plus peu fiable en PWA iOS (documentation Firebase « Redirect best practices »).
- **Solution** : seconde adresse **https://lisa-cmpt.web.app** (Firebase Hosting) servant le même code. Sur cette adresse, `authDomain = location.hostname` (page `/__/auth/handler` sur le même domaine) et connexion par redirection. L'adresse PC (GitHub Pages) garde la popup, rien ne change sur Windows.
- **Prérequis** : ajouter `https://lisa-cmpt.web.app/__/auth/handler` aux URI de redirection du client OAuth « Web client (auto created by Google Service) » dans Google Cloud. Sans cela, Google répond `Error 400: redirect_uri_mismatch` (constaté lors du premier test).
- **Statut** : corrigé le 2026-09-29 — URI de redirection ajoutée par l'utilisateur ; vérifié : la connexion depuis lisa-cmpt.web.app arrive sur la page Google « to continue to lisa-cmpt.web.app » (plus d'erreur `redirect_uri_mismatch`).

#### D3. Champs en 13 px : Safari zoome à chaque saisie
- **Cause** : la règle « 16 px minimum sur écran tactile » était dans la couche `base`, qui passe **après** la couche `components` (`.control` en 13 px) : elle n'avait aucun effet.
- **Solution** : règle `@media (pointer: coarse)` déplacée dans la couche `utilities`. Vérifié : 0 champ visible < 16 px.
- **Statut** : corrigé le 2026-09-29

#### D4. Pages Chronologie / Heures imputées plus larges que l'écran
- **Cause** : la grille `.suivi` avait une colonne `auto` : la largeur minimale des tableaux et des lignes « Pointé · écart » (`nowrap`) élargissait toute la page.
- **Solution** : `grid-template-columns: minmax(0, 1fr)` sur `.suivi`, retour à la ligne des lignes d'écart sur téléphone, cellules de budget contraintes (`min-width: 0`).
- **Statut** : corrigé le 2026-09-29

#### D5. Débordement de 80 px sur « Par affaire » causé par un texte invisible
- **Cause** : les libellés `.sr-only` (positionnés en absolu) dans les en-têtes de tableau se plaçaient par rapport à la page et non au conteneur défilant `.table-wrap`.
- **Solution** : `.table-wrap { position: relative; }`. Corrige aussi le cas sur PC.
- **Statut** : corrigé le 2026-09-29

#### D6. Premier déploiement Firebase : dossier `.git` publié
- **Constat** : le motif d'exclusion `**/.*` de `firebase.json` exclut les fichiers cachés, **pas le contenu** du dossier `.git` : 240 fichiers de l'historique git ont été publiés sur `lisa-cmpt.web.app` pendant quelques minutes.
- **Impact** : aucun secret (pas d'identifiant dans `.git/config`) ; l'historique est identique à celui du dépôt GitHub, déjà public.
- **Solution** : exclusions explicites `.git/**`, `.github/**`, `**/.*/**` puis republication immédiate (33 fichiers, uniquement l'app). `/.git/config` répond désormais 404. Contrôle de la liste des fichiers publiés via l'API Firebase Hosting.
- **Statut** : corrigé le 2026-09-29

#### D7. Secret GitHub Actions non créable depuis l'environnement de Claude
- **Constat** : le proxy de l'environnement refuse l'API GitHub Actions (« Access to this GitHub Actions path is not permitted through this proxy »).
- **Solution** : le workflow `firebase-hosting.yml` est livré et ignore proprement la publication tant que le secret `FIREBASE_SERVICE_ACCOUNT_LISA_CMPT` n'existe pas ; il est à ajouter une fois dans GitHub (Settings → Secrets and variables → Actions). En attendant, publication manuelle `firebase deploy --only hosting --project lisa-cmpt`.
- **Statut** : résolu le 2026-09-29 — secret ajouté par l'utilisateur ; exécution manuelle du workflow réussie (38 s) et publication automatique au push vérifiée côté Firebase (releases de 13:14 et 13:15).

#### D8. Avertissement GitHub Actions : Node.js 20 obsolète
- **Constat** : annotation « Node.js 20 is deprecated … actions/checkout@v4 » lors de la première exécution du workflow.
- **Solution** : passage à `actions/checkout@v5` (Node.js 24).
- **Statut** : corrigé le 2026-09-29

---

## 2026-09-29 — Refonte UX/UI « Verre » (aspect PORTAIL-DUO) : problèmes rencontrés

Référence : charte UX/UI v2.0 et `verre.css` du dépôt PORTAIL-DUO. Détail du design : [`UX-UI.md`](./UX-UI.md) ;
règles iPhone : [`GUIDE-PWA-IOS.md`](./GUIDE-PWA-IOS.md).

#### E1. Barre d'onglets fixe « prisonnière » de la plaque de verre (anticipé à la lecture, avant tout rendu)
- **Risque** : dans la version iPhone, la barre d'onglets était rendue par `js/views/suivi.js` **dans** `<main>`. Or la plaque de verre = `<main>` avec `backdrop-filter`, et un élément qui porte `backdrop-filter` (comme `filter` / `transform`) devient le **bloc conteneur** de ses descendants en `position: fixed` : la barre se serait collée au bas du **document** (sous tout le contenu), plus au bas de l'écran.
- **Solution** : conteneur `#tabbar` placé **après** `</main>` dans `index.html` ; `suivi.js` y rend la pilule et le bouton « + », et le vide au démontage. Même principe que Course et Budget (« barre hors de `<main>` »).
- **Règle** : aucun élément fixe dans une surface floutée (UX-UI.md, règle 2).
- **Statut** : corrigé le 2026-09-29

#### E2. Contraste AA non tenu avec l'aspect de référence tel quel
- **Symptôme** : mesure au pixel (texte masqué → vrai fond sous chaque texte, halos compris) : **521 textes** sous 4,5:1 (jusqu'à 2,4:1) là où les halos sont les plus lumineux : labels atténués (`--v-dim` 0,64), accent `#5eadff`, badges de type, bouton « Supprimer l'affaire… » en rouge.
- **Cause** : le verre de référence (7 % de blanc) laisse passer les halos à pleine intensité (opacité 0,60). Les apps PORTAIL-DUO affichent surtout du texte blanc assez gros ; TIME-WORK affiche beaucoup de petits textes colorés (tableaux, légendes, badges), et l'audit A16 impose l'AA.
- **Fausses pistes écartées** : baisser l'opacité des halos ou les déplacer (l'aspect n'aurait plus été identique).
- **Solution** : (1) **voile de lisibilité** dans la plaque (`--v-voile: rgba(8,8,10,.42)` par-dessus le verre) → 521 → 19 défauts ; (2) textes atténués éclaircis (`--text-3` 0,72, `--text-2` 0,82), accent en texte `#7cbcff`, `--ok #52e0a6`, `--danger #ffa3a3` ; (3) couleur de catégorie employée en texte = `--tc` + 20 % de blanc (`--tc-text`) ; (4) tuiles « accent » et ligne de total en texte clair ; en-têtes de tableau en `--text-2`. → **0 défaut sur 5 024 textes**, 3 positions des halos, PC et téléphone.
- **Conséquence** : fond de `<html>` (bande iOS) passé de `#171719` (Course) à `#121214` = bas de la plaque avec voile.
- **Statut** : corrigé le 2026-09-29

#### E3. Camembert : disque central opaque sur le verre
- **Cause** : l'ancien camembert dessinait des secteurs pleins puis un disque « trou » de la couleur du fond. Sur une plaque translucide, ce disque ferait une tache sombre qui ne suit pas les halos.
- **Solution** : `js/ui/pie.js` dessine des **secteurs d'anneau** (arc extérieur → arc intérieur), et un anneau complet en `fill-rule: evenodd` pour une seule catégorie. Plus de disque central.
- **Statut** : corrigé le 2026-09-29

#### E4. Pointage : total collé aux jours, badge « Solde global » par-dessus la carte du mercredi
- **Cause** : la ligne de navigation, la grille des jours et le total sont les enfants du panneau d'onglet (`#panel-hebdo`), qui n'avait aucun espacement ; les nouvelles cartes (plus hautes, rayon 22 px) ont rendu le chevauchement visible.
- **Solution** : `.pointage > [role="tabpanel"] { display: grid; gap: 20px; }`.
- **Statut** : corrigé le 2026-09-29

#### E5. Tests : le navigateur headless refuse le certificat du proxy (`ERR_CERT_AUTHORITY_INVALID`)
- **Symptôme** : l'app reste sur « Chargement… » dans Chromium (Playwright) : SDK Firebase (`gstatic.com`) et police (Google Fonts) bloqués, alors que `curl` y accède.
- **Cause** : l'environnement de Claude passe par un proxy à certificat propre, reconnu par `curl` mais pas par le Chromium de Playwright.
- **Solution** (sans jamais désactiver la vérification TLS) : SDK 12.19 et police téléchargés avec `curl` dans un dossier de travail, puis servis au navigateur par `page.route()` (même méthode que B5 : « SDK 12.19 mis en cache local »).
- **Statut** : contourné le 2026-09-29 (sans impact sur l'app en production)

#### E6. Tests : le flou `backdrop-filter` n'apparaît pas sur les captures
- **Symptôme** : sur les captures, le texte qui passe sous la barre d'onglets reste net (seulement assombri).
- **Cause** : rendu logiciel de Chromium headless — confirmé sur une page minimale de 6 lignes : le flou n'est pas appliqué au contenu, quel que soit le code.
- **Règle** : ne pas juger le flou sur une capture headless ; vérifier sur l'iPhone et sur le PC.
- **Statut** : limite de l'outil, documentée (UX-UI.md §4)

#### E7. Tests : la capture « pleine page » fausse le contrôle des champs 16 px
- **Symptôme** : le script de captures comptait 63 champs < 16 px sur téléphone, le test ciblé 0.
- **Cause** : la capture pleine page de Playwright redimensionne temporairement la page et réinitialise l'émulation tactile (`pointer: coarse` devient faux) ; la règle « 16 px en tactile » ne s'applique plus pendant la mesure.
- **Solution** : mesurer les champs dans un contexte sans capture pleine page → **0 champ < 16 px** (`pointer: coarse` vrai).
- **Statut** : limite de l'outil, documentée

#### E8. Tests : `color-mix()` renvoie une couleur au format `color(srgb 0.2 0.9 0.7)`
- **Symptôme** : après le passage des couleurs de catégories en `color-mix()`, le script de contraste annonçait des rapports de 1,5:1.
- **Cause** : `getComputedStyle().color` renvoie alors des composantes entre 0 et 1 (et non 0–255) ; le script les lisait comme du noir.
- **Solution** : analyseur adapté (×255 pour `color(…)`).
- **Statut** : corrigé le 2026-09-29

#### E9. Tests : mode Window Controls Overlay non émulable
- **Constat** : `display-mode: window-controls-overlay` ne peut pas être simulé dans Chromium headless (émulation CDP acceptée mais sans effet).
- **Conséquence** : l'en-tête en barre de titre (fixe, verre dense, titre 14 px) n'a pas pu être vérifié automatiquement.
- **À faire** : vérifier sur la PWA Windows (bouton ⌃ de la barre de titre).
- **Statut** : ouvert (vérification manuelle)

#### E10. Police Unbounded chargée depuis Google Fonts
- **Risque** : hors ligne, titre et chiffres retombaient sur la police système ; l'audit A16 avait retiré l'`@import` Google Fonts (performance).
- **Solution** : `<link rel="preconnect">` + feuille en `display=swap` (le texte s'affiche tout de suite en police système), et le service worker met la feuille et les fichiers de police en **cache d'abord** (réponse « opaque » acceptée pour la feuille). Unbounded reste réservée au titre et aux grands chiffres (charte §12).
- **Statut** : corrigé le 2026-09-29

#### À vérifier sur les appareils (non vérifiable hors iPhone / Windows)
- iPhone : fluidité du défilement avec la plaque floutée et les halos animés (si saccades : couper d'abord l'animation des halos) ; absence de bande en bas ; boutons de la barre hors zone Siri.
- Windows : en-tête en mode Window Controls Overlay (E9).

---

## 2026-09-29 — Onglet Paramètres (types de travail, glisser-déposer, flou, animations, icône) : problèmes rencontrés

#### F1. Glisser-déposer : le geste s'arrêtait après un cran en REMONTANT
- **Symptôme** (test souris) : en tirant un type vers le haut, il ne remontait que d'une ligne puis la ligne « lâchait » ; vers le bas, tout fonctionnait.
- **Cause** : pour remonter, le code déplaçait **la ligne tenue elle-même** dans le DOM (`insertBefore(row, prev)`). Or retirer puis réinsérer l'élément qui a **capturé le pointeur** (`setPointerCapture`) annule la capture : le navigateur envoie `lostpointercapture`, qui terminait le geste. Vers le bas, c'est la voisine qui bougeait, d'où l'asymétrie.
- **Solution** : ne jamais déplacer la ligne tenue ; toujours déplacer la **voisine** (`insertBefore(prev, row.nextSibling)` pour remonter). Vérifié : souris jusqu'en 1ʳᵉ position avec défilement automatique ; doigt (événements tactiles) vers le haut et vers le bas.
- **Leçon** : avec la capture de pointeur, l'élément capturant doit rester dans le document pendant tout le geste.
- **Statut** : corrigé le 2026-09-29

#### F2. Six onglets : libellés coupés sur les iPhone de 375 et 390 pt
- **Symptôme** : « Imputées », « Pointage » et « Paramètres » tronqués (points de suspension) dans la pilule ; correct à 430 pt.
- **Solution** : libellé court **« Réglages »** dans la pilule (comme l'onglet de Budget), le titre de l'en-tête reste « Paramètres » ; sous 400 pt, pilule un peu plus large (marges 10 px), espacement 2 px, texte 10,5 px. Vérifié : aucun libellé coupé à 375, 390 et 430 pt (seul un iPhone SE 1ʳᵉ génération, 320 pt, garde des points de suspension).
- **Statut** : corrigé le 2026-09-29

#### F3. Types stockés en LISTE, pas en map (anticipé)
- **Risque** : `setSettings()` écrit avec `setDoc(…, { merge: true })`, qui **fusionne** les maps imbriquées sans jamais en supprimer une clé (problème B3) : un type supprimé serait resté dans Firestore.
- **Solution** : `settings.types` est un **tableau** ordonné (Firestore remplace un tableau en entier lors d'une fusion) ; il porte aussi l'ordre. Format minimal : `{ code, hidden? }` pour un type intégré, `{ code, label, color, custom: true, hidden? }` pour un type personnalisé. Relecture défensive (`normalizeTypeConfig`) : codes invalides, doublons, préfixe de Load et libellés vides ignorés ; types intégrés absents rajoutés.
- **Limite connue** : deux postes qui réordonnent au même instant → la dernière écriture gagne pour la liste entière (sans perte de saisies).
- **Statut** : corrigé le 2026-09-29

#### F4. Changement venu d'un autre poste pendant un glisser
- **Risque** : l'instantané Firestore déclenche un nouveau rendu de l'écran, qui aurait détruit la ligne tenue en plein geste.
- **Solution** : pendant un glisser, le rendu est **différé** jusqu'au lâcher (`refreshWanted`) ; le lâcher enregistre l'ordre vu à l'écran.
- **Statut** : corrigé le 2026-09-29

#### F5. Flou réglable : éclair au démarrage
- **Risque** : les modules ES s'exécutent après le premier affichage ; appliquer le réglage de flou depuis `js/ui/prefs.js` aurait affiché le flou par défaut une fraction de seconde.
- **Solution** : mini-script dans le `<head>` d'`index.html` qui lit `localStorage['tw-apparence']` et pose `--v-flou` / `data-animations` avant le premier affichage (même formule que `prefs.js`, testée : `flouCSS`). Valeur invalide → valeur par défaut. Vérifié : réglage conservé au rechargement.
- **Statut** : corrigé le 2026-09-29

#### F6. Nouvelle icône : mise en cache par Windows et iOS
- **Constat** : iOS enregistre l'`apple-touch-icon` **au moment de l'ajout** à l'écran d'accueil ; Edge et le service worker gardent les icônes en cache (et Firebase Hosting les sert avec `max-age=86400`).
- **Solution** : **nouveaux noms de fichiers** (`icons/tw-verre-*`), anciens fichiers supprimés, `VERSION` du service worker changée. Sur iPhone : supprimer l'app de l'écran d'accueil puis la rajouter (aucune donnée perdue : tout est dans Firestore). Sur Windows : mise à jour au lancement suivant (ou désinstaller / réinstaller).
- **Fabrication** : SVG écrit à la main (`tw-verre.svg` coins arrondis transparents pour Windows et le favicon ; `tw-verre-plein.svg` plein cadre pour iPhone et « maskable »), converti en PNG par Chromium (Playwright) ; contenu dans la zone sûre des icônes maskable (rayon 162 px < 205 px).
- **Statut** : corrigé le 2026-09-29 (à vérifier sur les appareils)

#### F7. Outils de test : faux positifs et données résiduelles
- **Contraste** : un texte **derrière un dialogue ouvert** (ici « TOTAL » d'un camembert sous la feuille « Saisie rapide ») était mesuré alors qu'il est invisible → le script ne mesure plus que le contenu du dialogue quand il est ouvert. Résultat : 0 défaut sur 4 101 textes (6 onglets).
- **Émulateur Firestore** : il garde les données d'un passage à l'autre (un test « suppression d'un type inutilisé » échouait car un passage précédent l'avait utilisé) → base vidée au début de chaque test (`DELETE /emulator/v1/projects/demo-lisa/databases/(default)/documents`).
- **Statut** : corrigé le 2026-09-29

---

## 2026-09-30 — Thème Neumorphisme : problèmes rencontrés

#### G1. Le flou restait actif en Neumorphisme (anticipé à la lecture)
- **Cause** : le réglage d'intensité du flou est posé en **style en ligne** sur `<html>` (`--v-flou`, par `prefs.js` et le `<head>`) ; un style en ligne l'emporte sur toute règle de la feuille de styles, donc `:root[data-theme="neo"] { --v-flou: none }` n'aurait eu aucun effet.
- **Solution** : en Neumorphisme, `applyPrefs()` et le script du `<head>` posent eux-mêmes `--v-flou: none`. Vérifié : `backdrop-filter` = `none` sur la plaque, la barre et le « + » ; 0 surface floutée.
- **Statut** : corrigé le 2026-09-30

#### G2. Validation du thème enregistré : piège de l'opérateur `in`
- **Risque** : `p.theme in THEMES` est vrai pour `"toString"` ou `"constructor"` (propriétés héritées d'`Object.prototype`) : une valeur corrompue dans `localStorage` aurait posé `data-theme="toString"` (aucun style, page cassée).
- **Solution** : `Object.hasOwn(THEMES, p.theme)` ; sinon thème par défaut (Verre).
- **Statut** : corrigé le 2026-09-30

#### G3. Thèmes Clay / Aurora / Skeuo : contrastes à reprendre, faux positifs de mesure
- **Aurora** : les premiers rideaux d'aurore, centrés en haut de l'écran, passaient **derrière le titre** (« TIME-WORK » à 2,4:1, titre à 3,3:1) et, sous la plaque, faisaient descendre de petits textes à ~4:1. **Solution** : rideaux centrés plus bas (sous l'en-tête), intensité réduite, voile de la plaque porté à `.68` → 0 défaut sur 5 698 textes (3 positions de l'animation).
- **Clay** : textes gris (`--text-2`) sur la carte « Total » bleue à 3,8:1 → texte blanc sur cette carte.
- **Outil de mesure** : deux « défauts » Clay étaient des textes **recouverts** par la barre d'onglets et le bouton « + » sur téléphone (invisibles à cet endroit). Le script ignore désormais un texte dont le centre est couvert par un autre élément (`elementFromPoint`).
- **Statut** : corrigé le 2026-09-30

---

## Lancement en mode application (Edge)

Raccourci Windows utilisé (champ *Cible*) :

```
"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe" --app="https://corentindebritocanica-cloud.github.io/TIME-WORK/" --window-size=1200,800 --window-position=360,140 --user-data-dir="C:\PERSO\TIME WORK CLOUD"
```

Si une ancienne version s'affiche après une mise à jour : **Ctrl+F5**.

Depuis le lot 3, l'app peut aussi être **installée comme PWA** (Edge → ⋯ → Applications → Installer TIME-WORK), voir le README.
