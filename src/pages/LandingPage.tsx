import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Bell,
  Calendar,
  CalendarClock,
  Check,
  ChevronDown,
  CreditCard,
  Eye,
  Gift,
  Link2,
  MessageSquare,
  Search,
  Sparkles,
  Ticket,
  Zap,
} from 'lucide-react';
import LanguageSelector from '../components/LanguageSelector';
import { useAuth } from '../hooks/useAuth';
import { getInitials } from '../lib/discoveryHelpers';

/**
 * Public marketing landing page (FE-006). One file by ticket — every section
 * is a local sub-component below. All copy flows through the `public`
 * namespace; the only other namespace used is `billing` for frequency units
 * ("month" / "mes"), as the ticket directs.
 *
 * CTAs are navigation, not actions, so they render as anchors styled with the
 * design-system primary-button classes — ActionButton (FE-005) is a <button>,
 * and a button inside an anchor is invalid HTML. Unauthenticated CTAs point
 * at the backend's `GET /auth/google` redirect; FE-007 wires the full flow.
 */

const GOOGLE_AUTH_URL = '/auth/google';
const APP_DASHBOARD_URL = '/app/dashboard';

const CTA_SIZE_CLASSES = {
  sm: 'px-4 py-2 text-sm',
  md: 'px-5 py-2.5 text-base',
} as const;

interface PrimaryCtaProps {
  size?: keyof typeof CTA_SIZE_CLASSES;
  /** White-on-dark variant for the closing section. */
  inverse?: boolean;
  className?: string;
}

/**
 * The landing's single conversion action. Visitors get the auth entry point;
 * signed-in users get a link into the app — the landing never redirects
 * anyone away.
 */
const PrimaryCta = ({ size = 'md', inverse = false, className = '' }: PrimaryCtaProps) => {
  const { t } = useTranslation('public');
  const { isAuthenticated } = useAuth();

  const variant = inverse
    ? 'bg-white text-gray-900 hover:bg-gray-100 focus-visible:ring-white'
    : 'bg-gray-900 text-white hover:bg-gray-800 focus-visible:ring-gray-900';
  const classes = `inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 ${variant} ${CTA_SIZE_CLASSES[size]} ${className}`;

  if (isAuthenticated) {
    return (
      <Link to={APP_DASHBOARD_URL} className={classes}>
        {t('landing.nav.goToApp')}
      </Link>
    );
  }
  return (
    <a href={GOOGLE_AUTH_URL} className={classes}>
      {t('landing.cta')}
    </a>
  );
};

const SectionHeading = ({
  eyebrow,
  title,
  subtitle,
}: {
  eyebrow?: string;
  title: string;
  subtitle?: string;
}) => (
  <div className="mx-auto max-w-2xl text-center">
    {eyebrow ? (
      <p className="text-sm font-semibold uppercase tracking-wide text-gray-500">{eyebrow}</p>
    ) : null}
    <h2 className="mt-2 text-3xl font-bold tracking-tight text-gray-900 md:text-4xl">{title}</h2>
    {subtitle ? <p className="mt-4 text-lg text-gray-600">{subtitle}</p> : null}
  </div>
);

const NavSection = () => {
  const { t } = useTranslation('public');
  const { isAuthenticated } = useAuth();

  return (
    <header className="sticky top-0 z-10 border-b border-gray-200 bg-white">
      <nav className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
        <Link to="/" className="flex items-center gap-2 text-base font-semibold text-gray-900">
          <Search className="h-5 w-5" aria-hidden="true" />
          {t('landing.nav.brand')}
        </Link>
        <div className="flex items-center gap-2 sm:gap-4">
          <LanguageSelector />
          {isAuthenticated ? (
            <Link
              to={APP_DASHBOARD_URL}
              className="hidden text-sm font-medium text-gray-700 hover:text-gray-900 sm:inline"
            >
              {t('landing.nav.goToApp')}
            </Link>
          ) : (
            <a
              href={GOOGLE_AUTH_URL}
              className="hidden text-sm font-medium text-gray-700 hover:text-gray-900 sm:inline"
            >
              {t('landing.nav.signIn')}
            </a>
          )}
          <PrimaryCta size="sm" className="hidden md:inline-flex" />
        </div>
      </nav>
    </header>
  );
};

const HeroSection = () => {
  const { t } = useTranslation('public');

  return (
    <section className="bg-gradient-to-b from-gray-50 to-white">
      <div className="mx-auto max-w-6xl px-4 py-16 text-center sm:px-6 md:py-24">
        <h1 className="mx-auto max-w-3xl text-4xl font-bold tracking-tight text-gray-900 md:text-6xl">
          {t('landing.title')}
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-lg text-gray-600">{t('landing.subtitle')}</p>
        <div className="mt-8">
          <PrimaryCta />
        </div>
        <p className="mt-4 text-sm text-gray-500">{t('landing.trust')}</p>
      </div>
    </section>
  );
};

