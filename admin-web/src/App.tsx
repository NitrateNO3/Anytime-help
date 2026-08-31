import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Staff from './pages/Staff';
import Announcements from './pages/Announcements';
import AdminLayout from './layouts/AdminLayout';
import Banners from './pages/Banners';
import Residents from './pages/Residents';
import PaidServices from './pages/PaidServices';
import PaidStaff from './pages/PaidStaff';
import ServiceBookings from './pages/ServiceBookings';

function App() {
  return (
    <>
      <Toaster position="top-center" />
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          
          <Route path="/" element={<AdminLayout />}>
            <Route index element={<Navigate to="/dashboard" replace />} />
            <Route path="dashboard" element={<Dashboard />} />
            <Route path="staff" element={<Staff />} />
            <Route path="residents" element={<Residents />} />
            <Route path="announcements" element={<Announcements />} />
            <Route path="banners" element={<Banners />} />
            <Route path="paid-services" element={<PaidServices />} />
            <Route path="paid-staff" element={<PaidStaff />} />
            <Route path="service-bookings" element={<ServiceBookings />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </>
  );
}

export default App;
