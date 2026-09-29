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

Ouvrir simplement [`index.html`](./index.html) dans un navigateur récent
(Chrome / Edge / Firefox). Aucune installation, aucun backend : toutes les
données sont stockées localement (`localStorage`).

## Sauvegarde & restauration

Depuis la page d'accueil, section **⚙ Administrateur** :

- **💾 Sauvegarder** — télécharge un fichier JSON contenant toutes les
  affaires et saisies.
- **📂 Importer** — restaure une sauvegarde JSON précédemment exportée.
- **📊 Historique CSV** — importe un historique au format
  `CLIENT ; DATE ; HEURES ; CODE_AFFAIRE ; TYPE` (séparateur `;` ou `,`,
  dates `dd/mm/yyyy` ou `yyyy-mm-dd`, heures décimales).

> ⚠ Les données n'existent que dans le navigateur. Pensez à exporter
> régulièrement.

## Git — commit & push

L'auto-push a été désactivé. Deux tâches VS Code sont disponibles
(`Ctrl+Shift+P` → *Tasks: Run Task*) :

- **💾 Commit & Push** — commit horodaté + rebase + push (`auto-push.sh`).
- **📥 Pull (rebase)** — récupère les changements distants.

Le script `auto-push.sh` est aussi utilisable en ligne de commande :
```bash
bash auto-push.sh
```

## Structure

```
index.html        Application complète (HTML + CSS + JS)
auto-push.sh      Script de commit & push manuel
.vscode/tasks.json Tâches VS Code (push, pull)
DTO/              Données locales (ignoré par git)
```
