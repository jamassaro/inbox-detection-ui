import type { TFunction } from 'i18next';
import type { LegalSection } from '../components/LegalPage';

export type LegalDoc = 'privacy' | 'terms';

// FE-026 fixes the section set and order for both legal documents.
const SECTION_KEYS = ['intro', 'collect', 'use', 'gmail', 'deletion', 'contact'] as const;

/** Maps the `legal.<doc>.sections.*` locale entries into ordered sections. */
export const legalSections = (t: TFunction, doc: LegalDoc): LegalSection[] =>
  SECTION_KEYS.map((key) => ({
    heading: t(`legal.${doc}.sections.${key}.heading`),
    body: t(`legal.${doc}.sections.${key}.body`),
  }));
