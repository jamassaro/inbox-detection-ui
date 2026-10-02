/** MV3 manifest, generated at build time so host permissions follow the web origin. */
export function buildManifest(webOrigin: string) {
  return {
    manifest_version: 3,
    name: 'Inbox Detective',
    version: '0.2.0',
    description: 'See what Inbox Detective discovered in your inbox, right inside Gmail.',
    icons: { '16': 'icons/icon-16.png', '48': 'icons/icon-48.png', '128': 'icons/icon-128.png' },
    // Session cookie is attached by the browser to service-worker requests to
    // this origin only; it is never readable from Gmail's page context.
    host_permissions: [`${webOrigin}/*`],
    background: { service_worker: 'background/service-worker.js' },
    content_scripts: [
      {
        matches: ['https://mail.google.com/*'],
        js: ['content/gmail.js'],
        run_at: 'document_idle',
      },
    ],
  };
}
