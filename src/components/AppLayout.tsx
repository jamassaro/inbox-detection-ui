import { Outlet } from 'react-router-dom';
import ScanStatusWidget from './ScanStatusWidget';
import Sidebar from './Sidebar';

/** Shell for authenticated /app/* routes — owns the Sidebar; pages render in the Outlet. */
const AppLayout = () => (
  <div className="flex h-screen bg-gray-50">
    <Sidebar />
    <main className="flex-1 overflow-auto">
      <Outlet />
    </main>
    <ScanStatusWidget />
  </div>
);

export default AppLayout;
