import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';

const push = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push }),
}));
vi.mock('next-themes', () => ({
  useTheme: () => ({ setTheme: vi.fn(), theme: 'dark' }),
}));
vi.mock('@/lib/i18n', () => ({
  useTranslation: () => ({ t: (k: string) => k, language: 'en', setLanguage: () => {} }),
}));

import { CommandPalette } from '@/components/ui/command-palette';

const openWithCtrlK = () => {
  act(() => {
    fireEvent.keyDown(window, { key: 'k', ctrlKey: true });
  });
};

const paletteInput = () => screen.getByPlaceholderText('commandPalette.placeholder');

describe('CommandPalette (Ctrl+K)', () => {
  beforeAll(() => {
    // jsdom non implementa scrollIntoView, che cmdk chiama sull'elemento selezionato
    Element.prototype.scrollIntoView = vi.fn();
  });
  beforeEach(() => push.mockClear());

  it('Ctrl+K apre un solo dialog', () => {
    render(<CommandPalette />);
    expect(screen.queryByRole('dialog')).toBeNull();
    openWithCtrlK();
    expect(screen.getAllByRole('dialog')).toHaveLength(1);
  });

  it('Invio esegue la voce filtrata, non la Dashboard', () => {
    render(<CommandPalette />);
    openWithCtrlK();
    fireEvent.change(paletteInput(), { target: { value: 'fixer' } });
    fireEvent.keyDown(paletteInput(), { key: 'Enter' });
    expect(push).toHaveBeenCalledTimes(1);
    expect(push).toHaveBeenCalledWith('/fixer');
  });

  it('le frecce spostano la selezione e Invio esegue quella', () => {
    render(<CommandPalette />);
    openWithCtrlK();
    fireEvent.keyDown(paletteInput(), { key: 'ArrowDown' });
    fireEvent.keyDown(paletteInput(), { key: 'Enter' });
    expect(push).toHaveBeenCalledTimes(1);
    expect(push).toHaveBeenCalledWith('/library');
  });

  it('Invio fuori dalla palette non esegue nulla', () => {
    render(
      <>
        <input aria-label="other" />
        <CommandPalette />
      </>,
    );
    fireEvent.keyDown(screen.getByLabelText('other'), { key: 'Enter' });
    expect(push).not.toHaveBeenCalled();
  });

  it('le pagine batch non compaiono finché non funzionano', () => {
    render(<CommandPalette />);
    openWithCtrlK();
    fireEvent.change(paletteInput(), { target: { value: 'batch' } });
    expect(screen.getByText(/commandPalette\.noResults/)).toBeInTheDocument();
    fireEvent.keyDown(paletteInput(), { key: 'Enter' });
    expect(push).not.toHaveBeenCalled();
  });

  it('le azioni senza ascoltatore (scan-games, show-shortcuts) non compaiono', () => {
    render(<CommandPalette />);
    openWithCtrlK();
    expect(screen.queryByText('commandPalette.scanGames')).toBeNull();
    expect(screen.queryByText('commandPalette.shortcuts')).toBeNull();
    expect(screen.queryByText('commandPalette.actions')).toBeNull();
  });
});
