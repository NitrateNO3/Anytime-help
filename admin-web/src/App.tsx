import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Staff from './pages/Staff';
import Announcements from './pages/Announcements';
import AdminLayout from './layouts/AdminLayout';
import Banners from './pages/Banners';

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
            <Route path="announcements" element={<Announcements />} />
            <Route path="banners" element={<Banners />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </>
  );
}

export default App;
