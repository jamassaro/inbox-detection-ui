import type { Offer } from '../types';

interface OfferListItemProps {
  offer: Offer;
}

const OfferListItem = ({ offer }: OfferListItemProps) => {
  return (
    <div className="flex items-center justify-between py-4 px-5 hover:bg-gray-50 transition-colors cursor-pointer">
      <div className="flex items-center gap-4">
        <div className="w-10 h-10 bg-gray-900 text-white rounded-lg flex items-center justify-center font-semibold text-sm">
          {offer.companyInitials}
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h4 className="font-medium text-gray-900">{offer.companyName}</h4>
            <span className="bg-green-100 text-green-700 text-xs font-semibold px-2 py-0.5 rounded">
              {offer.discount}
            </span>
          </div>
          <p className="text-sm text-gray-500 mt-0.5">{offer.description}</p>
        </div>
      </div>
      <span className="text-sm text-gray-500">{offer.date}</span>
    </div>
  );
};

export default OfferListItem;
