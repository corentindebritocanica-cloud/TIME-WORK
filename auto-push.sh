#!/bin/bash
# ─────────────────────────────────────────────────────────
#  Commit & push manuel — à exécuter à la demande.
#  Ajoute tous les fichiers suivis (hors DTO/ et *data.json),
#  crée un commit horodaté et pousse sur origin/main.
# ─────────────────────────────────────────────────────────
set -euo pipefail

REPO="/workspaces/Time-Work"
cd "$REPO"

BRANCH="$(git rev-parse --abbrev-ref HEAD)"
TIMESTAMP="$(date '+%Y-%m-%d %H:%M:%S')"

echo "📁 Repo   : $REPO"
echo "🌿 Branch : $BRANCH"
echo "🕒 $TIMESTAMP"
echo ""

# Silence l'advice « ignored path » (DTO/, *data.json…) : ces exclusions sont voulues.
git -c advice.addIgnoredFile=false add -A -- ':!DTO' ':!DTO/**' ':!**/data.json' || true

if git diff --cached --quiet; then
    echo "ℹ  Rien à committer."
    exit 0
fi

FILES="$(git diff --cached --name-only | tr '\n' ' ' | sed 's/ $//')"
git commit -m "manual: update [$TIMESTAMP] — $FILES"

# Sync avec le remote avant de pousser (évite les conflits).
git pull --rebase origin "$BRANCH" || {
    echo "⚠  Rebase impossible — résolvez manuellement puis relancez."
    exit 1
}

git push origin "$BRANCH" && echo "✅ Poussé sur GitHub ($BRANCH)"

