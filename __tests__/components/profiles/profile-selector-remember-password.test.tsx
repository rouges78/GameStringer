import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';

const { invokeMock, profilesApi, secureStore } = vi.hoisted(() => {
  const secureStore = new Map<string, string>();
  return {
    secureStore,
    invokeMock: vi.fn(),
    profilesApi: {
      profiles: [
        {
          id: 'p1',
          name: 'Tester',
          created_at: '2026-01-01T00:00:00Z',
          last_accessed: '2026-01-01T00:00:00Z',
          is_locked: false,
          failed_attempts: 0,
        },
      ],
      currentProfile: null,
      isLoading: false,
      error: null,
      authenticateProfile: vi.fn(),
      deleteProfile: vi.fn(),
      getProfileAvatar: vi.fn(async () => null),
      updateProfileAvatar: vi.fn(),
    },
  };
});

vi.mock('@/lib/tauri-wrapper', () => ({ safeInvoke: invokeMock }));
vi.mock('@/hooks/use-profiles', () => ({ useProfiles: () => profilesApi }));
vi.mock('@/lib/version', () => ({ useVersion: () => ({ version: '0.0.0' }) }));
vi.mock('@/components/ui/alphabet-background', () => ({ AlphabetBackground: () => null }));
vi.mock('next/image', () => ({
  // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text
  default: (props: Record<string, unknown>) => <img {...(props as React.ImgHTMLAttributes<HTMLImageElement>)} />,
}));

import { ProfileSelector } from '@/components/profiles/profile-selector';

const KEY = 'PROFILE_PASSWORD_p1';

describe('ProfileSelector remember password', () => {
  beforeAll(() => {
    // framer-motion calls window.scrollTo, which jsdom does not implement
    Object.defineProperty(window, 'scrollTo', { value: vi.fn(), writable: true });
  });

  beforeEach(() => {
    secureStore.clear();
    invokeMock.mockReset();
    invokeMock.mockImplementation(async (cmd: string, args?: { name: string; value?: string }) => {
      switch (cmd) {
        case 'set_secure_key':
          secureStore.set(args!.name, args!.value!);
          return null;
        case 'get_secure_key':
          return secureStore.get(args!.name) ?? null;
        case 'has_secure_key':
          return secureStore.has(args!.name);
        case 'remove_secure_key':
          secureStore.delete(args!.name);
          return null;
        default:
          return null;
      }
    });
    profilesApi.authenticateProfile.mockReset();
  });

  it('moves a legacy base64 password out of localStorage into the encrypted store', async () => {
    localStorage.setItem('gs_pwd_p1', btoa('secret'));

    render(<ProfileSelector onCreateProfile={() => {}} />);

    await waitFor(() => expect(secureStore.get(KEY)).toBe('secret'));
    expect(localStorage.getItem('gs_pwd_p1')).toBeNull();
  });

  it('stores the password in the encrypted store, never in localStorage, on login with remember checked', async () => {
    profilesApi.authenticateProfile.mockResolvedValue(true);
    render(<ProfileSelector onCreateProfile={() => {}} />);

    fireEvent.click(screen.getByText('Tester'));
    fireEvent.change(screen.getByLabelText('profile.password'), { target: { value: 'secret' } });
    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.click(screen.getByRole('button', { name: /profile\.login/ }));

    await waitFor(() => expect(secureStore.get(KEY)).toBe('secret'));
    expect(profilesApi.authenticateProfile).toHaveBeenCalledWith('Tester', 'secret');
    expect(localStorage.getItem('gs_pwd_p1')).toBeNull();
  });

  it('prefills the remembered password from the encrypted store without letting it be revealed', async () => {
    secureStore.set(KEY, 'secret');
    render(<ProfileSelector onCreateProfile={() => {}} />);

    await waitFor(() => expect(invokeMock).toHaveBeenCalledWith('get_secure_key', { name: KEY }));
    fireEvent.click(screen.getByText('Tester'));

    const input = screen.getByLabelText('profile.password') as HTMLInputElement;
    await waitFor(() => expect(input.value).toBe('secret'));
    const revealButton = input.parentElement!.querySelector('button')!;
    expect(revealButton).toBeDisabled();

    fireEvent.change(input, { target: { value: 'typed' } });
    expect(revealButton).not.toBeDisabled();
  });

  it('forgets the remembered password after a failed login', async () => {
    secureStore.set(KEY, 'stale');
    profilesApi.authenticateProfile.mockResolvedValue(false);
    render(<ProfileSelector onCreateProfile={() => {}} />);

    fireEvent.click(screen.getByText('Tester'));
    await waitFor(() =>
      expect((screen.getByLabelText('profile.password') as HTMLInputElement).value).toBe('stale')
    );
    fireEvent.click(screen.getByRole('button', { name: /profile\.login/ }));

    await waitFor(() => expect(secureStore.has(KEY)).toBe(false));
  });

  it('removes the remembered password when the profile is deleted', async () => {
    secureStore.set(KEY, 'secret');
    profilesApi.deleteProfile.mockResolvedValue(true);
    render(<ProfileSelector onCreateProfile={() => {}} />);

    fireEvent.click(screen.getByText('Tester'));
    await waitFor(() =>
      expect((screen.getByLabelText('profile.password') as HTMLInputElement).value).toBe('secret')
    );
    fireEvent.click(screen.getByTitle('profile.deleteConfirm'));
    fireEvent.click(screen.getByRole('button', { name: 'profile.confirm' }));

    await waitFor(() => expect(secureStore.has(KEY)).toBe(false));
    expect(profilesApi.deleteProfile).toHaveBeenCalledWith('p1', 'secret');
  });
});
