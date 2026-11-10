import { useEffect, useState } from 'react';
import axios from 'axios';
import { Outlet, useNavigate, useLocation, Link } from 'react-router-dom';
import { LayoutDashboard, Users, LogOut, Megaphone, Image as ImageIcon, Home, BookOpen, ListPlus, MessageSquare, Building2, Sliders, MapPin, BadgeCheck } from 'lucide-react';
import { API_URL, getSelectedArea, setSelectedArea } from '../lib/area';
import logoImg from '../assets/logo.png';

export default function AdminLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const adminUserStr = localStorage.getItem('adminUser');
  const adminUser = adminUserStr ? JSON.parse(adminUserStr) : null;
  const isSuperAdmin = adminUser?.role === 'Admin';
  // Platform super admin: manages all areas and switches between them
  const isPlatformAdmin = !!adminUser?.isSuperAdmin;
  const [areas, setAreas] = useState<{ _id: string; name: string }[]>([]);
  const selectedArea = getSelectedArea();

  useEffect(() => {
    if (!isPlatformAdmin) return;
    axios.get(`${API_URL}/areas`, { headers: { 'x-auth-token': localStorage.getItem('adminToken') || '' } })
      .then((res) => {
        setAreas(res.data);
        // Forget a selection that no longer exists
        if (selectedArea && !res.data.some((a: any) => a._id === selectedArea)) {
          setSelectedArea(null);
          navigate('/areas');
        }
      })
      .catch(() => {});
  }, [isPlatformAdmin]);

  // Area-specific screens need an area picked first (see the prompt below)
  const needsArea = isPlatformAdmin && !selectedArea && location.pathname !== '/areas';

  const switchArea = (id: string) => {
    setSelectedArea(id || null);
    // Full reload so every screen and socket reconnects inside the new area
    window.location.href = id ? (location.pathname === '/areas' ? '/dashboard' : location.pathname) : '/areas';
  };
  
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
    localStorage.removeItem('selectedAreaId');
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

        {isPlatformAdmin && (
          <div style={{ padding: '0 12px 16px' }}>
            <label htmlFor="area-switcher" style={{ display: 'block', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 6 }}>Viewing area</label>
            <select
              id="area-switcher"
              className="form-input"
              style={{ padding: '10px 12px', fontSize: 14 }}
              value={selectedArea || ''}
              onChange={(e) => switchArea(e.target.value)}
            >
              <option value="">Super Admin</option>
              {areas.map((a) => <option key={a._id} value={a._id}>{a.name}</option>)}
            </select>
          </div>
        )}

        <nav style={{ flex: 1 }}>
          {isPlatformAdmin && (
            <Link to="/areas" className={`nav-link ${location.pathname === '/areas' ? 'active' : ''}`}>
              <MapPin size={20} />
              Areas
            </Link>
          )}

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

          {isPlatformAdmin && (
            <Link to="/officials" className={`nav-link ${location.pathname === '/officials' ? 'active' : ''}`}>
              <BadgeCheck size={20} />
              Officials
            </Link>
          )}
        </nav>

        <div className="nav-link" onClick={handleLogout} style={{ color: 'var(--danger)', marginTop: 'auto' }}>
          <LogOut size={20} />
          Sign Out
        </div>
      </aside>

      {/* Main Content */}
      <main className="main-content">
        {needsArea ? (
          <div style={{ maxWidth: 560, margin: '60px auto', textAlign: 'center', background: 'white', border: '1px solid var(--border-color)', borderRadius: 16, padding: '36px 28px' }}>
            <div style={{ width: 56, height: 56, borderRadius: 16, background: 'rgba(37, 99, 235, 0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
              <MapPin size={28} color="var(--primary)" />
            </div>
            <h2 style={{ margin: '0 0 8px', fontSize: 22 }}>Please select an area</h2>
            <p style={{ margin: '0 0 24px', color: 'var(--text-muted)', fontSize: 15, lineHeight: 1.5 }}>
              You are viewing as Super Admin. Select the area (sub admin) whose data you want to see.
            </p>
            {areas.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {areas.map((a) => (
                  <button key={a._id} className="btn btn-secondary" onClick={() => switchArea(a._id)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '12px 16px', fontSize: 15 }}>
                    <MapPin size={16} /> {a.name}
                  </button>
                ))}
              </div>
            ) : (
              <Link to="/areas" className="btn btn-primary" style={{ display: 'inline-flex' }}>Go to Areas</Link>
            )}
          </div>
        ) : (
          <Outlet />
        )}
      </main>
    </div>
  );
}
