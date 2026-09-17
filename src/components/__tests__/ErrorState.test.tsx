import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import { afterEach, describe, expect, it, vi } from 'vitest';
import i18n from '../../i18n';
import ErrorState from '../ErrorState';

const renderErrorState = (props: Parameters<typeof ErrorState>[0] = {}) =>
  render(
    <I18nextProvider i18n={i18n}>
      <ErrorState {...props} />
    </I18nextProvider>,
  );

afterEach(async () => {
  cleanup();
  await i18n.changeLanguage('en');
});

describe('ErrorState', () => {
  it('falls back to the translated errors.generic copy when no props are given', () => {
    renderErrorState();
    expect(
      screen.getByText('Something went wrong. Please try again.'),
    ).toBeTruthy();
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('renders custom title and description when provided', () => {
    renderErrorState({ title: 'Upload failed', description: 'Check your connection.' });
    expect(screen.getByText('Upload failed')).toBeTruthy();
    expect(screen.getByText('Check your connection.')).toBeTruthy();
  });

  it('shows a translated retry button when onRetry is provided and wires the callback', () => {
    const onRetry = vi.fn();
    renderErrorState({ onRetry });

    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('renders the Spanish defaults when the locale is es', async () => {
    await i18n.changeLanguage('es');
    renderErrorState({ onRetry: () => {} });

    expect(screen.getByText('Algo salió mal. Inténtalo de nuevo.')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Reintentar' })).toBeTruthy();
  });
});
