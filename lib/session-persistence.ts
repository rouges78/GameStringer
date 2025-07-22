'use client';

import { invoke } from '@/lib/tauri-api';

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
      const currentProfile = await invoke<any>('get_current_profile');
      
      if (currentProfile?.success && currentProfile.data) {
        const sessionTimeRemaining = await invoke<number>('get_session_time_remaining');
        
        const sessionData: SessionData = {
          profileId: currentProfile.data.id,
          profileName: currentProfile.data.name,
          expiresAt: Date.now() + sessionTimeRemaining,
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

  // Restore session on app startup
  async restoreSession(): Promise<boolean> {
    const session = this.loadSession();
    if (!session) return false;

    try {
      // Try to restore the session in the backend
      const canAuth = await invoke<boolean>('can_authenticate');
      if (!canAuth) {
        this.clearSession();
        return false;
      }

      // Check if the session is still valid in the backend
      const isExpired = await invoke<boolean>('is_session_expired');
      if (isExpired) {
        // Try to renew if recent activity
        if (this.shouldRenewSession()) {
          const renewed = await invoke<boolean>('renew_session');
          if (renewed) {
            await this.syncWithBackend();
            return true;
          }
        }
        
        this.clearSession();
        return false;
      }

      // Session is valid, sync with backend
      await this.syncWithBackend();
      return true;
    } catch (error) {
      console.error('Error restoring session:', error);
      this.clearSession();
      return false;
    }
  }

  // Setup activity tracking
  setupActivityTracking(): void {
    // Track user activity
    const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click'];
    
    const updateActivity = () => {
      this.updateLastActivity();
    };

    events.forEach(event => {
      document.addEventListener(event, updateActivity, { passive: true });
    });

    // Periodic sync with backend
    setInterval(async () => {
      const session = this.loadSession();
      if (session) {
        await this.syncWithBackend();
      }
    }, 60000); // Sync every minute
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