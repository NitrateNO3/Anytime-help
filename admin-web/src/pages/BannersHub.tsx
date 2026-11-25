import type { ReactNode } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Image as ImageIcon, Sliders, LogIn, Handshake } from 'lucide-react';
import StaffBanners from './StaffBanners';
import BottomBanners from './BottomBanners';
import Banners from './Banners';
import PartnerPromos from './PartnerPromos';
import '../index.css';

type Category = 'top' | 'bottom' | 'partner' | 'login';

const CATEGORIES: { key: Category; label: string; hint: string; icon: ReactNode; perms: string[] }[] = [
  {
    key: 'top',
    label: 'Home Top Banners',
    hint: 'Header slider. Residents & Members share one set, Staff has its own.',
    icon: <ImageIcon size={18} />,
    perms: ['Banners', 'Staff Banner', 'Staff Banners'],
  },
  {
    key: 'bottom',
    label: 'Bottom / Featured Banners',
    hint: 'Featured updates slider lower on the home screen.',
    icon: <Sliders size={18} />,
    perms: ['Banners', 'Announcements'],
  },
  {
    key: 'partner',
    label: 'Partner Promo',
    hint: 'Partner offer card (e.g. a hospital) on the resident and member home screen, with a call button.',
    icon: <Handshake size={18} />,
    perms: ['Banners'],
  },
  {
    key: 'login',
    label: 'Login Screen Banners',
    hint: 'Shown on the app login screen before sign-in.',
    icon: <LogIn size={18} />,
    perms: ['Banners'],
  },
];

export default function BannersHub() {
  const [params, setParams] = useSearchParams();

  let adminUser: any = null;
  try {
    adminUser = JSON.parse(localStorage.getItem('adminUser') || 'null');
  } catch {
    adminUser = null;
  }
  const isSubAdmin = adminUser?.role === 'SubAdmin';
  const perms: string[] = adminUser?.permissions || [];
  const visible = CATEGORIES.filter((c) => !isSubAdmin || c.perms.some((p) => perms.includes(p)));

  const requested = params.get('cat') as Category | null;
  const active: Category =
    visible.find((c) => c.key === requested)?.key || visible[0]?.key || 'top';
  const activeInfo = CATEGORIES.find((c) => c.key === active)!;

  return (
    <div className="page-container fade-in">
      <header className="page-header" style={{ marginBottom: 16 }}>
        <div>
          <h1 className="page-title">Banners</h1>
          <p className="page-subtitle">Pick a category to see which banner goes where in the app</p>
        </div>
      </header>

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 8 }}>
        {visible.map((c) => {
          const selected = c.key === active;
          return (
            <button
              key={c.key}
              onClick={() => setParams({ cat: c.key }, { replace: true })}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '10px 18px',
                borderRadius: 12,
                border: selected ? 'none' : '1px solid var(--border-color)',
                background: selected ? 'var(--primary)' : '#FFFFFF',
                color: selected ? '#FFFFFF' : 'var(--text-muted)',
                fontWeight: 600,
                fontSize: 14,
                cursor: 'pointer',
                transition: 'all 0.2s',
                boxShadow: selected ? '0 4px 12px rgba(29, 78, 216, 0.25)' : 'none',
              }}
            >
              {c.icon}
              {c.label}
            </button>
          );
        })}
      </div>
      <p style={{ color: 'var(--text-muted)', fontSize: 13, margin: '0 0 20px' }}>{activeInfo.hint}</p>

      <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: 20 }}>
        {active === 'top' && <StaffBanners embedded />}
        {active === 'bottom' && <BottomBanners embedded />}
        {active === 'partner' && <PartnerPromos />}
        {active === 'login' && <Banners embedded />}
      </div>
    </div>
  );
}
