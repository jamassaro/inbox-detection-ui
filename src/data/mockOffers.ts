import type { Offer } from '../types';

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
