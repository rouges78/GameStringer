import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

const { invokeMock, toastMock } = vi.hoisted(() => ({
  invokeMock: vi.fn(),
  toastMock: { success: vi.fn(), error: vi.fn() },
}));

vi.mock('@/lib/tauri-wrapper', () => ({ safeInvoke: invokeMock }));
vi.mock('sonner', () => ({ toast: toastMock }));

import { SecurityDialog } from '@/components/profiles/security-dialog';

function renderDialog() {
  return render(
    <SecurityDialog open onOpenChange={() => {}} profileId="p1" profileName="Tester" />
  );
}

function submitPasswordChange(current: string, next: string) {
  fireEvent.change(screen.getByLabelText('securityDialogComp.currentPassword'), { target: { value: current } });
  fireEvent.change(screen.getByLabelText('securityDialogComp.newPassword'), { target: { value: next } });
  fireEvent.change(screen.getByLabelText('securityDialogComp.confirmPassword'), { target: { value: next } });
  fireEvent.click(screen.getByRole('button', { name: 'securityDialog.changePassword' }));
}

describe('SecurityDialog', () => {
  beforeEach(() => {
    invokeMock.mockReset();
    toastMock.success.mockReset();
    toastMock.error.mockReset();
  });

  it('changes the password through the backend and updates the remembered password', async () => {
    invokeMock.mockImplementation(async (cmd: string) => {
      if (cmd === 'change_profile_password') return { success: true, data: true };
      if (cmd === 'has_secure_key') return true;
      return null;
    });
    renderDialog();

    submitPasswordChange('old-pass', 'new-pass');

    await waitFor(() => expect(toastMock.success).toHaveBeenCalledWith('securityDialog.passwordChanged'));
    expect(invokeMock).toHaveBeenCalledWith('change_profile_password', {
      profileId: 'p1',
      oldPassword: 'old-pass',
      newPassword: 'new-pass',
    });
    expect(invokeMock).toHaveBeenCalledWith('set_secure_key', { name: 'PROFILE_PASSWORD_p1', value: 'new-pass' });
    expect(toastMock.error).not.toHaveBeenCalled();
    expect(localStorage.getItem('password_p1')).toBeNull();
  });

  it('reports a failure, not success, when the backend rejects the current password', async () => {
    invokeMock.mockImplementation(async (cmd: string) =>
      cmd === 'change_profile_password' ? { success: false, error: 'invalid' } : null
    );
    renderDialog();

    submitPasswordChange('wrong-pass', 'new-pass');

    await waitFor(() => expect(toastMock.error).toHaveBeenCalledWith('securityDialog.passwordChangeFailed'));
    expect(toastMock.success).not.toHaveBeenCalled();
    expect(invokeMock).not.toHaveBeenCalledWith('set_secure_key', expect.anything());
  });

  it('reports a failure when the backend call throws', async () => {
    invokeMock.mockRejectedValue(new Error('backend down'));
    renderDialog();

    submitPasswordChange('old-pass', 'new-pass');

    await waitFor(() => expect(toastMock.error).toHaveBeenCalledWith('securityDialog.passwordChangeFailed'));
    expect(toastMock.success).not.toHaveBeenCalled();
  });

  it('no longer offers the simulated 2FA, session and activity controls', () => {
    renderDialog();

    expect(screen.queryByText('2FA')).toBeNull();
    expect(screen.queryByText('securityDialog.disconnectAll')).toBeNull();
    expect(screen.queryByText('securityDialog.activityHistory')).toBeNull();
    expect(screen.queryByText('securityDialogComp.demoUsa123456')).toBeNull();
  });

  it('clears the base64 password and fake data left by the old dialog', () => {
    localStorage.setItem('password_p1', btoa('leaked'));
    localStorage.setItem('activity_p1', '[]');
    localStorage.setItem('security_p1', '{}');

    renderDialog();

    expect(localStorage.getItem('password_p1')).toBeNull();
    expect(localStorage.getItem('activity_p1')).toBeNull();
    expect(localStorage.getItem('security_p1')).toBeNull();
  });
});
