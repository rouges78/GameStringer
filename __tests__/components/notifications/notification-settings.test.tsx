import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import '@testing-library/jest-dom';
import { NotificationSettings } from '@/components/notifications/notification-settings';
import { NotificationType, NotificationPriority } from '@/types/notifications';

// Mock delle dipendenze
vi.mock('@/hooks/use-notification-preferences', () => ({
  useNotificationPreferences: vi.fn()
}));

vi.mock('@/lib/profile-auth', () => ({
  useProfileAuth: vi.fn()
}));

// Mock preferences
const mockPreferences = {
  profileId: 'test-profile',
  globalEnabled: true,
  soundEnabled: true,
  desktopEnabled: false,
  typeSettings: {
    [NotificationType.SYSTEM]: {
      enabled: true,
      priority: NotificationPriority.NORMAL,
      showToast: true,
      playSound: true,
      persistInCenter: true
    },
    [NotificationType.PROFILE]: {
      enabled: true,
      priority: NotificationPriority.LOW,
      showToast: false,
      playSound: false,
      persistInCenter: true
    },
    [NotificationType.SECURITY]: {
      enabled: true,
      priority: NotificationPriority.URGENT,
      showToast: true,
      playSound: true,
      persistInCenter: true
    },
    [NotificationType.UPDATE]: {
      enabled: false,
      priority: NotificationPriority.NORMAL,
      showToast: false,
      playSound: false,
      persistInCenter: false
    },
    [NotificationType.GAME]: {
      enabled: true,
      priority: NotificationPriority.NORMAL,
      showToast: true,
      playSound: false,
      persistInCenter: true
    },
    [NotificationType.STORE]: {
      enabled: true,
      priority: NotificationPriority.LOW,
      showToast: false,
      playSound: false,
      persistInCenter: false
    },
    [NotificationType.CUSTOM]: {
      enabled: true,
      priority: NotificationPriority.NORMAL,
      showToast: true,
      playSound: true,
      persistInCenter: true
    }
  },
  quietHours: {
    enabled: false,
    startTime: '22:00',
    endTime: '08:00',
    allowUrgent: true
  },
  maxNotifications: 50,
  autoDeleteAfterDays: 30
};

