'use client';

import { invoke } from '@/lib/tauri-api';
import type { ProfileResponse, UserProfile } from '@/types/profiles';

export interface SessionData {
  profileId: string;
  profileName: string;
  expiresAt: number;
  lastActivity: number;
}

class SessionPersistence {
  private static instance: SessionPersistence;
  private sessionKey = 'gs_profile_session';
  private activityKey = 'gs_last_activity';

  static getInstance(): SessionPersistence {
    if (!SessionPersistence.instance) {
      SessionPersistence.instance = new SessionPersistence();
    }
    return SessionPersistence.instance;
  }

  // Save session data to localStorage
  saveSession(sessionData: SessionData): void {
    try {
      localStorage.setItem(this.sessionKey, JSON.stringify(sessionData));
      this.updateLastActivity();
    } catch (error) {
      console.error('Error saving session:', error);
    }
  }

  // Load session data from localStorage
  loadSession(): SessionData | null {
    try {
      const sessionStr = localStorage.getItem(this.sessionKey);
      if (!sessionStr) return null;

      const session = JSON.parse(sessionStr) as SessionData;
      
      // Check if session is expired
      if (Date.now() > session.expiresAt) {
        this.clearSession();
        return null;
      }

      return session;
    } catch (error) {
      console.error('Error loading session:', error);
      this.clearSession();
      return null;
    }
  }

  // Clear session data
  clearSession(): void {
    try {
      localStorage.removeItem(this.sessionKey);
      localStorage.removeItem(this.activityKey);
    } catch (error) {
      console.error('Error clearing session:', error);
    }
  }

  // Update last activity timestamp
  updateLastActivity(): void {
    try {
      localStorage.setItem(this.activityKey, Date.now().toString());
    } catch (error) {
      console.error('Error updating last activity:', error);
    }
  }

  // Get last activity timestamp
  getLastActivity(): number | null {
    try {
      const activityStr = localStorage.getItem(this.activityKey);
      return activityStr ? parseInt(activityStr, 10) : null;
    } catch (error) {
      console.error('Error getting last activity:', error);
      return null;
    }
  }

  // Check if session should be renewed based on activity
  shouldRenewSession(inactivityThreshold: number = 30 * 60 * 1000): boolean {
    const lastActivity = this.getLastActivity();
    if (!lastActivity) return false;

    const timeSinceActivity = Date.now() - lastActivity;
    return timeSinceActivity < inactivityThreshold;
  }

  // Auto-save session when profile changes
  async syncWithBackend(): Promise<void> {
    try {
      const currentProfile = await invoke<ProfileResponse<UserProfile | null>>('get_current_profile');
      
      if (currentProfile?.success && currentProfile.data) {
        const timeResponse = await invoke<ProfileResponse<number | null>>('get_session_time_remaining', {
          timeoutSeconds: 1800 // 30 minuti - Tauri 2.x converte automaticamente in snake_case
        });
        const remaining = timeResponse?.success && typeof timeResponse.data === 'number' ? timeResponse.data : 0;
        
        const sessionData: SessionData = {
          profileId: currentProfile.data.id,
          profileName: currentProfile.data.name,
          expiresAt: Date.now() + remaining,
          lastActivity: Date.now()
        };

        this.saveSession(sessionData);
      } else {
        this.clearSession();
      }
    } catch (error) {
      console.error('Error syncing session with backend:', error);
    }
  }

  // Restore session on app startup con timeout e protezione
  async restoreSession(): Promise<boolean> {
    console.log('🔄 Tentativo restore session...');
    
    const session = this.loadSession();
    if (!session) {
      console.log('📭 Nessuna session salvata');
      return false;
    }

    try {
      // Timeout per evitare hang
      const timeoutPromise = new Promise<never>((_, reject) => 
        setTimeout(() => reject(new Error('Session restore timeout')), 3000)
      );

      const restorePromise = this.performRestore(session);
      
      const result = await Promise.race([restorePromise, timeoutPromise]);
      console.log('✅ Session restore completato:', result);
      return result;
      
    } catch (error) {
      console.error('❌ Error restoring session:', error);
      this.clearSession();
      return false;
    }
  }

