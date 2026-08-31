import { useEffect } from 'react';
import { Outlet, useNavigate, useLocation, Link } from 'react-router-dom';
import { LayoutDashboard, Users, LogOut, Megaphone, Image as ImageIcon, Home, Briefcase, Wrench, ClipboardList } from 'lucide-react';
import logoImg from '../assets/logo.png';

export default function AdminLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const adminUser = localStorage.getItem('adminUser');

  useEffect(() => {
    if (!adminUser) {
      navigate('/login');
    }
  }, [adminUser, navigate]);

  if (!adminUser) return null;

  const handleLogout = () => {
    localStorage.removeItem('adminToken');
    localStorage.removeItem('adminUser');
    navigate('/login');
  };

  return (
    <div className="app-container">
      {/* Sidebar */}
      <aside className="sidebar">
        <div className="sidebar-logo">
          <img src={logoImg} alt="Logo" style={{ width: 44, height: 44, objectFit: 'contain' }} />
          Anytime Help
        </div>

        <nav style={{ flex: 1 }}>
          <Link to="/dashboard" className={`nav-link ${location.pathname === '/dashboard' ? 'active' : ''}`}>
            <LayoutDashboard size={20} />
            Overview
          </Link>
          <Link to="/residents" className={`nav-link ${location.pathname === '/residents' ? 'active' : ''}`}>
            <Home size={20} />
            Residents
          </Link>
          <Link to="/staff" className={`nav-link ${location.pathname === '/staff' ? 'active' : ''}`}>
            <Users size={20} />
            Staff Team
          </Link>
          <Link to="/paid-services" className={`nav-link ${location.pathname === '/paid-services' ? 'active' : ''}`}>
            <Briefcase size={20} />
            Paid Services
          </Link>
          <Link to="/paid-staff" className={`nav-link ${location.pathname === '/paid-staff' ? 'active' : ''}`}>
            <Wrench size={20} />
            Paid Staff
          </Link>
          <Link to="/service-bookings" className={`nav-link ${location.pathname === '/service-bookings' ? 'active' : ''}`}>
            <ClipboardList size={20} />
            Service Bookings
          </Link>
          <Link to="/announcements" className={`nav-link ${location.pathname === '/announcements' ? 'active' : ''}`}>
            <Megaphone size={20} />
            Announcements
          </Link>
          <Link to="/banners" className={`nav-link ${location.pathname === '/banners' ? 'active' : ''}`}>
            <ImageIcon size={20} />
            Banners
          </Link>
        </nav>

        <div className="nav-link" onClick={handleLogout} style={{ color: 'var(--danger)', marginTop: 'auto' }}>
          <LogOut size={20} />
          Sign Out
        </div>
      </aside>

      {/* Main Content */}
      <main className="main-content">
        <Outlet />
      </main>
    </div>
  );
}
