import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import { afterEach, describe, expect, it, vi } from 'vitest';
import AgentActionPanel from '../AgentActionPanel';
import i18n from '../../i18n';

const renderPanel = (props: Parameters<typeof AgentActionPanel>[0]) =>
  render(
    <I18nextProvider i18n={i18n}>
      <AgentActionPanel {...props} />
    </I18nextProvider>,
  );

afterEach(async () => {
  cleanup();
  await i18n.changeLanguage('en');
});

describe('AgentActionPanel — idle', () => {
  it('renders nothing by default', () => {
    const { container } = renderPanel({ state: 'idle' });

    expect(container.childElementCount).toBe(0);
    expect(container.textContent).toBe('');
  });

  it('renders children when provided', () => {
    const { container } = renderPanel({ state: 'idle', children: <p>Nothing pending</p> });

    expect(container.textContent).toBe('Nothing pending');
  });
});

describe('AgentActionPanel — thinking', () => {
  it('renders an animated indicator and the translated label', () => {
    const { container } = renderPanel({ state: 'thinking' });

    expect(container.querySelector('[class*="motion-safe:animate-bounce"]')).toBeTruthy();
    expect(screen.getByText('Detective is thinking…')).toBeTruthy();
  });

  it('honors a custom thinkingLabel', () => {
    renderPanel({ state: 'thinking', thinkingLabel: 'Crunching your inbox' });

    expect(screen.getByText('Crunching your inbox')).toBeTruthy();
  });
});

describe('AgentActionPanel — proposing', () => {
  it('renders the proposal ReactNode', () => {
    renderPanel({
      state: 'proposing',
      proposal: <button data-proposal-selection="slot-230">Tuesday at 2:00 PM</button>,
    });

    expect(screen.getByText('The Detective has a suggestion')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Tuesday at 2:00 PM' })).toBeTruthy();
  });

  it('shows a fallback when no proposal is provided', () => {
    renderPanel({ state: 'proposing' });

    expect(screen.getByText('No suggestion to show')).toBeTruthy();
  });

  it('delegates clicks on data-proposal-selection items to onSelectProposal', () => {
    const onSelectProposal = vi.fn();
    renderPanel({
      state: 'proposing',
      onSelectProposal,
      proposal: (
        <ul>
          <li data-proposal-selection="slot-140">Tuesday at 1:00 PM</li>
          <li data-proposal-selection="slot-230">Tuesday at 2:00 PM</li>
        </ul>
      ),
    });

    fireEvent.click(screen.getByText('Tuesday at 2:00 PM'));

    expect(onSelectProposal).toHaveBeenCalledTimes(1);
    expect(onSelectProposal).toHaveBeenCalledWith('slot-230');
  });
});

describe('AgentActionPanel — approving', () => {
  it('renders the description with Confirm and Cancel buttons that fire callbacks', () => {
    const onApprove = vi.fn();
    const onCancel = vi.fn();
    renderPanel({ state: 'approving', approvalDescription: 'Create meeting Tuesday at 2:00 PM?', onApprove, onCancel });

    expect(screen.getByText('Create meeting Tuesday at 2:00 PM?')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Confirm' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Confirm' }));
    expect(onApprove).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('renders a standard confirm button at Level 2 (no red)', () => {
    renderPanel({ state: 'approving', approvalLevel: 2 });

    const confirm = screen.getByRole('button', { name: 'Confirm' });
    expect(confirm.className).toContain('bg-gray-900');
    expect(confirm.className).not.toContain('bg-red-600');
    expect(screen.queryByText(/sends information outside/i)).toBeNull();
  });

  it('renders an unmistakable red destructive card at Level 3', () => {
    renderPanel({ state: 'approving', approvalLevel: 3, approvalDescription: 'Send the draft email?' });

    const card = screen.getByTestId('agent-approval');
    const confirm = screen.getByRole('button', { name: 'Confirm' });

    expect(card.className).toContain('bg-red-50');
    expect(card.className).toContain('border-red-300');
    expect(confirm.className).toContain('bg-red-600');
    expect(confirm.className).toContain('font-bold');
    expect(confirm.className).not.toContain('bg-gray-900');
    expect(screen.getByText(/sends information outside/i)).toBeTruthy();
  });
});

describe('AgentActionPanel — executing / verifying', () => {
  it('renders an animated progress indicator and the translated label', () => {
    const { container } = renderPanel({ state: 'executing' });

    expect(container.querySelector('[class*="motion-safe:animate-spin"]')).toBeTruthy();
    expect(screen.getByText('Working on it…')).toBeTruthy();
  });

  it('honors a custom executingLabel', () => {
    renderPanel({ state: 'executing', executingLabel: 'Sending your email' });

    expect(screen.getByText('Sending your email')).toBeTruthy();
  });

  it('renders the verifying label', () => {
    renderPanel({ state: 'verifying' });

    expect(screen.getByText('Verifying the result…')).toBeTruthy();
  });
});

describe('AgentActionPanel — done / failed', () => {
  it('renders the resultSummary ReactNode', () => {
    renderPanel({ state: 'done', resultSummary: <p>Meeting created for Tuesday at 2:00 PM.</p> });

    expect(screen.getByText('Done')).toBeTruthy();
    expect(screen.getByText('Meeting created for Tuesday at 2:00 PM.')).toBeTruthy();
  });

  it('renders the error message and fires onRetry', () => {
    const onRetry = vi.fn();
    renderPanel({ state: 'failed', errorMessage: 'Calendar could not be reached.', onRetry });

    expect(screen.getByText('Calendar could not be reached.')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: /Try again/ }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('omits the retry button when no onRetry is provided', () => {
    renderPanel({ state: 'failed' });

    expect(screen.getByText('Something went wrong')).toBeTruthy();
    expect(screen.queryByRole('button')).toBeNull();
  });
});

describe('AgentActionPanel — labels', () => {
  it('renders ES defaults for every state label and button', async () => {
    await i18n.changeLanguage('es');

    const onApprove = vi.fn();
    renderPanel({ state: 'approving', onApprove });
    expect(screen.getByText('Confirma esta acción')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Confirmar' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Cancelar' })).toBeTruthy();

    cleanup();

    renderPanel({ state: 'thinking' });
    expect(screen.getByText('El Detective está pensando…')).toBeTruthy();

    cleanup();

    renderPanel({ state: 'executing' });
    expect(screen.getByText('Trabajando en ello…')).toBeTruthy();

    cleanup();

    renderPanel({ state: 'verifying' });
    expect(screen.getByText('Verificando el resultado…')).toBeTruthy();

    cleanup();

    renderPanel({ state: 'done' });
    expect(screen.getByText('Listo')).toBeTruthy();

    cleanup();

    renderPanel({ state: 'failed', onRetry: () => {} });
    expect(screen.getByText('Algo salió mal')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Intentar de nuevo' })).toBeTruthy();
  });
});
