import { Link, useLocation } from 'react-router-dom';
import { Tag, Building2, Bookmark, Settings, HelpCircle, Mail } from 'lucide-react';

const Sidebar = () => {
  const location = useLocation();

  const navItems = [
    { icon: Tag, label: 'Offers', path: '/offers' },
    { icon: Building2, label: 'Companies', path: '/companies' },
    { icon: Bookmark, label: 'Saved', path: '/saved' },
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
            <h1 className="font-semibold text-sm">Inbox Detective</h1>
          </div>
        </div>
        <p className="text-xs text-gray-500 ml-10">Connected</p>
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
          Scan Inbox
        </button>
      </div>

      {/* Bottom Navigation */}
      <div className="p-2 border-t border-gray-200">
        <Link
          to="/settings"
          className="flex items-center gap-3 px-3 py-2 rounded-lg mb-1 text-sm text-gray-600 hover:bg-white hover:text-gray-900 transition-colors"
        >
          <Settings className="w-4 h-4" />
          <span>Settings</span>
        </Link>
        <Link
          to="/help"
          className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-gray-600 hover:bg-white hover:text-gray-900 transition-colors"
        >
          <HelpCircle className="w-4 h-4" />
          <span>Help</span>
        </Link>
      </div>
    </div>
  );
};

export default Sidebar;
