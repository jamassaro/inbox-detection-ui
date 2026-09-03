import { useState } from 'react';
import { Search, Bookmark, AlertCircle } from 'lucide-react';
import StatCard from '../components/StatCard';
import FeaturedOfferCard from '../components/FeaturedOfferCard';
import OfferListItem from '../components/OfferListItem';
import { mockOffers } from '../data/mockOffers';
import type { FilterType } from '../types';

const OffersPage = () => {
  const [activeFilter, setActiveFilter] = useState<FilterType>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const featuredOffers = mockOffers.filter((offer) => offer.featured);
  const allOffers = mockOffers.filter((offer) => !offer.featured);

  const filters: { id: FilterType; label: string; icon?: any }[] = [
    { id: 'all', label: 'All' },
    { id: 'ending-soon', label: 'Ending Soon' },
    { id: 'new', label: 'New' },
    { id: 'saved', label: 'Saved', icon: Bookmark },
  ];

  return (
    <div className="flex-1 bg-white overflow-auto">
      <div className="max-w-5xl mx-auto px-8 py-8">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-semibold text-gray-900 mb-1">Your Offers</h1>
          <p className="text-gray-600">Offers found in your inbox that you might have missed.</p>
        </div>

        {/* Stats */}
        <div className="flex gap-12 mb-8">
          <StatCard value={18} label="Offers found" />
          <StatCard value={3} label="Ending soon" color="red" />
          <StatCard value={8} label="New this week" color="green" />
        </div>

        {/* Filters and Search */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex gap-2">
            {filters.map((filter) => {
              const Icon = filter.icon;
              return (
                <button
                  key={filter.id}
                  onClick={() => setActiveFilter(filter.id)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-1.5 ${
                    activeFilter === filter.id
                      ? 'bg-gray-900 text-white'
                      : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  {Icon && <Icon className="w-4 h-4" />}
                  {filter.label}
                </button>
              );
            })}
          </div>

          <div className="relative w-80">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search companies or offers"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent"
            />
          </div>
        </div>

        {/* Don't miss these section */}
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-4">
            <AlertCircle className="w-5 h-5 text-red-600" />
            <h2 className="text-lg font-semibold text-gray-900">Don't miss these</h2>
          </div>
          <div className="grid grid-cols-2 gap-4">
            {featuredOffers.map((offer) => (
              <FeaturedOfferCard key={offer.id} offer={offer} />
            ))}
          </div>
        </div>

        {/* All Offers section */}
        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-4">All Offers</h2>
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            {allOffers.map((offer, index) => (
              <div key={offer.id}>
                <OfferListItem offer={offer} />
                {index < allOffers.length - 1 && <div className="border-t border-gray-100" />}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default OffersPage;
