import { test, expect } from '@playwright/test';

test.describe('Translation Tools', () => {
  test('should access neural translator', async ({ page }) => {
    await page.goto('/neural-translator');
    await expect(page).toHaveURL(/neural-translator/);
  });

  test('should access translation wizard', async ({ page }) => {
    await page.goto('/wizard');
    await expect(page).toHaveURL(/wizard/);
  });

  test('should access settings page', async ({ page }) => {
    await page.goto('/settings');
    await expect(page).toHaveURL(/settings/);
  });
});

test.describe('Page Load', () => {
  test('should respond to dashboard', async ({ page }) => {
    const response = await page.goto('/');
    expect(response?.status()).toBeLessThan(500);
  });

  test('should respond to library', async ({ page }) => {
    const response = await page.goto('/library');
    expect(response?.status()).toBeLessThan(500);
  });
});
