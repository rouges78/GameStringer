/**
 * Session-level provider blocking and cooldown system.
 * Tracks blocked providers (permanent errors) and cooldown providers (rate limits).
 * Implements escalating cooldown timers for repeated failures.
 */

import { clientLogger } from '@/lib/client-logger';

// Session-level flags: skip provider dopo errore fatale (permanente) o rate-limit (cooldown)
const blockedProviders = new Set<string>();
const cooldownProviders = new Map<string, number>(); // provider -> timestamp sblocco
const cooldownFailCount = new Map<string, number>(); // provider -> contatore fallimenti consecutivi

export const FREE_PROVIDERS = new Set(['mymemory', 'lingva', 'nllb', 'gemini', 'hymt', 'translategemma', 'ollama', 'lmstudio']);

// Provider che richiedono sourceLanguage corretto (web API con traduzione letterale)
export const LANG_SENSITIVE_PROVIDERS = new Set(['mymemory', 'lingva']);

export function blockProvider(name: string, permanent = true) {
  if (permanent) {
    blockedProviders.add(name);
    clientLogger.warn(`[Session] ${name} bloccato permanentemente (errore fatale)`);
  } else {
    // Cooldown escalation: 5min -> 15min -> 1h dopo fallimenti ripetuti
    const fails = (cooldownFailCount.get(name) || 0) + 1;
    cooldownFailCount.set(name, fails);
    const baseCooldown = FREE_PROVIDERS.has(name) ? 300000 : 30000;
    const escalation = Math.min(fails, 3); // max 3 livelli: 1x, 3x, 12x
    const multiplier = escalation === 1 ? 1 : escalation === 2 ? 3 : 12;
    const cooldownMs = baseCooldown * multiplier;
    const unblockAt = Date.now() + cooldownMs;
    cooldownProviders.set(name, unblockAt);
    clientLogger.warn(`[Session] ${name} in cooldown ${Math.round(cooldownMs / 1000)}s (rate-limit, fail #${fails})`);
  }
}

export function isProviderBlocked(name: string): boolean {
  if (blockedProviders.has(name)) return true;
  const cooldownUntil = cooldownProviders.get(name);
  if (cooldownUntil) {
    if (Date.now() < cooldownUntil) return true;
    cooldownProviders.delete(name); // Cooldown scaduto, riprova
  }
  return false;
}

/** Reset provider blocks (es. quando si cambia API key) */
export function resetProviderBlocks() {
  blockedProviders.clear();
  cooldownProviders.clear();
  cooldownFailCount.clear();
}

/** Direct access to cooldownProviders for advanced cooldown management */
export function setCooldown(name: string, unblockAt: number) {
  cooldownProviders.set(name, unblockAt);
}
