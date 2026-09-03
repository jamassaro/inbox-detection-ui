import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import OffersPage from './pages/OffersPage';
import CompaniesPage from './pages/CompaniesPage';
import SavedPage from './pages/SavedPage';

function App() {
  return (
    <BrowserRouter>
      <div className="flex h-screen bg-gray-50">
        <Sidebar />
        <Routes>
          <Route path="/" element={<Navigate to="/offers" replace />} />
          <Route path="/offers" element={<OffersPage />} />
          <Route path="/companies" element={<CompaniesPage />} />
          <Route path="/saved" element={<SavedPage />} />
          <Route path="/settings" element={<div className="flex-1 p-8">Settings page</div>} />
          <Route path="/help" element={<div className="flex-1 p-8">Help page</div>} />
        </Routes>
      </div>
    </BrowserRouter>
  );
}

export default App;

