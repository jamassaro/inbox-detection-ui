import { createRoot } from 'react-dom/client';
import ExtensionApp from '../components/ExtensionApp';
import css from '../styles/extension.css?inline';

export const ROOT_ID = 'inbox-detective-root';

let host: HTMLElement | null = null;
let observer: MutationObserver | null = null;

/**
 * Mounts the extension UI once. Idempotent: a second call is a no-op, and if
 * Gmail removes the host element it is re-attached (the React tree is kept,
 * never remounted). The shadow root is closed so Gmail's scripts can't reach
 * into it, and Tailwind's CSS stays inside it.
 */
export function mountExtension(doc: Document = document): HTMLElement {
  if (host) return host;

  host = doc.createElement('div');
  host.id = ROOT_ID;
  const shadow = host.attachShadow({ mode: 'closed' });

  const style = doc.createElement('style');
  style.textContent = css;
  const container = doc.createElement('div');
  shadow.append(style, container);
  createRoot(container).render(<ExtensionApp />);

  const attach = () => {
    if (host && !host.isConnected) doc.documentElement.appendChild(host);
  };
  attach();

  // Direct children of <html> only (no subtree): cheap even on busy Gmail pages.
  observer = new MutationObserver(attach);
  observer.observe(doc.documentElement, { childList: true });

  return host;
}

export function unmountExtension(): void {
  observer?.disconnect();
  observer = null;
  host?.remove();
  host = null;
}
