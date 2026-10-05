# Time-Work

Application **Windows (PWA Edge / Chrome) et iPhone (PWA Safari)** pour le
pointage CEGID, la saisie des heures par affaire et le suivi du temps de travail.
Modules ES natifs, sans dépendance ni étape de build : le dépôt est servi tel quel.

> ## ⚠️ RÈGLE ABSOLUE : mettre à jour TOUS les fichiers `.md` après CHAQUE modification
>
> Aucune modification (code, design, correctif, ajout ou retrait de fonction) n'est
> terminée tant que **tous** les fichiers `.md` du dépôt n'ont pas été relus et mis à
> jour **dans le même commit** :
>
> | Fichier | Quoi mettre à jour |
> |---|---|
> | `README.md` | description des fonctions, structure des fichiers, ligne dans « Historique des mises à jour » |
> | `UX-UI.md` | tout changement visuel ou d'interaction, ligne dans « Historique des décisions » |
> | `GUIDE-PWA-IOS.md` | tout ce qui touche l'iPhone / la PWA / le service worker, ligne dans « Historique » |
> | `Problème rencontrés.md` | chaque problème rencontré, sa cause, sa solution et son statut (nouvelle section datée) |
> | `AUDIT-2026-09-29.md` | statut d'un point de l'audit s'il est concerné |
>
> Si un fichier n'est pas concerné, le vérifier quand même. Cette documentation est la
> base de connaissances du projet : un changement non documenté est un changement
> incomplet.

| Appareil | Adresse | Publication |
|---|---|---|
| **PC Windows** | https://corentindebritocanica-cloud.github.io/TIME-WORK/ | GitHub Pages (automatique à chaque push) |
| **iPhone** | https://lisa-cmpt.web.app | Firebase Hosting (workflow `.github/workflows/firebase-hosting.yml`) |

Un seul code, **les mêmes données** (Firestore, temps réel entre PC et iPhone).
L'app ne détecte pas le système : la mise en page suit la largeur d'écran
(≤ 600 px = téléphone) et la connexion suit l'adresse (voir « iPhone » ci-dessous).

## Documentation

| Fichier | Contenu |
|---|---|
| [`UX-UI.md`](./UX-UI.md) | Design « Verre » (aspect identique aux apps PORTAIL-DUO) : règles à ne pas casser, écarts assumés, jetons, composants, méthode de vérification (contraste au pixel), checklist, historique + charte de référence en annexe. **À lire avant toute modification visuelle.** |
| [`GUIDE-PWA-IOS.md`](./GUIDE-PWA-IOS.md) | iPhone / Safari : deux adresses, connexion, installation iOS 26, bande du bas, zones sûres, service worker, tests sans iPhone + guide de référence en annexe. |
| [`Problème rencontrés.md`](./Problème%20rencontrés.md) | Journal de tous les problèmes rencontrés et de leur solution (audit A, lot 2 B, lot 3 C, iPhone D, refonte Verre E, Paramètres F, thèmes G, J-1 et liens H, Loads MEP I). |
| [`AUDIT-2026-09-29.md`](./AUDIT-2026-09-29.md) | Cahier de correction de l'audit (lots 1 à 3, terminés). |

## Contenu

Pas de page d'accueil : l'app s'ouvre directement sur le **Tableau de bord**.
Tout est dans une seule barre d'onglets flottante (en bas de l'écran) : **Tableau ·
Affaires · Imputées · Pointage · Réglages** ; le titre de la section
s'affiche en haut à gauche (« Paramètres » pour Réglages). Passer d'un onglet à
l'autre fait glisser la section depuis le côté de l'onglet choisi. Le bouton rond **Données** de l'en-tête regroupe sauvegarde,
restauration et import CSV ; le bouton rond voisin déconnecte.

- **Temps productif** (Tableau) : part des heures pointées passée sur les affaires
  « temps productif » (hors affaires non facturées), semaine par semaine. Il ne compte
  **jamais l'avenir** : par défaut jusqu'à **hier (J-1)**, pour qu'un pointage rempli à
  l'avance ne fausse pas le pourcentage ; le bouton **J-0** inclut aujourd'hui. Les
  semaines passées sont comptées en entier.

- **Pointage CEGID** : saisie hebdomadaire des heures, motifs Férié / Congé,
  calculateur de sessions, solde cumulé (7h06 par jour ouvré, 35h30 / semaine).
