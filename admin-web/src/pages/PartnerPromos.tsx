import { useEffect, useRef, useState } from 'react';
import axios from 'axios';
import { toast } from 'react-hot-toast';
import { io } from 'socket.io-client';
import { Plus, Edit2, Trash2, X, Phone, Image as ImageIcon, Globe, Check } from 'lucide-react';
import { API_URL, socketAuth } from '../lib/area';
import { confirmDialog } from '../components/ConfirmDialog';
import '../index.css';

// Partner promo cards (e.g. a partner hospital offer) on the resident/member
// home screen. Universal: the same promos show in every area, and only the
// platform Super Admin manages them (Super Admin view, no area selected).

interface Promo {
  _id: string;
  partnerName: string;
  title: string;
  description: string;
  points: string[];
  phone: string;
  buttonText: string;
  url: string;
  order: number;
  isActive: boolean;
}

type FormState = {
  partnerName: string;
  title: string;
  description: string;
  points: string[];
  phone: string;
  buttonText: string;
  order: string;
  isActive: boolean;
};

const POINT_SLOTS = 3;
const padPoints = (list: string[] = []) => [...list, '', '', ''].slice(0, Math.max(POINT_SLOTS, list.length));

const EMPTY: FormState = {
  partnerName: '', title: '', description: '', points: padPoints(), phone: '', buttonText: '', order: '0', isActive: true,
};

// The original Artemis card, to fill the form in one click
const ARTEMIS_TEMPLATE = {
  partnerName: 'Artemis Hospitals',
  title: 'Book hospital visits & save up to 25%',
  description: 'Exclusive rates at Artemis Hospitals, Gurugram, and other partners for residents and their families.',
  points: ['Up to 25% off', 'Priority OPD slots', 'Family covered'],
  buttonText: 'Call to book',
};

const BASE = `${API_URL}/partner-promos`;

