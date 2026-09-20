import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Staff from './pages/Staff';
import Categories from './pages/Categories';
import Announcements from './pages/Announcements';
import AdminLayout from './layouts/AdminLayout';
import Banners from './pages/Banners';
import Residents from './pages/Residents';
import PaidServices from './pages/PaidServices';
import PaidStaff from './pages/PaidStaff';
import ServiceBookings from './pages/ServiceBookings';
import Directory from './pages/Directory';
import Members from './pages/Members';
import SubAdmins from './pages/SubAdmins';

function IndexRedirect() {
  const adminUserStr = localStorage.getItem('adminUser');
  const user = adminUserStr ? JSON.parse(adminUserStr) : null;
  
  if (user?.role === 'Admin') return <Navigate to="/dashboard" replace />;
  if (user?.role === 'SubAdmin') {
    const perms = user.permissions || [];
    if (perms.includes('Residents')) return <Navigate to="/residents" replace />;
    if (perms.includes('Staff Team')) return <Navigate to="/staff" replace />;
    if (perms.includes('Committee Members')) return <Navigate to="/members" replace />;
    if (perms.includes('Announcements')) return <Navigate to="/announcements" replace />;
    if (perms.includes('Banners')) return <Navigate to="/banners" replace />;
    if (perms.includes('Directory')) return <Navigate to="/directory" replace />;
    return <Navigate to="/residents" replace />;
  }
  return <Navigate to="/login" replace />;
}

function App() {
  return (
    <>
      <Toaster position="top-center" />
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          
          <Route path="/" element={<AdminLayout />}>
            <Route index element={<IndexRedirect />} />
            <Route path="dashboard" element={<Dashboard />} />
            <Route path="staff" element={<Staff />} />
            <Route path="categories" element={<Categories />} />
            <Route path="residents" element={<Residents />} />
            <Route path="announcements" element={<Announcements />} />
            <Route path="banners" element={<Banners />} />
            <Route path="paid-services" element={<PaidServices />} />
            <Route path="paid-staff" element={<PaidStaff />} />
            <Route path="service-bookings" element={<ServiceBookings />} />
            <Route path="directory" element={<Directory />} />
            <Route path="members" element={<Members />} />
            <Route path="subadmins" element={<SubAdmins />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </>
  );
}

export default App;
