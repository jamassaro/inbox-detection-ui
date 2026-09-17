import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

export interface LegalSection {
  heading: string;
  body: string;
}

interface LegalPageProps {
  title: string;
  lastUpdated: string;
  placeholderNotice: string;
  backLabel: string;
  sections: LegalSection[];
}

/**
 * Shared layout for the static legal documents (FE-026). Public pages render
 * this without any auth. Prose styling is hand-rolled — the repo does not
 * ship @tailwindcss/typography: a max-w-2xl column with leading-7 body text
 * keeps the content readable down to 375px.
 */
const LegalPage = ({
  title,
  lastUpdated,
  placeholderNotice,
  backLabel,
  sections,
}: LegalPageProps) => (
  <div className="min-h-screen bg-white text-gray-900 antialiased">
    <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6 sm:py-16">
      <Link
        to="/"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-gray-600 hover:text-gray-900"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        {backLabel}
      </Link>
      <article className="mt-6">
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">{title}</h1>
        <p className="mt-2 text-sm text-gray-500">{lastUpdated}</p>
        <p
          data-testid="placeholder-notice"
          className="mt-6 rounded-md border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-800"
        >
          {placeholderNotice}
        </p>
        <div className="mt-8 space-y-8">
          {sections.map(({ heading, body }) => (
            <section key={heading}>
              <h2 className="text-xl font-semibold tracking-tight">{heading}</h2>
              <p className="mt-3 leading-7 text-gray-700">{body}</p>
            </section>
          ))}
        </div>
      </article>
    </div>
  </div>
);

export default LegalPage;
