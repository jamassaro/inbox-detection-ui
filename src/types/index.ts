export interface Offer {
  id: string;
  companyName: string;
  companyInitials: string;
  discount: string;
  description: string;
  status?: 'ending-soon' | 'new' | 'restart';
  statusText?: string;
  date: string;
  featured?: boolean;
  code?: string;
}

export type FilterType = 'all' | 'ending-soon' | 'new' | 'saved';
