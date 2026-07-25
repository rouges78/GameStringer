'use client';

/**
 * Registrazione di un .gspack importato come progetto tracciato.
 *
 * PERCHÉ un modulo a sé: l'import di un pack avviene da due punti (il dialog
 * nella scheda gioco e il pulsante "Importa" della pagina Progetti) e la
 * registrazione deve comportarsi in modo identico in entrambi — progetto,
 * avanzamento e file tradotti persistiti.
 */

import { installPack, type GspackManifest, type GspackFile } from '@/lib/gspack-manager';
import { projectService } from '@/lib/services/translation-projects';
import { saveTranslatedFiles } from '@/lib/services/translated-files-store';
import { clientLogger } from '@/lib/client-logger';

/** gameId canonico: `steam_<appid>` quando disponibile (come in libreria). */
export function gameIdFromManifest(m: GspackManifest): string {
  return m.game.appId ? `steam_${m.game.appId}` : m.game.name;
}

/** Cover: il manifest non la trasporta, ma per Steam si ricava dall'appId. */
export function coverFromManifest(m: GspackManifest): string | undefined {
  return m.game.appId
    ? `https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/${m.game.appId}/header.jpg`
    : undefined;
}

/**
 * Installa il pack e lo registra come progetto completato.
 * FAIL-OPEN sulla parte progetto: se la registrazione fallisce il pack resta
 * comunque installato (non deve mai bloccare l'import).
 */
export async function installGspackAsProject(
  manifest: GspackManifest,
  files: GspackFile[],
): Promise<void> {
  installPack(manifest, files.length);

  try {
    const gameId = gameIdFromManifest(manifest);
    const project = await projectService.createOrGetProject({
      gameId,
      gameName: manifest.game.name,
      gameImage: coverFromManifest(manifest),
      engine: manifest.game.engine,
      sourceLanguage: manifest.translation.sourceLanguage,
      targetLanguage: manifest.translation.targetLanguage,
      files: files.map(f => ({ path: f.path, name: f.path, type: f.format, strings: f.stringCount })),
    });
    await projectService.updateProgress(project.id, manifest.translation.translatedStrings);
    // Contenuto tradotto persistito: serve a Pubblica/Applica per allegare o
    // scrivere il file vero, non un manifest di soli metadati.
    await saveTranslatedFiles(
      gameId,
      manifest.translation.targetLanguage,
      files.map(f => ({ path: f.path, originalPath: f.originalPath, content: f.content, format: f.format })),
    );
  } catch (e) {
    clientLogger.warn(`[gspack] registrazione progetto non riuscita: ${String(e)}`);
  }
}
