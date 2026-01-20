/**
 * Community Translation Hub
 * Sistema per condividere e scaricare Translation Memory dalla community
 */

export interface CommunityPackage {
  id: string;
  name: string;
  gameId: string;
  gameName: string;
  sourceLanguage: string;
  targetLanguage: string;
  entryCount: number;
  author: string;
  authorId: string;
  description: string;
  version: string;
  downloads: number;
  rating: number;
  ratingCount: number;
  tags: string[];
  createdAt: string;
  updatedAt: string;
  verified: boolean;
  size: number; // bytes
}

export interface CommunityUser {
  id: string;
  username: string;
  avatar?: string;
  packagesCount: number;
  totalDownloads: number;
  reputation: number;
  joinedAt: string;
  badges: string[];
}

export interface PackageReview {
  id: string;
  packageId: string;
  userId: string;
  username: string;
  rating: number; // 1-5
  comment: string;
  createdAt: string;
  helpful: number;
}

export interface TranslationEntry {
  source: string;
  target: string;
  context?: string;
  verified?: boolean;
}

export interface PackageUpload {
  name: string;
  gameId: string;
  gameName: string;
  sourceLanguage: string;
  targetLanguage: string;
  description: string;
  tags: string[];
  entries: TranslationEntry[];
}

// Simulated local storage for community packages (in production this would be a server)
const LOCAL_STORAGE_KEY = 'gamestringer_community_packages';
const LOCAL_REVIEWS_KEY = 'gamestringer_community_reviews';

/**
 * Get all community packages (simulated)
 */
export async function getCommunityPackages(filters?: {
  gameId?: string;
  targetLanguage?: string;
  search?: string;
  sortBy?: 'downloads' | 'rating' | 'recent';
}): Promise<CommunityPackage[]> {
  // In production, this would be an API call
  const stored = localStorage.getItem(LOCAL_STORAGE_KEY);
  let packages: CommunityPackage[] = stored ? JSON.parse(stored) : getSamplePackages();
  
  // Apply filters
  if (filters?.gameId) {
    packages = packages.filter(p => p.gameId === filters.gameId);
  }
  
  if (filters?.targetLanguage) {
    packages = packages.filter(p => p.targetLanguage === filters.targetLanguage);
  }
  
  if (filters?.search) {
    const searchLower = filters.search.toLowerCase();
    packages = packages.filter(p => 
      p.name.toLowerCase().includes(searchLower) ||
      p.gameName.toLowerCase().includes(searchLower) ||
      p.description.toLowerCase().includes(searchLower) ||
      p.tags.some(t => t.toLowerCase().includes(searchLower))
    );
  }
  
  // Sort
  switch (filters?.sortBy) {
    case 'downloads':
      packages.sort((a, b) => b.downloads - a.downloads);
      break;
    case 'rating':
      packages.sort((a, b) => b.rating - a.rating);
      break;
    case 'recent':
    default:
      packages.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  }
  
  return packages;
}

/**
 * Get a single package by ID
 */
export async function getPackageById(id: string): Promise<CommunityPackage | null> {
  const packages = await getCommunityPackages();
  return packages.find(p => p.id === id) || null;
}

/**
 * Upload a new package
 */
