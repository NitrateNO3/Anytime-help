import { useEffect, useRef, useState } from 'react';
import axios from 'axios';
import { toast } from 'react-hot-toast';
import { io } from 'socket.io-client';
import { Plus, Edit2, Trash2, X, Globe, Image as ImageIcon, Megaphone, Link as LinkIcon } from 'lucide-react';
import { API_URL, socketAuth } from '../lib/area';
import { confirmDialog } from '../components/ConfirmDialog';
import '../index.css';

// "Sponsored" ad cards on the resident/member home screen. Universal (same in
// every area); only the platform Super Admin manages them.

interface Ad {
  _id: string;
  title: string;
  sub: string;
  icon: string;
  theme: string;
  link: string;
  url: string;
  order: number;
  isActive: boolean;
}

type FormState = { title: string; sub: string; icon: string; theme: string; link: string; order: string; isActive: boolean };

// Same colours as the app (components/home/ResidentHomeExtras.tsx AD_THEMES)
const THEMES: Record<string, { from: string; to: string; fg: string; label: string }> = {
  amber: { from: '#FEF3C7', to: '#FDE68A', fg: '#92400E', label: 'Amber' },
  blue: { from: '#DBEAFE', to: '#BFDBFE', fg: '#1E40AF', label: 'Blue' },
  green: { from: '#DCFCE7', to: '#BBF7D0', fg: '#166534', label: 'Green' },
  pink: { from: '#FCE7F3', to: '#FBCFE8', fg: '#9D174D', label: 'Pink' },
  purple: { from: '#F3E8FF', to: '#E9D5FF', fg: '#6B21A8', label: 'Purple' },
  teal: { from: '#CCFBF1', to: '#99F6E4', fg: '#115E59', label: 'Teal' },
  orange: { from: '#FFEDD5', to: '#FED7AA', fg: '#9A3412', label: 'Orange' },
  red: { from: '#FEE2E2', to: '#FECACA', fg: '#991B1B', label: 'Red' },
};

const ICON_LABELS: Record<string, string> = {
  'megaphone-outline': 'Megaphone',
  'cafe-outline': 'Cafe / snacks',
  'airplane-outline': 'Travel',
  'barbell-outline': 'Gym / fitness',
  'restaurant-outline': 'Restaurant',
  'cart-outline': 'Shopping',
  'shirt-outline': 'Clothes / laundry',
  'car-outline': 'Car',
  'school-outline': 'Education',
  'medkit-outline': 'Health',
  'home-outline': 'Home / property',
  'construct-outline': 'Repair / services',
  'gift-outline': 'Gift',
  'pricetag-outline': 'Offer tag',
  'paw-outline': 'Pets',
  'cut-outline': 'Salon',
};

const EMPTY: FormState = { title: '', sub: '', icon: 'megaphone-outline', theme: 'amber', link: '', order: '0', isActive: true };
const BASE = `${API_URL}/sponsored-ads`;

