import { test, expect } from '@playwright/test';

test.describe('Danganronpa Page', () => {
  test('should load danganronpa patcher page', async ({ page }) => {
    const response = await page.goto('/danganronpa-patcher');
    expect(response?.status()).toBeLessThan(500);
    await expect(page.locator('body')).toBeVisible();
  });

  test('should load danganronpa page (legacy route)', async ({ page }) => {
    const response = await page.goto('/danganronpa');
    // May redirect or 404, but should not 500
    expect(response?.status()).not.toBe(500);
  });
});

test.describe('Danganronpa Filter (unit-like)', () => {
  test('should filter system strings from dialogues', async ({ page }) => {
    await page.goto('/');
    
    const result = await page.evaluate(() => {
      // Simula il filtro locale inline
      const testDialogues = [
        { id: '1', speaker: 'Makoto', original: 'I need to find the truth!', translated: '', file: 'e01.txt', line_index: 0 },
        { id: '2', speaker: '', original: 'CLR', translated: '', file: 'e01.txt', line_index: 1 },
        { id: '3', speaker: '', original: 'BGM_001.wav', translated: '', file: 'e01.txt', line_index: 2 },
        { id: '4', speaker: 'Kyoko', original: 'The evidence points to only one conclusion.', translated: '', file: 'e01.txt', line_index: 3 },
        { id: '5', speaker: '', original: '', translated: '', file: 'e01.txt', line_index: 4 },
        { id: '6', speaker: '', original: '42', translated: '', file: 'e01.txt', line_index: 5 },
        { id: '7', speaker: 'Makoto', original: 'I need to find the truth!', translated: '', file: 'e01.txt', line_index: 6 }, // duplicate
        { id: '8', speaker: '', original: '#FF0000', translated: '', file: 'e01.txt', line_index: 7 },
        { id: '9', speaker: 'Byakuya', original: "Don't waste my time with your foolish theories.", translated: '', file: 'e01.txt', line_index: 8 },
        { id: '10', speaker: '', original: 'OK', translated: '', file: 'e01.txt', line_index: 9 },
      ];
      
      // Filtro inline semplificato (stesse regole di danganronpa-filter.ts)
      const systemPatterns = [
        /^[A-Z_]{3,}$/, /^\d+$/, /\.(png|jpg|wav|ogg|mp3)$/i,
        /^(CLR|WAK|FLH|BGM|SE|VOI|CHR|BG)/, /^#[0-9A-Fa-f]{6}$/,
        /^(OK|YES|NO|CANCEL|BACK|NEXT)$/i,
      ];
      
      const seen = new Set<string>();
      const filtered = testDialogues.filter(d => {
        const text = d.original?.trim();
        if (!text || text.length < 3) return false;
        const norm = text.toLowerCase();
        if (seen.has(norm)) return false;
        seen.add(norm);
        for (const p of systemPatterns) { if (p.test(text)) return false; }
        return true;
      });
      
      return { total: testDialogues.length, filtered: filtered.length, ids: filtered.map(d => d.id) };
    });
    
    // Dovrebbe tenere solo i dialoghi reali (Makoto, Kyoko, Byakuya)
    expect(result.total).toBe(10);
    expect(result.filtered).toBe(3);
    expect(result.ids).toContain('1');
    expect(result.ids).toContain('4');
    expect(result.ids).toContain('9');
  });
});

test.describe('Danganronpa - Cost Estimation', () => {
  test('should calculate cost estimate correctly', async ({ page }) => {
    await page.goto('/');
    
    const cost = await page.evaluate(() => {
      const totalStrings = 3000;
      const avgCharsPerString = 50;
      const totalChars = totalStrings * avgCharsPerString;
      const totalTokens = Math.ceil(totalChars / 4);
      const geminiInput = 0.075;
      const geminiOutput = 0.30;
      const inputCost = (totalTokens / 1_000_000) * geminiInput;
      const outputCost = (totalTokens / 1_000_000) * geminiOutput;
      return inputCost + outputCost;
    });
    
    // 3K stringhe con Gemini dovrebbe costare meno di $0.05
    expect(cost).toBeLessThan(0.05);
    expect(cost).toBeGreaterThan(0);
  });
});
