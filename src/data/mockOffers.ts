import type { Discovery, Offer } from '../types';

export const mockOffers: Offer[] = [
  {
    id: '1',
    companyName: 'CPAP.com',
    companyInitials: 'CP',
    discount: '38% OFF',
    description: 'Save 38% on all premium sleep therapy equipment. Code automatically applied at checkout.',
    status: 'ending-soon',
    statusText: 'Ends Tomorrow',
    date: 'Today',
    featured: true,
    code: 'SLEEP38'
  },
  {
    id: '2',
    companyName: 'Uber Eats',
    companyInitials: 'UE',
    discount: '50% OFF',
    description: 'Get 50% off your next 3 orders (up to $15 per order) when you order this weekend.',
    status: 'new',
    statusText: 'New Offer',
    date: 'Today',
    featured: true,
    code: 'WEEKEND50'
  },
  {
    id: '3',
    companyName: 'BetterMe',
    companyInitials: 'BM',
    discount: '80% OFF',
    description: 'Restart offer',
    status: 'restart',
    date: 'Today'
  },
  {
    id: '4',
    companyName: 'PUMA',
    companyInitials: 'PU',
    discount: '50% OFF',
    description: 'Selected items',
    date: 'Yesterday'
  },
  {
    id: '5',
    companyName: 'Columbia',
    companyInitials: 'CO',
    discount: '50% OFF',
    description: 'Top-reviewed gear',
    date: 'Aug 18'
  },
];

/**
 * FE-012 development mocks. One representative Discovery per card shape:
 * amount+frequency, date+importance, price change, and a plain row. AI text
 * (title/summary) is authored copy here but is rendered as-is by the cards —
 * the cards never translate it.
 */
export const mockDiscoveries: Discovery[] = [
  {
    id: 'disc-1',
    type: 'subscription',
    title: 'Your Netflix Standard plan renews soon at $15.49/month',
    summary: 'Netflix will charge the card ending 4242 on the next billing date.',
    company: 'Netflix',
    companyInitials: 'NE',
    amount: 15.49,
    currency: 'USD',
    frequency: 'monthly',
    date: '2026-10-01',
    importance: 'high',
    status: 'new',
    locked: false,
    availableActions: ['review_subscription', 'remind', 'dismiss'],
    confidence: 0.97,
  },
  {
    id: 'disc-2',
    type: 'trial_expiration',
    title: 'Your Spotify Premium free trial ends in 3 days',
    summary: 'After October 12 Spotify will start charging $11.99 per month unless cancelled.',
    company: 'Spotify',
    companyInitials: 'SP',
    amount: 11.99,
    currency: 'USD',
    frequency: 'monthly',
    date: '2026-10-12',
    importance: 'high',
    status: 'new',
    locked: false,
    availableActions: ['remind', 'open_provider', 'dismiss'],
  },
  {
    id: 'disc-3',
    type: 'price_change',
    title: 'YouTube Premium is raising your price from $13.99 to $17.99',
    summary: 'Google notified subscribers of a $4.00 monthly increase effective November 1.',
    company: 'YouTube',
    companyInitials: 'YT',
    amount: 17.99,
    currency: 'USD',
    frequency: 'monthly',
    previousAmount: 13.99,
    date: '2026-11-01',
    importance: 'medium',
    status: 'new',
    locked: false,
    availableActions: ['investigate', 'dismiss'],
  },
  {
    id: 'disc-4',
    type: 'refund',
    title: 'Amazon issued a $23.40 refund for your cancelled order',
    summary: 'The refund was processed to the original payment method and takes 3-5 business days.',
    company: 'Amazon',
    companyInitials: 'AM',
    amount: 23.4,
    currency: 'USD',
    importance: 'medium',
    status: 'viewed',
    locked: false,
    availableActions: ['track_refund', 'ask_detective'],
  },
  {
    id: 'disc-5',
    type: 'meeting',
    title: 'Sarah Chen proposed Thursday 2pm for the vendor sync',
    summary: 'Reply or propose a new time directly from this discovery.',
    company: 'Acme Corp',
    companyInitials: 'AC',
    date: '2026-09-24',
    importance: 'high',
    status: 'new',
    locked: false,
    availableActions: ['find_time'],
  },
];
