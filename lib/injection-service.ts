import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import { gameProfileManager } from './game-profiles';
import { getGameInfo } from './game-translations';

const execAsync = promisify(exec);

// Interfacce per il modulo nativo
interface InjectionResult {
  success: boolean;
  injectedCount: number;
  injected: Array<{
    address: number;
    original: string;
    translated: string;
  }>;
}

interface Translation {
  original: string;
  translated: string;
}

class InjectionService {
  private nativeModule: any;
  private isAdmin: boolean = false;
  private activeInjections: Map<number, NodeJS.Timeout> = new Map();

  constructor() {
    this.loadNativeModule();
    this.checkAdminPrivileges();
  }

  private loadNativeModule() {
    try {
      // Usa eval per evitare che Webpack processi il modulo nativo
      const nativePath = require('path').join(process.cwd(), 'native', 'build', 'Release', 'gamestringer_injector.node');
      this.nativeModule = eval('require')(nativePath);
      console.log('Modulo nativo caricato con successo da:', nativePath);
    } catch (error) {
      console.warn('Modulo nativo non disponibile, uso mock:', error);
      this.nativeModule = this.createMockModule();
    }
  }

  private createMockModule() {
    return {
      injectTranslations: (processId: number, translations: Translation[]) => {
        console.log(`[MOCK] Injecting ${translations.length} translations into process ${processId}`);
        return {
          success: true,
          injectedCount: translations.length,
          injected: translations.map((t, i) => ({
            address: 0x1000 + i * 0x100,
            original: t.original,
            translated: t.translated
          }))
        };
      },
      monitorProcess: (processId: number) => {
        console.log(`[MOCK] Monitoring process ${processId}`);
        return { success: true, message: 'Mock monitoring started' };
      },
      getProcessModules: (processId: number) => {
        return [
          { name: 'game.exe', base: 0x400000, size: 0x100000 },
          { name: 'engine.dll', base: 0x10000000, size: 0x200000 }
        ];
      },
      isProcess64Bit: (processId: number) => true,
      scanMemory: (processId: number, pattern: number[], mask: string) => {
        return [
          { address: 0x401000, region: 0x400000, size: 0x1000 }
        ];
      },
      hasAdminPrivileges: () => false
    };
  }

  private checkAdminPrivileges() {
    if (process.platform === 'win32') {
      try {
        // Controlla se il modulo nativo ha una funzione per verificare i privilegi
        if (this.nativeModule && this.nativeModule.hasAdminPrivileges) {
          this.isAdmin = this.nativeModule.hasAdminPrivileges();
          console.log('Privilegi admin (dal modulo nativo):', this.isAdmin);
        } else {
          // Fallback: usa un metodo sincrono
          const { execSync } = require('child_process');
          try {
            execSync('net session', { stdio: 'ignore', windowsHide: true });
            this.isAdmin = true;
          } catch {
            this.isAdmin = false;
          }
          console.log('Privilegi admin (fallback):', this.isAdmin);
        }
      } catch (error) {
        console.error('Errore verifica privilegi:', error);
        this.isAdmin = false;
      }
    }
  }

  public requiresAdmin(): boolean {
    // Temporaneamente disabilitato per test
    return false;
    // return process.platform === 'win32' && !this.isAdmin;
  }

