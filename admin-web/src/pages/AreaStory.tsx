// Area Story: the area's own official page in the app's Status bar.
// One per area, blue tick, always first, seen by everyone in the area.
// Admin uploads a photo and pins it for as long as needed.
import { useEffect, useState } from 'react';
import axios from 'axios';
import { toast } from 'react-hot-toast';
import { Pin, PinOff, Trash2, Upload, Eye, Heart, X, Image as ImageIcon } from 'lucide-react';
import { API_URL } from '../lib/area';
import { confirmDialog } from '../components/ConfirmDialog';

interface AreaStoryItem {
  _id: string;
  media_type: 'image' | 'text';
  media_url: string;
  caption: string;
  bg_color: string;
  createdAt: string;
  expiresAt: string;
  pinned: boolean;
  pinned_until: string | null;
  view_count: number;
  like_count: number;
}

// '' = no pin (normal 24 hours), 'forever' = until removed, number = days
const PIN_OPTIONS: { value: string; label: string }[] = [
  { value: 'forever', label: 'Pin until I remove it' },
  { value: '7', label: 'Pin for 7 days' },
  { value: '30', label: 'Pin for 30 days' },
  { value: '90', label: 'Pin for 90 days' },
  { value: 'custom', label: 'Pin for custom days' },
  { value: '', label: 'No pin (24 hours only)' },
];

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

const statusText = (st: AreaStoryItem) => {
  if (st.pinned) return st.pinned_until ? `Pinned till ${fmtDate(st.pinned_until)}` : 'Pinned until removed';
  const h = Math.max(0, Math.round((new Date(st.expiresAt).getTime() - Date.now()) / 3600000));
  return h <= 0 ? 'Ends soon' : `Ends in ${h}h`;
};

// Turns the picker value into the API body, or null when custom days are invalid
const pinBody = (choice: string, customDays: string): Record<string, string> | null => {
  if (choice === 'forever') return { pin: 'forever' };
  if (choice === 'custom') {
    const d = Math.round(Number(customDays));
    return d >= 1 && d <= 3650 ? { pin_days: String(d) } : null;
  }
  if (choice) return { pin_days: choice };
  return {};
};

function PinPicker({ choice, days, onChoice, onDays, allowNone }: {
  choice: string; days: string; onChoice: (v: string) => void; onDays: (v: string) => void; allowNone: boolean;
}) {
  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
      <select className="form-input" value={choice} onChange={(e) => onChoice(e.target.value)} style={{ minWidth: 220 }}>
        {PIN_OPTIONS.filter(o => allowNone || o.value !== '').map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      {choice === 'custom' && (
        <input
          type="number" min={1} max={3650} className="form-input" placeholder="Days"
          value={days} onChange={(e) => onDays(e.target.value)} style={{ width: 100 }}
        />
      )}
    </div>
  );
}

