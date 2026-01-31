'use client';

import { useState, useEffect, useCallback } from 'react';
import { invoke } from '@/lib/tauri-api';

export interface UpdateInfo {
  current_version: string;
  latest_version: string;
  update_available: boolean;
  release_notes: string | null;
  download_url: string | null;
  published_at: string | null;
}

export const useUpdateCheck = () => {
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
  const [isChecking, setIsChecking] = useState(false);
  const [showPopup, setShowPopup] = useState(false);
  const [hasPlayedSound, setHasPlayedSound] = useState(false);

  const checkForUpdates = useCallback(async () => {
    if (isChecking) return;
    setIsChecking(true);
    
    try {
      const info = await invoke<UpdateInfo>('check_for_updates');
      if (info && info.update_available) {
        setUpdateInfo(info);
        
        // Controlla se è già stato dismissato
        const lastDismissed = localStorage.getItem('update_dismissed_version');
        if (lastDismissed !== info.latest_version) {
          // Riproduci suono solo la prima volta
          if (!hasPlayedSound) {
            playNotificationSound();
            setHasPlayedSound(true);
          }
        }
      }
    } catch (error) {
      console.warn('Update check failed:', error);
    } finally {
      setIsChecking(false);
    }
  }, [isChecking, hasPlayedSound]);

  const playNotificationSound = () => {
    try {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      
      // Crea un suono di notifica piacevole (due toni)
      const playTone = (frequency: number, startTime: number, duration: number) => {
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        
        oscillator.frequency.value = frequency;
        oscillator.type = 'sine';
        
        gainNode.gain.setValueAtTime(0, startTime);
        gainNode.gain.linearRampToValueAtTime(0.3, startTime + 0.05);
        gainNode.gain.linearRampToValueAtTime(0, startTime + duration);
        
        oscillator.start(startTime);
        oscillator.stop(startTime + duration);
      };
      
      const now = audioContext.currentTime;
      playTone(880, now, 0.15); // A5
      playTone(1108.73, now + 0.15, 0.2); // C#6
    } catch (e) {
      console.warn('Could not play notification sound:', e);
    }
  };

  const dismissUpdate = useCallback(() => {
    if (updateInfo) {
      localStorage.setItem('update_dismissed_version', updateInfo.latest_version);
    }
    setShowPopup(false);
  }, [updateInfo]);

  const togglePopup = useCallback(() => {
    setShowPopup(prev => !prev);
  }, []);

  // Check all'avvio
  useEffect(() => {
    const timer = setTimeout(() => {
      checkForUpdates();
    }, 3000);

    return () => clearTimeout(timer);
  }, []);

  const isDismissed = updateInfo 
    ? localStorage.getItem('update_dismissed_version') === updateInfo.latest_version 
    : false;

  return {
    updateInfo,
    hasUpdate: updateInfo?.update_available && !isDismissed,
    isChecking,
    showPopup,
    setShowPopup,
    togglePopup,
    dismissUpdate,
    checkForUpdates,
    playNotificationSound
  };
};