  public async injectTranslations(
    processId: number, 
    processName: string,
    translations?: Record<string, string>
  ): Promise<InjectionResult> {
    if (!this.nativeModule) {
      throw new Error('Modulo nativo non caricato');
    }

    try {
      // Ottieni info gioco e profilo
      const gameInfo = getGameInfo(processName);
      const profile = gameProfileManager.getOrCreateProfile(processName, gameInfo?.gameName);
      
      // Usa traduzioni dal profilo se non specificate
      const translationsToUse = translations || gameProfileManager.getAllTranslations(processName);
      
      console.log(`[INJEKT] Processo ${processId} - ${processName}`);
      console.log(`[INJEKT] Gioco riconosciuto: ${gameInfo?.gameName || 'Sconosciuto'}`);
      console.log(`[INJEKT] Traduzioni disponibili: ${Object.keys(translationsToUse).length}`);
      
      // Converti l'oggetto traduzioni in array per il modulo nativo
      const translationsArray = Object.entries(translationsToUse).map(([original, translated]) => ({
        original,
        translated
      }));
      
      const result = await this.nativeModule.injectTranslations(
        processId,
        translationsArray
      );
      
      // Aggiorna statistiche profilo
      if (result.success && result.injectedCount > 0) {
        gameProfileManager.incrementInjectionCount(processName, result.injectedCount);
        
        // Salva indirizzi di memoria per future injection più veloci
        result.injected?.forEach((item: any) => {
          gameProfileManager.addMemoryAddress(
            processName,
            item.address,
            item.original,
            item.translated
          );
        });
      }
      
      console.log('[INJEKT] Injection completata:', {
        success: result.success,
        injectedCount: result.injectedCount,
        totalInjections: profile.totalInjections + (result.injectedCount || 0)
      });
      

      return result;
    } catch (error) {
      console.error('Errore injection:', error);
      throw error;
    }
  }

  public async getProcessInfo(processId: number) {
    try {
      // Usa funzioni mock se non disponibili nel modulo nativo
      const modules = this.nativeModule.getProcessModules ? 
        this.nativeModule.getProcessModules(processId) :
        [{ name: 'game.exe', base: 0x400000, size: 0x100000 }];
      
      const is64Bit = this.nativeModule.isProcess64Bit ?
        this.nativeModule.isProcess64Bit(processId) : true;
      
      return {
        processId,
        modules,
        is64Bit,
        isAdmin: this.isAdmin
      };
    } catch (error) {
      console.error('Errore nel recupero info processo:', error);
      return null;
    }
  }

  private startMonitoring(processId: number) {
    // Ferma monitoring esistente
    this.stopMonitoring(processId);

    // Avvia nuovo monitoring
    const timer = setInterval(async () => {
      try {
        // Qui potresti implementare la logica per:
        // 1. Cercare nuovi testi nel processo
        // 2. Tradurli automaticamente
        // 3. Iniettarli
        console.log(`Monitoring processo ${processId}...`);
      } catch (error) {
        console.error('Errore monitoring:', error);
        this.stopMonitoring(processId);
      }
    }, 5000); // Check ogni 5 secondi

    this.activeInjections.set(processId, timer);
  }

  public stopMonitoring(processId: number) {
    const timer = this.activeInjections.get(processId);
    if (timer) {
      clearInterval(timer as any);
      this.activeInjections.delete(processId);
    }
  }

  public stopAllMonitoring() {
    for (const [processId, timer] of this.activeInjections) {
      clearInterval(timer as any);
    }
    this.activeInjections.clear();
  }

  public getActiveInjections(): number[] {
    return Array.from(this.activeInjections.keys());
  }

  // Metodo per cercare pattern di testo comuni nei giochi
  public async findGameTextPatterns(processId: number): Promise<string[]> {
    const commonPatterns = [
      // Pattern comuni per testi di gioco
      { pattern: [0x00, 0x00], mask: 'xx' }, // Unicode null terminator
      // Aggiungi altri pattern specifici per engine
    ];

    const foundTexts: string[] = [];

    for (const pattern of commonPatterns) {
      try {
        const results = await this.nativeModule.scanMemory(
          processId,
          pattern.pattern,
          pattern.mask
        );

        // Analizza i risultati per estrarre testi
        // Questa è una semplificazione, in realtà servirebbe
        // logica più complessa per identificare stringhe valide
        console.log(`Trovati ${results.length} potenziali testi`);
      } catch (error) {
        console.error('Errore scan pattern:', error);
      }
    }

    return foundTexts;
  }
}

// Singleton
let injectionService: InjectionService | null = null;

export function getInjectionService(): InjectionService {
  if (!injectionService) {
    injectionService = new InjectionService();
  }
  return injectionService;
}

export type { InjectionResult, Translation };
