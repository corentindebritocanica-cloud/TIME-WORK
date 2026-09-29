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

## Lancement en mode application (Edge)

Raccourci Windows utilisé (champ *Cible*) :

```
"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe" --app="https://corentindebritocanica-cloud.github.io/TIME-WORK/" --window-size=1200,800 --window-position=360,140 --user-data-dir="C:\PERSO\TIME WORK CLOUD"
```

Si une ancienne version s'affiche après une mise à jour : **Ctrl+F5**.