  private async performRestore(session: SessionData): Promise<boolean> {
    try {
      // Try to restore the session in the backend
      const canAuthResp = await invoke<ProfileResponse<boolean>>('can_authenticate', { name: session.profileName });
      if (!(canAuthResp?.success && canAuthResp.data)) {
        console.log(' Backend non può autenticare');
        this.clearSession();
        return false;
      }

      // Check if the session is still valid in the backend
      const expiredResp = await invoke<ProfileResponse<boolean>>('is_session_expired', { timeoutSeconds: 1800 });
      const isExpired = expiredResp?.success ? !!expiredResp.data : true;
      if (isExpired) {
        console.log(' Session scaduta, tentativo rinnovo...');
        
        // Try to renew if recent activity
        if (this.shouldRenewSession()) {
          const renewedResp = await invoke<ProfileResponse<boolean>>('renew_session');
          const renewed = renewedResp?.success && !!renewedResp.data;
          if (renewed) {
            console.log('✅ Session rinnovata');
            await this.syncWithBackend();
            return true;
          }
        }
        
        console.log('❌ Impossibile rinnovare session');
        this.clearSession();
        return false;
      }

      // Session is valid, sync with backend
      console.log('✅ Session valida, sync con backend...');
      await this.syncWithBackend();
      return true;
      
    } catch (error) {
      console.error('❌ Errore durante restore:', error);
      throw error;
    }
  }

  // Setup activity tracking con protezione anti-loop
  setupActivityTracking(): void {
    // Evita setup multipli
    if ((window as any).__sessionTrackingSetup) {
      console.log('🔄 Session tracking già configurato, skip');
      return;
    }
    
    console.log('🔄 Configurazione session tracking...');
    
    // Track user activity con debouncing
    const events = ['mousedown', 'keypress', 'scroll', 'touchstart', 'click'];
    let activityTimeout: NodeJS.Timeout | null = null;
    
    const updateActivity = () => {
      // Debounce per evitare spam di aggiornamenti
      if (activityTimeout) {
        clearTimeout(activityTimeout);
      }
      
      activityTimeout = setTimeout(() => {
        this.updateLastActivity();
      }, 2000); // Aggiorna massimo ogni 2 secondi
    };

    const listeners: Array<() => void> = [];
    
    events.forEach(event => {
      const listener = () => updateActivity();
      document.addEventListener(event, listener, { passive: true });
      listeners.push(() => document.removeEventListener(event, listener));
    });

    // Periodic sync con protezione
    let syncInProgress = false;
    const syncInterval = setInterval(async () => {
      if (syncInProgress) {
        console.log('🔄 Sync già in corso, skip');
        return;
      }
      
      try {
        syncInProgress = true;
        const session = this.loadSession();
        if (session) {
          await this.syncWithBackend();
        }
      } catch (error) {
        console.error('❌ Errore sync session:', error);
      } finally {
        syncInProgress = false;
      }
    }, 120000); // Sync ogni 2 minuti invece di 1

    // Cleanup function globale
    (window as any).__sessionTrackingCleanup = () => {
      console.log('🧹 Cleanup session tracking...');
      if (activityTimeout) clearTimeout(activityTimeout);
      clearInterval(syncInterval);
      listeners.forEach(cleanup => cleanup());
      delete (window as any).__sessionTrackingSetup;
      delete (window as any).__sessionTrackingCleanup;
    };
    
    // Marca come configurato
    (window as any).__sessionTrackingSetup = true;
    console.log('✅ Session tracking configurato');
  }

  // Clean up expired sessions
  cleanup(): void {
    const session = this.loadSession();
    if (session && Date.now() > session.expiresAt) {
      this.clearSession();
    }
  }
}

export const sessionPersistence = SessionPersistence.getInstance();