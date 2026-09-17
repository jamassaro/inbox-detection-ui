import DOMPurify from 'dompurify';

// Intentionally restrictive allowlist — email evidence is attacker-controlled.
// No <script>, <style>, <iframe>, <form>, <input>, or <img> (FE-027 Agent Notes).
const ALLOWED_TAGS = [
  'p', 'br', 'b', 'i', 'em', 'strong', 'span', 'div',
  'ul', 'ol', 'li', 'a', 'blockquote',
];
const ALLOWED_ATTR = ['href', 'target', 'rel'];

export function sanitizeHtml(html: string): string {
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS,
    ALLOWED_ATTR,
    // Force external links to open safely
    FORCE_BODY: true,
  });
}

// Security Rule 1 (AGENTS.md): all email HTML must pass through this before
// any dangerouslySetInnerHTML.
export function sanitizeEmailHtml(html: string): string {
  const clean = sanitizeHtml(html);
  // Ensure all links are safe external links. These attributes come first,
  // so they win over any target/rel the original markup carried.
  return clean.replace(/<a /g, '<a target="_blank" rel="noopener noreferrer" ');
}
