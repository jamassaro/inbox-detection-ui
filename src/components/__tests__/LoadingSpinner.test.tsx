import { cleanup, render, screen } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import { afterEach, describe, expect, it } from 'vitest';
import i18n from '../../i18n';
import LoadingSpinner from '../LoadingSpinner';

afterEach(cleanup);

describe('LoadingSpinner', () => {
  it('renders all three sizes with the expected classes', () => {
    render(
      <I18nextProvider i18n={i18n}>
        <LoadingSpinner size="sm" />
        <LoadingSpinner size="md" />
        <LoadingSpinner size="lg" />
      </I18nextProvider>,
    );

    const spinners = screen.getAllByRole('status');
    expect(spinners).toHaveLength(3);
    expect(spinners[0].className).toContain('h-4 w-4');
    expect(spinners[1].className).toContain('h-6 w-6');
    expect(spinners[2].className).toContain('h-8 w-8');
  });

  it('has a translated accessible label and a CSS animation', () => {
    render(
      <I18nextProvider i18n={i18n}>
        <LoadingSpinner />
      </I18nextProvider>,
    );

    const spinner = screen.getByRole('status');
    expect(spinner.getAttribute('aria-label')).toBe('Loading');
    expect(spinner.className).toContain('animate-spin');
  });

  it('labels itself in Spanish when the locale is es', async () => {
    await i18n.changeLanguage('es');
    render(
      <I18nextProvider i18n={i18n}>
        <LoadingSpinner />
      </I18nextProvider>,
    );

    expect(screen.getByRole('status').getAttribute('aria-label')).toBe('Cargando');
  });
});
