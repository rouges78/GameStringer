import { test, expect } from '@playwright/test';

test.describe('Danganronpa Integration', () => {
  test('should load danganronpa page', async ({ page }) => {
    await page.goto('/danganronpa');
    await expect(page).toHaveURL(/danganronpa/);
  });

  test('should respond without error', async ({ page }) => {
    const response = await page.goto('/danganronpa');
    expect(response?.status()).toBeLessThan(500);
  });
});
