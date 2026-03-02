#!/bin/bash
# GameStringer Tauri Build Script (Linux/macOS)
# Builds static export for Tauri production

set -e

PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"

echo "[BUILD] Preparing Tauri Build..."

# Folders to backup (not compatible with static export)
declare -a PATHS=("app/api" "app/games/[id]" "app/translator/[gameId]")
declare -a BACKUPS=("app/_api_backup" "app/games/_id_backup" "app/translator/_gameId_backup")

# 1. Backup incompatible folders
for i in "${!PATHS[@]}"; do
    FULL_PATH="$PROJECT_ROOT/${PATHS[$i]}"
    BACKUP_PATH="$PROJECT_ROOT/${BACKUPS[$i]}"
    if [ -d "$FULL_PATH" ]; then
        echo "[BUILD] Backing up ${PATHS[$i]}..."
        rm -rf "$BACKUP_PATH"
        mv "$FULL_PATH" "$BACKUP_PATH"
    fi
done

# Cleanup function to restore folders
cleanup() {
    for i in "${!PATHS[@]}"; do
        FULL_PATH="$PROJECT_ROOT/${PATHS[$i]}"
        BACKUP_PATH="$PROJECT_ROOT/${BACKUPS[$i]}"
        if [ -d "$BACKUP_PATH" ]; then
            echo "[BUILD] Restoring ${PATHS[$i]}..."
            rm -rf "$FULL_PATH"
            mv "$BACKUP_PATH" "$FULL_PATH"
        fi
    done
    unset TAURI_BUILD
}
trap cleanup EXIT

# 2. Build Next.js with static export
echo "[BUILD] Building Next.js (static export)..."
cd "$PROJECT_ROOT"
export TAURI_BUILD=true
npm run build

echo "[BUILD] Next.js build complete!"
echo "[BUILD] Tauri build preparation complete!"
