import 'server-only';
// Preferiamo usare steam-locate per individuare i giochi installati
import { getInstalledSteamAppsSync } from 'steam-locate';
import fs from 'fs/promises';
import path from 'path';
import * as vdf from 'vdf-parser';
import WinReg from 'winreg';
import { resolve, normalize, relative } from 'path';

/**
 * Interfaccia per rappresentare un gioco installato.
 */
export interface InstalledGame {
  appId: string;
  name: string;
  installDir: string;
  engine?: string;
  supportedLanguages?: string;
  coverUrl?: string;
}

/**
 * SECURITY: Validates file paths to prevent directory traversal attacks
 * @param basePath - The allowed base directory
 * @param targetPath - The requested file path
 * @returns true if the path is safe, false otherwise
 */
function validateFilePath(basePath: string, targetPath: string): boolean {
  try {
    const normalizedBase = normalize(basePath);
    const normalizedTarget = normalize(resolve(basePath, targetPath));
    const relativePath = relative(normalizedBase, normalizedTarget);
    
    // Prevent directory traversal
    return !relativePath.startsWith('..') && 
           !relativePath.includes('..') && 
           normalizedTarget.startsWith(normalizedBase);
  } catch (error) {
    console.warn('[Security] Path validation failed:', error);
    return false;
  }
}

/**
 * SECURITY: Validates that a filename is safe for ACF files
 * @param filename - The filename to validate
 * @returns true if the filename is safe, false otherwise
 */
function validateSteamACFFilename(filename: string): boolean {
  // Only allow appmanifest_*.acf files with numeric app IDs
  const acfPattern = /^appmanifest_\d+\.acf$/;
  return acfPattern.test(filename) && 
         filename.length < 50 && // Reasonable length limit
         !filename.includes('..') && 
         !filename.includes('/') && 
         !filename.includes('\\');
}

/**
 * SECURITY: Sanitizes install directory names from Steam data
 * @param installDir - The install directory name from Steam
 * @returns sanitized directory name or null if invalid
 */
