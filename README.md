# Time-Work

Application **Windows (PWA Edge / Chrome) et iPhone (PWA Safari)** pour le
pointage CEGID, la saisie des heures par affaire et le suivi du temps de travail.
Modules ES natifs, sans dépendance ni étape de build : le dépôt est servi tel quel.

| Appareil | Adresse | Publication |
|---|---|---|
| **PC Windows** | https://corentindebritocanica-cloud.github.io/TIME-WORK/ | GitHub Pages (automatique à chaque push) |
| **iPhone** | https://lisa-cmpt.web.app | Firebase Hosting (workflow `.github/workflows/firebase-hosting.yml`) |

Un seul code, **les mêmes données** (Firestore, temps réel entre PC et iPhone).
L'app ne détecte pas le système : la mise en page suit la largeur d'écran
(≤ 600 px = téléphone) et la connexion suit l'adresse (voir « iPhone » ci-dessous).

## Contenu

Pas de page d'accueil : l'app s'ouvre directement sur le **Tableau de bord**.
Tout est dans une seule barre d'onglets : **Tableau de bord · Par affaire ·
Chronologie · Heures imputées · Pointage CEGID**. Le menu **💾 Données** de
l'en-tête regroupe sauvegarde, restauration et import CSV.

- **Pointage CEGID** (dernier onglet) : saisie hebdomadaire des heures, motifs Férié / Congé,
  calculateur de sessions, solde cumulé (7h06 par jour ouvré, 35h30 / semaine).
- **Suivi Projet** : gestion des affaires, saisies horaires par type
  (DE, ECA, CD, Réunion, Formation, MEP, Loads CD…), budgets par type,
  répartition graphique (camemberts), chronologie hebdomadaire, vue
  « Heures imputées (semaine) » avec l'écart pointé − imputé.
- **Saisie rapide** (`Ctrl+K`) depuis n'importe quel écran : affaire
  (autocomplétion code / client / machine), type, date, durée → `Entrée`.
- **Annuler** pendant 5 s après la suppression d'une saisie, d'une affaire ou
  l'effacement d'une semaine.
- Thème **sombre** unique (le thème clair a été retiré à la demande), police
  Segoe UI Variable, contraste WCAG AA vérifié.

## Utilisation

App en ligne : **https://corentindebritocanica-cloud.github.io/TIME-WORK/** (PC)
et **https://lisa-cmpt.web.app** (iPhone).

Connexion avec un compte Google. Les données sont stockées dans **Firebase
Firestore** et synchronisées **en temps réel** entre postes et onglets. Hors
ligne, les saisies sont enregistrées sur le poste (cache IndexedDB du SDK) puis
envoyées à la reconnexion. La pastille de l'en-tête indique l'état :
*Synchronisé*, *Enregistrement…*, *Hors ligne — enregistré sur ce poste*,
*Erreur de synchronisation*.

### Installer l'application (PWA)

