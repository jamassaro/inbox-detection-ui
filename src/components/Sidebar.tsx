import { Link, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Tag, Building2, Bookmark, Settings, Mail } from 'lucide-react';
import LanguageSelector from './LanguageSelector';

const Sidebar = () => {
  const { t } = useTranslation('common');
  const location = useLocation();

  const navItems = [
    { icon: Tag, label: t('nav.dashboard'), path: '/app/dashboard' },
    { icon: Building2, label: t('nav.discoveries'), path: '/app/discoveries' },
    { icon: Bookmark, label: t('nav.saved'), path: '/app/discoveries' },
  ];

  return (
    <div className="w-48 bg-gray-50 border-r border-gray-200 flex flex-col h-screen">
      {/* Logo/Header */}
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center gap-2 mb-1">
          <div className="w-8 h-8 bg-gray-800 rounded-lg flex items-center justify-center">
            <Mail className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="font-semibold text-sm">{t('app.name')}</h1>
          </div>
        </div>
        <p className="text-xs text-gray-500 ml-10">{t('nav.connected')}</p>
        <div className="ml-10 mt-2">
          <LanguageSelector />
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-2">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = location.pathname === item.path;
          return (
            <Link
              key={item.path}
              to={item.path}
              className={`flex items-center gap-3 px-3 py-2 rounded-lg mb-1 text-sm transition-colors ${
                isActive
                  ? 'bg-white text-gray-900 font-medium'
                  : 'text-gray-600 hover:bg-white hover:text-gray-900'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Scan Inbox Button */}
      <div className="p-2">
        <button className="w-full bg-gray-900 text-white py-2.5 px-4 rounded-lg text-sm font-medium hover:bg-gray-800 transition-colors">
          {t('actions.scanInbox')}
        </button>
      </div>

      {/* Bottom Navigation */}
      <div className="p-2 border-t border-gray-200">
        <Link
          to="/app/settings"
          className="flex items-center gap-3 px-3 py-2 rounded-lg mb-1 text-sm text-gray-600 hover:bg-white hover:text-gray-900 transition-colors"
        >
          <Settings className="w-4 h-4" />
          <span>{t('nav.settings')}</span>
        </Link>
      </div>
    </div>
  );
};

export default Sidebar;