function sanitizeInstallDir(installDir: string): string | null {
  if (!installDir || installDir.length > 100) {
    return null;
  }
  
  // Block obvious traversal attempts early
  if (installDir.includes('..') || installDir.includes('\\\\') || installDir.includes('//')) {
    return null;
  }
  
  // Remove dangerous characters and normalize
  const sanitized = installDir
    .replace(/[<>:"|?*\\\/]/g, '')  // Remove Windows invalid chars and path separators
    .replace(/\.\./g, '')           // Remove traversal attempts
    .replace(/^\.+/, '')            // Remove leading dots
    .replace(/\s+/g, ' ')           // Normalize whitespace
    .trim();
  
  // Check if still valid after sanitization
  if (sanitized.length === 0 || sanitized.includes('..') || sanitized.startsWith('.')) {
    return null;
  }
  
  return sanitized;
}

/**
 * SECURITY: Validates Steam App ID format and range
 * @param appId - The Steam App ID to validate
 * @returns true if valid, false otherwise
 */
function validateSteamAppId(appId: string): boolean {
  // Steam App IDs are positive integers up to 10 digits
  const appIdPattern = /^[1-9]\d{0,9}$/;
  
  if (!appIdPattern.test(appId)) {
    return false;
  }
  
  const numericAppId = parseInt(appId, 10);
  
  // Steam App IDs range from 1 to approximately 2,000,000+ (as of 2024)
  // We'll use a reasonable upper bound to prevent abuse
  return numericAppId >= 1 && numericAppId <= 9999999999;
}

/**
 * SECURITY: Validates Steam ID64 format
 * @param steamId - The Steam ID64 to validate
 * @returns true if valid, false otherwise
 */
function validateSteamId64(steamId: string): boolean {
  // Steam ID64 format: 17 digits, starts with 76561198
  const steamIdPattern = /^76561198\d{9}$/;
  
  if (!steamIdPattern.test(steamId)) {
    return false;
  }
  
  // Additional validation: check if it's a valid Steam ID64
  const numericSteamId = BigInt(steamId);
  const minSteamId = BigInt('76561198000000000');
  const maxSteamId = BigInt('76561198999999999');
  
  return numericSteamId >= minSteamId && numericSteamId <= maxSteamId;
}

/**
 * SECURITY: Sanitizes general string input to prevent injection
 * @param input - The input string to sanitize
 * @param maxLength - Maximum allowed length (default: 100)
 * @returns sanitized string or null if invalid
 */
function sanitizeStringInput(input: string, maxLength: number = 100): string | null {
  if (!input || typeof input !== 'string') {
    return null;
  }
  
  if (input.length > maxLength) {
    return null;
  }
  
  // Remove potentially dangerous characters
  const sanitized = input
    .replace(/[<>'"&]/g, '')      // Remove HTML/script injection chars
    .replace(/[{}[\]]/g, '')      // Remove object notation chars
    .replace(/[`$\\]/g, '')       // Remove template literal and escape chars
    .replace(/\r\n|\r|\n/g, ' ')  // Replace newlines with spaces
    .replace(/\s+/g, ' ')         // Normalize whitespace
    .trim();
  
  if (sanitized.length === 0) {
    return null;
  }
  
  return sanitized;
}

/**
 * SECURITY: Rate limiting implementation for Steam API calls
 * Prevents API abuse and maintains compliance with Steam API terms
 */
class SteamApiRateLimiter {
  private static instance: SteamApiRateLimiter;
  private requests: Map<string, number[]> = new Map();
  private readonly maxRequestsPerMinute = 100; // Steam API limit
  private readonly maxRequestsPerSecond = 10;  // Conservative limit
  private readonly rateLimitWindow = 60 * 1000; // 1 minute in milliseconds
  private readonly burstWindow = 1000; // 1 second in milliseconds
  
  private constructor() {}
  
  static getInstance(): SteamApiRateLimiter {
    if (!SteamApiRateLimiter.instance) {
      SteamApiRateLimiter.instance = new SteamApiRateLimiter();
    }
    return SteamApiRateLimiter.instance;
  }
  
  /**
   * Checks if a request is allowed under rate limiting rules
   * @param endpoint - The API endpoint being called
   * @returns true if request is allowed, false if rate limited
   */
  isRequestAllowed(endpoint: string): boolean {
    const now = Date.now();
    const endpointKey = `${endpoint}`;
    
    // Get or create request history for this endpoint
    if (!this.requests.has(endpointKey)) {
      this.requests.set(endpointKey, []);
    }
    
    const requestHistory = this.requests.get(endpointKey)!;
    
    // Clean old requests outside the window
    const validRequests = requestHistory.filter(
      timestamp => now - timestamp < this.rateLimitWindow
    );
    
    // Check burst limit (requests per second)
    const recentRequests = validRequests.filter(
      timestamp => now - timestamp < this.burstWindow
    );
    
    if (recentRequests.length >= this.maxRequestsPerSecond) {
      console.warn(`[RateLimit] Burst limit exceeded for ${endpoint}: ${recentRequests.length}/${this.maxRequestsPerSecond} per second`);
      return false;
    }
    
    // Check minute limit
    if (validRequests.length >= this.maxRequestsPerMinute) {
      console.warn(`[RateLimit] Minute limit exceeded for ${endpoint}: ${validRequests.length}/${this.maxRequestsPerMinute} per minute`);
      return false;
    }
    
    // Request is allowed, record it
    validRequests.push(now);
    this.requests.set(endpointKey, validRequests);
    
    return true;
  }
  
  /**
   * Calculates delay needed before next request can be made
   * @param endpoint - The API endpoint being called
   * @returns delay in milliseconds, 0 if no delay needed
   */
  getDelayUntilNextRequest(endpoint: string): number {
    const now = Date.now();
    const endpointKey = `${endpoint}`;
    
    if (!this.requests.has(endpointKey)) {
      return 0;
    }
    
    const requestHistory = this.requests.get(endpointKey)!;
    
    // Check if we need to wait for burst limit
    const recentRequests = requestHistory.filter(
      timestamp => now - timestamp < this.burstWindow
    );
    
    if (recentRequests.length >= this.maxRequestsPerSecond) {
      const oldestRecentRequest = Math.min(...recentRequests);
      return this.burstWindow - (now - oldestRecentRequest);
    }
    
    // Check if we need to wait for minute limit
    const validRequests = requestHistory.filter(
      timestamp => now - timestamp < this.rateLimitWindow
    );
    
    if (validRequests.length >= this.maxRequestsPerMinute) {
      const oldestValidRequest = Math.min(...validRequests);
      return this.rateLimitWindow - (now - oldestValidRequest);
    }
    
    return 0;
  }
  
  /**
   * Waits for the appropriate delay before allowing next request
   * @param endpoint - The API endpoint being called
   */
  async waitForNextRequest(endpoint: string): Promise<void> {
    const delay = this.getDelayUntilNextRequest(endpoint);
    if (delay > 0) {
      console.info(`[RateLimit] Waiting ${delay}ms before next request to ${endpoint}`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  /**
   * Gets current usage statistics for an endpoint
   * @param endpoint - The API endpoint to check
   * @returns usage statistics
   */
  getUsageStats(endpoint: string): { 
    requestsLastMinute: number; 
    requestsLastSecond: number; 
    nextAvailableSlot: number;
  } {
    const now = Date.now();
    const endpointKey = `${endpoint}`;
    
    if (!this.requests.has(endpointKey)) {
      return { 
        requestsLastMinute: 0, 
        requestsLastSecond: 0, 
        nextAvailableSlot: 0 
      };
    }
    
    const requestHistory = this.requests.get(endpointKey)!;
    const requestsLastMinute = requestHistory.filter(
      timestamp => now - timestamp < this.rateLimitWindow
    ).length;
    
    const requestsLastSecond = requestHistory.filter(
      timestamp => now - timestamp < this.burstWindow
    ).length;
    
    const nextAvailableSlot = now + this.getDelayUntilNextRequest(endpoint);
    
    return { requestsLastMinute, requestsLastSecond, nextAvailableSlot };
  }
}

/**
 * PERFORMANCE FIX: Multi-layer cache system for Steam API responses
 * Combines in-memory cache with persistent storage for optimal performance
 */
class AdvancedSteamCache {
  private static instance: AdvancedSteamCache;
  private memoryCache: Map<string, { data: any; timestamp: number; ttl: number }> = new Map();
  private persistentCacheDir: string;
  private readonly defaultTtl = 30 * 60 * 1000; // 30 minutes default TTL
  private readonly maxMemoryCacheSize = 1000; // Maximum in-memory entries
  private readonly maxPersistentCacheSize = 10000; // Maximum persistent entries
  private stats = {
    memoryHits: 0,
    persistentHits: 0,
    misses: 0,
    writes: 0
  };
  
  private constructor() {
    this.persistentCacheDir = path.join(process.cwd(), '.cache', 'steam-api');
    this.initializePersistentCache();
  }
  
  static getInstance(): AdvancedSteamCache {
    if (!AdvancedSteamCache.instance) {
      AdvancedSteamCache.instance = new AdvancedSteamCache();
    }
    return AdvancedSteamCache.instance;
  }
  
  private async initializePersistentCache(): Promise<void> {
    try {
      await fs.mkdir(this.persistentCacheDir, { recursive: true });
      console.log(`[AdvancedCache] Persistent cache initialized at: ${this.persistentCacheDir}`);
    } catch (error) {
      console.warn(`[AdvancedCache] Failed to initialize persistent cache:`, error);
    }
  }
  
  /**
   * Set data in both memory and persistent cache
   */
  async set(key: string, data: any, ttl: number = this.defaultTtl): Promise<void> {
    // Clean memory cache if getting too large
    if (this.memoryCache.size >= this.maxMemoryCacheSize) {
      this.cleanExpiredMemoryEntries();
    }
    
    const cacheEntry = {
      data,
      timestamp: Date.now(),
      ttl
    };
    
    // Set in memory cache
    this.memoryCache.set(key, cacheEntry);
    
    // Set in persistent cache (async, don't wait)
    this.setPersistent(key, cacheEntry).catch(error => {
      console.warn(`[AdvancedCache] Failed to write to persistent cache:`, error);
    });
    
    this.stats.writes++;
  }
  
  /**
   * Get data from memory cache first, then persistent cache
   */
  async get(key: string): Promise<any | null> {
    // Try memory cache first
    const memoryEntry = this.memoryCache.get(key);
    if (memoryEntry) {
      if (Date.now() - memoryEntry.timestamp <= memoryEntry.ttl) {
        this.stats.memoryHits++;
        return memoryEntry.data;
      } else {
        this.memoryCache.delete(key);
      }
    }
    
    // Try persistent cache
    try {
      const persistentEntry = await this.getPersistent(key);
      if (persistentEntry) {
        if (Date.now() - persistentEntry.timestamp <= persistentEntry.ttl) {
          // Promote to memory cache
          this.memoryCache.set(key, persistentEntry);
          this.stats.persistentHits++;
          return persistentEntry.data;
        } else {
          // Delete expired persistent entry
          this.deletePersistent(key).catch(() => {});
        }
      }
    } catch (error) {
      console.warn(`[AdvancedCache] Failed to read from persistent cache:`, error);
    }
    
    this.stats.misses++;
    return null;
  }
  
  /**
   * Check if key exists in either cache
   */
  async has(key: string): Promise<boolean> {
    return (await this.get(key)) !== null;
  }
  
  /**
   * Invalidate specific key from both caches
   */
  async invalidate(key: string): Promise<void> {
    this.memoryCache.delete(key);
    await this.deletePersistent(key).catch(() => {});
  }
  
  /**
   * Invalidate all cache entries matching pattern
   */
  async invalidatePattern(pattern: string): Promise<void> {
    const regex = new RegExp(pattern);
    
    // Clear from memory cache
    for (const key of this.memoryCache.keys()) {
      if (regex.test(key)) {
        this.memoryCache.delete(key);
      }
    }
    
    // Clear from persistent cache
    try {
      const files = await fs.readdir(this.persistentCacheDir);
      for (const file of files) {
        const key = file.replace('.json', '');
        if (regex.test(key)) {
          await this.deletePersistent(key).catch(() => {});
        }
      }
    } catch (error) {
      console.warn(`[AdvancedCache] Failed to invalidate pattern from persistent cache:`, error);
    }
  }
  
  /**
   * Clear all cache
   */
  async clear(): Promise<void> {
    this.memoryCache.clear();
    try {
      await fs.rmdir(this.persistentCacheDir, { recursive: true });
      await this.initializePersistentCache();
    } catch (error) {
      console.warn(`[AdvancedCache] Failed to clear persistent cache:`, error);
    }
  }
  
  private async setPersistent(key: string, entry: any): Promise<void> {
    const filePath = path.join(this.persistentCacheDir, `${this.sanitizeKey(key)}.json`);
    await fs.writeFile(filePath, JSON.stringify(entry));
  }
  
  private async getPersistent(key: string): Promise<any | null> {
    const filePath = path.join(this.persistentCacheDir, `${this.sanitizeKey(key)}.json`);
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      return JSON.parse(content);
    } catch (error) {
      return null;
    }
  }
  
  private async deletePersistent(key: string): Promise<void> {
    const filePath = path.join(this.persistentCacheDir, `${this.sanitizeKey(key)}.json`);
    await fs.unlink(filePath);
  }
  
  private sanitizeKey(key: string): string {
    return key.replace(/[<>:"/\\|?*]/g, '_');
  }
  
  private cleanExpiredMemoryEntries(): void {
    const now = Date.now();
    for (const [key, entry] of this.memoryCache.entries()) {
      if (now - entry.timestamp > entry.ttl) {
        this.memoryCache.delete(key);
      }
    }
  }
  
  /**
   * Get detailed cache statistics
   */
  getStats(): {
    memorySize: number;
    persistentSize: number;
    memoryHits: number;
    persistentHits: number;
    misses: number;
    writes: number;
    hitRate: number;
    memoryHitRate: number;
    persistentHitRate: number;
  } {
    const totalRequests = this.stats.memoryHits + this.stats.persistentHits + this.stats.misses;
    const hitRate = totalRequests > 0 ? ((this.stats.memoryHits + this.stats.persistentHits) / totalRequests) * 100 : 0;
    const memoryHitRate = totalRequests > 0 ? (this.stats.memoryHits / totalRequests) * 100 : 0;
    const persistentHitRate = totalRequests > 0 ? (this.stats.persistentHits / totalRequests) * 100 : 0;
    
    return {
      memorySize: this.memoryCache.size,
      persistentSize: 0, // Could implement if needed
      memoryHits: this.stats.memoryHits,
      persistentHits: this.stats.persistentHits,
      misses: this.stats.misses,
      writes: this.stats.writes,
      hitRate,
      memoryHitRate,
      persistentHitRate
    };
  }
}

/**
 * PERFORMANCE FIX: Batch processing for Steam API calls
 * Processes games in small batches to avoid rate limits and improve performance
 */
async function processSteamGamesInBatches(games: InstalledGame[]): Promise<InstalledGame[]> {
  const rateLimiter = SteamApiRateLimiter.getInstance();
  const advancedCache = AdvancedSteamCache.getInstance();
  const batchSize = 5; // Process 5 games at a time
  const batchDelay = 2000; // 2 seconds between batches
  
  const results: InstalledGame[] = [];
  
  console.log(`[BatchProcessor] Processing ${games.length} games in batches of ${batchSize}`);
  
  // PERFORMANCE FIX: Pre-populate cache with common games data
  await prePopulateCommonGamesCache(games, advancedCache);
  
  for (let i = 0; i < games.length; i += batchSize) {
    const batch = games.slice(i, i + batchSize);
    console.log(`[BatchProcessor] Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(games.length / batchSize)} (${batch.length} games)`);
    
    const batchResults = await Promise.all(
      batch.map(async (game) => {
        return await processGameWithAdvancedCache(game, rateLimiter, advancedCache);
      })
    );
    
    results.push(...batchResults);
    
    // Wait between batches to respect rate limits
    if (i + batchSize < games.length) {
      console.log(`[BatchProcessor] Waiting ${batchDelay}ms before next batch...`);
      await new Promise(resolve => setTimeout(resolve, batchDelay));
    }
  }
  
  const cacheStats = advancedCache.getStats();
  console.log(`[BatchProcessor] Completed processing ${results.length} games. Memory cache: ${cacheStats.memorySize}, Hit rate: ${cacheStats.hitRate.toFixed(1)}%`);
  
  return results;
}

/**
 * PERFORMANCE FIX: Process individual game with advanced caching
 * Checks multi-layer cache first, then makes API call if needed
 */
async function processGameWithAdvancedCache(
  game: InstalledGame,
  rateLimiter: SteamApiRateLimiter,
  advancedCache: AdvancedSteamCache
): Promise<InstalledGame> {
  try {
    // SECURITY FIX: Validate App ID before processing
    if (!validateSteamAppId(game.appId)) {
      console.warn(`[Security] Invalid App ID for processing: ${game.appId}`);
      return game;
    }
    
    const cacheKey = `game_details_${game.appId}`;
    
    // PERFORMANCE FIX: Check advanced cache first (memory + persistent)
    const cachedData = await advancedCache.get(cacheKey);
    if (cachedData) {
      console.log(`[AdvancedCache] Cache hit for ${game.name} (${game.appId})`);
      return {
        ...game,
        supportedLanguages: cachedData.supportedLanguages,
        engine: cachedData.engine,
        coverUrl: cachedData.coverUrl,
      };
    }
    
    const endpoint = 'store.steampowered.com/api/appdetails';
    
    // SECURITY FIX: Check rate limit before making request
    if (!rateLimiter.isRequestAllowed(endpoint)) {
      console.warn(`[RateLimit] Request blocked for ${game.name} (appId: ${game.appId})`);
      return game;
    }
    
    // SECURITY FIX: Wait for rate limit if needed
    await rateLimiter.waitForNextRequest(endpoint);
    
    const response = await fetch(`https://store.steampowered.com/api/appdetails?appids=${game.appId}&l=italian`);
    
    if (response.status === 429) {
      console.warn(`[getGameDetails] Rate limit per appId: ${game.appId}.`);
      // PERFORMANCE FIX: Shorter wait for batch processing
      await new Promise(resolve => setTimeout(resolve, 2000));
      return game;
    }
    
    if (!response.ok) {
      console.warn(`[getGameDetails] Impossibile recuperare i dettagli per ${game.name} (appId: ${game.appId}). Status: ${response.status}`);
      return game;
    }
    
    const data = await response.json();
    const gameData = data[game.appId];
    
    if (gameData && gameData.success) {
      const details = gameData.data;
      
      const languages = (details.supported_languages || '')
        .split(',')
        .map((lang: string) => lang.replace(/<[^>]*>?/gm, '').replace(/\*/g, '').trim())
        .filter(Boolean)
        .join(',');
      
      let engine = 'N/A';
      if (details.categories) {
        const engineCategory = details.categories.find((c: { description: string }) => 
          c.description.toLowerCase().includes('engine') || c.description.toLowerCase().includes('sdk')
        );
        if (engineCategory) {
          engine = engineCategory.description.replace('SDK', '').replace('Engine', '').trim();
        }
      }
      
      const gameDetails = {
        supportedLanguages: languages,
        engine: engine,
        coverUrl: details.header_image || '',
      };
      
      // PERFORMANCE FIX: Cache the result in advanced cache
      await advancedCache.set(cacheKey, gameDetails);
      
      return {
        ...game,
        ...gameDetails,
      };
    } else {
      return game;
    }
  } catch (error) {
    console.error(`[getGameDetails] Errore durante il recupero dei dettagli per ${game.name}:`, error);
    return game;
  }
}

/**
 * PERFORMANCE FIX: Pre-populate cache with common games data
 * Reduces API calls for popular games that many users have
 */
async function prePopulateCommonGamesCache(games: InstalledGame[], advancedCache: AdvancedSteamCache): Promise<void> {
  const commonGames = [
    {
      appId: '570',
      name: 'Dota 2',
      data: {
        supportedLanguages: 'Italian,English,German,French,Russian,Spanish,Portuguese,Korean,Simplified Chinese,Traditional Chinese',
        engine: 'Source 2',
        coverUrl: 'https://cdn.akamai.steamstatic.com/steam/apps/570/header.jpg'
      }
    },
    {
      appId: '730',
      name: 'Counter-Strike 2',
      data: {
        supportedLanguages: 'Italian,English,German,French,Russian,Spanish,Portuguese,Korean,Simplified Chinese,Traditional Chinese',
        engine: 'Source 2',
        coverUrl: 'https://cdn.akamai.steamstatic.com/steam/apps/730/header.jpg'
      }
    },
    {
      appId: '440',
      name: 'Team Fortress 2',
      data: {
        supportedLanguages: 'Italian,English,German,French,Russian,Spanish,Portuguese,Korean,Simplified Chinese,Traditional Chinese',
        engine: 'Source',
        coverUrl: 'https://cdn.akamai.steamstatic.com/steam/apps/440/header.jpg'
      }
    },
    {
      appId: '1085660',
      name: 'Destiny 2',
      data: {
        supportedLanguages: 'Italian,English,German,French,Russian,Spanish,Portuguese,Japanese,Korean,Simplified Chinese',
        engine: 'Tiger Engine',
        coverUrl: 'https://cdn.akamai.steamstatic.com/steam/apps/1085660/header.jpg'
      }
    },
    {
      appId: '1172470',
      name: 'Apex Legends',
      data: {
        supportedLanguages: 'Italian,English,German,French,Russian,Spanish,Portuguese,Japanese,Korean,Simplified Chinese,Traditional Chinese',
        engine: 'Source',
        coverUrl: 'https://cdn.akamai.steamstatic.com/steam/apps/1172470/header.jpg'
      }
    }
  ];
  
  let cacheHits = 0;
  
  for (const game of games) {
    const commonGame = commonGames.find(cg => cg.appId === game.appId);
    if (commonGame && !(await advancedCache.has(`game_details_${game.appId}`))) {
      await advancedCache.set(`game_details_${game.appId}`, commonGame.data, 60 * 60 * 1000); // 1 hour TTL for common games
      cacheHits++;
    }
  }
  
  if (cacheHits > 0) {
    console.log(`[PreCache] Pre-populated cache with ${cacheHits} common games`);
  }
}

/**
 * PERFORMANCE FIX: Cache management utilities
 * Provides utility functions for cache management and invalidation
 */
export class SteamCacheManager {
  private static cache = AdvancedSteamCache.getInstance();
  
  /**
   * Invalidate cache for a specific game
   */
  static async invalidateGame(appId: string): Promise<void> {
    await this.cache.invalidate(`game_details_${appId}`);
    console.log(`[CacheManager] Invalidated cache for game ${appId}`);
  }
  
  /**
   * Invalidate cache for all games matching a pattern
   */
  static async invalidateGames(pattern: string): Promise<void> {
    await this.cache.invalidatePattern(pattern);
    console.log(`[CacheManager] Invalidated cache for pattern: ${pattern}`);
  }
  
  /**
   * Clear all Steam API cache
   */
  static async clearAllCache(): Promise<void> {
    await this.cache.clear();
    console.log(`[CacheManager] Cleared all Steam API cache`);
  }
  
  /**
   * Get cache statistics
   */
  static getCacheStats() {
    return this.cache.getStats();
  }
  
  /**
   * Warm up cache with specific games
   */
  static async warmupCache(games: InstalledGame[]): Promise<void> {
    console.log(`[CacheManager] Warming up cache for ${games.length} games`);
    await prePopulateCommonGamesCache(games, this.cache);
  }
  
  /**
   * Get cached game data if available
   */
  static async getCachedGameData(appId: string): Promise<any | null> {
    return await this.cache.get(`game_details_${appId}`);
  }
  
  /**
   * Manually set cache data for a game
   */
  static async setCachedGameData(appId: string, data: any, ttl?: number): Promise<void> {
    await this.cache.set(`game_details_${appId}`, data, ttl);
  }
}

/**
 * Recupera il percorso di installazione di Steam dal registro di Windows.
 * @returns {Promise<string | null>} Il percorso di installazione o null se non trovato.
 */
async function getSteamInstallPathFromRegistry(): Promise<string | null> {
  try {
    const regKey = new WinReg({
      hive: WinReg.HKCU, // Cerca nella chiave dell'utente corrente
      key:  '\\Software\\Valve\\Steam'
    });
    const steamPathValue = await new Promise((resolve, reject) => {
      regKey.get('SteamPath', (err: any, item: any) => {
        if (err) return reject(err);
        resolve(item.value);
      });
    });
    return steamPathValue ? (steamPathValue as string).replace(/\//g, '\\') : null;
  } catch (error) {
    console.warn('Impossibile trovare la chiave di registro di Steam in HKCU, tento con HKLM...');
    try {
        const regKey = new WinReg({
            hive: WinReg.HKLM,
            key:  '\\SOFTWARE\\Wow6432Node\\Valve\\Steam'
        });
        const steamPathValue = await new Promise((resolve, reject) => {
            regKey.get('InstallPath', (err: any, item: any) => {
                if (err) return reject(err);
                resolve(item.value);
            });
        });
        return steamPathValue ? (steamPathValue as string).replace(/\//g, '\\') : null;
    } catch (err) {
        console.error('Errore critico: Impossibile trovare il percorso di installazione di Steam nel registro.', err);
        return null;
    }
  }
}

/**
 * Legge le cartelle della libreria di Steam dal file di configurazione.
 * @param {string} steamPath - Il percorso di installazione di Steam.
 * @returns {Promise<string[]>} Una lista di percorsi delle librerie.
 */
async function getSteamLibraryFolders(steamPath: string): Promise<string[]> {
  const libraryFoldersVdfPath = path.join(steamPath, 'steamapps', 'libraryfolders.vdf');
  const libraryFolders: string[] = [steamPath]; // La cartella principale è sempre una libreria

  try {
    const content = await fs.readFile(libraryFoldersVdfPath, 'utf-8');
    const data: any = vdf.parse(content);

    if (data.LibraryFolders) {
        Object.values(data.LibraryFolders as any)
            .filter((val: any) => typeof val === 'object' && val.path)
            .forEach((val: any) => libraryFolders.push(val.path));
    } else {
        // Fallback per un formato alternativo del file VDF
        Object.values(data as any)
            .filter((val: any) => typeof val === 'object' && val.path)
            .forEach((val: any) => libraryFolders.push(val.path));
    }

  } catch (error) {
    console.warn(`File libraryfolders.vdf non trovato o illeggibile. Verrà usata solo la libreria principale.`, error);
  }

  return [...new Set(libraryFolders)]; // Rimuove duplicati
}

/**
 * Scansiona le librerie di Steam e restituisce una lista di giochi installati.
 * Funzione robusta che non si blocca in caso di file .acf corrotti.
 * @returns {Promise<InstalledGame[]>} La lista dei giochi installati.
 */
export async function getInstalledGames(): Promise<InstalledGame[]> {
  // 1. Tentativo rapido con steam-locate (sincrono, quindi poco overhead)
  try {
    const apps = getInstalledSteamAppsSync();
    if (apps && apps.length > 0) {
      console.log(`[getInstalledGames] Recuperati ${apps.length} giochi tramite steam-locate.`);
      return apps.map(app => ({
        appId: app.appId,
        name: app.name ?? `App ${app.appId}`,
        installDir: app.installDir ?? '',
      }));
    } else {
      console.warn('[getInstalledGames] steam-locate non ha restituito giochi, procedo con fallback legacy.');
    }
  } catch (locErr) {
    console.warn('[getInstalledGames] steam-locate non disponibile o ha fallito, procedo con fallback legacy.', locErr);
  }
  console.log('[getInstalledGames] Inizio scansione giochi installati...');
  const steamPath = await getSteamInstallPathFromRegistry();

  if (!steamPath) {
    console.error("[getInstalledGames] Impossibile determinare il percorso di installazione di Steam. La scansione è interrotta.");
    return [];
  }

  const libraryFolders = await getSteamLibraryFolders(steamPath);
  console.log(`[getInstalledGames] Trovate ${libraryFolders.length} librerie di Steam.`);
  const allGames: InstalledGame[] = [];

  for (const library of libraryFolders) {
    const steamappsPath = path.join(library, 'steamapps');
    try {
      const files = await fs.readdir(steamappsPath);
      const acfFiles = files.filter(f => f.startsWith('appmanifest_') && f.endsWith('.acf'));

      for (const file of acfFiles) {
        // SECURITY FIX: Validate ACF filename before processing
        if (!validateSteamACFFilename(file)) {
          console.warn(`[Security] Invalid ACF filename blocked: ${file}`);
          continue;
        }

        // SECURITY FIX: Validate file path before reading
        if (!validateFilePath(steamappsPath, file)) {
          console.warn(`[Security] Invalid file path blocked: ${file}`);
          continue;
        }

        const filePath = path.join(steamappsPath, file);
        try {
          const content = await fs.readFile(filePath, 'utf-8');
          const data: any = vdf.parse(content);
          const appState = data.AppState;

          if (appState && appState.appid && appState.name && appState.installdir) {
            // SECURITY FIX: Sanitize install directory name
            const sanitizedInstallDir = sanitizeInstallDir(appState.installdir);
            if (!sanitizedInstallDir) {
              console.warn(`[Security] Invalid install directory blocked: ${appState.installdir}`);
              continue;
            }

            const gameInstallPath = path.join(steamappsPath, 'common', sanitizedInstallDir);
            
            // SECURITY FIX: Final path validation
            if (!validateFilePath(path.join(steamappsPath, 'common'), sanitizedInstallDir)) {
              console.warn(`[Security] Install path validation failed for: ${sanitizedInstallDir}`);
              continue;
            }

            allGames.push({
              appId: appState.appid,
              name: appState.name,
              installDir: gameInstallPath,
            });
          } else {
            console.warn(`[Parser ACF] Dati incompleti nel file ${file}. Salto.`);
          }
        } catch (parseError) {
          console.warn(`[Parser ACF] Impossibile analizzare il file ${file}. Potrebbe essere corrotto. Salto.`, parseError);
        }
      }
    } catch (dirError) {
      console.warn(`[Scanner Libreria] Impossibile leggere la cartella ${steamappsPath}. Salto.`, dirError);
    }
  }

  console.log(`[getInstalledGames] Recupero dettagli da Steam API per ${allGames.length} giochi...`);

  // PERFORMANCE FIX: Implement batched API calls with intelligent caching
  const gamesWithDetails = await processSteamGamesInBatches(allGames);

  console.log(`[getInstalledGames] Scansione e arricchimento dati completati. Trovati ${gamesWithDetails.length} giochi.`);
  return gamesWithDetails;
}

/**
 * Trova il percorso di installazione di un gioco Steam specifico usando una strategia a due livelli.
 * @param {string} gameId - L'AppID del gioco da trovare.
 * @returns {Promise<string | null>} Il percorso di installazione o null se non trovato.
 */
export async function findSteamGamePath(gameId: string): Promise<string | null> {
  // SECURITY FIX: Validate Steam App ID format
  if (!validateSteamAppId(gameId)) {
    console.error(`[Security] Invalid Steam App ID format: ${gameId}`);
    throw new Error('Invalid Steam App ID format');
  }

  // SECURITY FIX: Sanitize gameId for logging
  const sanitizedGameId = sanitizeStringInput(gameId, 20);
  if (!sanitizedGameId) {
    console.error(`[Security] Failed to sanitize game ID: ${gameId}`);
    throw new Error('Invalid game ID input');
  }

  console.log(`[findSteamGamePath] Inizio ricerca per gameId: ${sanitizedGameId}`);

  // Strategia 1: Cerca tra i giochi installati tramite file .acf
  try {
    const installedGames = await getInstalledGames();
    const foundGame = installedGames.find(g => g.appId === sanitizedGameId);
    if (foundGame && foundGame.installDir) {
      console.log(`[findSteamGamePath] Trovato con Strategia 1 (ACF): ${foundGame.installDir}`);
      return foundGame.installDir;
    }
  } catch (error) {
    console.warn('[findSteamGamePath] Errore durante la Strategia 1 (ACF), procedo con fallback.', error);
  }

  console.log('[findSteamGamePath] Strategia 1 fallita, avvio Strategia 2 (Scansione Directory)...');

  // Strategia 2: Scansione manuale delle cartelle di libreria
  const steamPath = await getSteamInstallPathFromRegistry();
  if (!steamPath) {
    console.error('[findSteamGamePath] Impossibile trovare il percorso di Steam per la Strategia 2.');
    return null;
  }

  const libraryFolders = await getSteamLibraryFolders(steamPath);
  for (const library of libraryFolders) {
    const steamappsPath = path.join(library, 'steamapps', 'common');
    
    // SECURITY FIX: Validate library path before accessing
    if (!validateFilePath(steamPath, library)) {
      console.warn(`[Security] Invalid library path blocked: ${library}`);
      continue;
    }

    try {
      const gameDirs = await fs.readdir(steamappsPath);
      
      // SECURITY FIX: Validate each game directory
      for (const gameDir of gameDirs) {
        if (!validateFilePath(steamappsPath, gameDir)) {
          console.warn(`[Security] Invalid game directory blocked: ${gameDir}`);
          continue;
        }
        
        // Heuristica: cerca una cartella che potrebbe corrispondere al gioco.
        // Questa parte potrebbe essere migliorata con un mapping appId -> nome cartella.
        // Per ora, è un placeholder che dimostra la logica di fallback.
      }
    } catch (error) {
      console.warn(`[findSteamGamePath] Impossibile leggere la cartella ${steamappsPath} durante la Strategia 2.`);
    }
  }

  console.log(`[findSteamGamePath] Ricerca completata. Gioco non trovato.`);
  return null;
}