Dans Edge ou Chrome, ouvrir l'URL ci-dessus puis **menu ⋯ → Applications →
Installer TIME-WORK** (ou l'icône d'installation dans la barre d'adresse).
L'app s'ouvre alors dans sa propre fenêtre, épinglable à la barre des tâches,
avec des raccourcis « Pointage CEGID » et « Suivi projet » sur l'icône.
Le mode **Window Controls Overlay** (bouton ⌃ dans la barre de titre) place
l'en-tête de l'app dans la barre de titre Windows. L'application démarre aussi
hors ligne (service worker `sw.js`).

L'ancien raccourci `msedge.exe --app=…` fonctionne toujours.

### iPhone (PWA Safari)

**Installation** : ouvrir **https://lisa-cmpt.web.app** dans **Safari** →
bouton **Partager** → **Sur l'écran d'accueil**. L'app s'ouvre ensuite en plein
écran, comme une app native, et démarre hors ligne.

Sur téléphone (≤ 600 px) : onglets dans une **barre en bas** (sous le pouce),
jours du pointage en liste, zones sûres respectées (Dynamic Island, barre
d'accueil), champs en 16 px (pas de zoom automatique de Safari), dialogues
pleine largeur.

**Pourquoi une seconde adresse ?** Safari bloque le stockage « tiers » : la
connexion Google de Firebase ne fonctionne pas quand la page de connexion
(`lisa-cmpt.firebaseapp.com`) n'est pas sur le même domaine que l'app
(`github.io`). Sur `lisa-cmpt.web.app`, la page de connexion
(`/__/auth/handler`) est servie par le même domaine : `js/firebase.js` y utilise
`authDomain = location.hostname` et `js/cloud.js` la connexion par
**redirection** (fiable en PWA iOS). Sur GitHub Pages rien ne change (popup).

**Réglages faits une seule fois** :
1. Google Cloud → APIs & Services → Identifiants → *Web client (auto created by
   Google Service)* → URI de redirection autorisés :
   `https://lisa-cmpt.web.app/__/auth/handler` (sinon erreur
   `redirect_uri_mismatch`).
2. GitHub → Settings → Secrets and variables → Actions → secret
   `FIREBASE_SERVICE_ACCOUNT_LISA_CMPT` = contenu JSON du compte de service
   Firebase (**en place depuis le 2026-09-29** : chaque push sur `main` republie
   l'adresse iPhone en ~40 s, onglet *Actions* du dépôt). Sans lui, le workflow
   ignore la publication (avertissement). Publication manuelle possible :
   `firebase deploy --only hosting --project lisa-cmpt` (fichiers exclus : voir
   `firebase.json`, dont `.git/**`).

### Raccourci clavier

Un seul raccourci global : **`Ctrl+K`** ouvre la saisie rapide. Tout le reste
se fait à la souris / au Tab (liens de l'en-tête, onglets du Suivi, boutons ❮ ❯
des semaines, champ de recherche).

### Si l'app reste bloquée au démarrage

GitHub Pages met les fichiers en cache 10 min : juste après une mise à jour, le
navigateur peut mélanger ancienne et nouvelle version. Depuis le 2026-09-29 l'app
se répare seule (rechargement forcé des fichiers, une fois). Si un message
« L'application n'a pas pu démarrer » s'affiche malgré tout : **Ctrl+F5**.
Si Firestore ne répond pas au bout de 15 s, un bouton **Recharger** apparaît.

### Modèle de données Firestore

```
users/{uid}
  affaires   : { [id]: { client, num, machine, loads[], budgets{}, productive, unbilled, createdAt } }
  settings   : { dashFilter }
  migratedAt : date de conversion depuis l'ancien format (champ kv supprimé)
users/{uid}/months/{AAAA-MM}
  entries    : { [id]: { affaireId, date, type, minutes, createdAt } }
  days       : { "AAAA-MM-JJ": { h, m, reason: null | "ferie" | "conge" } }
```

- Écritures **ciblées par champ** (`entries.<id>`, `affaires.<id>`, `days.<date>`) :
  deux postes qui saisissent en même temps ne s'écrasent plus.
- Coût : ~1 document lu par mois de données au démarrage (≈ 12 / an), puis
  uniquement les documents modifiés.
- Identifiants : `crypto.randomUUID()` (les anciens identifiants numériques
  sont conservés tels quels, en chaîne).

### Mise en place Firebase (une seule fois)

1. Console Firebase → **Authentication** → Sign-in method → activer **Google**.
2. Authentication → Settings → **Authorized domains** → ajouter
   `corentindebritocanica-cloud.github.io`.
3. **Firestore Database** → créer la base (région `eur3` / Europe), puis
   onglet **Règles** → coller les règles de la section
   [Règles Firestore](#règles-firestore) ci-dessous → Publier.
   **À refaire à chaque modification de ces règles** : rien n'est déployé
   automatiquement.
   Les règles n'autorisent que le compte `corentin.debritocanica@gmail.com`
   (liste blanche dans `isOwner()`) : pour utiliser un autre compte Google,
   l'ajouter à la liste puis republier.
4. Renseigner `FIREBASE_CONFIG` dans `index.html` (Paramètres du projet →
   Vos applications → app Web → Config).
5. *(Recommandé, coût/perf)* Firestore → **Index** → onglet *Exemptions* :
   désactiver l'indexation des champs `affaires`, `settings`, `kv` (collection
   `users`) et `entries`, `days` (collection `months`). Ces champs ne sont jamais
   requêtés.

### Passage au nouveau stockage (lot 2, une seule fois)

1. **Publier les règles Firestore** (étape 3 ci-dessus).
   Sans cela, la conversion est refusée et l'app l'indique ; aucune donnée
   n'est modifiée.
2. Ouvrir l'app (**Ctrl+F5**). Une fenêtre « Mise à jour du stockage »
   s'affiche → *Lancer la mise à jour*.
3. Une sauvegarde `backup_avant_migration_AAAA-MM-JJ.json` est téléchargée,
   puis les données sont converties, **relues depuis le serveur et comparées**
   (nombre d'affaires, de saisies, minutes totales, jours pointés, motifs).
   L'ancien champ `kv` n'est supprimé que si tout concorde.
4. Fermer les fenêtres de l'ancienne version encore ouvertes : après la
   conversion, les règles refusent l'ancien format.

### Tests

- **Fonctions pures** (durées, semaines ISO, solde, CSV, validation,
  échappement) : ouvrir `tests/domain.test.html` via un serveur local
  (42 tests, résultat dans la page et la console).
- **Application complète** : émulateur Firebase ci-dessous.

```bash
firebase emulators:start --only firestore,auth --project demo-lisa   # règles ci-dessous dans firestore.rules (fichier local)
python3 -m http.server 8765                                           # depuis le dossier du repo
# puis ouvrir http://localhost:8765/?emu
```

Le paramètre `?emu` (uniquement sur `localhost`) branche l'app sur les
émulateurs Auth (9099) et Firestore (8080) du projet `demo-lisa` et expose
`__twTestSignIn(email)` pour se connecter sans popup Google.

- **iPhone** : mêmes tests dans **WebKit** (moteur de Safari, Playwright) au
  format iPhone 16 Pro Max (430 × 932, tactile) : navigation par la barre du bas,
  pointage au doigt, Férié, menu Données, saisie rapide, absence de débordement
  horizontal et de champ < 16 px. Le test final (installation + connexion Google)
  se fait sur l'iPhone.

## Sauvegarde & restauration

Depuis le menu **💾 Données** de l'en-tête :

- **💾 Sauvegarder** — télécharge un fichier JSON contenant toutes les
  affaires, saisies et heures CEGID.
- **📂 Importer** — restaure une sauvegarde JSON (ou un dump brut de
  l'ancienne version) : l'état actuel est d'abord téléchargé, puis **toutes**
  les données sont remplacées, sur tous les postes.
- **📊 Historique CSV** — importe un historique au format
  `CLIENT ; DATE ; HEURES ; CODE_AFFAIRE ; TYPE` (séparateur `;` ou `,`,
  dates `dd/mm/yyyy` ou `yyyy-mm-dd`, heures décimales).

> Firestore fait foi. Une sauvegarde JSON de temps en temps reste une bonne
> précaution.

## Règles Firestore

À coller dans la console Firebase → Firestore Database → **Règles** → Publier.

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // Seul le propriétaire, connecté avec un compte Google vérifié
    // et présent dans la liste blanche, accède à ses documents.
    function isOwner(uid) {
      return request.auth != null
        && request.auth.uid == uid
        && request.auth.token.email_verified == true
        && request.auth.token.email in ['corentin.debritocanica@gmail.com'];
    }
    function isMapOrAbsent(data, field) {
      return !(field in data) || data[field] is map;
    }

    // users/{uid} : affaires + réglages (+ ancien champ kv jusqu'à la migration)
    match /users/{uid} {
      allow read: if isOwner(uid);
      allow create, update: if isOwner(uid)
        && request.resource.data.keys().hasOnly(['affaires', 'settings', 'updatedAt', 'migratedAt', 'kv'])
        && isMapOrAbsent(request.resource.data, 'affaires')
        && isMapOrAbsent(request.resource.data, 'settings')
        && isMapOrAbsent(request.resource.data, 'kv')
        // Après migration, l'ancien format est refusé (fenêtre de l'ancienne version restée ouverte).
        && !('migratedAt' in request.resource.data && 'kv' in request.resource.data);

      // users/{uid}/months/{AAAA-MM} : saisies + pointages CEGID du mois
      match /months/{month} {
        allow read: if isOwner(uid);
        allow delete: if isOwner(uid);
        allow create, update: if isOwner(uid)
          && month.matches('^[0-9]{4}-[0-9]{2}$')
          && request.resource.data.keys().hasOnly(['entries', 'days', 'updatedAt'])
          && isMapOrAbsent(request.resource.data, 'entries')
          && isMapOrAbsent(request.resource.data, 'days');
      }
    }

    // Pas de règle globale « /{document=**} » : tout ce qui n'est pas
    // autorisé ci-dessus est refusé par défaut, et d'éventuelles autres
    // applications du projet lisa-cmpt gardent leurs propres règles.
  }
}
```

## Historique des mises à jour

| Date | Type | Détail |
|------|------|--------|
| 2026-09-29 | Migration | Stockage déplacé du `localStorage` vers Firebase Firestore (`users/{uid}`), connexion Google, publication GitHub Pages. |
| 2026-09-29 | Audit | Audit complet design / architecture / code / sécurité / Firestore. Aucun code modifié. 16 problèmes consignés dans [`Problème rencontrés.md`](./Problème%20rencontrés.md) (section « Audit complet »), dont 4 critiques : perte de données au premier login, écrasement multi-poste, XSS stockée, règles Firestore sans liste blanche. |
| 2026-09-29 | Doc | Ajout de [`AUDIT-2026-09-29.md`](./AUDIT-2026-09-29.md) : cahier de correction détaillé (lots 1 à 3, critères de validation, tests, prompt de démarrage pour Claude Code). |
| 2026-09-29 | Correctif A1 | Premier login sur cloud vide : choix explicite (envoyer / sauvegarder puis repartir de zéro / annuler) dans un `<dialog>` natif. « Annuler » et Échap déconnectent sans rien effacer. |
| 2026-09-29 | Correctif A2 | Démarrage : les clés en attente d'envoi gardent leur valeur locale au lieu d'être écrasées par le cloud, puis sont renvoyées automatiquement. |
| 2026-09-29 | Correctif A3 | XSS : échappement de toutes les données utilisateur restantes (machines, Loads, types, aperçu CSV), noms de Load validés, données importées normalisées, plus aucune chaîne utilisateur dans un `onclick`. |
| 2026-09-29 | Correctif A4 | Règles Firestore : accès limité au compte `corentin.debritocanica@gmail.com` (e-mail vérifié), validation du format du document, suppression de la règle globale. **À republier dans la console Firebase.** |
| 2026-09-29 | Correctif A5 | Accordéons (affaires, semaines, jours) : animation `height: 0 → auto`, plus aucune saisie masquée quelle que soit la longueur. |
| 2026-09-29 | Correctif A6 | Solde global CEGID : objectif de 7h06 par jour ouvré échu (ou déjà pointé) au lieu de 35h30 par semaine entamée. Un mardi avec lundi et mardi pointés affiche désormais +0h00. |
| 2026-09-29 | Correctif A7 | Durées : « 2,30 » refusé comme ambigu, aperçu de l'interprétation sous le champ (« = 2h18 »), minutes > 59 et heures > 23 signalées en rouge côté CEGID. |
| 2026-09-29 | Correctif A8 | Import CSV : les lignes identiques à des saisies existantes (date, affaire, type, durée) sont détectées, affichées dans l'aperçu (« Déjà importées ») et ignorées. |
| 2026-09-29 | Correctif A9 | Modification d'une durée existante : si la saisie est invalide, toast d'erreur explicite, champ en rouge et valeur précédente restaurée ; toast de confirmation si la modification est acceptée. |
| 2026-09-29 | Correctif A10 | Vue CEGID : grille fluide 5 colonnes (3 puis 2 en container query), plus de scroll interne ; les 5 jours et le total restent visibles de 1200×800 à 560×500. |
| 2026-09-29 | Correctif A11 | Écrans renommés « Pointage CEGID » (portail) et « Heures imputées (semaine) » (Suivi) ; écart pointé − imputé affiché par jour et sur la semaine ; motif Férié / Congé enregistré (`r_AAAA-MM-JJ`) et affiché sur la carte du jour. |
| 2026-09-29 | Correctif A16 | Contrastes : tous les textes des 7 vues ≥ 4,5:1 (3:1 pour les grands titres), aucun texte < 11 px ; couleurs d'accent et de types éclaircies pour le texte, boutons pleins sur un bleu plus foncé. |
| 2026-09-29 | Lot 2 A13 + A14 | SDK Firebase modulaire 12.19 (ESM, cache IndexedDB multi-onglets), store unique `js/store.js` (mémoire + écritures ciblées + écoute temps réel), amorçage `js/cloud.js`, migration `js/migrate.js` ; suppression des scripts « compat » et du monkey-patch `localStorage` ; mode émulateur `?emu` pour les tests locaux. |
| 2026-09-29 | Lot 2 A2 | Nouveau modèle Firestore `users/{uid}` (affaires, réglages) + `users/{uid}/months/{AAAA-MM}` (saisies, pointages) : écritures ciblées par champ, écoute temps réel, IDs UUID. Deux postes qui saisissent en même temps ne s'écrasent plus. **Règles à republier dans la console.** |
| 2026-09-29 | Lot 2 Migration | Migration : à la première ouverture, conversion de l'ancien format (`kv` ou cache local) après sauvegarde JSON automatique ; relecture serveur et contrôle des totaux ; `kv` supprimé seulement si tout concorde. 5 problèmes rencontrés pendant le lot consignés (B1 à B5). |
| 2026-09-29 | Nettoyage | Suppression des fichiers inutiles du repo : `firestore.rules` (règles désormais dans la section « Règles Firestore » du README), `firestore.indexes.json`, `auto-push.sh`, `.vscode/tasks.json`. Section « Git — commit & push » retirée. |
| 2026-09-29 | Lot 3 A12 + A15 | Application réécrite en modules ES : `index.html` réduit à une coquille sémantique, `js/app.js` (routage `#/…`, vues chargées à la demande), `js/domain/` (fonctions pures testées), `js/ui/` (gabarit `html`` échappé par défaut, dialogues, toasts, camemberts, saisie rapide), `js/views/` (une vue par écran). Plus aucun `onclick` ni `style` inline, aucune variable globale, une seule table des types. Tests unitaires `tests/domain.test.html` (42). |
| 2026-09-29 | Lot 3 A16 | Design system en couches (`@layer`) et tokens, thèmes clair/sombre, Segoe UI Variable, PWA installable (manifeste, service worker hors ligne, Window Controls Overlay), `<dialog>` à la place de ~20 `alert`/`confirm`, toasts avec **Annuler** (5 s), raccourcis clavier + aide `?`, **saisie rapide Ctrl+K**, sémantique et navigation clavier complètes. 6 problèmes rencontrés consignés (C1 à C6). |
| 2026-09-29 | Lot 3 retours | **Blocage sur « Chargement… »** corrigé : chargeur protégé dans `index.html` (en cas d'échec, rechargement forcé de tous les fichiers de l'app une fois, puis message clair « Ctrl+F5 »), service worker qui revalide chaque fichier (`cache: 'no-cache'`, VERSION `lot3b`), bouton **Recharger** si Firestore ne répond pas en 15 s. **Thème clair supprimé** (sombre uniquement, comme avant). **Raccourcis supprimés** (`Alt+H/P/S`, `1`–`4`, `←`/`→`/`T`, `Ctrl+F`, `Ctrl+S`, aide `?`) — seul `Ctrl+K` est conservé. Problèmes C7 à C9 consignés. |
| 2026-09-29 | Navigation | **Page d'accueil supprimée** : l'app s'ouvre sur le Tableau de bord. **Pointage CEGID devient un onglet**, à droite de « Heures imputées » (`#/suivi/pointage`). Liens Accueil / Pointage / Suivi retirés de l'en-tête ; sauvegarde, restauration et import CSV déplacés dans un menu **💾 Données** (Popover API) de l'en-tête. Anciennes adresses `#/` et `#/pointage` redirigées. Raccourcis de l'icône PWA mis à jour. `js/views/home.js` supprimé, logique déplacée dans `js/ui/data.js`. Service worker `lot3c`. |
| 2026-09-29 | iPhone | **App utilisable en PWA sur iPhone** : seconde adresse **https://lisa-cmpt.web.app** (Firebase Hosting, même code, mêmes données) avec connexion Google par redirection sur le même domaine (contourne le blocage du stockage tiers de Safari) ; l'adresse PC ne change pas. Mise en page téléphone (barre d'onglets en bas, pointage en liste, zones sûres, champs 16 px, dialogues pleine largeur), icône iPhone, balises `apple-mobile-web-app-*`. Corrigé : plantage Safari au démarrage (`requestIdleCallback`). Ajout de `firebase.json`, `.firebaserc`, workflow de publication. Tests WebKit iPhone 11/11. Service worker `ios1`. Problèmes D1 à D7 consignés. |

### Plan de correction issu de l'audit (2026-09-29)

1. **Lot 1 — Correctifs critiques** : perte de données au login, XSS (échappement systématique), accordéons tronqués, solde CEGID de la semaine en cours, règles Firestore (liste blanche + validation), contrastes.
2. **Lot 2 — Données** : SDK Firebase modulaire, modèle `users/{uid}/months/{YYYY-MM}` avec écritures par champ, `onSnapshot` temps réel, cache IndexedDB natif, suppression du monkey-patch `localStorage`, script de migration.
3. **Lot 3 — Front** : découpage en modules ES, CSS `@layer` + tokens uniquement, thème sombre, PWA (manifest, service worker, Window Controls Overlay), `<dialog>`, raccourcis clavier, saisie rapide.

## Structure

```
index.html              Coquille : en-tête, <main>, écran de connexion, <dialog>, zone de toasts
css/app.css             Styles en couches (@layer reset, tokens, base, components, views, utilities), thème sombre, mise en page téléphone ≤ 600 px
manifest.webmanifest    Manifeste PWA (Window Controls Overlay, raccourcis)
firebase.json           Firebase Hosting (adresse iPhone) : fichiers publiés, en-têtes de cache
.firebaserc             Projet Firebase par défaut (lisa-cmpt)
.github/workflows/      firebase-hosting.yml : publication automatique sur lisa-cmpt.web.app à chaque push
sw.js                   Service worker : démarrage hors ligne (⚠ incrémenter VERSION et tenir SHELL à jour à chaque livraison)
icons/                  Icônes de l'application (SVG, PNG 192/512, maskable, apple-touch-icon 180 pour iPhone)
js/app.js               Point d'entrée : routage #/suivi/<onglet>, sections chargées à la demande, Ctrl+K, menu Données, rafraîchissement temps réel
js/firebase.js          Initialisation Firebase (SDK modulaire 12.19, cache IndexedDB, mode émulateur, authDomain selon l'adresse)
js/store.js             Store : état en mémoire, écritures ciblées, écoute temps réel, restauration (Annuler)
js/cloud.js             Connexion, migration, démarrage du store, état de synchro
js/migrate.js           Conversion de l'ancien format (kv / cache local) avec contrôle des totaux
js/domain/              Fonctions pures : time (durées, semaines), balance (solde), types (table unique), csv, validate, backup
js/ui/                  dom (gabarit html`` échappé par défaut, délégation), dialog, toast, pie, quick (saisie rapide), data (sauvegarde / restauration / import CSV)
js/views/               suivi (hôte des onglets) + dashboard, affaires, chrono, imputees, pointage, shared
tests/domain.test.html  Tests unitaires des fonctions pures
AUDIT-2026-09-29.md Cahier de correction issu de l'audit
DTO/              Données locales (ignoré par git)
```
