# Time-Work

Portail interne Getinge — mono-fichier HTML pour la saisie et le suivi des
heures de travail.

## Contenu

- **Pointage CEGID** : saisie hebdomadaire des heures, motifs Férié / Congé,
  calculateur de sessions, solde cumulé (7h06 par jour ouvré, 35h30 / semaine).
- **Suivi Projet** : gestion des affaires, saisies horaires par type
  (DE, ECA, CD, Réunion, Formation, MEP, Loads CD…), budgets par type,
  répartition graphique (camemberts), chronologie hebdomadaire, vue
  « Heures imputées (semaine) » avec l'écart pointé − imputé.

## Utilisation

App en ligne : **https://corentindebritocanica-cloud.github.io/TIME-WORK/**

Connexion avec un compte Google. Les données sont stockées dans **Firebase
Firestore** et synchronisées **en temps réel** entre postes et onglets. Hors
ligne, les saisies sont enregistrées sur le poste (cache IndexedDB du SDK) puis
envoyées à la reconnexion. La pastille en bas à gauche indique l'état :
*Synchronisé*, *Enregistrement…*, *Hors ligne — enregistré sur ce poste*,
*Erreur de synchronisation*.

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

### Tests locaux (émulateur Firebase)

```bash
firebase emulators:start --only firestore,auth --project demo-lisa   # règles ci-dessous dans firestore.rules (fichier local)
python3 -m http.server 8765                                           # depuis le dossier du repo
# puis ouvrir http://localhost:8765/?emu
```

Le paramètre `?emu` (uniquement sur `localhost`) branche l'app sur les
émulateurs Auth (9099) et Firestore (8080) du projet `demo-lisa` et expose
`__twTestSignIn(email)` pour se connecter sans popup Google.

## Sauvegarde & restauration

Depuis la page d'accueil, section **⚙ Administrateur** :

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

### Plan de correction issu de l'audit (2026-09-29)

1. **Lot 1 — Correctifs critiques** : perte de données au login, XSS (échappement systématique), accordéons tronqués, solde CEGID de la semaine en cours, règles Firestore (liste blanche + validation), contrastes.
2. **Lot 2 — Données** : SDK Firebase modulaire, modèle `users/{uid}/months/{YYYY-MM}` avec écritures par champ, `onSnapshot` temps réel, cache IndexedDB natif, suppression du monkey-patch `localStorage`, script de migration.
3. **Lot 3 — Front** : découpage en modules ES, CSS `@layer` + tokens uniquement, thème clair, PWA (manifest, service worker, Window Controls Overlay), `<dialog>`, raccourcis clavier, saisie rapide.

## Structure

```
index.html          Application (HTML + CSS + JS des vues)
js/firebase.js      Initialisation Firebase (SDK modulaire 12.19, cache IndexedDB, mode émulateur)
js/store.js         Store : état en mémoire, écritures ciblées, écoute temps réel
js/cloud.js         Connexion, migration, démarrage du store, pastille de synchro
js/migrate.js       Conversion de l'ancien format (kv / cache local) avec contrôle des totaux
AUDIT-2026-09-29.md Cahier de correction issu de l'audit
DTO/              Données locales (ignoré par git)
```
