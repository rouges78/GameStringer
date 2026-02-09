import { Page } from '@playwright/test';

/**
 * In Playwright (browser), Tauri non è disponibile.
 * La app mostra "Select your profile" / "Create first profile".
 * Questo helper gestisce la schermata profilo per i test.
 */
export async function waitForAppReady(page: Page, timeout = 15000): Promise<'app' | 'profile-screen'> {
  await page.waitForLoadState('domcontentloaded');
  
  // Aspetta che il body sia visibile
  await page.locator('body').waitFor({ state: 'visible', timeout });
  
  // Controlla se siamo sulla schermata profilo
  const profileScreen = page.locator('text=Select your profile, text=Create first profile, text=Seleziona il tuo profilo').first();
  const isProfileScreen = await profileScreen.isVisible({ timeout: 3000 }).catch(() => false);
  
  if (isProfileScreen) {
    return 'profile-screen';
  }
  
  return 'app';
}

/**
 * Chiude l'overlay di errore Next.js se presente (dev mode).
 */
export async function dismissErrorOverlay(page: Page): Promise<void> {
  try {
    // Next.js dev error overlay ha un pulsante X o si può chiudere con Escape
    const overlay = page.locator('[data-nextjs-dialog-overlay], [data-nextjs-toast]').first();
    if (await overlay.isVisible({ timeout: 1000 }).catch(() => false)) {
      await page.keyboard.press('Escape');
      await page.waitForTimeout(500);
    }
  } catch {
    // Nessun overlay da chiudere
  }
}