export async function uploadPackage(
  upload: PackageUpload,
  authorId: string,
  authorName: string
): Promise<CommunityPackage> {
  const newPackage: CommunityPackage = {
    id: `pkg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    name: upload.name,
    gameId: upload.gameId,
    gameName: upload.gameName,
    sourceLanguage: upload.sourceLanguage,
    targetLanguage: upload.targetLanguage,
    entryCount: upload.entries.length,
    author: authorName,
    authorId: authorId,
    description: upload.description,
    version: '1.0.0',
    downloads: 0,
    rating: 0,
    ratingCount: 0,
    tags: upload.tags,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    verified: false,
    size: JSON.stringify(upload.entries).length
  };
  
  // Save to local storage
  const packages = await getCommunityPackages();
  packages.push(newPackage);
  localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(packages));
  
  // Also save the entries separately
  localStorage.setItem(`package_entries_${newPackage.id}`, JSON.stringify(upload.entries));
  
  return newPackage;
}

/**
 * Download package entries
 */
export async function downloadPackageEntries(packageId: string): Promise<TranslationEntry[]> {
  // First check local storage
  const stored = localStorage.getItem(`package_entries_${packageId}`);
  if (stored) {
    // Increment download count
    const packages = await getCommunityPackages();
    const pkg = packages.find(p => p.id === packageId);
    if (pkg) {
      pkg.downloads++;
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(packages));
    }
    
    return JSON.parse(stored);
  }
  
  // Return sample entries for demo packages
  return getSampleEntries(packageId);
}

/**
 * Rate a package
 */
export async function ratePackage(packageId: string, rating: number): Promise<void> {
  const packages = await getCommunityPackages();
  const pkg = packages.find(p => p.id === packageId);
  
  if (pkg) {
    // Simple average (in production would track individual ratings)
    const newTotal = pkg.rating * pkg.ratingCount + rating;
    pkg.ratingCount++;
    pkg.rating = newTotal / pkg.ratingCount;
    pkg.rating = Math.round(pkg.rating * 10) / 10;
    
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(packages));
  }
}

/**
 * Add a review
 */
export async function addReview(
  packageId: string,
  userId: string,
  username: string,
  rating: number,
  comment: string
): Promise<PackageReview> {
  const review: PackageReview = {
    id: `rev_${Date.now()}`,
    packageId,
    userId,
    username,
    rating,
    comment,
    createdAt: new Date().toISOString(),
    helpful: 0
  };
  
  const stored = localStorage.getItem(LOCAL_REVIEWS_KEY);
  const reviews: PackageReview[] = stored ? JSON.parse(stored) : [];
  reviews.push(review);
  localStorage.setItem(LOCAL_REVIEWS_KEY, JSON.stringify(reviews));
  
  // Update package rating
  await ratePackage(packageId, rating);
  
  return review;
}

/**
 * Get reviews for a package
 */
export async function getPackageReviews(packageId: string): Promise<PackageReview[]> {
  const stored = localStorage.getItem(LOCAL_REVIEWS_KEY);
  const reviews: PackageReview[] = stored ? JSON.parse(stored) : [];
  return reviews.filter(r => r.packageId === packageId);
}

/**
 * Export local TM to community format
 */
export function exportToCommunitFormat(
  entries: { source: string; target: string; context?: string }[],
  metadata: {
    name: string;
    gameId: string;
    gameName: string;
    sourceLanguage: string;
    targetLanguage: string;
    description: string;
    tags: string[];
  }
): PackageUpload {
  return {
    ...metadata,
    entries: entries.map(e => ({
      source: e.source,
      target: e.target,
      context: e.context,
      verified: false
    }))
  };
}

// Sample data for demo
function getSamplePackages(): CommunityPackage[] {
  return [
    {
      id: 'sample_1',
      name: 'Hollow Knight - Traduzione Completa',
      gameId: 'steam_367520',
      gameName: 'Hollow Knight',
      sourceLanguage: 'en',
      targetLanguage: 'it',
      entryCount: 4500,
      author: 'TranslatorPro',
      authorId: 'user_1',
      description: 'Traduzione italiana completa di Hollow Knight, inclusi tutti i DLC. Revisionata dalla community.',
      version: '2.1.0',
      downloads: 15420,
      rating: 4.8,
      ratingCount: 234,
      tags: ['metroidvania', 'completo', 'revisionato', 'dlc'],
      createdAt: '2024-06-15T10:00:00Z',
      updatedAt: '2025-01-10T14:30:00Z',
      verified: true,
      size: 450000
    },
    {
      id: 'sample_2',
      name: 'Stardew Valley - Mod Italiano',
      gameId: 'steam_413150',
      gameName: 'Stardew Valley',
      sourceLanguage: 'en',
      targetLanguage: 'it',
      entryCount: 8200,
      author: 'FarmTranslations',
      authorId: 'user_2',
      description: 'Traduzione italiana per Stardew Valley 1.6+. Include dialoghi, oggetti e quest.',
      version: '1.6.2',
      downloads: 28750,
      rating: 4.9,
      ratingCount: 512,
      tags: ['simulazione', 'farming', 'completo', '1.6'],
      createdAt: '2024-03-20T08:00:00Z',
      updatedAt: '2025-01-15T09:00:00Z',
      verified: true,
      size: 820000
    },
    {
      id: 'sample_3',
      name: 'Celeste - UI e Dialoghi',
      gameId: 'steam_504230',
      gameName: 'Celeste',
      sourceLanguage: 'en',
      targetLanguage: 'it',
      entryCount: 1200,
      author: 'PixelWords',
      authorId: 'user_3',
      description: 'Traduzione completa dell\'UI e tutti i dialoghi di Celeste.',
      version: '1.0.0',
      downloads: 5680,
      rating: 4.6,
      ratingCount: 89,
      tags: ['platformer', 'indie', 'dialoghi'],
      createdAt: '2024-09-01T12:00:00Z',
      updatedAt: '2024-12-20T16:00:00Z',
      verified: false,
      size: 120000
    },
    {
      id: 'sample_4',
      name: 'Undertale - Traduzione Fan',
      gameId: 'steam_391540',
      gameName: 'Undertale',
      sourceLanguage: 'en',
      targetLanguage: 'it',
      entryCount: 3800,
      author: 'DeterminedTeam',
      authorId: 'user_4',
      description: 'Traduzione italiana di Undertale realizzata con amore dalla community. Include tutte le route.',
      version: '3.0.0',
      downloads: 42000,
      rating: 4.7,
      ratingCount: 876,
      tags: ['rpg', 'indie', 'cult', 'completo'],
      createdAt: '2023-11-10T10:00:00Z',
      updatedAt: '2024-08-15T11:00:00Z',
      verified: true,
      size: 380000
    },
    {
      id: 'sample_5',
      name: 'Hades - Glossario Gaming',
      gameId: 'steam_1145360',
      gameName: 'Hades',
      sourceLanguage: 'en',
      targetLanguage: 'it',
      entryCount: 6500,
      author: 'OlympusTranslators',
      authorId: 'user_5',
      description: 'Traduzione di Hades con terminologia gaming italiana accurata. Dialoghi e descrizioni.',
      version: '1.2.0',
      downloads: 18900,
      rating: 4.5,
      ratingCount: 203,
      tags: ['roguelike', 'action', 'mitologia'],
      createdAt: '2024-01-25T14:00:00Z',
      updatedAt: '2024-11-30T10:00:00Z',
      verified: false,
      size: 650000
    }
  ];
}

function getSampleEntries(packageId: string): TranslationEntry[] {
  // Return sample entries based on package ID
  const samples: Record<string, TranslationEntry[]> = {
    'sample_1': [
      { source: 'Hollow Knight', target: 'Cavaliere Vuoto', context: 'title' },
      { source: 'Soul', target: 'Anima', context: 'resource' },
      { source: 'Geo', target: 'Geo', context: 'currency' },
      { source: 'Bench', target: 'Panchina', context: 'save_point' },
      { source: 'Nail', target: 'Chiodo', context: 'weapon' }
    ],
    'sample_2': [
      { source: 'Farm', target: 'Fattoria', context: 'location' },
      { source: 'Seeds', target: 'Semi', context: 'item' },
      { source: 'Harvest', target: 'Raccolto', context: 'action' },
      { source: 'Friendship', target: 'Amicizia', context: 'mechanic' },
      { source: 'Season', target: 'Stagione', context: 'time' }
    ]
  };
  
  return samples[packageId] || [
    { source: 'Example', target: 'Esempio', context: 'demo' }
  ];
}

/**
 * Get trending packages
 */
export async function getTrendingPackages(limit: number = 5): Promise<CommunityPackage[]> {
  const packages = await getCommunityPackages({ sortBy: 'downloads' });
  return packages.slice(0, limit);
}

/**
 * Get recently updated packages
 */
export async function getRecentPackages(limit: number = 5): Promise<CommunityPackage[]> {
  const packages = await getCommunityPackages({ sortBy: 'recent' });
  return packages.slice(0, limit);
}

/**
 * Search packages by game name
 */
export async function searchByGame(gameName: string): Promise<CommunityPackage[]> {
  return getCommunityPackages({ search: gameName });
}

/**
 * Get statistics
 */
export async function getCommunityStats(): Promise<{
  totalPackages: number;
  totalDownloads: number;
  totalEntries: number;
  topLanguages: { lang: string; count: number }[];
}> {
  const packages = await getCommunityPackages();
  
  const totalPackages = packages.length;
  const totalDownloads = packages.reduce((sum, p) => sum + p.downloads, 0);
  const totalEntries = packages.reduce((sum, p) => sum + p.entryCount, 0);
  
  // Count by target language
  const langCounts: Record<string, number> = {};
  packages.forEach(p => {
    langCounts[p.targetLanguage] = (langCounts[p.targetLanguage] || 0) + 1;
  });
  
  const topLanguages = Object.entries(langCounts)
    .map(([lang, count]) => ({ lang, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);
  
  return { totalPackages, totalDownloads, totalEntries, topLanguages };
}
