import { Outlet } from 'react-router-dom';
import DemoBanner from './DemoBanner';
import ScanStatusWidget from './ScanStatusWidget';
import Sidebar from './Sidebar';

/** Shell for authenticated /app/* routes — owns the Sidebar; pages render in the Outlet. */
const AppLayout = () => (
  <div className="flex h-screen flex-col bg-gray-50">
    <DemoBanner />
    <div className="flex min-h-0 flex-1">
      <Sidebar />
      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
      <ScanStatusWidget />
    </div>
  </div>
);

export default AppLayout;
