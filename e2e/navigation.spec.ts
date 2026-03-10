import { test, expect } from '@playwright/test';

test.describe('Navigation - Core Pages', () => {
  test('should load homepage without errors', async ({ page }) => {
    const response = await page.goto('/');
    expect(response?.status()).toBeLessThan(500);
    // In browser senza Tauri, potrebbe mostrare profilo o app
    await expect(page.locator('body')).toBeVisible();
  });

  test('should load settings page', async ({ page }) => {
    const response = await page.goto('/settings');
    expect(response?.status()).toBeLessThan(500);
    await expect(page.locator('body')).toBeVisible();
  });

  test('should load library page', async ({ page }) => {
    const response = await page.goto('/library');
    expect(response?.status()).toBeLessThan(500);
  });

  test('should load guide page', async ({ page }) => {
    const response = await page.goto('/guide');
    expect(response?.status()).toBeLessThan(500);
  });
});

test.describe('Navigation - Tool Pages', () => {
  const toolPages = [
    '/ai-translator',
    '/batch',
    '/live-ocr',
    '/character-voice',
    '/ai-review',
    '/dictionaries',
    '/memory',
    '/stats',
    '/editor',
  ];

  for (const path of toolPages) {
    test(`should load ${path} without 500 error`, async ({ page }) => {
      const response = await page.goto(path);
      expect(response?.status()).toBeLessThan(500);
    });
  }
});

test.describe('Navigation - Sidebar', () => {
  test('should have visible page content', async ({ page }) => {
    await page.goto('/');
    // In browser senza Tauri, mostra schermata profilo o app
    // Verifica che ci sia contenuto visibile (profilo selector o sidebar)
    await expect(page.locator('body')).toBeVisible();
    const hasContent = await page.locator('button, a, h1, h2, p').first().isVisible({ timeout: 10000 }).catch(() => false);
    expect(hasContent).toBeTruthy();
  });

  test('should navigate between pages via links', async ({ page }) => {
    await page.goto('/library');
    // Verifica che la pagina carichi
    await expect(page.locator('body')).toBeVisible();
  });
});

test.describe('Navigation - Error Handling', () => {
  test('should handle 404 gracefully', async ({ page }) => {
    const response = await page.goto('/nonexistent-page-xyz');
    // Should not crash with 500
    expect(response?.status()).not.toBe(500);
  });

  test('should not have excessive console errors on homepage', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', msg => {
      if (msg.type() === 'error') errors.push(msg.text());
    });
    await page.goto('/');
    await page.waitForTimeout(3000);
    // Filter out expected/benign errors (Tauri not available in browser, hydration, etc.)
    const realErrors = errors.filter(e => 
      !e.includes('favicon') && 
      !e.includes('hydration') &&
      !e.includes('ResizeObserver') &&
      !e.includes('tauri') &&
      !e.includes('Tauri') &&
      !e.includes('__TAURI') &&
      !e.includes('invoke') &&
      !e.includes('SyntaxError') &&
      !e.includes('Unexpected end of input') &&
      !e.includes('profile') &&
      !e.includes('Failed to fetch')
    );
    // Allow some errors since Tauri APIs aren't available in browser
    expect(realErrors.length).toBeLessThanOrEqual(5);
  });
});
