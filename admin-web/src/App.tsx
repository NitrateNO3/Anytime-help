import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import axios from 'axios';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Staff from './pages/Staff';
import Categories from './pages/Categories';
import Announcements from './pages/Announcements';
import AdminLayout from './layouts/AdminLayout';
import BannersHub from './pages/BannersHub';
import AreaStory from './pages/AreaStory';
import Residents from './pages/Residents';
import Directory from './pages/Directory';
import Officials from './pages/Officials';
import PartnerPromos from './pages/PartnerPromos';
import Maintenance from './pages/Maintenance';
import Members from './pages/Members';
import SubAdmins from './pages/SubAdmins';
import ChatGroups from './pages/ChatGroups';
import Communities from './pages/Communities';
import Areas from './pages/Areas';
import { areaHeaders } from './lib/area';
import { ConfirmHost } from './components/ConfirmDialog';

// Multi-area: a platform Super Admin's requests are scoped to the area picked
// in the sidebar switcher. Area admins are always scoped to their own area
// by the backend, so nothing is added for them.
// The login token only goes to our own API, never to another site
const OWN_API_HOSTS = new Set(['api.anytimehelp.co.in', 'localhost', '127.0.0.1']);
try { if (import.meta.env.VITE_API_URL) OWN_API_HOSTS.add(new URL(import.meta.env.VITE_API_URL).hostname); } catch { /* ignore */ }
const isOwnApi = (url?: string) => {
  try { return OWN_API_HOSTS.has(new URL(url || '', window.location.origin).hostname); } catch { return false; }
};

axios.interceptors.request.use((config) => {
  const headers = areaHeaders();
  for (const [k, v] of Object.entries(headers)) config.headers.set(k, v);
  // Send the admin login token on every request (banner and other admin
  // routes require it); a header set by the caller is left as is
  const token = localStorage.getItem('adminToken');
  if (token && isOwnApi(config.url) && !config.headers.has('x-auth-token')) config.headers.set('x-auth-token', token);
  return config;
});

// Global axios interceptor for 401 Unauthorized errors
axios.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      // Token is invalid or expired
      localStorage.removeItem('adminToken');
      localStorage.removeItem('adminUser');
      localStorage.removeItem('selectedAreaId');
      // Redirect to login if not already there
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

function IndexRedirect() {
  const adminUserStr = localStorage.getItem('adminUser');
  const user = adminUserStr ? JSON.parse(adminUserStr) : null;
  
  if (user?.isSuperAdmin && !localStorage.getItem('selectedAreaId')) return <Navigate to="/areas" replace />;
  if (user?.role === 'Admin') return <Navigate to="/dashboard" replace />;
  if (user?.role === 'SubAdmin') {
    const perms = user.permissions || [];
    if (perms.includes('Overview')) return <Navigate to="/dashboard" replace />;
    if (perms.includes('Residents')) return <Navigate to="/residents" replace />;
    if (perms.includes('Staff Team')) return <Navigate to="/staff" replace />;
    if (perms.includes('Committee Members')) return <Navigate to="/members" replace />;
    if (perms.includes('Announcements')) return <Navigate to="/announcements" replace />;
    if (perms.includes('Banners')) return <Navigate to="/banners" replace />;
    if (perms.includes('Staff Banner') || perms.includes('Staff Banners')) return <Navigate to="/banners?cat=top" replace />;
    if (perms.includes('Directory')) return <Navigate to="/directory" replace />;
    return <Navigate to="/residents" replace />;
  }
  return <Navigate to="/login" replace />;
}

function App() {
  return (
    <>
      <Toaster position="top-center" />
      <ConfirmHost />
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
            <Route path="banners" element={<BannersHub />} />
            <Route path="area-story" element={<AreaStory />} />
            <Route path="staff-banners" element={<Navigate to="/banners?cat=top" replace />} />
            <Route path="bottom-banners" element={<Navigate to="/banners?cat=bottom" replace />} />
            <Route path="directory" element={<Directory />} />
            <Route path="officials" element={<Officials />} />
            <Route path="partner-promos" element={<PartnerPromos />} />
            <Route path="maintenance" element={<Maintenance />} />
            <Route path="members" element={<Members />} />
            <Route path="chat-groups" element={<ChatGroups />} />
            <Route path="communities" element={<Communities />} />
            <Route path="community" element={<Navigate to="/communities" replace />} />
            <Route path="subadmins" element={<SubAdmins />} />
            <Route path="areas" element={<Areas />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </>
  );
}

export default App;