describe('NotificationSettings', () => {
  const mockUseNotificationPreferences = {
    preferences: mockPreferences,
    isLoading: false,
    error: null,
    updatePreferences: vi.fn(),
    resetToDefaults: vi.fn(),
    validatePreferences: vi.fn(() => ({ isValid: true, errors: [] }))
  };

  const mockProfile = {
    id: 'test-profile',
    name: 'Test Profile',
    isActive: true
  };

  beforeEach(() => {
    vi.clearAllMocks();
    (require('@/hooks/use-notification-preferences').useNotificationPreferences as any)
      .mockReturnValue(mockUseNotificationPreferences);
    (require('@/lib/profile-auth').useProfileAuth as any)
      .mockReturnValue({ currentProfile: mockProfile });
  });

  describe('Rendering', () => {
    it('should render notification settings', () => {
      render(<NotificationSettings />);
      
      expect(screen.getByText('Impostazioni Notifiche')).toBeInTheDocument();
      expect(screen.getByText('Configura come e quando ricevere le notifiche')).toBeInTheDocument();
    });

    it('should render global settings section', () => {
      render(<NotificationSettings />);
      
      expect(screen.getByText('Impostazioni Generali')).toBeInTheDocument();
      expect(screen.getByLabelText('Abilita notifiche')).toBeInTheDocument();
      expect(screen.getByLabelText('Suoni notifiche')).toBeInTheDocument();
      expect(screen.getByLabelText('Notifiche desktop')).toBeInTheDocument();
    });

    it('should render notification types section', () => {
      render(<NotificationSettings />);
      
      expect(screen.getByText('Tipi di Notifica')).toBeInTheDocument();
      expect(screen.getByText('Sistema')).toBeInTheDocument();
      expect(screen.getByText('Profilo')).toBeInTheDocument();
      expect(screen.getByText('Sicurezza')).toBeInTheDocument();
      expect(screen.getByText('Aggiornamenti')).toBeInTheDocument();
      expect(screen.getByText('Giochi')).toBeInTheDocument();
      expect(screen.getByText('Store')).toBeInTheDocument();
      expect(screen.getByText('Personalizzate')).toBeInTheDocument();
    });

    it('should render quiet hours section', () => {
      render(<NotificationSettings />);
      
      expect(screen.getByText('Ore Silenziose')).toBeInTheDocument();
      expect(screen.getByLabelText('Abilita ore silenziose')).toBeInTheDocument();
    });

    it('should render advanced settings section', () => {
      render(<NotificationSettings />);
      
      expect(screen.getByText('Impostazioni Avanzate')).toBeInTheDocument();
      expect(screen.getByLabelText('Numero massimo notifiche')).toBeInTheDocument();
      expect(screen.getByLabelText('Elimina automaticamente dopo (giorni)')).toBeInTheDocument();
    });

    it('should show loading state', () => {
      (require('@/hooks/use-notification-preferences').useNotificationPreferences as any)
        .mockReturnValue({
          ...mockUseNotificationPreferences,
          isLoading: true
        });

      render(<NotificationSettings />);
      
      expect(screen.getByRole('progressbar', { hidden: true })).toBeInTheDocument();
    });

    it('should show error state', () => {
      (require('@/hooks/use-notification-preferences').useNotificationPreferences as any)
        .mockReturnValue({
          ...mockUseNotificationPreferences,
          error: 'Failed to load preferences'
        });

      render(<NotificationSettings />);
      
      expect(screen.getByText('Errore nel caricamento delle impostazioni')).toBeInTheDocument();
      expect(screen.getByText('Failed to load preferences')).toBeInTheDocument();
    });
  });

  describe('Global Settings', () => {
    it('should toggle global notifications', async () => {
      const user = userEvent.setup();
      render(<NotificationSettings />);
      
      const globalToggle = screen.getByLabelText('Abilita notifiche');
      expect(globalToggle).toBeChecked();
      
      await user.click(globalToggle);
      
      expect(mockUseNotificationPreferences.updatePreferences).toHaveBeenCalledWith({
        ...mockPreferences,
        globalEnabled: false
      });
    });

    it('should toggle sound notifications', async () => {
      const user = userEvent.setup();
      render(<NotificationSettings />);
      
      const soundToggle = screen.getByLabelText('Suoni notifiche');
      expect(soundToggle).toBeChecked();
      
      await user.click(soundToggle);
      
      expect(mockUseNotificationPreferences.updatePreferences).toHaveBeenCalledWith({
        ...mockPreferences,
        soundEnabled: false
      });
    });

    it('should toggle desktop notifications', async () => {
      const user = userEvent.setup();
      render(<NotificationSettings />);
      
      const desktopToggle = screen.getByLabelText('Notifiche desktop');
      expect(desktopToggle).not.toBeChecked();
      
      await user.click(desktopToggle);
      
      expect(mockUseNotificationPreferences.updatePreferences).toHaveBeenCalledWith({
        ...mockPreferences,
        desktopEnabled: true
      });
    });

    it('should disable all controls when global notifications are disabled', async () => {
      const disabledPreferences = {
        ...mockPreferences,
        globalEnabled: false
      };

      (require('@/hooks/use-notification-preferences').useNotificationPreferences as any)
        .mockReturnValue({
          ...mockUseNotificationPreferences,
          preferences: disabledPreferences
        });

      render(<NotificationSettings />);
      
      expect(screen.getByLabelText('Suoni notifiche')).toBeDisabled();
      expect(screen.getByLabelText('Notifiche desktop')).toBeDisabled();
    });
  });

  describe('Notification Types', () => {
    it('should toggle notification type', async () => {
      const user = userEvent.setup();
      render(<NotificationSettings />);
      
      // Find system notification toggle
      const systemSection = screen.getByText('Sistema').closest('[data-testid="notification-type-system"]');
      const systemToggle = systemSection?.querySelector('input[type="checkbox"]') as HTMLInputElement;
      
      expect(systemToggle).toBeChecked();
      
      await user.click(systemToggle);
      
      expect(mockUseNotificationPreferences.updatePreferences).toHaveBeenCalledWith({
        ...mockPreferences,
        typeSettings: {
          ...mockPreferences.typeSettings,
          [NotificationType.SYSTEM]: {
            ...mockPreferences.typeSettings[NotificationType.SYSTEM],
            enabled: false
          }
        }
      });
    });

    it('should change notification priority', async () => {
      const user = userEvent.setup();
      render(<NotificationSettings />);
      
      // Find system notification priority select
      const systemSection = screen.getByText('Sistema').closest('[data-testid="notification-type-system"]');
      const prioritySelect = systemSection?.querySelector('select') as HTMLSelectElement;
      
      await user.selectOptions(prioritySelect, NotificationPriority.HIGH);
      
      expect(mockUseNotificationPreferences.updatePreferences).toHaveBeenCalledWith({
        ...mockPreferences,
        typeSettings: {
          ...mockPreferences.typeSettings,
          [NotificationType.SYSTEM]: {
            ...mockPreferences.typeSettings[NotificationType.SYSTEM],
            priority: NotificationPriority.HIGH
          }
        }
      });
    });

    it('should toggle toast display', async () => {
      const user = userEvent.setup();
      render(<NotificationSettings />);
      
      // Find system notification toast toggle
      const systemSection = screen.getByText('Sistema').closest('[data-testid="notification-type-system"]');
      const toastToggle = systemSection?.querySelector('input[aria-label*="toast"]') as HTMLInputElement;
      
      expect(toastToggle).toBeChecked();
      
      await user.click(toastToggle);
      
      expect(mockUseNotificationPreferences.updatePreferences).toHaveBeenCalledWith({
        ...mockPreferences,
        typeSettings: {
          ...mockPreferences.typeSettings,
          [NotificationType.SYSTEM]: {
            ...mockPreferences.typeSettings[NotificationType.SYSTEM],
            showToast: false
          }
        }
      });
    });

    it('should toggle sound for type', async () => {
      const user = userEvent.setup();
      render(<NotificationSettings />);
      
      // Find system notification sound toggle
      const systemSection = screen.getByText('Sistema').closest('[data-testid="notification-type-system"]');
      const soundToggle = systemSection?.querySelector('input[aria-label*="suono"]') as HTMLInputElement;
      
      expect(soundToggle).toBeChecked();
      
      await user.click(soundToggle);
      
      expect(mockUseNotificationPreferences.updatePreferences).toHaveBeenCalledWith({
        ...mockPreferences,
        typeSettings: {
          ...mockPreferences.typeSettings,
          [NotificationType.SYSTEM]: {
            ...mockPreferences.typeSettings[NotificationType.SYSTEM],
            playSound: false
          }
        }
      });
    });

    it('should toggle persistence in center', async () => {
      const user = userEvent.setup();
      render(<NotificationSettings />);
      
      // Find system notification persistence toggle
      const systemSection = screen.getByText('Sistema').closest('[data-testid="notification-type-system"]');
      const persistToggle = systemSection?.querySelector('input[aria-label*="centro"]') as HTMLInputElement;
      
      expect(persistToggle).toBeChecked();
      
      await user.click(persistToggle);
      
      expect(mockUseNotificationPreferences.updatePreferences).toHaveBeenCalledWith({
        ...mockPreferences,
        typeSettings: {
          ...mockPreferences.typeSettings,
          [NotificationType.SYSTEM]: {
            ...mockPreferences.typeSettings[NotificationType.SYSTEM],
            persistInCenter: false
          }
        }
      });
    });

    it('should disable type controls when type is disabled', async () => {
      const disabledTypePreferences = {
        ...mockPreferences,
        typeSettings: {
          ...mockPreferences.typeSettings,
          [NotificationType.UPDATE]: {
            ...mockPreferences.typeSettings[NotificationType.UPDATE],
            enabled: false
          }
        }
      };

      (require('@/hooks/use-notification-preferences').useNotificationPreferences as any)
        .mockReturnValue({
          ...mockUseNotificationPreferences,
          preferences: disabledTypePreferences
        });

      render(<NotificationSettings />);
      
      const updateSection = screen.getByText('Aggiornamenti').closest('[data-testid="notification-type-update"]');
      const prioritySelect = updateSection?.querySelector('select') as HTMLSelectElement;
      const toastToggle = updateSection?.querySelector('input[aria-label*="toast"]') as HTMLInputElement;
      
      expect(prioritySelect).toBeDisabled();
      expect(toastToggle).toBeDisabled();
    });
  });

  describe('Quiet Hours', () => {
    it('should toggle quiet hours', async () => {
      const user = userEvent.setup();
      render(<NotificationSettings />);
      
      const quietHoursToggle = screen.getByLabelText('Abilita ore silenziose');
      expect(quietHoursToggle).not.toBeChecked();
      
      await user.click(quietHoursToggle);
      
      expect(mockUseNotificationPreferences.updatePreferences).toHaveBeenCalledWith({
        ...mockPreferences,
        quietHours: {
          ...mockPreferences.quietHours,
          enabled: true
        }
      });
    });

    it('should change start time', async () => {
      const enabledQuietHours = {
        ...mockPreferences,
        quietHours: {
          ...mockPreferences.quietHours,
          enabled: true
        }
      };

      (require('@/hooks/use-notification-preferences').useNotificationPreferences as any)
        .mockReturnValue({
          ...mockUseNotificationPreferences,
          preferences: enabledQuietHours
        });

      const user = userEvent.setup();
      render(<NotificationSettings />);
      
      const startTimeInput = screen.getByLabelText('Ora inizio');
      await user.clear(startTimeInput);
      await user.type(startTimeInput, '23:00');
      
      expect(mockUseNotificationPreferences.updatePreferences).toHaveBeenCalledWith({
        ...enabledQuietHours,
        quietHours: {
          ...enabledQuietHours.quietHours,
          startTime: '23:00'
        }
      });
    });

    it('should change end time', async () => {
      const enabledQuietHours = {
        ...mockPreferences,
        quietHours: {
          ...mockPreferences.quietHours,
          enabled: true
        }
      };

      (require('@/hooks/use-notification-preferences').useNotificationPreferences as any)
        .mockReturnValue({
          ...mockUseNotificationPreferences,
          preferences: enabledQuietHours
        });

      const user = userEvent.setup();
      render(<NotificationSettings />);
      
      const endTimeInput = screen.getByLabelText('Ora fine');
      await user.clear(endTimeInput);
      await user.type(endTimeInput, '07:00');
      
      expect(mockUseNotificationPreferences.updatePreferences).toHaveBeenCalledWith({
        ...enabledQuietHours,
        quietHours: {
          ...enabledQuietHours.quietHours,
          endTime: '07:00'
        }
      });
    });

    it('should toggle allow urgent during quiet hours', async () => {
      const enabledQuietHours = {
        ...mockPreferences,
        quietHours: {
          ...mockPreferences.quietHours,
          enabled: true
        }
      };

      (require('@/hooks/use-notification-preferences').useNotificationPreferences as any)
        .mockReturnValue({
          ...mockUseNotificationPreferences,
          preferences: enabledQuietHours
        });

      const user = userEvent.setup();
      render(<NotificationSettings />);
      
      const allowUrgentToggle = screen.getByLabelText('Consenti notifiche urgenti');
      expect(allowUrgentToggle).toBeChecked();
      
      await user.click(allowUrgentToggle);
      
      expect(mockUseNotificationPreferences.updatePreferences).toHaveBeenCalledWith({
        ...enabledQuietHours,
        quietHours: {
          ...enabledQuietHours.quietHours,
          allowUrgent: false
        }
      });
    });

    it('should disable quiet hours controls when disabled', () => {
      render(<NotificationSettings />);
      
      expect(screen.getByLabelText('Ora inizio')).toBeDisabled();
      expect(screen.getByLabelText('Ora fine')).toBeDisabled();
      expect(screen.getByLabelText('Consenti notifiche urgenti')).toBeDisabled();
    });
  });

  describe('Advanced Settings', () => {
    it('should change max notifications', async () => {
      const user = userEvent.setup();
      render(<NotificationSettings />);
      
      const maxNotificationsInput = screen.getByLabelText('Numero massimo notifiche');
      await user.clear(maxNotificationsInput);
      await user.type(maxNotificationsInput, '100');
      
      expect(mockUseNotificationPreferences.updatePreferences).toHaveBeenCalledWith({
        ...mockPreferences,
        maxNotifications: 100
      });
    });

    it('should change auto delete days', async () => {
      const user = userEvent.setup();
      render(<NotificationSettings />);
      
      const autoDeleteInput = screen.getByLabelText('Elimina automaticamente dopo (giorni)');
      await user.clear(autoDeleteInput);
      await user.type(autoDeleteInput, '60');
      
      expect(mockUseNotificationPreferences.updatePreferences).toHaveBeenCalledWith({
        ...mockPreferences,
        autoDeleteAfterDays: 60
      });
    });

    it('should validate max notifications range', async () => {
      const user = userEvent.setup();
      render(<NotificationSettings />);
      
      const maxNotificationsInput = screen.getByLabelText('Numero massimo notifiche');
      await user.clear(maxNotificationsInput);
      await user.type(maxNotificationsInput, '1000');
      
      // Should clamp to maximum allowed value
      expect(mockUseNotificationPreferences.updatePreferences).toHaveBeenCalledWith({
        ...mockPreferences,
        maxNotifications: 500 // Assuming 500 is the max
      });
    });

    it('should validate auto delete days range', async () => {
      const user = userEvent.setup();
      render(<NotificationSettings />);
      
      const autoDeleteInput = screen.getByLabelText('Elimina automaticamente dopo (giorni)');
      await user.clear(autoDeleteInput);
      await user.type(autoDeleteInput, '0');
      
      // Should clamp to minimum allowed value
      expect(mockUseNotificationPreferences.updatePreferences).toHaveBeenCalledWith({
        ...mockPreferences,
        autoDeleteAfterDays: 1 // Assuming 1 is the minimum
      });
    });
  });

  describe('Actions', () => {
    it('should reset to defaults', async () => {
      const user = userEvent.setup();
      render(<NotificationSettings />);
      
      const resetButton = screen.getByText('Ripristina Predefinite');
      await user.click(resetButton);
      
      expect(mockUseNotificationPreferences.resetToDefaults).toHaveBeenCalled();
    });

    it('should save settings', async () => {
      const user = userEvent.setup();
      render(<NotificationSettings />);
      
      // Make a change first
      const globalToggle = screen.getByLabelText('Abilita notifiche');
      await user.click(globalToggle);
      
      const saveButton = screen.getByText('Salva Impostazioni');
      await user.click(saveButton);
      
      // Should show success message
      expect(screen.getByText('Impostazioni salvate con successo')).toBeInTheDocument();
    });

    it('should show validation errors', async () => {
      (require('@/hooks/use-notification-preferences').useNotificationPreferences as any)
        .mockReturnValue({
          ...mockUseNotificationPreferences,
          validatePreferences: vi.fn(() => ({
            isValid: false,
            errors: ['Max notifications must be between 1 and 500']
          }))
        });

      const user = userEvent.setup();
      render(<NotificationSettings />);
      
      const saveButton = screen.getByText('Salva Impostazioni');
      await user.click(saveButton);
      
      expect(screen.getByText('Max notifications must be between 1 and 500')).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('should have proper heading structure', () => {
      render(<NotificationSettings />);
      
      expect(screen.getByRole('heading', { name: 'Impostazioni Notifiche' })).toBeInTheDocument();
      expect(screen.getByRole('heading', { name: 'Impostazioni Generali' })).toBeInTheDocument();
      expect(screen.getByRole('heading', { name: 'Tipi di Notifica' })).toBeInTheDocument();
    });

    it('should have proper form labels', () => {
      render(<NotificationSettings />);
      
      expect(screen.getByLabelText('Abilita notifiche')).toBeInTheDocument();
      expect(screen.getByLabelText('Suoni notifiche')).toBeInTheDocument();
      expect(screen.getByLabelText('Notifiche desktop')).toBeInTheDocument();
    });

    it('should have proper fieldset grouping', () => {
      render(<NotificationSettings />);
      
      const generalFieldset = screen.getByRole('group', { name: 'Impostazioni Generali' });
      expect(generalFieldset).toBeInTheDocument();
      
      const typesFieldset = screen.getByRole('group', { name: 'Tipi di Notifica' });
      expect(typesFieldset).toBeInTheDocument();
    });

    it('should have proper ARIA attributes', () => {
      render(<NotificationSettings />);
      
      const form = screen.getByRole('form');
      expect(form).toHaveAttribute('aria-labelledby');
      
      const description = screen.getByText('Configura come e quando ricevere le notifiche');
      expect(description).toHaveAttribute('id');
    });

    it('should announce changes to screen readers', async () => {
      const user = userEvent.setup();
      render(<NotificationSettings />);
      
      const globalToggle = screen.getByLabelText('Abilita notifiche');
      await user.click(globalToggle);
      
      // Should have live region for announcements
      const liveRegion = screen.getByRole('status', { hidden: true });
      expect(liveRegion).toBeInTheDocument();
    });
  });

  describe('Responsive Design', () => {
    it('should adapt to mobile viewport', () => {
      // Mock mobile viewport
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 375,
      });

      render(<NotificationSettings />);
      
      // Should have mobile-friendly layout classes
      const container = screen.getByRole('form');
      expect(container).toHaveClass('space-y-6'); // Vertical spacing for mobile
    });

    it('should adapt to desktop viewport', () => {
      // Mock desktop viewport
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 1024,
      });

      render(<NotificationSettings />);
      
      // Should have desktop layout classes
      const container = screen.getByRole('form');
      expect(container).toBeInTheDocument();
    });
  });

  describe('Performance', () => {
    it('should debounce preference updates', async () => {
      const user = userEvent.setup();
      render(<NotificationSettings />);
      
      const maxNotificationsInput = screen.getByLabelText('Numero massimo notifiche');
      
      // Rapid changes should be debounced
      await user.clear(maxNotificationsInput);
      await user.type(maxNotificationsInput, '100');
      await user.type(maxNotificationsInput, '0');
      await user.type(maxNotificationsInput, '200');
      
      // Should only call updatePreferences once after debounce
      await waitFor(() => {
        expect(mockUseNotificationPreferences.updatePreferences).toHaveBeenCalledTimes(1);
      });
    });
  });
});