- **Par affaire** : tri de la liste par **code affaire**, **client** ou **machine**
  (ou ordre de création) ; un 2ᵉ clic sur le tri actif inverse l'ordre (A→Z / Z→A).
  Tri naturel (AF-2026-9 avant AF-2026-10), accents et majuscules ignorés, affaires
  sans valeur à la fin. Le choix est enregistré dans Firestore (même tri sur PC et iPhone)
  et se combine avec le champ de recherche.
- **Paramètres** (onglet « Réglages ») :
  - **Types de travail** : ajouter ses propres types (nom + couleur), les
    **réordonner par glisser-déposer** (poignée ⋮⋮, au doigt ou à la souris ;
    flèches ↑ ↓ au clavier), masquer un type (il n'est plus proposé à la saisie,
    ses heures restent comptées), supprimer un type personnalisé inutilisé,
    revenir à l'ordre par défaut. Enregistré **dans Firestore** et synchronisé en
    direct entre PC et iPhone ; l'ordre est utilisé partout (listes, légendes,
    budgets). Les types personnalisés sont reconnus à l'import CSV (par nom ou
    code) et inclus dans la sauvegarde JSON.
  - **Apparence** (propre à chaque appareil) : choix du **thème** parmi 10 —
    **Verre** (halos, verre dépoli, par défaut), **Neumorphisme** (relief doux, actifs
    « enfoncés »), **Claymorphism** (pâte à modeler, formes gonflées, boutons bleus),
    **Aurora** (aurores boréales vertes / cyan / violettes derrière le verre) et
    **Skeuomorphisme** (cuir surpiqué, boutons biseautés, barre en métal), **Phosphore**
    (terminal rétro vert, lignes de balayage, curseur clignotant), **Blueprint** (plan
    d'atelier bleu quadrillé, repères d'angle), **Cyber** (néons roses et cyan de Tokyo),
    **Moleskine** (carnet papier ligné, encre, tampon « VALIDÉ » à 35 h) et **Tableau de
    bord** (métal brossé, vis, afficheurs LCD verts, LED) — ; curseur **Effet de verre** (Verre et Aurora) pour
    réduire ou accentuer le flou (0 à 60 px, 30 px par défaut) et interrupteur
    **Animations entre les onglets**.
- **Suivi Projet** : gestion des affaires, saisies horaires par type
  (DE, ECA, CD, Réunion, Formation, MEP…), budgets par type,
  **Loads** : CD et MEP se découpent par lot dans chaque affaire (« CD Load A »,
  « MEP Load B »…), avec **une liste de Loads par famille** et **un budget par Load**
  (ex. CD Load A = 10 h, MEP Load A = 15 h). Dans l'affaire, une tuile en pointillés
  « Σ Loads CD / MEP » donne le cumul des Loads et de leurs budgets. Au **tableau de
  bord**, chaque Load est **cumulé dans sa famille** (CD ou MEP, mention « dont Loads … ») ;
  les reprises et reviews restent des types à part. Supprimer un Load reclasse ses
  saisies dans CD ou MEP.
  répartition graphique (camemberts), vue
  « Heures imputées (semaine) » avec l'écart pointé − imputé. Dans les Imputées, un
  clic sur le **code affaire** d'une saisie ouvre l'affaire dans l'onglet Affaires,
  amène à **cette saisie** (surlignée) et place le curseur sur son type, pour corriger
  le type ou la durée.