export default function SponsoredAds() {
  const [ads, setAds] = useState<Ad[]>([]);
  const [icons, setIcons] = useState<string[]>(Object.keys(ICON_LABELS));
  const [themes, setThemes] = useState<string[]>(Object.keys(THEMES));
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Ad | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState('');
  const [removeImage, setRemoveImage] = useState(false);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = async () => {
    try {
      const res = await axios.get(`${BASE}?all=true`);
      setAds(Array.isArray(res.data?.ads) ? res.data.ads : []);
      if (Array.isArray(res.data?.icons) && res.data.icons.length) setIcons(res.data.icons);
      if (Array.isArray(res.data?.themes) && res.data.themes.length) setThemes(res.data.themes);
    } catch {
      toast.error('Failed to load sponsored ads');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    const socket = io(API_URL.replace('/api', ''), { ...socketAuth(), transports: ['websocket', 'polling'] });
    socket.on('sponsored_ads_changed', load);
    return () => { socket.disconnect(); };
  }, []);

  const set = (k: keyof FormState, v: any) => setForm(f => ({ ...f, [k]: v }));

  const openNew = () => {
    setEditing(null);
    const used = new Set(ads.map(a => a.theme));
    setForm({ ...EMPTY, theme: themes.find(t => !used.has(t)) || themes[0], order: String(ads.length) });
    setFile(null); setPreview(''); setRemoveImage(false);
    setOpen(true);
  };

  const openEdit = (a: Ad) => {
    setEditing(a);
    setForm({ title: a.title || '', sub: a.sub || '', icon: a.icon || icons[0], theme: a.theme || themes[0], link: a.link || '', order: String(a.order ?? 0), isActive: a.isActive });
    setFile(null); setPreview(a.url || ''); setRemoveImage(false);
    setOpen(true);
  };

  const pickFile = (f: File | null) => {
    if (!f) return;
    if (!f.type.startsWith('image/')) { toast.error('Please pick an image file'); return; }
    setFile(f);
    setPreview(URL.createObjectURL(f));
    setRemoveImage(false);
  };

  const clearImage = () => {
    setFile(null); setPreview(''); setRemoveImage(true);
    if (fileRef.current) fileRef.current.value = '';
  };

  const save = async () => {
    if (!form.title.trim()) { toast.error('Title is required'); return; }
    const data = new FormData();
    data.append('title', form.title);
    data.append('sub', form.sub);
    data.append('icon', form.icon);
    data.append('theme', form.theme);
    data.append('link', form.link);
    data.append('order', form.order || '0');
    data.append('isActive', String(form.isActive));
    if (file) data.append('image', file);
    if (editing && removeImage && !file) data.append('removeImage', 'true');

    setSaving(true);
    try {
      if (editing) await axios.put(`${BASE}/${editing._id}`, data);
      else await axios.post(BASE, data);
      toast.success(editing ? 'Ad updated' : 'Ad added');
      setOpen(false);
      load();
    } catch (e: any) {
      toast.error(e?.response?.data?.msg || 'Could not save ad');
    } finally {
      setSaving(false);
    }
  };

  const toggle = async (a: Ad) => {
    try {
      await axios.patch(`${BASE}/${a._id}/toggle`);
      load();
    } catch {
      toast.error('Could not change status');
    }
  };

  const remove = async (a: Ad) => {
    const ok = await confirmDialog({ title: 'Delete sponsored ad?', message: `"${a.title}" will be removed from the app home screen.`, confirmText: 'Delete', danger: true });
    if (!ok) return;
    try {
      await axios.delete(`${BASE}/${a._id}`);
      toast.success('Ad deleted');
      load();
    } catch {
      toast.error('Could not delete ad');
    }
  };

  return (
    <div className="page-container fade-in">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 18 }}>
        <div>
          <h1 className="page-title">Sponsored Ads</h1>
          <p className="page-subtitle" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Globe size={15} /> The "Sponsored" ad cards on the resident and member home screen. Same in every area.
          </p>
        </div>
        <button className="btn btn-primary" onClick={openNew} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Plus size={18} /> Add Sponsored Ad
        </button>
      </div>

      {loading ? (
        <p style={{ color: 'var(--text-muted)' }}>Loading...</p>
      ) : ads.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>
          No sponsored ads yet. Until you add one, the app shows its three sample ads.
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16 }}>
          {ads.map(a => (
            <div key={a._id} className="card" style={{ padding: 0, overflow: 'hidden', opacity: a.isActive ? 1 : 0.6 }}>
              <AdPreview ad={a} />
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px' }}>
                <span style={{ fontSize: 12.5, fontWeight: 700, color: a.isActive ? '#16A34A' : '#94A3B8' }}>
                  {a.isActive ? 'Live' : 'Hidden'} · Order {a.order}
                </span>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button className="btn btn-outline" onClick={() => toggle(a)} style={{ padding: '6px 10px', fontSize: 12.5 }}>{a.isActive ? 'Hide' : 'Show'}</button>
                  <button className="btn btn-icon" onClick={() => openEdit(a)} title="Edit"><Edit2 size={16} /></button>
                  <button className="btn btn-icon" onClick={() => remove(a)} title="Delete" style={{ color: '#DC2626' }}><Trash2 size={16} /></button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {open && (
        <div className="modal-overlay" onClick={() => !saving && setOpen(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: 560, width: '100%', maxHeight: '90vh', overflowY: 'auto' }}>
            <div className="modal-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2>{editing ? 'Edit Sponsored Ad' : 'Add Sponsored Ad'}</h2>
              <button className="btn btn-icon" onClick={() => setOpen(false)} disabled={saving}><X size={18} /></button>
            </div>

            <div className="modal-body">
              <p style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--text-muted)', margin: '0 0 14px' }}>
                <Globe size={15} /> This ad is shown in every area.
              </p>

              <div className="form-group">
                <label className="form-label">Title *</label>
                <input className="form-input" maxLength={60} placeholder="e.g. FitZone Gym" value={form.title} onChange={e => set('title', e.target.value)} />
              </div>

              <div className="form-group">
                <label className="form-label">Small text</label>
                <input className="form-input" maxLength={100} placeholder="e.g. First month at ₹999 for residents" value={form.sub} onChange={e => set('sub', e.target.value)} />
              </div>

              <div className="form-group">
                <label className="form-label">Link when tapped (optional)</label>
                <input className="form-input" placeholder="https://... or tel:+91..." value={form.link} onChange={e => set('link', e.target.value)} />
              </div>

              <div className="form-group">
                <label className="form-label">Image (optional, replaces icon and colour)</label>
                {preview ? (
                  <div style={{ position: 'relative' }}>
                    <img src={preview} alt="" style={{ width: '100%', maxHeight: 200, objectFit: 'cover', borderRadius: 12 }} />
                    <button type="button" className="btn btn-icon" onClick={clearImage} title="Remove image" style={{ position: 'absolute', top: 8, right: 8, background: '#FFFFFF' }}><X size={16} /></button>
                  </div>
                ) : (
                  <button type="button" className="btn btn-outline" onClick={() => fileRef.current?.click()} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <ImageIcon size={16} /> Choose image
                  </button>
                )}
                <input ref={fileRef} type="file" accept="image/*" hidden onChange={e => pickFile(e.target.files?.[0] || null)} />
              </div>

              {!preview && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div className="form-group">
                    <label className="form-label">Icon</label>
                    <select className="form-input" value={form.icon} onChange={e => set('icon', e.target.value)}>
                      {icons.map(ic => <option key={ic} value={ic}>{ICON_LABELS[ic] || ic}</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Colour</label>
                    <select className="form-input" value={form.theme} onChange={e => set('theme', e.target.value)}>
                      {themes.map(t => <option key={t} value={t}>{THEMES[t]?.label || t}</option>)}
                    </select>
                  </div>
                </div>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, alignItems: 'end' }}>
                <div className="form-group">
                  <label className="form-label">Display order</label>
                  <input className="form-input" type="number" value={form.order} onChange={e => set('order', e.target.value)} />
                </div>
                <label className="form-group" style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                  <input type="checkbox" checked={form.isActive} onChange={e => set('isActive', e.target.checked)} />
                  Show in app
                </label>
              </div>

              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', margin: '6px 0 8px' }}>PREVIEW</div>
              <AdPreview ad={{ ...form, url: preview } as any} />
            </div>

            <div className="modal-footer">
              <button className="btn btn-outline" onClick={() => setOpen(false)} disabled={saving}>Cancel</button>
              <button className="btn btn-primary" onClick={save} disabled={saving}>{saving ? 'Saving...' : editing ? 'Save changes' : 'Add ad'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Rough preview of the card in the app
function AdPreview({ ad }: { ad: Pick<Ad, 'title' | 'sub' | 'theme' | 'url' | 'link'> }) {
  const t = THEMES[ad.theme] || THEMES.amber;
  if (ad.url) {
    return (
      <div style={{ position: 'relative', height: 150, background: `url(${ad.url}) center / cover no-repeat`, borderRadius: 0 }}>
        <span style={{ position: 'absolute', top: 10, right: 10, background: 'rgba(15,23,42,0.6)', color: '#FFFFFF', fontSize: 10, fontWeight: 900, borderRadius: 6, padding: '2px 7px' }}>AD</span>
      </div>
    );
  }
  return (
    <div style={{ position: 'relative', height: 150, display: 'flex', alignItems: 'center', gap: 14, padding: 16, background: `linear-gradient(135deg, ${t.from}, ${t.to})` }}>
      <span style={{ position: 'absolute', top: 10, right: 10, background: 'rgba(15,23,42,0.6)', color: '#FFFFFF', fontSize: 10, fontWeight: 900, borderRadius: 6, padding: '2px 7px' }}>AD</span>
      <Megaphone size={40} color={t.fg} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 17, fontWeight: 900, color: t.fg, lineHeight: 1.25 }}>{ad.title || 'Ad title'}</div>
        <div style={{ fontSize: 12.5, color: '#334155', marginTop: 4 }}>{ad.sub}</div>
        {ad.link && <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11.5, color: t.fg, marginTop: 6 }}><LinkIcon size={12} /> Opens link</div>}
      </div>
    </div>
  );
}