export default function PartnerPromos() {
  const [promos, setPromos] = useState<Promo[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Promo | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState('');
  const [removeImage, setRemoveImage] = useState(false);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = async () => {
    try {
      const res = await axios.get(`${BASE}?all=true`);
      setPromos(Array.isArray(res.data) ? res.data : []);
    } catch {
      toast.error('Failed to load partner promos');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    const socket = io(API_URL.replace('/api', ''), { ...socketAuth(), transports: ['websocket', 'polling'] });
    socket.on('partner_promos_changed', load);
    return () => { socket.disconnect(); };
  }, []);

  const set = (k: keyof FormState, v: any) => setForm(f => ({ ...f, [k]: v }));

  const openNew = () => {
    setEditing(null);
    setForm({ ...EMPTY, order: String(promos.length) });
    setFile(null); setPreview(''); setRemoveImage(false);
    setOpen(true);
  };

  const openEdit = (p: Promo) => {
    setEditing(p);
    setForm({
      partnerName: p.partnerName || '',
      title: p.title || '',
      description: p.description || '',
      points: padPoints(p.points || []),
      phone: p.phone || '',
      buttonText: p.buttonText || '',
      order: String(p.order ?? 0),
      isActive: p.isActive,
    });
    setFile(null); setPreview(p.url || ''); setRemoveImage(false);
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

  const setPoint = (i: number, v: string) => setForm(f => ({ ...f, points: f.points.map((p, j) => (j === i ? v : p)) }));

  const useArtemis = () => setForm(f => ({ ...f, ...ARTEMIS_TEMPLATE, points: padPoints(ARTEMIS_TEMPLATE.points) }));

  const save = async () => {
    if (!form.title.trim()) { toast.error('Title is required'); return; }
    const phone = form.phone.trim();
    if (phone && !/^[+\d][\d\s-]{5,}$/.test(phone)) { toast.error('Enter a valid phone number'); return; }

    const data = new FormData();
    data.append('partnerName', form.partnerName);
    data.append('title', form.title);
    data.append('description', form.description);
    data.append('points', JSON.stringify(form.points.map(s => s.trim()).filter(Boolean)));
    data.append('phone', phone);
    data.append('buttonText', form.buttonText);
    data.append('order', form.order || '0');
    data.append('isActive', String(form.isActive));
    if (file) data.append('image', file);
    if (editing && removeImage && !file) data.append('removeImage', 'true');

    setSaving(true);
    try {
      if (editing) await axios.put(`${BASE}/${editing._id}`, data);
      else await axios.post(BASE, data);
      toast.success(editing ? 'Promo updated' : 'Promo added');
      setOpen(false);
      load();
    } catch (e: any) {
      toast.error(e?.response?.data?.msg || 'Could not save promo');
    } finally {
      setSaving(false);
    }
  };

  const toggle = async (p: Promo) => {
    try {
      await axios.patch(`${BASE}/${p._id}/toggle`);
      load();
    } catch {
      toast.error('Could not change status');
    }
  };

  const remove = async (p: Promo) => {
    const ok = await confirmDialog({
      title: 'Delete partner promo?',
      message: `"${p.title}" will be removed from the app home screen.`,
      confirmText: 'Delete',
      danger: true,
    });
    if (!ok) return;
    try {
      await axios.delete(`${BASE}/${p._id}`);
      toast.success('Promo deleted');
      load();
    } catch {
      toast.error('Could not delete promo');
    }
  };

  return (
    <div className="page-container fade-in">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 18 }}>
        <div>
          <h1 className="page-title">Partner Promo</h1>
          <p className="page-subtitle" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Globe size={15} /> Partner offer cards on the resident and member home screen. Same in every area.
          </p>
        </div>
        <button className="btn btn-primary" onClick={openNew} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Plus size={18} /> Add Partner Promo
        </button>
      </div>

      {loading ? (
        <p style={{ color: 'var(--text-muted)' }}>Loading...</p>
      ) : promos.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>
          No partner promos yet. Add one to show it on the resident and member home screens.
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 16 }}>
          {promos.map(p => (
            <div key={p._id} className="card" style={{ padding: 0, overflow: 'hidden', opacity: p.isActive ? 1 : 0.6 }}>
              <PromoPreview promo={p} />
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px' }}>
                <span style={{ fontSize: 12.5, fontWeight: 700, color: p.isActive ? '#16A34A' : '#94A3B8' }}>
                  {p.isActive ? 'Live' : 'Hidden'} · Order {p.order}
                </span>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button className="btn btn-outline" onClick={() => toggle(p)} style={{ padding: '6px 10px', fontSize: 12.5 }}>
                    {p.isActive ? 'Hide' : 'Show'}
                  </button>
                  <button className="btn btn-icon" onClick={() => openEdit(p)} title="Edit"><Edit2 size={16} /></button>
                  <button className="btn btn-icon" onClick={() => remove(p)} title="Delete" style={{ color: '#DC2626' }}><Trash2 size={16} /></button>
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
              <h2>{editing ? 'Edit Partner Promo' : 'Add Partner Promo'}</h2>
              <button className="btn btn-icon" onClick={() => setOpen(false)} disabled={saving}><X size={18} /></button>
            </div>

            <div className="modal-body">
              {!editing && (
                <button type="button" className="btn btn-outline" onClick={useArtemis} style={{ marginBottom: 14 }}>
                  Fill with Artemis Hospital template
                </button>
              )}

              <p style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--text-muted)', margin: '0 0 14px' }}>
                <Globe size={15} /> This promo is shown in every area.
              </p>

              <div className="form-group">
                <label className="form-label">Partner name</label>
                <input className="form-input" placeholder="e.g. Artemis Hospitals" value={form.partnerName} onChange={e => set('partnerName', e.target.value)} />
              </div>

              <div className="form-group">
                <label className="form-label">Title *</label>
                <input className="form-input" placeholder="e.g. Book hospital visits & save up to 25%" value={form.title} onChange={e => set('title', e.target.value)} />
              </div>

              <div className="form-group">
                <label className="form-label">Description</label>
                <textarea className="form-input" rows={2} placeholder="e.g. Exclusive rates for residents and their families." value={form.description} onChange={e => set('description', e.target.value)} />
              </div>

              <div className="form-group">
                <label className="form-label">Points</label>
                <div style={{ display: 'grid', gap: 8 }}>
                  {form.points.map((pt, i) => (
                    <input key={i} className="form-input" placeholder={ARTEMIS_TEMPLATE.points[i] ? `Point ${i + 1}, e.g. ${ARTEMIS_TEMPLATE.points[i]}` : `Point ${i + 1}`}
                      value={pt} onChange={e => setPoint(i, e.target.value)} />
                  ))}
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div className="form-group">
                  <label className="form-label">Contact number</label>
                  <input className="form-input" placeholder="e.g. +91 98765 43210" value={form.phone} onChange={e => set('phone', e.target.value)} />
                </div>
                <div className="form-group">
                  <label className="form-label">Button text</label>
                  <input className="form-input" placeholder="Call to book" value={form.buttonText} onChange={e => set('buttonText', e.target.value)} />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Image (optional)</label>
                {preview ? (
                  <div style={{ position: 'relative' }}>
                    <img src={preview} alt="" style={{ width: '100%', maxHeight: 200, objectFit: 'cover', borderRadius: 12 }} />
                    <button type="button" className="btn btn-icon" onClick={clearImage} title="Remove image"
                      style={{ position: 'absolute', top: 8, right: 8, background: '#FFFFFF' }}><X size={16} /></button>
                  </div>
                ) : (
                  <button type="button" className="btn btn-outline" onClick={() => fileRef.current?.click()} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <ImageIcon size={16} /> Choose image
                  </button>
                )}
                <input ref={fileRef} type="file" accept="image/*" hidden onChange={e => pickFile(e.target.files?.[0] || null)} />
              </div>

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
            </div>

            <div className="modal-footer">
              <button className="btn btn-outline" onClick={() => setOpen(false)} disabled={saving}>Cancel</button>
              <button className="btn btn-primary" onClick={save} disabled={saving}>{saving ? 'Saving...' : editing ? 'Save changes' : 'Add promo'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Rough preview of how the card looks in the app
function PromoPreview({ promo }: { promo: Promo }) {
  return (
    <div style={{ background: '#1D4ED8', color: '#FFFFFF', padding: 16 }}>
      {promo.url && <img src={promo.url} alt="" style={{ width: '100%', height: 130, objectFit: 'cover', borderRadius: 12, marginBottom: 12 }} />}
      {promo.partnerName && (
        <div style={{ display: 'inline-block', background: '#FFFFFF', color: '#0F172A', borderRadius: 14, padding: '3px 10px', fontSize: 11, fontWeight: 800, marginBottom: 8 }}>
          IN PARTNERSHIP WITH {promo.partnerName.toUpperCase()}
        </div>
      )}
      <div style={{ fontSize: 18, fontWeight: 900, lineHeight: 1.25 }}>{promo.title}</div>
      {promo.description && <div style={{ fontSize: 13, color: '#DBEAFE', marginTop: 6 }}>{promo.description}</div>}
      {promo.points?.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 10 }}>
          {promo.points.map(pt => (
            <span key={pt} style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'rgba(255,255,255,0.16)', borderRadius: 12, padding: '3px 9px', fontSize: 12, fontWeight: 700 }}>
              <Check size={12} /> {pt}
            </span>
          ))}
        </div>
      )}
      {promo.phone && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, background: '#FFFFFF', color: '#1D4ED8', borderRadius: 12, padding: '9px 0', marginTop: 12, fontWeight: 800, fontSize: 14 }}>
          <Phone size={15} /> {promo.buttonText || 'Call to book'}
        </div>
      )}
    </div>
  );
}
