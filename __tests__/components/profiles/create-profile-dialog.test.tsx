import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

const { createProfile, setLanguage, generateRecoveryKey, saveRecoveryKeyHash } = vi.hoisted(() => ({
  createProfile: vi.fn(),
  setLanguage: vi.fn(),
  generateRecoveryKey: vi.fn(),
  saveRecoveryKeyHash: vi.fn(),
}));

vi.mock('@/lib/i18n', () => ({
  useTranslation: () => ({ t: (k: string) => k, language: 'en', setLanguage }),
}));
vi.mock('@/hooks/use-profiles', () => ({ useProfiles: () => ({ createProfile }) }));
// Guardia di regressione: la creazione del profilo non deve più generare né
// salvare una recovery key (non può sbloccare un profilo cifrato con la password).
vi.mock('@/lib/recovery-key', () => ({ generateRecoveryKey, saveRecoveryKeyHash }));

import { CreateProfileDialog } from '@/components/profiles/create-profile-dialog';
import { PasswordRecoveryDialog } from '@/components/profiles/password-recovery-dialog';

function fillAndSubmit() {
  fireEvent.change(screen.getByPlaceholderText('profile.namePlaceholder'), { target: { value: 'Tester' } });
  fireEvent.change(screen.getByPlaceholderText('profile.passwordMinChars'), { target: { value: 'secret123' } });
  fireEvent.change(screen.getByPlaceholderText('profile.repeatPassword'), { target: { value: 'secret123' } });
  fireEvent.click(screen.getByRole('button', { name: 'profile.createProfile' }));
}

describe('CreateProfileDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    createProfile.mockResolvedValue(true);
  });

  it('shows the password notice instead of a recovery key, then completes the flow', async () => {
    const onOpenChange = vi.fn();
    const onProfileCreated = vi.fn();
    render(<CreateProfileDialog open onOpenChange={onOpenChange} onProfileCreated={onProfileCreated} />);

    fillAndSubmit();

    const notice = await screen.findByRole('dialog', { name: 'profile.passwordNoticeTitle' });
    expect(within(notice).getByText('profile.passwordNoticeDesc')).toBeInTheDocument();
    expect(screen.queryByText('profile.recoveryKey')).toBeNull();
    expect(screen.queryByText('profile.savedKeyConfirm')).toBeNull();
    expect(generateRecoveryKey).not.toHaveBeenCalled();
    expect(saveRecoveryKeyHash).not.toHaveBeenCalled();
    expect(onProfileCreated).not.toHaveBeenCalled();

    fireEvent.click(within(notice).getByRole('button', { name: 'profile.passwordNoticeConfirm' }));

    expect(setLanguage).toHaveBeenCalledWith('en');
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(onProfileCreated).toHaveBeenCalledTimes(1);
    expect(onProfileCreated).toHaveBeenCalledWith('Tester');
  });

  it('still completes the flow when the notice is dismissed with its close button', async () => {
    const onProfileCreated = vi.fn();
    render(<CreateProfileDialog open onOpenChange={vi.fn()} onProfileCreated={onProfileCreated} />);

    fillAndSubmit();

    const notice = await screen.findByRole('dialog', { name: 'profile.passwordNoticeTitle' });
    // Il bottone di chiusura integrato di DialogContent
    const closeButtons = within(notice).getAllByRole('button').filter(b => b.getAttribute('aria-label'));
    fireEvent.click(closeButtons[0]);

    await waitFor(() => expect(onProfileCreated).toHaveBeenCalledTimes(1));
    expect(onProfileCreated).toHaveBeenCalledWith('Tester');
  });

  it('shows the error and no notice when creation fails', async () => {
    createProfile.mockResolvedValue(false);
    const onProfileCreated = vi.fn();
    render(<CreateProfileDialog open onOpenChange={vi.fn()} onProfileCreated={onProfileCreated} />);

    fillAndSubmit();

    expect(await screen.findByText('profile.errorCreatingProfile')).toBeInTheDocument();
    expect(screen.queryByText('profile.passwordNoticeTitle')).toBeNull();
    expect(onProfileCreated).not.toHaveBeenCalled();
  });
});

describe('PasswordRecoveryDialog', () => {
  it('does not refer to a recovery key the user may never have received', () => {
    render(<PasswordRecoveryDialog open onOpenChange={vi.fn()} profileName="Tester" />);

    expect(screen.getByText('profile.passwordUnrecoverableDesc')).toBeInTheDocument();
    expect(screen.queryByText('profile.recoveryUnavailableDesc')).toBeNull();
  });
});
