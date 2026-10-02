import { renderHook, act, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

const { invokeMock, toastMock } = vi.hoisted(() => ({
  invokeMock: vi.fn(),
  toastMock: { success: vi.fn(), error: vi.fn() },
}));

vi.mock('@/lib/tauri-api', () => ({ invoke: invokeMock }));
vi.mock('sonner', () => ({ toast: toastMock }));

import { useAutoBackup } from '@/hooks/use-auto-backup';

// Comandi di avvio dell'hook: config, lista backup e controllo del timer.
function baseInvoke(cmd: string) {
  if (cmd === 'load_autobackup_config') {
    return { enabled: false, intervalMinutes: 15, backupTranslationMemory: true, backupDictionaries: true, backupSettings: true, maxBackups: 20, lastBackup: null };
  }
  if (cmd === 'list_auto_backups') return [];
  if (cmd === 'should_run_auto_backup') return false;
  return undefined;
}

async function renderReady() {
  const hook = renderHook(() => useAutoBackup());
  await waitFor(() => expect(hook.result.current.loading).toBe(false));
  return hook;
}

describe('useAutoBackup toasts (sonner, not the unmounted radix store)', () => {
  beforeEach(() => {
    invokeMock.mockReset();
    toastMock.success.mockReset();
    toastMock.error.mockReset();
  });

  it('reports a failed backup result as an error, never as success', async () => {
    invokeMock.mockImplementation(async (cmd: string) =>
      cmd === 'run_auto_backup'
        ? { success: false, timestamp: '', filesBackedUp: [], totalSizeBytes: 0, error: 'disk full' }
        : baseInvoke(cmd)
    );
    const { result } = await renderReady();

    await act(async () => { await result.current.runBackup(); });

    expect(toastMock.error).toHaveBeenCalledWith('common.errorCreatingBackup', { description: 'disk full' });
    expect(toastMock.success).not.toHaveBeenCalled();
  });

  it('shows success with the file count when the backup succeeds', async () => {
    invokeMock.mockImplementation(async (cmd: string) =>
      cmd === 'run_auto_backup'
        ? { success: true, timestamp: '', filesBackedUp: ['a', 'b'], totalSizeBytes: 2048, error: null }
        : baseInvoke(cmd)
    );
    const { result } = await renderReady();

    await act(async () => { await result.current.runBackup(); });

    expect(toastMock.success).toHaveBeenCalledWith('💾 common.backupCreatedSuccessfully', { description: 'settings.backupDoneDesc' });
    expect(toastMock.error).not.toHaveBeenCalled();
  });

  it('reports a rejected restore as an error and rethrows', async () => {
    invokeMock.mockImplementation(async (cmd: string) => {
      if (cmd === 'restore_from_auto_backup') throw 'locked';
      return baseInvoke(cmd);
    });
    const { result } = await renderReady();

    await act(async () => {
      await expect(result.current.restoreBackup('C:/b.zip', 'all')).rejects.toBe('locked');
    });

    expect(toastMock.error).toHaveBeenCalledWith('settings.restoreFailed', { description: 'locked' });
    expect(toastMock.success).not.toHaveBeenCalled();
  });
});
