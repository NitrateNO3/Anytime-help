// Multi-area helpers for the admin panel.
//
// A platform Super Admin (backend role 'SuperAdmin') is stored in localStorage
// as role 'Admin' + isSuperAdmin: true, so every existing admin screen works
// unchanged. The area it is currently viewing is kept in localStorage and sent
// to the backend on every request (x-area-id) and socket connection.

export const API_URL = import.meta.env.VITE_API_URL || 'https://anytime-help.onrender.com/api';

const AREA_KEY = 'selectedAreaId';

export const getAdminUser = () => {
  try {
    const raw = localStorage.getItem('adminUser');
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

export const isPlatformSuperAdmin = () => !!getAdminUser()?.isSuperAdmin;

export const getSelectedArea = (): string | null => {
  try { return localStorage.getItem(AREA_KEY); } catch { return null; }
};

export const setSelectedArea = (id: string | null) => {
  try {
    if (id) localStorage.setItem(AREA_KEY, id);
    else localStorage.removeItem(AREA_KEY);
  } catch { /* ignore */ }
};

// Header to scope a request to the selected area (super admin only; for area
// admins the backend always uses their own area and ignores this).
export const areaHeaders = (): Record<string, string> => {
  const area = isPlatformSuperAdmin() ? getSelectedArea() : null;
  return area ? { 'x-area-id': area } : {};
};

// Pass as socket.io options so live events are limited to the right area:
//   io(SOCKET_URL, { ...socketAuth(), transports: [...] })
export const socketAuth = () => ({
  auth: {
    token: localStorage.getItem('adminToken') || undefined,
    areaId: (isPlatformSuperAdmin() && getSelectedArea()) || undefined,
  },
});
