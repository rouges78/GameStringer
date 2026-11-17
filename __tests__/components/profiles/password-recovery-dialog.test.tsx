import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

import { PasswordRecoveryDialog } from '@/components/profiles/password-recovery-dialog';

describe('PasswordRecoveryDialog', () => {
  it('explains that the password cannot be reset instead of simulating a reset', () => {
    const onOpenChange = vi.fn();
    render(<PasswordRecoveryDialog open onOpenChange={onOpenChange} profileName="Tester" />);

    expect(screen.getByText('profile.recoveryUnavailableTitle')).toBeInTheDocument();
    expect(screen.getByText('profile.passwordUnrecoverableDesc')).toBeInTheDocument();
    // No recovery-key input, no new-password form, no "password reset" success state
    expect(screen.queryByRole('textbox')).toBeNull();
    expect(document.querySelector('input[type="password"]')).toBeNull();
    expect(screen.queryByText('profile.passwordResetSuccess')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'common.close' }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
