import { createPortal } from 'react-dom';
import { useCallback, useEffect, useRef, useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { I18nextProvider } from 'react-i18next';
import i18n from '../i18n';
import DetectiveButton from './DetectiveButton';
import DetectivePanel from './DetectivePanel';

const queryClient = new QueryClient();

interface ExtensionAppProps {
  /** Slot inside Gmail's top-right bar; null until found (floating launcher is used meanwhile). */
  launcherContainer: HTMLElement | null;
}

const ExtensionApp = ({ launcherContainer }: ExtensionAppProps) => {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  const close = useCallback(() => {
    setOpen(false);
    // Return focus to the launcher (inside the shadow root).
    const launcher = launcherContainer ?? wrapperRef.current;
    launcher?.querySelector<HTMLButtonElement>('button[aria-expanded]')?.focus();
  }, [launcherContainer]);

  // Escape is only listened for while the panel is open.
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    // Click outside: ignore clicks inside our own shadow hosts (retargeted to the host in composedPath).
    const onPointerDown = (e: PointerEvent) => {
      const hosts = [wrapperRef.current, launcherContainer].map((el) => {
        const root = el?.getRootNode();
        return root instanceof ShadowRoot ? root.host : el;
      });
      const path = e.composedPath();
      if (!hosts.some((h) => h && path.includes(h))) close();
    };
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('pointerdown', onPointerDown, true);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('pointerdown', onPointerDown, true);
    };
  }, [open, close, launcherContainer]);

  return (
    <I18nextProvider i18n={i18n}>
      <QueryClientProvider client={queryClient}>
        <div ref={wrapperRef}>
          {open && <DetectivePanel locale={i18n.language} onClose={close} />}
          {(() => {
            const button = (
              <DetectiveButton
                open={open}
                variant={launcherContainer ? 'toolbar' : 'floating'}
                onClick={() => (open ? close() : setOpen(true))}
              />
            );
            return launcherContainer ? createPortal(button, launcherContainer) : button;
          })()}
        </div>
      </QueryClientProvider>
    </I18nextProvider>
  );
};

export default ExtensionApp;