const PROBLEM_ITEMS = [
  { key: 'subscriptions', icon: Ticket },
  { key: 'prices', icon: CreditCard },
  { key: 'credits', icon: Gift },
  { key: 'meetings', icon: CalendarClock },
] as const;

const ProblemSection = () => {
  const { t } = useTranslation('public');

  return (
    <section className="bg-white">
      <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 md:py-20">
        <SectionHeading
          eyebrow={t('landing.problem.eyebrow')}
          title={t('landing.problem.title')}
          subtitle={t('landing.problem.subtitle')}
        />
        <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {PROBLEM_ITEMS.map(({ key, icon: Icon }) => (
            <div key={key} className="rounded-xl border border-gray-200 bg-white p-6">
              <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-gray-100">
                <Icon className="h-5 w-5 text-gray-900" aria-hidden="true" />
              </span>
              <h3 className="mt-4 text-base font-semibold text-gray-900">
                {t(`landing.problem.items.${key}.title`)}
              </h3>
              <p className="mt-2 text-sm text-gray-600">
                {t(`landing.problem.items.${key}.description`)}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

const DISCOVERY_EXAMPLES = [
  { key: 'example1', icon: CreditCard },
  { key: 'example2', icon: Gift },
  { key: 'example3', icon: Ticket },
] as const;

const DiscoveryExamplesSection = () => {
  const { t } = useTranslation('public');

  return (
    <section className="bg-gray-50">
      <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 md:py-20">
        <SectionHeading
          eyebrow={t('landing.discovery.eyebrow')}
          title={t('landing.discovery.title')}
          subtitle={t('landing.discovery.subtitle')}
        />
        <div className="mt-12 grid gap-6 md:grid-cols-3">
          {DISCOVERY_EXAMPLES.map(({ key, icon: Icon }) => {
            const company = t(`landing.discovery.${key}.company`);
            return (
              <article key={key} className="rounded-xl border border-gray-200 bg-white p-6">
                <div className="flex items-center gap-3">
                  <span
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gray-900 text-xs font-semibold text-white"
                    aria-hidden="true"
                  >
                    {getInitials(company)}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-gray-900">{company}</p>
                    <p className="text-xs text-gray-500">{t(`landing.discovery.${key}.badge`)}</p>
                  </div>
                  <Icon className="ml-auto h-4 w-4 text-gray-400" aria-hidden="true" />
                </div>
                <h3 className="mt-4 text-base font-semibold text-gray-900">
                  {t(`landing.discovery.${key}.title`)}
                </h3>
                <p className="mt-2 text-sm text-gray-600">{t(`landing.discovery.${key}.body`)}</p>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
};

const HOW_STEPS = [
  { key: 'connect', icon: Link2 },
  { key: 'investigate', icon: Search },
  { key: 'discover', icon: Sparkles },
  { key: 'act', icon: Zap },
] as const;

const HowItWorksSection = () => {
  const { t } = useTranslation('public');

  return (
    <section className="bg-white">
      <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 md:py-20">
        <SectionHeading eyebrow={t('landing.how.eyebrow')} title={t('landing.how.title')} />
        <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {HOW_STEPS.map(({ key, icon: Icon }, index) => (
            <div key={key} className="text-center sm:text-left">
              <div className="flex items-center justify-center gap-3 sm:justify-start">
                <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-gray-900 text-white">
                  <Icon className="h-5 w-5" aria-hidden="true" />
                </span>
                <span className="text-sm font-semibold text-gray-400">{index + 1}</span>
              </div>
              <h3 className="mt-4 text-base font-semibold text-gray-900">
                {t(`landing.how.steps.${key}.title`)}
              </h3>
              <p className="mt-2 text-sm text-gray-600">
                {t(`landing.how.steps.${key}.description`)}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

const FREE_FEATURES = ['f1', 'f2', 'f3', 'f4'] as const;

const FreeInvestigationSection = () => {
  const { t } = useTranslation('public');

  return (
    <section className="bg-gray-50">
      <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 md:py-20">
        <div className="grid items-center gap-10 lg:grid-cols-2">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-gray-500">
              {t('landing.free.eyebrow')}
            </p>
            <h2 className="mt-2 text-3xl font-bold tracking-tight text-gray-900 md:text-4xl">
              {t('landing.free.title')}
            </h2>
            <p className="mt-4 text-lg text-gray-600">{t('landing.free.subtitle')}</p>
            <div className="mt-6">
              <PrimaryCta />
            </div>
          </div>
          <ul className="divide-y divide-gray-200 rounded-xl border border-gray-200 bg-white">
            {FREE_FEATURES.map((feature) => (
              <li key={feature} className="flex items-start gap-3 p-4">
                <Check className="mt-0.5 h-5 w-5 shrink-0 text-green-600" aria-hidden="true" />
                <span className="text-sm text-gray-700">
                  {t(`landing.free.features.${feature}`)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
};

const AGENT_FEATURES = [
  { key: 'monitoring', icon: Eye },
  { key: 'reminders', icon: Bell },
  { key: 'calendar', icon: Calendar },
  { key: 'chat', icon: MessageSquare },
] as const;

const AgentCapabilitiesSection = () => {
  const { t } = useTranslation('public');

  return (
    <section className="bg-white">
      <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 md:py-20">
        <SectionHeading
          eyebrow={t('landing.agent.eyebrow')}
          title={t('landing.agent.title')}
          subtitle={t('landing.agent.subtitle')}
        />
        <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {AGENT_FEATURES.map(({ key, icon: Icon }) => (
            <div key={key} className="rounded-xl border border-gray-200 bg-white p-6">
              <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-gray-100">
                <Icon className="h-5 w-5 text-gray-900" aria-hidden="true" />
              </span>
              <h3 className="mt-4 text-base font-semibold text-gray-900">
                {t(`landing.agent.features.${key}.title`)}
              </h3>
              <p className="mt-2 text-sm text-gray-600">
                {t(`landing.agent.features.${key}.description`)}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

const COMPARE_ROWS = ['r1', 'r2', 'r3', 'r4', 'r5', 'r6'] as const;

const ComparisonSection = () => {
  const { t } = useTranslation('public');

  return (
    <section className="bg-gray-50">
      <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 md:py-20">
        <SectionHeading
          eyebrow={t('landing.compare.eyebrow')}
          title={t('landing.compare.title')}
          subtitle={t('landing.compare.subtitle')}
        />
        <div className="mx-auto mt-12 max-w-4xl overflow-x-auto rounded-xl border border-gray-200 bg-white">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-gray-200">
                <th scope="col" className="px-4 py-3 font-medium text-gray-500">
                  <span className="sr-only">{t('landing.compare.title')}</span>
                </th>
                <th scope="col" className="px-4 py-3 text-center font-semibold text-gray-900">
                  {t('landing.compare.colFree')}
                </th>
                <th scope="col" className="px-4 py-3 text-center font-semibold text-gray-900">
                  {t('landing.compare.colPro')}
                </th>
              </tr>
            </thead>
            <tbody>
              {COMPARE_ROWS.map((row) => (
                <tr key={row} className="border-b border-gray-100 last:border-0">
                  <th scope="row" className="px-4 py-3 font-medium text-gray-700">
                    {t(`landing.compare.rows.${row}.feature`)}
                  </th>
                  <td className="px-4 py-3 text-center text-gray-600">
                    {t(`landing.compare.rows.${row}.free`)}
                  </td>
                  <td className="px-4 py-3 text-center font-medium text-gray-900">
                    {t(`landing.compare.rows.${row}.pro`)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
};

const PricingSection = () => {
  const { t } = useTranslation('public');
  // Frequency units come from the billing namespace per the ticket ("month",
  // "mes"…); the amounts themselves are presentational marketing copy.
  const monthly = t('billing:frequency.monthly');
  const annual = t('billing:frequency.annual');
  const upgradeCta = t('billing:upgrade.cta');

  const upgradeLinkClasses =
    'inline-flex w-full items-center justify-center rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-900 focus-visible:ring-offset-2';

  const renderFeatures = (plan: 'free' | 'proMonthly' | 'proAnnual') => (
    <ul className="flex-1 space-y-3">
      {(['f1', 'f2', 'f3'] as const).map((feature) => (
        <li key={feature} className="flex items-start gap-3">
          <Check className="mt-0.5 h-5 w-5 shrink-0 text-green-600" aria-hidden="true" />
          <span className="text-sm text-gray-700">
            {t(`landing.pricing.${plan}.features.${feature}`)}
          </span>
        </li>
      ))}
    </ul>
  );

  return (
    <section className="bg-white">
      <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 md:py-20">
        <SectionHeading
          eyebrow={t('landing.pricing.eyebrow')}
          title={t('landing.pricing.title')}
          subtitle={t('landing.pricing.subtitle')}
        />
        <div className="mx-auto mt-12 grid max-w-5xl gap-6 md:grid-cols-3">
          <div className="flex flex-col rounded-xl border border-gray-200 bg-white p-6">
            <h3 className="text-base font-semibold text-gray-900">
              {t('landing.pricing.free.name')}
            </h3>
            <p className="mt-4 flex items-baseline gap-1">
              <span className="text-4xl font-bold text-gray-900">
                {t('landing.pricing.free.price')}
              </span>
              <span className="text-sm text-gray-500">/{t('landing.pricing.free.period')}</span>
            </p>
            {renderFeatures('free')}
            <div className="mt-6">
              <PrimaryCta size="sm" className="w-full" />
            </div>
          </div>

          <div className="flex flex-col rounded-xl border border-gray-900 bg-white p-6 ring-1 ring-gray-900">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-base font-semibold text-gray-900">
                {t('landing.pricing.proMonthly.name')}
              </h3>
              <span className="rounded-full bg-gray-900 px-2.5 py-0.5 text-xs font-medium text-white">
                {t('landing.pricing.proMonthly.badge')}
              </span>
            </div>
            <p className="mt-4 flex items-baseline gap-1">
              <span className="text-4xl font-bold text-gray-900">
                {t('landing.pricing.proMonthly.price')}
              </span>
              <span className="text-sm text-gray-500">/{monthly}</span>
            </p>
            {renderFeatures('proMonthly')}
            <div className="mt-6">
              <Link to="/upgrade" className={upgradeLinkClasses}>
                {upgradeCta}
              </Link>
            </div>
          </div>

          <div className="flex flex-col rounded-xl border border-gray-200 bg-white p-6">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-base font-semibold text-gray-900">
                {t('landing.pricing.proAnnual.name')}
              </h3>
              <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-700">
                {t('landing.pricing.proAnnual.badge')}
              </span>
            </div>
            <p className="mt-4 flex items-baseline gap-1">
              <span className="text-4xl font-bold text-gray-900">
                {t('landing.pricing.proAnnual.price')}
              </span>
              <span className="text-sm text-gray-500">/{annual}</span>
            </p>
            {renderFeatures('proAnnual')}
            <div className="mt-6">
              <Link to="/upgrade" className={upgradeLinkClasses}>
                {upgradeCta}
              </Link>
            </div>
          </div>
        </div>
        <p className="mx-auto mt-8 max-w-2xl text-center text-xs text-gray-500">
          {t('landing.pricing.note')}
        </p>
      </div>
    </section>
  );
};

const FAQ_ITEMS = ['q1', 'q2', 'q3', 'q4', 'q5', 'q6'] as const;

const FaqSection = () => {
  const { t } = useTranslation('public');

  return (
    <section className="bg-gray-50">
      <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 md:py-20">
        <SectionHeading eyebrow={t('landing.faq.eyebrow')} title={t('landing.faq.title')} />
        <div className="mx-auto mt-12 max-w-3xl space-y-3">
          {FAQ_ITEMS.map((item) => (
            <details key={item} className="group rounded-xl border border-gray-200 bg-white p-4">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-sm font-medium text-gray-900 [&::-webkit-details-marker]:hidden">
                {t(`landing.faq.items.${item}`)}
                <ChevronDown
                  className="h-4 w-4 shrink-0 text-gray-500 transition-transform group-open:rotate-180"
                  aria-hidden="true"
                />
              </summary>
              <p className="mt-3 text-sm text-gray-600">
                {t(`landing.faq.items.a${item.slice(1)}`)}
              </p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
};

const FinalCtaSection = () => {
  const { t } = useTranslation('public');

  return (
    <section className="bg-gray-900">
      <div className="mx-auto max-w-6xl px-4 py-16 text-center sm:px-6 md:py-20">
        <h2 className="text-3xl font-bold tracking-tight text-white md:text-4xl">
          {t('landing.finalCta.title')}
        </h2>
        <p className="mt-4 text-lg text-gray-300">{t('landing.finalCta.subtitle')}</p>
        <div className="mt-8">
          <PrimaryCta inverse />
        </div>
      </div>
    </section>
  );
};

const FooterSection = () => {
  const { t } = useTranslation('public');

  return (
    <footer className="border-t border-gray-200 bg-white">
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
          <p className="text-sm text-gray-500">{t('landing.footer.tagline')}</p>
          <div className="flex items-center gap-6">
            <Link to="/privacy" className="text-sm text-gray-600 hover:text-gray-900">
              {t('landing.footer.privacy')}
            </Link>
            <Link to="/terms" className="text-sm text-gray-600 hover:text-gray-900">
              {t('landing.footer.terms')}
            </Link>
          </div>
        </div>
        <p className="mt-6 text-center text-xs text-gray-400 sm:text-left">
          {t('landing.footer.copyright', { year: new Date().getFullYear() })}
        </p>
      </div>
    </footer>
  );
};

const LandingPage = () => (
  <div className="min-h-screen bg-white text-gray-900 antialiased">
    <NavSection />
    <main>
      <HeroSection />
      <ProblemSection />
      <DiscoveryExamplesSection />
      <HowItWorksSection />
      <FreeInvestigationSection />
      <AgentCapabilitiesSection />
      <ComparisonSection />
      <PricingSection />
      <FaqSection />
      <FinalCtaSection />
    </main>
    <FooterSection />
  </div>
);

export default LandingPage;
