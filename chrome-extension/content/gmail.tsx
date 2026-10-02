import { mountExtension, unmountExtension } from './mount';

mountExtension();
window.addEventListener('pagehide', unmountExtension, { once: true });
