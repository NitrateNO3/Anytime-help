import { useEffect } from 'react';
import { Outlet, useNavigate, useLocation, Link } from 'react-router-dom';
import { LayoutDashboard, Users, LogOut, Megaphone, Image as ImageIcon, Home, BookOpen, ListPlus, MessageSquare, Building2, Sliders, MapPin } from 'lucide-react';
import logoImg from '../assets/logo.png';

export default function AdminLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const adminUserStr = localStorage.getItem('adminUser');
  const adminUser = adminUserStr ? JSON.parse(adminUserStr) : null;
  const isSuperAdmin = adminUser?.role === 'Admin';
  
  const hasAccess = (section: string) => {
    if (isSuperAdmin) return true;
    if (adminUser?.role === 'SubAdmin' && adminUser?.permissions?.includes(section)) return true;
    return false;
  };

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
          {hasAccess('Overview') && (
            <Link to="/dashboard" className={`nav-link ${location.pathname === '/dashboard' ? 'active' : ''}`}>
              <LayoutDashboard size={20} />
              Overview
            </Link>
          )}
          
          {hasAccess('Residents') && (
            <Link to="/residents" className={`nav-link ${location.pathname === '/residents' ? 'active' : ''}`}>
              <Home size={20} />
              Residents
            </Link>
          )}

          {(isSuperAdmin || hasAccess('Locations')) && (
            <Link to="/locations" className={`nav-link ${location.pathname === '/locations' ? 'active' : ''}`}>
              <MapPin size={20} />
              Locations
            </Link>
          )}
          
          {hasAccess('Staff Team') && (
            <>
              <Link to="/staff" className={`nav-link ${location.pathname === '/staff' ? 'active' : ''}`}>
                <Users size={20} />
                Staff Team
              </Link>
              <Link to="/categories" className={`nav-link ${location.pathname === '/categories' ? 'active' : ''}`}>
                <ListPlus size={20} />
                Categories
              </Link>
            </>
          )}

          {hasAccess('Committee Members') && (
            <>
              <Link to="/members" className={`nav-link ${location.pathname === '/members' ? 'active' : ''}`}>
                <Users size={20} />
                Members
              </Link>
              <Link to="/chat-groups" className={`nav-link ${location.pathname === '/chat-groups' ? 'active' : ''}`}>
                <MessageSquare size={20} />
                Chat Groups
              </Link>
            </>
          )}

          {(isSuperAdmin || hasAccess('Community') || hasAccess('Communities')) && (
            <Link to="/communities" className={`nav-link ${location.pathname.startsWith('/communities') || location.pathname.startsWith('/community') ? 'active' : ''}`}>
              <Building2 size={20} />
              Communities
            </Link>
          )}
          
          {isSuperAdmin && (
            <Link to="/subadmins" className={`nav-link ${location.pathname === '/subadmins' ? 'active' : ''}`}>
              <Users size={20} />
              Sub-Admins
            </Link>
          )}
          
          {hasAccess('Announcements') && (
            <Link to="/announcements" className={`nav-link ${location.pathname === '/announcements' ? 'active' : ''}`}>
              <Megaphone size={20} />
              Announcements
            </Link>
          )}
          
          {hasAccess('Banners') && (
            <Link to="/banners" className={`nav-link ${location.pathname === '/banners' ? 'active' : ''}`}>
              <ImageIcon size={20} />
              Banners
            </Link>
          )}

          {(hasAccess('Staff Banner') || hasAccess('Staff Banners') || hasAccess('Banners')) && (
            <Link to="/staff-banners" className={`nav-link ${location.pathname === '/staff-banners' ? 'active' : ''}`}>
              <ImageIcon size={20} />
              All Banners
            </Link>
          )}

          {(hasAccess('Banners') || hasAccess('Announcements')) && (
            <Link to="/bottom-banners" className={`nav-link ${location.pathname === '/bottom-banners' ? 'active' : ''}`}>
              <Sliders size={20} />
              Bottom Banners
            </Link>
          )}
          
          {hasAccess('Directory') && (
            <Link to="/directory" className={`nav-link ${location.pathname === '/directory' ? 'active' : ''}`}>
              <BookOpen size={20} />
              Directory
            </Link>
          )}
        </nav>

        {/* Logged-in User Profile Card */}
        <div style={{
          marginTop: 'auto',
          marginBottom: 10,
          padding: '10px 12px',
          background: '#F8FAFC',
          borderRadius: 10,
          border: '1px solid #E2E8F0',
          display: 'flex',
          alignItems: 'center',
          gap: 10
        }}>
          <div style={{
            width: 34,
            height: 34,
            borderRadius: '50%',
            background: isSuperAdmin ? 'linear-gradient(135deg, #2563EB, #1D4ED8)' : 'linear-gradient(135deg, #64748B, #475569)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#FFFFFF',
            fontWeight: 700,
            fontSize: 14,
            flexShrink: 0
          }}>
            {adminUser?.name ? adminUser.name.charAt(0).toUpperCase() : 'A'}
          </div>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-main)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {adminUser?.name || 'Admin User'}
            </div>
            <div style={{ fontSize: 11, color: isSuperAdmin ? '#2563EB' : 'var(--text-muted)', fontWeight: 600 }}>
              {adminUser?.role === 'Admin' ? (adminUser?.email === 'admin@anytimehelp.com' ? 'Main Super Admin' : 'Super Admin') : 'Sub-Admin'}
            </div>
          </div>
        </div>

        <div className="nav-link" onClick={handleLogout} style={{ color: 'var(--danger)' }}>
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
