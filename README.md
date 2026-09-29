# Time-Work

Portail interne Getinge — mono-fichier HTML pour la saisie et le suivi des
heures de travail.

## Contenu

- **Heure CEGID** : saisie hebdomadaire des heures, calculateur de sessions,
  calcul de solde cumulé (base 35h30).
- **Suivi Projet** : gestion des affaires, saisies horaires par type
  (DE, ECA, CD, Réunion, Formation, MEP, Loads CD…), budgets par type,
  répartition graphique (camemberts), chronologie hebdomadaire, vue CEGID
  intégrée.

## Utilisation

App en ligne : **https://corentindebritocanica-cloud.github.io/TIME-WORK/**

Connexion avec un compte Google. Les données (affaires, saisies, heures CEGID)
sont stockées dans **Firebase Firestore** (`users/{uid}`) et donc accessibles
depuis n'importe quel poste. Le `localStorage` du navigateur ne sert plus que
de cache ; la pastille en bas à gauche indique l'état de synchronisation.

### Mise en place Firebase (une seule fois)

1. Console Firebase → **Authentication** → Sign-in method → activer **Google**.
2. Authentication → Settings → **Authorized domains** → ajouter
   `corentindebritocanica-cloud.github.io`.
3. **Firestore Database** → créer la base (région `eur3` / Europe), puis
   onglet **Règles** → coller le contenu de [`firestore.rules`](./firestore.rules) → Publier.
4. Renseigner `FIREBASE_CONFIG` dans `index.html` (Paramètres du projet →
   Vos applications → app Web → Config).

## Sauvegarde & restauration

Depuis la page d'accueil, section **⚙ Administrateur** :

- **💾 Sauvegarder** — télécharge un fichier JSON contenant toutes les
  affaires, saisies et heures CEGID.
- **📂 Importer** — restaure une sauvegarde JSON (ou un dump brut du
  `localStorage`) et l'envoie dans Firestore.
- **📊 Historique CSV** — importe un historique au format
  `CLIENT ; DATE ; HEURES ; CODE_AFFAIRE ; TYPE` (séparateur `;` ou `,`,
  dates `dd/mm/yyyy` ou `yyyy-mm-dd`, heures décimales).

> Firestore fait foi. Une sauvegarde JSON de temps en temps reste une bonne
> précaution.

## Git — commit & push

L'auto-push a été désactivé. Deux tâches VS Code sont disponibles
(`Ctrl+Shift+P` → *Tasks: Run Task*) :

- **💾 Commit & Push** — commit horodaté + rebase + push (`auto-push.sh`).
- **📥 Pull (rebase)** — récupère les changements distants.

Le script `auto-push.sh` est aussi utilisable en ligne de commande :
```bash
bash auto-push.sh
```

## Historique des mises à jour

| Date | Type | Détail |
|------|------|--------|
| 2026-09-29 | Migration | Stockage déplacé du `localStorage` vers Firebase Firestore (`users/{uid}`), connexion Google, publication GitHub Pages. |
| 2026-09-29 | Audit | Audit complet design / architecture / code / sécurité / Firestore. Aucun code modifié. 16 problèmes consignés dans [`Problème rencontrés.md`](./Problème%20rencontrés.md) (section « Audit complet »), dont 4 critiques : perte de données au premier login, écrasement multi-poste, XSS stockée, règles Firestore sans liste blanche. |
| 2026-09-29 | Doc | Ajout de [`AUDIT-2026-09-29.md`](./AUDIT-2026-09-29.md) : cahier de correction détaillé (lots 1 à 3, critères de validation, tests, prompt de démarrage pour Claude Code). |

### Plan de correction issu de l'audit (2026-09-29)

1. **Lot 1 — Correctifs critiques** : perte de données au login, XSS (échappement systématique), accordéons tronqués, solde CEGID de la semaine en cours, règles Firestore (liste blanche + validation), contrastes.
2. **Lot 2 — Données** : SDK Firebase modulaire, modèle `users/{uid}/months/{YYYY-MM}` avec écritures par champ, `onSnapshot` temps réel, cache IndexedDB natif, suppression du monkey-patch `localStorage`, script de migration.
3. **Lot 3 — Front** : découpage en modules ES, CSS `@layer` + tokens uniquement, thème clair, PWA (manifest, service worker, Window Controls Overlay), `<dialog>`, raccourcis clavier, saisie rapide.

## Structure

```
index.html        Application complète (HTML + CSS + JS + synchro Firestore)
AUDIT-2026-09-29.md Cahier de correction issu de l'audit
firestore.rules   Règles de sécurité Firestore
auto-push.sh      Script de commit & push manuel
.vscode/tasks.json Tâches VS Code (push, pull)
DTO/              Données locales (ignoré par git)
```