- **Saisie rapide** (bouton rond **« + »** de la barre d'onglets, ou `Ctrl+K`) depuis
  n'importe quel écran : affaire (autocomplétion code / client / machine), type, date,
  durée → `Entrée`.
- **Annuler** pendant 5 s après la suppression d'une saisie, d'une affaire ou
  l'effacement d'une semaine.
- **Design « Verre »**, identique aux apps PORTAIL-DUO (Portail, Muscu, Budget,
  Course) : fond sombre éclairé par deux halos animés (bleu Corentin + violet
  TIME-WORK), une plaque de verre pour le contenu, panneaux et boutons en pilule,
  police **Unbounded** pour le titre et les grands chiffres (police système pour
  le reste : Segoe UI Variable sous Windows, SF sur iPhone), barre d'onglets
  flottante en pilule. Thème sombre unique. Contraste WCAG AA vérifié au pixel,
  halos compris. Détail : [`UX-UI.md`](./UX-UI.md).

## Utilisation

App en ligne : **https://corentindebritocanica-cloud.github.io/TIME-WORK/** (PC)
et **https://lisa-cmpt.web.app** (iPhone).

Connexion avec un compte Google. Les données sont stockées dans **Firebase
Firestore** et synchronisées **en temps réel** entre postes et onglets. Hors
ligne, les saisies sont enregistrées sur le poste (cache IndexedDB du SDK) puis
envoyées à la reconnexion. La **pastille à côté du titre** indique l'état :
**verte** = synchronisé, **or** = enregistrement en cours, **rouge** = hors ligne
(enregistré sur ce poste) ou erreur de synchronisation. Le détail s'affiche au
survol de la pastille.

### Installer l'application (PWA)

Dans Edge ou Chrome, ouvrir l'URL ci-dessus puis **menu ⋯ → Applications →
Installer TIME-WORK** (ou l'icône d'installation dans la barre d'adresse).
L'app s'ouvre alors dans sa propre fenêtre, épinglable à la barre des tâches,
avec des raccourcis « Pointage CEGID », « Tableau de bord » et « Paramètres » sur l'icône (clic droit).
Le mode **Window Controls Overlay** (bouton ⌃ dans la barre de titre) place
l'en-tête de l'app dans la barre de titre Windows. L'application démarre aussi
hors ligne (service worker `sw.js`).

L'ancien raccourci `msedge.exe --app=…` fonctionne toujours.

### iPhone (PWA Safari)

**Installation** : ouvrir **https://lisa-cmpt.web.app** dans **Safari** →
bouton **« ··· »** → **Partager** → **Sur l'écran d'accueil** (iOS 26 et plus ;
laisser **« Ouvrir en tant qu'app Web »** activé, sinon l'icône ouvre un simple
onglet Safari). L'app s'ouvre ensuite en plein écran, comme une app native, et
démarre hors ligne. Pièges et règles iPhone : [`GUIDE-PWA-IOS.md`](./GUIDE-PWA-IOS.md).

Sur téléphone (≤ 600 px) : onglets dans une **pilule flottante en bas** (sous le
pouce) avec le bouton **« + »** juste au-dessus, jours du pointage en liste,
zones sûres respectées (Dynamic Island, barre d'accueil), champs en 16 px (pas
de zoom automatique de Safari), dialogues en **feuille du bas**.

**Nouvelle icône (29/09/2026)** : iOS mémorise l'icône au moment de l'ajout à
l'écran d'accueil. Pour voir la nouvelle : **supprimer l'app de l'écran
d'accueil** (appui long → Supprimer l'app → Supprimer de l'écran d'accueil ; les
données sont dans Firestore, rien n'est perdu) puis la **rajouter** depuis
Safari. Sur Windows, Edge met l'icône à jour au lancement suivant de l'app
(avec parfois une demande de confirmation) ; sinon, la désinstaller puis la
réinstaller.

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

Un seul raccourci global : **`Ctrl+K`** ouvre la saisie rapide (comme le bouton
rond « + »). Tout le reste se fait à la souris / au Tab (boutons de l'en-tête,
onglets, boutons ❮ ❯ des semaines, champ de recherche).

### Si l'app reste bloquée au démarrage

GitHub Pages met les fichiers en cache 10 min : juste après une mise à jour, le
navigateur peut mélanger ancienne et nouvelle version. Depuis le 2026-09-29 l'app
se répare seule (rechargement forcé des fichiers, une fois). Si un message
« L'application n'a pas pu démarrer » s'affiche malgré tout : **Ctrl+F5**.
Si Firestore ne répond pas au bout de 15 s, un bouton **Recharger** apparaît.

### Modèle de données Firestore

```
users/{uid}
  affaires   : { [id]: { client, num, machine, loads[] (Loads CD), mepLoads[] (Loads MEP), budgets{}, productive, unbilled, createdAt } }
  settings   : { dashFilter, affSort: { by: created|num|client|machine, dir: asc|desc }, types: [ { code, hidden? } | { code, label, color, custom: true, hidden? } ] }
  migratedAt : date de conversion depuis l'ancien format (champ kv supprimé)
users/{uid}/months/{AAAA-MM}
  entries    : { [id]: { affaireId, date, type, minutes, createdAt } }   type : code du type, ou CD_LOAD_<Load> / MEP_LOAD_<Load>
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
  (58 tests, résultat dans la page et la console).
- **Application complète** : émulateur Firebase ci-dessous.

```bash
firebase emulators:start --only firestore,auth --project demo-lisa   # règles ci-dessous dans firestore.rules (fichier local)
python3 -m http.server 8765                                           # depuis le dossier du repo
# puis ouvrir http://localhost:8765/?emu
```

Le paramètre `?emu` (uniquement sur `localhost`) branche l'app sur les
émulateurs Auth (9099) et Firestore (8080) du projet `demo-lisa` et expose
`__twTestSignIn(email)` pour se connecter sans popup Google.

- **Interface (design Verre)** : débordement horizontal, champs ≥ 16 px en
  tactile, nombre de surfaces floutées et **contraste mesuré au pixel** (halos
  compris) à 1200×800, 800×533 et 430×932 — méthode et limites du navigateur
  headless dans [`UX-UI.md`](./UX-UI.md) §4.
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
| 2026-09-29 | UX/UI Verre | **Refonte de l'interface, aspect identique aux apps PORTAIL-DUO** (charte UX/UI v2.0, `verre.css`) : fond `#08080a` + deux halos animés calés sur l'horloge (bleu Corentin, violet TIME-WORK), une seule plaque de verre pour le contenu, panneaux sans flou (rayons 22–34 px), boutons / puces / onglets en pilule, Unbounded pour le titre de section et les grands chiffres, en-tête posé sur les halos (titre + pastille de connexion verte / or / rouge, boutons ronds Données et Déconnexion), **barre d'onglets flottante** en pilule avec icônes + **bouton rond « + »** (saisie rapide), dialogues en verre (feuille du bas sur téléphone), toasts en pilule, camemberts en anneau évidé. Contraste AA conservé (voile de lisibilité dans la plaque, textes éclaircis) : **0 défaut sur 5 024 textes mesurés au pixel**. Service worker `verre1` (police mise en cache). Problèmes E1 à E10 consignés. |
| 2026-09-29 | Doc | Ajout de [`UX-UI.md`](./UX-UI.md) (design, règles, méthode, historique + charte de référence) et [`GUIDE-PWA-IOS.md`](./GUIDE-PWA-IOS.md) (iPhone : règles, tests, corrections du guide de référence + guide en annexe). README : section Documentation. |
| 2026-09-29 | Paramètres | **Nouvel onglet Paramètres** (« Réglages » dans la pilule). **Types de travail personnalisés** : ajout (nom + couleur), ordre par **glisser-déposer** (doigt ou souris, défilement automatique) ou clavier, masquage, suppression d'un type inutilisé (avec Annuler), ordre par défaut — enregistré dans Firestore (`settings.types`, règles inchangées), synchronisé en direct, utilisé partout, compris par l'import CSV et la sauvegarde JSON. **Apparence** (par appareil) : curseur d'intensité du flou du verre, interrupteur des animations. **Animations de changement d'onglet** (glissé directionnel 280 ms + fondu du titre). **Nouvelle icône** style Verre (Windows, iPhone, favicon). Vérifié : 35 contrôles fonctionnels (dont glisser au doigt et à la souris, synchro entre 2 appareils), 52 tests unitaires, contraste 0 défaut sur 4 101 textes. Service worker `params1`. Problèmes F1 à F7 consignés. |
| 2026-09-30 | Tri des affaires | Onglet **Par affaire** : puces **Création · Code affaire · Client · Machine** ; 2ᵉ clic = ordre inversé (flèche ↑ / ↓). Tri naturel français (`Intl.Collator`, nombres comparés comme des nombres, accents ignorés), affaires sans valeur toujours à la fin. Choix enregistré dans Firestore (`settings.affSort`), identique sur PC et iPhone. Fonction pure `js/domain/sort.js` (6 tests, 58 au total). Service worker `tri1`. |
| 2026-09-30 | Thème Neumorphisme | **2ᵉ thème au choix** dans Paramètres → Apparence (par appareil) : **Neumorphisme sombre** (matière `#1f232a`, relief par double ombre, actifs et champs enfoncés, pas de halos ni de flou) à côté du **Verre** (par défaut). Cartes de choix avec aperçu, curseur de flou désactivé en Neumorphisme, appliqué avant le premier affichage, `theme-color` adaptée. Couche CSS `theme` qui redirige les jetons du verre. Vérifié : 6 onglets PC + iPhone sans débordement, contraste 0 défaut sur 1 891 textes, bascule / rechargement / retour au Verre. Service worker `neo1`. Problèmes G1–G2. |
| 2026-09-30 | Thèmes Clay / Aurora / Skeuo | **3 thèmes de plus** dans Paramètres → Apparence (5 au total, par appareil) : **Claymorphism** (surfaces violet ardoise « gonflées » par ombres intérieures, coins très arrondis, actifs en pâte bleue), **Aurora** (Verre + rideaux d'aurore animés vert / cyan / violet / rose, voile de lisibilité plus dense) et **Skeuomorphisme** (fond texturé, panneaux de cuir surpiqués, boutons biseautés, champs creusés, barre en métal). Cartes de choix avec aperçu. Contraste mesuré au pixel : **0 défaut** sur chaque thème (Clay 1 829, Skeuo 1 894, Aurora 5 698 textes sur 3 positions des aurores). Service worker `themes1`. Problème G3. |
| 2026-09-30 | 5 thèmes originaux | **Phosphore**, **Blueprint**, **Cyber**, **Moleskine**, **Tableau de bord** (10 thèmes au total, par appareil). Polices propres à chaque thème (VT323 / IBM Plex Mono, Share Tech Mono, Orbitron, Caveat) chargées **seulement** quand le thème est choisi. Moleskine : pages claires, encres AA, tampon « VALIDÉ » quand la semaine atteint 35 h. Contraste mesuré au pixel : **0 défaut** sur chaque thème (~4 400 textes chacun, PC + iPhone). Service worker `themes2`. Problème G4. |
| 2026-10-01 | Temps productif J-1 | Le temps productif de la semaine en cours ne compte plus que les jours **jusqu'à hier** (pointage ET saisies), pour ignorer le pointage rempli à l'avance ; bouton **J-1 / J-0** dans l'encart (J-0 = jusqu'à aujourd'hui, jamais au-delà) et mention « Compté jusqu'au … ». Calcul extrait dans `js/domain/productive.js` (5 tests, 63 au total). Service worker `prodj1`. |
| 2026-10-01 | Imputées → Affaires | Le code affaire de chaque saisie des Imputées est un lien : il ouvre l'affaire dans Affaires, fait défiler jusqu'à la saisie (au centre, surlignée ~2 s), focus sur son type. `openAffaire(id, entryId)` dans `suivi.js`. Service worker `lien1`. |
| 2026-10-01 | Onglet Chrono retiré | Onglet **Chronologie** supprimé (inutilisé) : 5 onglets (Tableau · Affaires · Imputées · Pointage · Réglages). `js/views/chrono.js` et l'icône `#i-calendar` supprimés ; l'ancienne adresse `#/suivi/chrono` ouvre le Tableau de bord. Service worker `sanschrono`. |
| 2026-10-01 | Règle documentation | Encadré **« Règle absolue »** en tête du README : tous les fichiers `.md` (README, UX-UI, GUIDE-PWA-IOS, Problème rencontrés, AUDIT) sont relus et mis à jour dans le même commit après **chaque** modification. Compléments : Problème rencontrés H2–H3, historique du guide iPhone au 01/10. |
| 2026-10-06 | Loads MEP + lisibilité | **Les MEP se découpent en Loads comme les CD** (`MEP_LOAD_A`…), avec une **liste de Loads propre à chaque famille** sur l'affaire (`loads` = CD, nouveau champ `mepLoads` = MEP) et donc des budgets séparés. Règle unique dans `js/domain/types.js` (`LOAD_FAMILIES`) : au tableau de bord, chaque Load est cumulé dans sa famille (CD / MEP) — reprises, reviews et Lancement FAB restent à part. **Plus clair dans l'app** : listes « Type » avec un groupe « CD — par Load » et « MEP — par Load » ; Loads triés juste après leur type de base (tuiles, légendes, budgets) ; tuile « Σ Loads CD / MEP » (cumul + % du budget des Loads) ; réglages de l'affaire avec une ligne de Loads par famille et une phrase d'explication ; création d'affaire avec « Loads CD » et « Loads MEP » ; légende du tableau de bord « CD dont Loads … » ; libellés « CD Load A » partout ; couleurs des Loads MEP décalées de celles des Loads CD ; explication de la règle dans Paramètres → Types de travail. **Données migrées** : affaire DAIICHI (AC 00002655) — saisies `MEP_A` / `MEP_B` → `MEP_LOAD_A` / `MEP_LOAD_B`, budgets renommés, `mepLoads: [A, B]` ; types personnalisés « MEP A » / « MEP B » retirés des Paramètres. 71 tests (9 nouveaux). Service worker `loads-mep`. Problèmes I1 à I4. |

### Plan de correction issu de l'audit (2026-09-29)

1. **Lot 1 — Correctifs critiques** : perte de données au login, XSS (échappement systématique), accordéons tronqués, solde CEGID de la semaine en cours, règles Firestore (liste blanche + validation), contrastes.
2. **Lot 2 — Données** : SDK Firebase modulaire, modèle `users/{uid}/months/{YYYY-MM}` avec écritures par champ, `onSnapshot` temps réel, cache IndexedDB natif, suppression du monkey-patch `localStorage`, script de migration.
3. **Lot 3 — Front** : découpage en modules ES, CSS `@layer` + tokens uniquement, thème sombre, PWA (manifest, service worker, Window Controls Overlay), `<dialog>`, raccourcis clavier, saisie rapide.

## Structure

```
index.html              Coquille : sprite d'icônes, en-tête (titre + pastille), <main> (plaque de verre), #tabbar, écran de connexion, <dialog>, toasts ; calage des halos sur l'horloge
css/app.css             Design « Verre » en couches (@layer reset, tokens, base, components, views, utilities) : jetons, halos, plaque, barre flottante, mise en page téléphone ≤ 600 px, WCO
manifest.webmanifest    Manifeste PWA (Window Controls Overlay, raccourcis)
firebase.json           Firebase Hosting (adresse iPhone) : fichiers publiés, en-têtes de cache
.firebaserc             Projet Firebase par défaut (lisa-cmpt)
.github/workflows/      firebase-hosting.yml : publication automatique sur lisa-cmpt.web.app à chaque push
sw.js                   Service worker : démarrage hors ligne (⚠ incrémenter VERSION et tenir SHELL à jour à chaque livraison)
icons/                  Icônes « Verre » : tw-verre.svg (source, favicon), tw-verre-plein.svg (source plein cadre), PNG 192/512, maskable 512, iPhone 180
js/app.js               Point d'entrée : routage #/suivi/<onglet>, sections chargées à la demande, Ctrl+K, menu Données, rafraîchissement temps réel
js/firebase.js          Initialisation Firebase (SDK modulaire 12.19, cache IndexedDB, mode émulateur, authDomain selon l'adresse)
js/store.js             Store : état en mémoire, écritures ciblées, écoute temps réel, restauration (Annuler)
js/cloud.js             Connexion, migration, démarrage du store, état de synchro
js/migrate.js           Conversion de l'ancien format (kv / cache local) avec contrôle des totaux
js/domain/              Fonctions pures : time (durées, semaines), balance (solde), types (types intégrés + réglages de l'utilisateur + familles de Loads CD / MEP), sort (tri des affaires), productive (temps productif J-1 / J-0), csv, validate, backup
js/ui/                  dom (gabarit html`` échappé par défaut, délégation), dialog, toast, pie, quick (saisie rapide), data (sauvegarde / restauration / import CSV), prefs (flou, animations — par appareil)
js/views/               suivi (hôte des sections + barre d'onglets flottante + animations) + dashboard, affaires, imputees, pointage, parametres, shared
tests/domain.test.html  Tests unitaires des fonctions pures
UX-UI.md                Design « Verre » : règles, jetons, composants, méthode de vérification, historique (+ charte PORTAIL-DUO)
GUIDE-PWA-IOS.md        iPhone / Safari : règles, pièges, tests (+ guide PWA iOS PORTAIL-DUO)
Problème rencontrés.md  Journal des problèmes et de leurs solutions
AUDIT-2026-09-29.md     Cahier de correction issu de l'audit
DTO/              Données locales (ignoré par git)
```
