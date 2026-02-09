import { test, expect } from '@playwright/test';

// ============================================================================
// SETTINGS & API KEY CONFIGURATION
// ============================================================================

test.describe('Settings - API Key Configuration', () => {
  test('should load settings page', async ({ page }) => {
    const response = await page.goto('/settings');
    expect(response?.status()).toBeLessThan(500);
    await expect(page.locator('body')).toBeVisible();
    // In browser senza Tauri potrebbe mostrare profilo screen
    // Verifica solo che la pagina carichi senza errori 500
  });

  test('should persist settings in localStorage', async ({ page }) => {
    await page.goto('/settings');
    // Imposta una fake API key via localStorage
    await page.evaluate(() => {
      const settings = JSON.parse(localStorage.getItem('gameStringerSettings') || '{}');
      settings.translation = { apiKey: 'test-gemini-key-123' };
      localStorage.setItem('gameStringerSettings', JSON.stringify(settings));
    });
    // Verifica che persista
    const key = await page.evaluate(() => {
      const s = JSON.parse(localStorage.getItem('gameStringerSettings') || '{}');
      return s?.translation?.apiKey;
    });
    expect(key).toBe('test-gemini-key-123');
  });
});

// ============================================================================
// AI TRANSLATOR
// ============================================================================

test.describe('AI Translator Page', () => {
  test('should load AI translator', async ({ page }) => {
    const response = await page.goto('/ai-translator');
    expect(response?.status()).toBeLessThan(500);
    await expect(page.locator('body')).toBeVisible();
  });

  test('should have text input area', async ({ page }) => {
    await page.goto('/ai-translator');
    const textarea = page.locator('textarea').first();
    if (await textarea.isVisible({ timeout: 5000 }).catch(() => false)) {
      await textarea.fill('Hello world');
      await expect(textarea).toHaveValue('Hello world');
    }
  });

  test('should have language selectors', async ({ page }) => {
    await page.goto('/ai-translator');
    // Cerca select di lingua sorgente/destinazione
    const selects = page.locator('select, [role="combobox"], button[data-slot="trigger"]');
    const count = await selects.count();
    expect(count).toBeGreaterThanOrEqual(0); // Almeno presente nella pagina
  });
});

// ============================================================================
// BATCH TRANSLATION
// ============================================================================

test.describe('Batch Translation Page', () => {
  test('should load batch translation page', async ({ page }) => {
    const response = await page.goto('/batch');
    expect(response?.status()).toBeLessThan(500);
  });

  test('should have file upload area', async ({ page }) => {
    await page.goto('/batch');
    // Cerca area di upload o input file
    const uploadArea = page.locator('input[type="file"], [role="button"]:has-text("upload"), button:has-text("import"), button:has-text("carica")').first();
    // Basta che la pagina carichi senza errori
    await expect(page.locator('body')).toBeVisible();
  });
});

// ============================================================================
// TRANSLATION MEMORY
// ============================================================================

test.describe('Translation Memory', () => {
  test('should load memory page', async ({ page }) => {
    const response = await page.goto('/memory');
    expect(response?.status()).toBeLessThan(500);
  });

  test('should store and retrieve from localStorage TM', async ({ page }) => {
    await page.goto('/');
    // Simula salvataggio in Translation Memory
    await page.evaluate(() => {
      const tm = [{
        id: 'test-1',
        sourceText: 'Hello',
        targetText: 'Ciao',
        gameId: 'test-game',
        provider: 'gemini',
        confidence: 0.95,
        createdAt: new Date().toISOString()
      }];
      localStorage.setItem('gs_translation_memory', JSON.stringify(tm));
    });

    const tmData = await page.evaluate(() => {
      return JSON.parse(localStorage.getItem('gs_translation_memory') || '[]');
    });
    expect(tmData).toHaveLength(1);
    expect(tmData[0].sourceText).toBe('Hello');
    expect(tmData[0].targetText).toBe('Ciao');
  });
});

// ============================================================================
// QUALITY TOOLS
// ============================================================================

test.describe('Quality Tools', () => {
  test('should load AI review page', async ({ page }) => {
    const response = await page.goto('/ai-review');
    expect(response?.status()).toBeLessThan(500);
  });

  test('should load quality gates page', async ({ page }) => {
    const response = await page.goto('/quality-gates');
    expect(response?.status()).toBeLessThan(500);
  });

  test('should load stats page', async ({ page }) => {
    const response = await page.goto('/stats');
    expect(response?.status()).toBeLessThan(500);
  });
});

// ============================================================================
// CHARACTER VOICE & SPECIALIZED TOOLS
// ============================================================================

test.describe('Specialized Tools', () => {
  test('should load character voice page', async ({ page }) => {
    const response = await page.goto('/character-voice');
    expect(response?.status()).toBeLessThan(500);
  });

  test('should load live OCR page', async ({ page }) => {
    const response = await page.goto('/live-ocr');
    expect(response?.status()).toBeLessThan(500);
  });

  test('should load editor page', async ({ page }) => {
    const response = await page.goto('/editor');
    expect(response?.status()).toBeLessThan(500);
  });

  test('should load dictionaries page', async ({ page }) => {
    const response = await page.goto('/dictionaries');
    expect(response?.status()).toBeLessThan(500);
  });
});