export default function AreaStory() {
  const [name, setName] = useState('');
  const [stories, setStories] = useState<AreaStoryItem[]>([]);
  const [loading, setLoading] = useState(true);

  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState('');
  const [pinChoice, setPinChoice] = useState('forever');
  const [pinDays, setPinDays] = useState('');
  const [posting, setPosting] = useState(false);

  // Story whose pin is being changed
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editChoice, setEditChoice] = useState('forever');
  const [editDays, setEditDays] = useState('');

  const load = async () => {
    try {
      const res = await axios.get(`${API_URL}/stories/area`);
      setName(res.data?.name || '');
      setStories(Array.isArray(res.data?.stories) ? res.data.stories : []);
    } catch (err: any) {
      toast.error(err.response?.data?.msg || 'Could not load area story');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  useEffect(() => {
    if (!file) { setPreview(''); return; }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const publish = async () => {
    if (!file || posting) return;
    const pin = pinBody(pinChoice, pinDays);
    if (!pin) { toast.error('Enter the number of days (1 to 3650)'); return; }
    setPosting(true);
    try {
      const fd = new FormData();
      fd.append('image', file);
      Object.entries(pin).forEach(([k, v]) => fd.append(k, v));
      await axios.post(`${API_URL}/stories/area`, fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      toast.success('Story published');
      setFile(null);
      load();
    } catch (err: any) {
      toast.error(err.response?.data?.msg || 'Could not publish story');
    } finally {
      setPosting(false);
    }
  };

  const savePin = async (st: AreaStoryItem) => {
    const pin = pinBody(editChoice, editDays);
    if (!pin || !Object.keys(pin).length) { toast.error('Enter the number of days (1 to 3650)'); return; }
    try {
      await axios.post(`${API_URL}/stories/area/${st._id}/pin`, pin);
      toast.success('Pin updated');
      setEditingId(null);
      load();
    } catch (err: any) {
      toast.error(err.response?.data?.msg || 'Could not pin story');
    }
  };

  const unpin = async (st: AreaStoryItem) => {
    const old = Date.now() - new Date(st.createdAt).getTime() > 24 * 3600000;
    const ok = await confirmDialog({
      title: 'Unpin story?',
      message: old
        ? 'This story is older than 24 hours, so it will disappear from the app right away.'
        : 'The story will disappear 24 hours after it was posted.',
      confirmText: 'Unpin',
      danger: old,
    });
    if (!ok) return;
    try {
      await axios.post(`${API_URL}/stories/area/${st._id}/unpin`);
      toast.success('Story unpinned');
      load();
    } catch (err: any) {
      toast.error(err.response?.data?.msg || 'Could not unpin story');
    }
  };

  const remove = async (st: AreaStoryItem) => {
    const ok = await confirmDialog({
      title: 'Delete story?',
      message: 'This story will be removed for everyone.',
      confirmText: 'Delete',
      danger: true,
    });
    if (!ok) return;
    try {
      await axios.delete(`${API_URL}/stories/${st._id}`);
      setStories(prev => prev.filter(x => x._id !== st._id));
      toast.success('Story deleted');
    } catch (err: any) {
      toast.error(err.response?.data?.msg || 'Could not delete story');
    }
  };

  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <h1 className="page-title" style={{ margin: 0 }}>Area Story</h1>
        <p className="page-subtitle" style={{ margin: '4px 0 0' }}>
          {name ? <><b>{name}</b> official page</> : 'Your area official page'}: blue tick, always first in the app's Status bar, seen by everyone in this area.
        </p>
      </div>

      {/* Upload */}
      <div className="card" style={{ padding: 20, marginBottom: 24 }}>
        <div style={{ fontWeight: 700, marginBottom: 12 }}>Upload story</div>
        <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', alignItems: 'flex-start' }}>
          <label style={{
            width: 160, height: 284, borderRadius: 12, border: '2px dashed #CBD5E1', background: '#F8FAFC', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', position: 'relative', flexShrink: 0,
          }}>
            {preview ? (
              <>
                <img src={preview} alt="" style={{ width: '100%', height: '100%', objectFit: 'contain', background: '#0F172A' }} />
                <button
                  type="button"
                  onClick={(e) => { e.preventDefault(); setFile(null); }}
                  style={{ position: 'absolute', top: 6, right: 6, width: 26, height: 26, borderRadius: 13, border: 'none', background: 'rgba(0,0,0,0.6)', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                >
                  <X size={14} />
                </button>
              </>
            ) : (
              <div style={{ textAlign: 'center', color: '#64748B', fontSize: 13, padding: 12 }}>
                <ImageIcon size={30} color="#94A3B8" style={{ margin: '0 auto 8px' }} />
                Click to choose photo
                <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 4 }}>1080 x 1920 px (9:16)</div>
              </div>
            )}
            <input type="file" accept="image/*" style={{ display: 'none' }} onChange={(e) => setFile(e.target.files?.[0] || null)} />
          </label>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 14, flex: 1, minWidth: 260 }}>
            <div>
              <div className="form-label" style={{ fontWeight: 600, marginBottom: 6 }}>How long should it stay?</div>
              <PinPicker choice={pinChoice} days={pinDays} onChoice={setPinChoice} onDays={setPinDays} allowNone />
            </div>
            <div>
              <button type="button" className="btn btn-primary" onClick={publish} disabled={!file || posting} style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                <Upload size={16} /> {posting ? 'Publishing...' : 'Publish story'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Live stories */}
      <div style={{ fontWeight: 700, marginBottom: 12 }}>Live stories</div>
      {loading ? (
        <div className="card" style={{ padding: 30, textAlign: 'center', color: '#64748B' }}>Loading...</div>
      ) : stories.length === 0 ? (
        <div className="card" style={{ padding: 30, textAlign: 'center', color: '#64748B' }}>
          No story yet. Upload one above, it will show first in the app's Status bar.
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 16 }}>
          {stories.map(st => (
            <div key={st._id} className="card" style={{ padding: 0, overflow: 'hidden' }}>
              <div style={{ height: 300, background: st.media_type === 'text' ? st.bg_color : '#0F172A', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
                {st.media_type === 'image'
                  ? <img src={st.media_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                  : <div style={{ color: '#fff', fontWeight: 700, padding: 16, textAlign: 'center' }}>{st.caption}</div>}
                <span style={{
                  position: 'absolute', top: 10, left: 10, display: 'inline-flex', alignItems: 'center', gap: 4,
                  background: st.pinned ? '#2563EB' : 'rgba(15,23,42,0.7)', color: '#fff', fontSize: 11, fontWeight: 700, borderRadius: 999, padding: '4px 10px',
                }}>
                  {st.pinned && <Pin size={12} />} {statusText(st)}
                </span>
              </div>
              <div style={{ padding: 14 }}>
                <div style={{ display: 'flex', gap: 14, color: '#64748B', fontSize: 13, marginBottom: 12 }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><Eye size={14} /> {st.view_count}</span>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><Heart size={14} /> {st.like_count}</span>
                  <span style={{ marginLeft: 'auto' }}>Posted {fmtDate(st.createdAt)}</span>
                </div>

                {editingId === st._id ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <PinPicker choice={editChoice} days={editDays} onChoice={setEditChoice} onDays={setEditDays} allowNone={false} />
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button type="button" className="btn btn-primary" onClick={() => savePin(st)}>Save pin</button>
                      <button type="button" className="btn btn-outline" onClick={() => setEditingId(null)}>Cancel</button>
                    </div>
                  </div>
                ) : (
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <button
                      type="button" className="btn btn-outline"
                      onClick={() => { setEditingId(st._id); setEditChoice('forever'); setEditDays(''); }}
                      style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
                    >
                      <Pin size={14} /> {st.pinned ? 'Change pin' : 'Pin'}
                    </button>
                    {st.pinned && (
                      <button type="button" className="btn btn-outline" onClick={() => unpin(st)} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                        <PinOff size={14} /> Unpin
                      </button>
                    )}
                    <button type="button" className="btn btn-outline" onClick={() => remove(st)} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: 'var(--danger)' }}>
                      <Trash2 size={14} /> Delete
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
