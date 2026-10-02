import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import ExtensionApp from '../components/ExtensionApp';
import css from '../styles/extension.css?inline';

export const ROOT_ID = 'inbox-detective-root';

let host: HTMLElement | null = null;
let observer: MutationObserver | null = null;
let toolbarObserver: MutationObserver | null = null;
let launcherHost: HTMLElement | null = null;
let root: Root | null = null;

/**
 * Gmail's top-right bar has no stable ids/classes, so anchor on the
 * language-independent links: the Google apps launcher (about/products) or the
 * account menu. Returns the bar item to insert before, or null if not rendered yet.
 */
function findToolbarAnchor(doc: Document): HTMLElement | null {
  const link =
    doc.querySelector<HTMLElement>('header a[href*="about/products"]') ??
    doc.querySelector<HTMLElement>('header a[href*="accounts.google.com/SignOutOptions"]');
  if (!link) return null;
  // Climb to the nearest horizontal flex row, so the launcher lines up with the
  // other icons instead of stacking above/below them in a column or block.
  let node: HTMLElement = link;
  while (node.parentElement && node.parentElement !== doc.body) {
    const parent = node.parentElement;
    const style = getComputedStyle(parent);
    if (style.display.includes('flex') && style.flexDirection.startsWith('row') && parent.children.length > 1) {
      return node;
    }
    node = parent;
  }
  return null;
}

function render(container: HTMLElement | null) {
  root?.render(<ExtensionApp launcherContainer={container} />);
}

function createLauncherHost(doc: Document): { host: HTMLElement; container: HTMLElement } {
  const el = doc.createElement('div');
  el.style.cssText = 'display:flex;align-items:center;align-self:center;flex:none;margin:0 4px;';
  const shadow = el.attachShadow({ mode: 'closed' });
  const style = doc.createElement('style');
  style.textContent = css;
  const container = doc.createElement('div');
  shadow.append(style, container);
  return { host: el, container };
}

/** Places the launcher in Gmail's top-right bar once it exists; keeps it there across Gmail re-renders. */
function watchToolbar(doc: Document) {
  const created = createLauncherHost(doc);
  launcherHost = created.host;
  let scheduled = false;

  const place = () => {
    scheduled = false;
    if (!launcherHost || launcherHost.isConnected) return;
    const anchor = findToolbarAnchor(doc);
    if (!anchor?.parentElement) {
      render(null); // fall back to the floating launcher
      return;
    }
    // After the apps grid (not before): other extensions such as Mailsuite anchor
    // to the item left of it, and removing their neighbour hides their icon.
    anchor.parentElement.insertBefore(launcherHost, anchor.nextSibling);
    render(created.container);
  };

  toolbarObserver = new MutationObserver(() => {
    if (scheduled || launcherHost?.isConnected) return;
    scheduled = true;
    requestAnimationFrame(place);
  });
  toolbarObserver.observe(doc.body, { childList: true, subtree: true });
  place();
}

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
  root = createRoot(container);
  render(null);

  const attach = () => {
    if (host && !host.isConnected) doc.documentElement.appendChild(host);
  };
  attach();

  // Direct children of <html> only (no subtree): cheap even on busy Gmail pages.
  observer = new MutationObserver(attach);
  observer.observe(doc.documentElement, { childList: true });
  watchToolbar(doc);

  return host;
}

export function unmountExtension(): void {
  observer?.disconnect();
  observer = null;
  toolbarObserver?.disconnect();
  toolbarObserver = null;
  launcherHost?.remove();
  launcherHost = null;
  root?.unmount();
  root = null;
  host?.remove();
  host = null;
}
