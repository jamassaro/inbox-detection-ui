import { Clock, Settings, User, BadgeCheck } from 'lucide-react';
import { mockOffers } from '../../src/data/mockOffers';
import type { Offer } from '../../src/types';

const URL_DASHBOARD = 'http://localhost:5173';

function Avatar({ initials }: { initials: string }) {
  return (
    <div className="w-9 h-9 bg-gray-100 text-gray-700 rounded-full flex items-center justify-center font-semibold text-xs shrink-0">
      {initials}
    </div>
  );
}

function DiscountBadge({ label }: { label: string }) {
  return (
    <span className="bg-green-100 text-green-700 text-xs font-semibold px-2.5 py-1 rounded-md whitespace-nowrap">
      {label}
    </span>
  );
}

function FeaturedCard({ offer }: { offer: Offer }) {
  const isEndingSoon = offer.status === 'ending-soon';
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2.5">
          <Avatar initials={offer.companyInitials} />
          <span className="font-semibold text-gray-900 text-sm">{offer.companyName}</span>
        </div>
        <DiscountBadge label={offer.discount} />
      </div>

      <p className="text-sm text-gray-600 mb-2">{offer.description}</p>

      <div className={`flex items-center gap-1.5 text-xs mb-3 ${isEndingSoon ? 'text-red-500' : 'text-gray-500'}`}>
        {isEndingSoon
          ? <Clock className="w-3.5 h-3.5" />
          : <BadgeCheck className="w-3.5 h-3.5" />}
        <span>{offer.statusText}</span>
      </div>

      <button className="w-full bg-gray-950 text-white py-2.5 rounded-lg text-sm font-medium hover:bg-gray-800 transition-colors">
        View offer
      </button>
    </div>
  );
}

function OtherOfferRow({ offer }: { offer: Offer }) {
  return (
    <div className="flex items-center justify-between py-2.5 border-b border-gray-100 last:border-0">
      <span className="text-sm text-gray-800">{offer.companyName}</span>
      <span className="text-sm font-semibold text-green-600">{offer.discount}</span>
    </div>
  );
}

function openDashboard() {
  chrome.tabs.create({ url: URL_DASHBOARD });
}

function PopupApp() {
  const featured = mockOffers.filter((o) => o.featured);
  const others = mockOffers.filter((o) => !o.featured);

  return (
    <div className="w-[380px] bg-white flex flex-col" style={{ minHeight: '600px' }}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-4 pb-3 border-b border-gray-100">
        <span className="font-bold text-gray-900 text-base">Inbox Detective</span>
        <div className="flex items-center gap-2 text-gray-400">
          <User className="w-5 h-5 cursor-pointer hover:text-gray-600" />
          <Settings className="w-5 h-5 cursor-pointer hover:text-gray-600" />
        </div>
      </div>

      {/* Status bar */}
      <div className="flex items-start justify-between px-4 py-3 border-b border-gray-100">
        <div>
          <p className="text-sm text-gray-600">Offers hiding in your inbox</p>
          <div className="flex items-center gap-1.5 mt-1">
            <span className="w-2 h-2 rounded-full bg-green-500 inline-block" />
            <span className="text-xs text-green-600 font-medium">Gmail connected</span>
          </div>
        </div>
        <div className="text-right">
          <span className="bg-indigo-100 text-indigo-700 text-xs font-semibold px-2.5 py-1 rounded-full">
            {mockOffers.length} new offers
          </span>
          <p className="text-xs text-red-500 mt-1 font-medium">
            {mockOffers.filter((o) => o.status === 'ending-soon').length} ending soon
          </p>
        </div>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto px-4 py-3">
        {/* Don't miss */}
        <h2 className="font-bold text-gray-900 text-base mb-3">Don't miss</h2>
        <div className="flex flex-col gap-3 mb-5">
          {featured.map((offer) => (
            <FeaturedCard key={offer.id} offer={offer} />
          ))}
        </div>

        {/* Other offers */}
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
          Other Offers
        </p>
        <div className="bg-white border border-gray-100 rounded-xl px-4 py-1">
          {others.map((offer) => (
            <OtherOfferRow key={offer.id} offer={offer} />
          ))}
        </div>
      </div>

      {/* Footer */}
      <div className="px-4 py-3 border-t border-gray-100">
        <button onClick={openDashboard} className="w-full border border-gray-200 text-gray-700 py-2.5 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors">
          View all offers
        </button>
        <p className="text-center text-xs text-gray-400 mt-2">Last checked 4 min ago</p>
      </div>
    </div>
  );
}

export default PopupApp;
