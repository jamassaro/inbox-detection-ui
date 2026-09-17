const SIDEBAR_WIDTH = '380px';
const SIDEBAR_ID = 'inbox-detective-sidebar';
const TOGGLE_ID = 'inbox-detective-toggle';

function injectSidebar() {
  if (document.getElementById(SIDEBAR_ID)) return;

  const sidebar = document.createElement('div');
  sidebar.id = SIDEBAR_ID;
  Object.assign(sidebar.style, {
    position: 'fixed',
    top: '0',
    right: '0',
    width: SIDEBAR_WIDTH,
    height: '100vh',
    zIndex: '2147483646',
    boxShadow: '-4px 0 24px rgba(0,0,0,0.12)',
    background: '#fff',
    display: 'none',
    borderLeft: '1px solid #e5e7eb',
  });

  const iframe = document.createElement('iframe');
  iframe.src = chrome.runtime.getURL('popup/index.html');
  iframe.style.cssText = 'width:100%;height:100%;border:none;';
  sidebar.appendChild(iframe);

  const toggle = document.createElement('button');
  toggle.id = TOGGLE_ID;
  toggle.title = 'Inbox Detective';
  toggle.textContent = '🔍';
  Object.assign(toggle.style, {
    position: 'fixed',
    bottom: '80px',
    right: '0',
    width: '36px',
    height: '36px',
    borderRadius: '8px 0 0 8px',
    background: '#111827',
    color: '#fff',
    border: 'none',
    cursor: 'pointer',
    zIndex: '2147483647',
    fontSize: '16px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '-2px 2px 8px rgba(0,0,0,0.2)',
    transition: 'right 0.2s ease',
  });

  toggle.addEventListener('click', () => {
    const isOpen = sidebar.style.display !== 'none';
    sidebar.style.display = isOpen ? 'none' : 'block';
    toggle.style.right = isOpen ? '0' : SIDEBAR_WIDTH;
  });

  document.body.appendChild(sidebar);
  document.body.appendChild(toggle);
}

// Wait for Gmail to finish loading
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', injectSidebar);
} else {
  injectSidebar();
}
