import { Clock, Sparkles } from 'lucide-react';
import type { Offer } from '../types';

interface FeaturedOfferCardProps {
  offer: Offer;
}

const FeaturedOfferCard = ({ offer }: FeaturedOfferCardProps) => {
  const getStatusIcon = () => {
    if (offer.status === 'ending-soon') {
      return <Clock className="w-3 h-3" />;
    }
    if (offer.status === 'new') {
      return <Sparkles className="w-3 h-3" />;
    }
    return null;
  };

  const getStatusColor = () => {
    if (offer.status === 'ending-soon') return 'text-orange-600';
    if (offer.status === 'new') return 'text-green-600';
    return 'text-gray-600';
  };

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gray-900 text-white rounded-lg flex items-center justify-center font-semibold text-sm">
            {offer.companyInitials}
          </div>
          <div>
            <h3 className="font-semibold text-gray-900">{offer.companyName}</h3>
            {offer.statusText && (
              <div className={`flex items-center gap-1 text-xs mt-0.5 ${getStatusColor()}`}>
                {getStatusIcon()}
                <span>{offer.statusText}</span>
              </div>
            )}
          </div>
        </div>
        <span className="bg-green-100 text-green-700 text-xs font-semibold px-2.5 py-1 rounded-md">
          {offer.discount}
        </span>
      </div>

      <p className="text-sm text-gray-600 mb-4">{offer.description}</p>

      <button className="w-full bg-gray-900 text-white py-2.5 px-4 rounded-lg text-sm font-medium hover:bg-gray-800 transition-colors">
        Copy Code & Shop
      </button>
    </div>
  );
};

export default FeaturedOfferCard;
