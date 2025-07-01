import { NextRequest, NextResponse } from 'next/server';

// Statistiche in memoria per ogni processo
const processStats = new Map<number, {
  processName: string;
  gameName: string;
  totalTranslations: number;
  translationsPerMinute: number;
  memoryUsage: number;
  cpuUsage: number;
  startTime: Date;
  lastTranslation: {
    original: string;
    translated: string;
    timestamp: Date;
  } | null;
  translationHistory: Array<{
    time: string;
    count: number;
  }>;
  languageDistribution: Map<string, number>;
  performanceMetrics: {
    avgTranslationTime: number;
    totalTranslationTime: number;
    translationCount: number;
    cacheHits: number;
    cacheMisses: number;
    memoryReads: number;
    memoryWrites: number;
  };
}>();

export async function GET(
  request: NextRequest,
  { params }: { params: { pid: string } }
) {
  try {
    const pid = parseInt(params.pid);
    
    // Ottieni o crea le statistiche per questo processo
    let stats = processStats.get(pid);
    
    if (!stats) {
      // Inizializza nuove statistiche
      stats = {
        processName: 'game.exe',
        gameName: 'Unknown Game',
        totalTranslations: 0,
        translationsPerMinute: 0,
        memoryUsage: Math.random() * 100 * 1024 * 1024, // Mock: 0-100MB
        cpuUsage: Math.random() * 20, // Mock: 0-20%
        startTime: new Date(),
        lastTranslation: null,
        translationHistory: [],
        languageDistribution: new Map([
          ['it', 0],
          ['en', 0],
          ['es', 0],
          ['fr', 0],
          ['de', 0]
        ]),
        performanceMetrics: {
          avgTranslationTime: 0,
          totalTranslationTime: 0,
          translationCount: 0,
          cacheHits: 0,
          cacheMisses: 0,
          memoryReads: 0,
          memoryWrites: 0
        }
      };
      processStats.set(pid, stats);
    }
    
    // Simula aggiornamenti in tempo reale
    const now = new Date();
    const activeTime = Math.floor((now.getTime() - stats.startTime.getTime()) / 1000);
    
    // Aggiorna metriche simulate
    if (Math.random() > 0.7) {
      stats.totalTranslations += Math.floor(Math.random() * 5) + 1;
      stats.performanceMetrics.translationCount = stats.totalTranslations;
      stats.performanceMetrics.memoryReads += Math.floor(Math.random() * 10) + 1;
      stats.performanceMetrics.memoryWrites += Math.floor(Math.random() * 3) + 1;
      
      // Simula ultima traduzione
      const translations = [
        { original: 'New Game', translated: 'Nuovo Gioco' },
        { original: 'Continue', translated: 'Continua' },
        { original: 'Options', translated: 'Opzioni' },
        { original: 'Exit', translated: 'Esci' },
        { original: 'Save Game', translated: 'Salva Partita' },
        { original: 'Load Game', translated: 'Carica Partita' },
        { original: 'Settings', translated: 'Impostazioni' },
        { original: 'Credits', translated: 'Crediti' }
      ];
      
      const randomTranslation = translations[Math.floor(Math.random() * translations.length)];
      stats.lastTranslation = {
        ...randomTranslation,
        timestamp: now
      };
      
      // Aggiorna distribuzione lingue
      const lang = 'it'; // Per ora solo italiano
      stats.languageDistribution.set(lang, (stats.languageDistribution.get(lang) || 0) + 1);
    }
    
    // Calcola traduzioni al minuto
    if (activeTime > 0) {
      stats.translationsPerMinute = Math.round((stats.totalTranslations / activeTime) * 60);
    }
    
    // Aggiorna CPU e memoria con variazioni realistiche
    stats.cpuUsage = Math.max(0, Math.min(100, stats.cpuUsage + (Math.random() - 0.5) * 5));
    stats.memoryUsage = Math.max(50 * 1024 * 1024, stats.memoryUsage + (Math.random() - 0.5) * 5 * 1024 * 1024);
    
    // Aggiorna storia traduzioni (ultimi 60 secondi)
    const historyTime = new Date(now.getTime() - 60000); // 1 minuto fa
    stats.translationHistory = [];
    for (let i = 0; i < 12; i++) { // 12 punti, uno ogni 5 secondi
      const time = new Date(historyTime.getTime() + i * 5000);
      stats.translationHistory.push({
        time: time.toLocaleTimeString(),
        count: Math.floor(Math.random() * 10) + stats.totalTranslations / 12
      });
    }
    
    // Calcola metriche performance
    if (stats.performanceMetrics.translationCount > 0) {
      stats.performanceMetrics.avgTranslationTime = 
        Math.random() * 50 + 10; // 10-60ms
      stats.performanceMetrics.cacheHits = 
        Math.floor(stats.performanceMetrics.translationCount * 0.7);
      stats.performanceMetrics.cacheMisses = 
        stats.performanceMetrics.translationCount - stats.performanceMetrics.cacheHits;
    }
    
    // Converti Map in array per la distribuzione lingue
    const languageDistribution = Array.from(stats.languageDistribution.entries())
      .map(([language, count]) => {
        const total = Array.from(stats!.languageDistribution.values()).reduce((a, b) => a + b, 0);
        return {
          language,
          count,
          percentage: total > 0 ? Math.round((count / total) * 100) : 0
        };
      })
      .filter(item => item.count > 0)
      .sort((a, b) => b.count - a.count);
    
    // Prepara risposta
    const response = {
      processId: pid,
      processName: stats.processName,
      gameName: stats.gameName,
      totalTranslations: stats.totalTranslations,
      translationsPerMinute: stats.translationsPerMinute,
      memoryUsage: stats.memoryUsage,
      cpuUsage: stats.cpuUsage,
      activeTime,
      lastTranslation: stats.lastTranslation,
      translationHistory: stats.translationHistory,
      languageDistribution,
      performanceMetrics: {
        avgTranslationTime: stats.performanceMetrics.avgTranslationTime,
        cacheHitRate: stats.performanceMetrics.translationCount > 0 
          ? stats.performanceMetrics.cacheHits / stats.performanceMetrics.translationCount 
          : 0,
        memoryEfficiency: Math.random() * 0.3 + 0.7 // 70-100%
      }
    };
    
    return NextResponse.json(response);
  } catch (error) {
    console.error('Errore recupero statistiche:', error);
    return NextResponse.json(
      { error: 'Errore recupero statistiche' },
      { status: 500 }
    );
  }
}

// Reset statistiche quando il processo termina
export async function DELETE(
  request: NextRequest,
  { params }: { params: { pid: string } }
) {
  try {
    const pid = parseInt(params.pid);
    processStats.delete(pid);
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Errore reset statistiche:', error);
    return NextResponse.json(
      { error: 'Errore reset statistiche' },
      { status: 500 }
    );
  }
}
