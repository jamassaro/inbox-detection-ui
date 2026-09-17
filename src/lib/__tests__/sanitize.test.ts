import { describe, expect, it } from 'vitest';
import { sanitizeEmailHtml } from '../sanitize';

describe('sanitizeEmailHtml', () => {
  it('strips script injection entirely', () => {
    expect(sanitizeEmailHtml('<script>alert(1)</script>')).not.toContain('<script');
    expect(sanitizeEmailHtml('<script>alert(1)</script>')).not.toContain('alert(1)');
  });

  it('strips img tags and their event handlers', () => {
    const out = sanitizeEmailHtml('<img src="x" onerror="alert(1)">');
    expect(out).not.toContain('<img');
    expect(out).not.toContain('onerror');
  });

  it('keeps simple formatting content intact', () => {
    expect(sanitizeEmailHtml('<p>Hello <b>world</b></p>')).toBe('<p>Hello <b>world</b></p>');
  });

  it('forces links to open safely in a new tab', () => {
    const out = sanitizeEmailHtml('<a href="https://example.com">link</a>');
    expect(out).toContain('target="_blank"');
    expect(out).toContain('rel="noopener noreferrer"');
    expect(out).toContain('href="https://example.com"');
  });

  it('strips javascript: URLs from links', () => {
    const out = sanitizeEmailHtml('<a href="javascript:alert(1)">click</a>');
    expect(out).not.toContain('javascript:');
  });

  it('removes event handlers from allowed tags', () => {
    const out = sanitizeEmailHtml('<p onclick="alert(1)">Hi</p>');
    expect(out).not.toContain('onclick');
    expect(out).toContain('<p>');
  });

  it('keeps safe link attributes ahead of attacker-supplied ones', () => {
    const out = sanitizeEmailHtml('<a href="https://example.com" rel="author" target="_self">link</a>');
    // First attribute wins in HTML parsing — ours are injected first.
    expect(out).toContain('rel="noopener noreferrer"');
    expect(out).toContain('target="_blank"');
  });
});
