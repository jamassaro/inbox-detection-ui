import { useCallback, useEffect, useRef, useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { I18nextProvider } from 'react-i18next';
import i18n from '../i18n';
import DetectiveButton from './DetectiveButton';
import DetectivePanel from './DetectivePanel';

const queryClient = new QueryClient();

const ExtensionApp = () => {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  const close = useCallback(() => {
    setOpen(false);
    // Return focus to the launcher (inside the shadow root).
    wrapperRef.current?.querySelector<HTMLButtonElement>('button[aria-expanded]')?.focus();
  }, []);

  // Escape is only listened for while the panel is open.
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open, close]);

  return (
    <I18nextProvider i18n={i18n}>
      <QueryClientProvider client={queryClient}>
        <div ref={wrapperRef}>
          {open && <DetectivePanel locale={i18n.language} onClose={close} />}
          <DetectiveButton open={open} onClick={() => (open ? close() : setOpen(true))} />
        </div>
      </QueryClientProvider>
    </I18nextProvider>
  );
};

export default ExtensionApp;
