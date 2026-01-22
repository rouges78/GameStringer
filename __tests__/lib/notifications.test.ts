import { describe, it, expect, vi, beforeEach } from 'vitest';
import { initNotifications, notify, notifications } from '@/lib/notifications';

describe('notifications', () => {
  let mockToast: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockToast = vi.fn();
    initNotifications(mockToast);
  });

  describe('initNotifications', () => {
    it('initializes the toast function', () => {
      notifications.success('Test');
      expect(mockToast).toHaveBeenCalled();
    });
  });

  describe('notify', () => {
    it('calls toast with success variant', () => {
      notify('success', 'Operation completed');
      
      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({
          variant: 'default',
        })
      );
    });

    it('calls toast with error variant', () => {
      notify('error', 'Something went wrong');
      
      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({
          variant: 'destructive',
        })
      );
    });

    it('uses custom options', () => {
      notify('info', 'Info message', {
        title: 'Custom Title',
        duration: 5000,
      });
      
      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Custom Title',
          duration: 5000,
        })
      );
    });
  });

  describe('convenience methods', () => {
    it('notifications.success works', () => {
      notifications.success('Saved!');
      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({
          title: '✓ Successo',
        })
      );
    });

    it('notifications.error works', () => {
      notifications.error('Failed!');
      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({
          title: '✕ Errore',
          variant: 'destructive',
        })
      );
    });

    it('notifications.warning works', () => {
      notifications.warning('Be careful!');
      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({
          title: '⚠ Attenzione',
        })
      );
    });

    it('notifications.info works', () => {
      notifications.info('FYI');
      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'ℹ Info',
        })
      );
    });
  });

  describe('notifications.promise', () => {
    it('shows success on resolved promise', async () => {
      const result = await notifications.promise(
        Promise.resolve('data'),
        {
          loading: 'Loading...',
          success: 'Done!',
          error: 'Failed',
        }
      );
      
      expect(result).toBe('data');
      expect(mockToast).toHaveBeenCalledTimes(2); // loading + success
    });

    it('shows error on rejected promise', async () => {
      await expect(
        notifications.promise(
          Promise.reject(new Error('Oops')),
          {
            loading: 'Loading...',
            success: 'Done!',
            error: 'Failed',
          }
        )
      ).rejects.toThrow('Oops');
      
      expect(mockToast).toHaveBeenCalledTimes(2); // loading + error
    });

    it('supports function messages', async () => {
      await notifications.promise(
        Promise.resolve({ count: 5 }),
        {
          loading: 'Loading...',
          success: (data) => `Loaded ${data.count} items`,
          error: (err) => `Error: ${err.message}`,
        }
      );
      
      expect(mockToast).toHaveBeenLastCalledWith(
        expect.objectContaining({
          description: 'Loaded 5 items',
        })
      );
    });
  });
});
