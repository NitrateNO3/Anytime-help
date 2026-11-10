import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { toast } from 'react-hot-toast';
import { Plus, Edit, Trash2, X, BadgeCheck, ImagePlus, Newspaper } from 'lucide-react';
import { io } from 'socket.io-client';
import { socketAuth, isPlatformSuperAdmin } from '../lib/area';
import '../index.css';

const API_URL = 'https://anytime-help.onrender.com/api';
const SOCKET_URL = 'https://anytime-help.onrender.com';

interface Official {
  _id: string;
  name: string;
  designation: string;
  ward: string;
  bio?: string;
  phone: string;
  verified: boolean;
  is_active: boolean;
  order: number;
  followers_count: number;
  all_areas?: boolean;
  areas?: { _id: string; name?: string }[];
}

interface OfficialPost {
  _id: string;
  text: string;
  image_url: string;
  createdAt: string;
  counts: { like: number; love: number };
}

const EMPTY = {
  name: '', designation: 'Parshad', ward: '', bio: '', phone: '', order: 100, verified: true, is_active: true,
  all_areas: true, areas: [] as string[],
};

// Super Admin: post / delete updates on one official's page
function PostsModal({ official, onClose }: { official: Official; onClose: () => void }) {
  const [posts, setPosts] = useState<OfficialPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [posting, setPosting] = useState(false);
  const headers = () => ({ 'x-auth-token': localStorage.getItem('adminToken') || '' });

  const load = async () => {
    try {
      const res = await axios.get(`${API_URL}/officials/${official._id}/posts?limit=50`, { headers: headers() });
      setPosts(res.data?.posts || []);
    } catch {
      toast.error('Failed to load updates');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [official._id]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim() && !file) return toast.error('Add some text or a photo');
    setPosting(true);
    const t = toast.loading('Posting update...');
    try {
      const fd = new FormData();
      fd.append('text', text.trim());
      if (file) fd.append('image', file);
      await axios.post(`${API_URL}/officials/${official._id}/posts`, fd, { headers: headers() });
      toast.success('Update posted. Followers will be notified.', { id: t });
      setText('');
      setFile(null);
      load();
    } catch (err: any) {
      toast.error(err.response?.data?.msg || 'Failed to post', { id: t });
    } finally {
      setPosting(false);
    }
  };

  const remove = async (id: string) => {
    if (!window.confirm('Delete this update? It will be removed from the app.')) return;
    try {
      await axios.delete(`${API_URL}/officials/posts/${id}`, { headers: headers() });
      setPosts(p => p.filter(x => x._id !== id));
      toast.success('Update deleted');
    } catch {
      toast.error('Failed to delete');
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content" style={{ maxWidth: 620 }}>
        <div className="modal-header">
          <h2 className="modal-title">Updates · {official.name}</h2>
          <button className="btn-icon" onClick={onClose}><X size={20} /></button>
        </div>
        <div className="modal-body" style={{ maxHeight: '70vh', overflowY: 'auto' }}>
          <form onSubmit={submit} style={{ marginBottom: 20 }}>
            <div className="form-group">
              <label className="form-label">New update</label>
              <textarea className="form-control" rows={3} maxLength={3000} value={text} onChange={e => setText(e.target.value)} placeholder="e.g., Inspected road resurfacing on the Sushant Lok 2 main road today..." />
            </div>
            <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <label className="btn btn-outline" style={{ cursor: 'pointer', margin: 0 }}>
                <ImagePlus size={16} /> {file ? 'Change photo' : 'Add photo'}
                <input type="file" accept="image/*" style={{ display: 'none' }} onChange={e => setFile(e.target.files?.[0] || null)} />
              </label>
              {file && <span style={{ fontSize: 13, color: '#6B7280' }}>{file.name} <button type="button" className="btn-icon" onClick={() => setFile(null)}><X size={14} /></button></span>}
              <button type="submit" className="btn btn-primary" style={{ marginLeft: 'auto' }} disabled={posting}>Post Update</button>
            </div>
          </form>

          {loading ? <p>Loading...</p> : posts.length === 0 ? (
            <p style={{ color: '#6B7280', textAlign: 'center' }}>No updates posted yet.</p>
          ) : posts.map(p => (
            <div key={p._id} style={{ border: '1px solid var(--border-color)', borderRadius: 12, padding: 12, marginBottom: 12 }}>
              {p.image_url && <img src={p.image_url} alt="" style={{ width: '100%', maxHeight: 240, objectFit: 'cover', borderRadius: 8, marginBottom: 8 }} />}
              {p.text && <p style={{ margin: '0 0 8px', whiteSpace: 'pre-wrap' }}>{p.text}</p>}
              <div style={{ display: 'flex', alignItems: 'center', fontSize: 12, color: '#6B7280', gap: 12 }}>
                <span>{new Date(p.createdAt).toLocaleString('en-IN')}</span>
                <span>👍 {p.counts.like} · ❤️ {p.counts.love}</span>
                <button className="btn-icon btn-icon-danger" style={{ marginLeft: 'auto' }} onClick={() => remove(p._id)} title="Delete"><Trash2 size={15} /></button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function Officials() {
  const [list, setList] = useState<Official[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [form, setForm] = useState({ ...EMPTY });
  const [postsFor, setPostsFor] = useState<Official | null>(null);
  const [allAreas, setAllAreas] = useState<{ _id: string; name: string; city?: string }[]>([]);

  // Officials are managed only by the platform Super Admin
  const canManage = isPlatformSuperAdmin();
  const config = () => ({ headers: { 'x-auth-token': localStorage.getItem('adminToken') } });

  const fetchList = async (showLoading = true) => {
    if (showLoading) setLoading(true);
    try {
      const res = await axios.get(`${API_URL}/officials?all=true`, config());
      setList(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error(err);
      toast.error('Failed to fetch officials');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!canManage) return;
    fetchList();
    axios.get(`${API_URL}/areas`, config())
      .then(res => setAllAreas(Array.isArray(res.data) ? res.data.map((a: any) => ({ _id: a._id, name: a.name, city: a.city })) : []))
      .catch(() => toast.error('Failed to load areas'));
    const socket = io(SOCKET_URL, { ...socketAuth(), transports: ['websocket', 'polling'] });
    socket.on('officials_updated', () => fetchList(false));
    return () => { socket.disconnect(); };
  }, []);

  const openAdd = () => { setEditingId(null); setForm({ ...EMPTY }); setIsModalOpen(true); };
  const openEdit = (o: Official) => {
    setEditingId(o._id);
    setForm({
      name: o.name, designation: o.designation, ward: o.ward, bio: o.bio || '', phone: o.phone || '', order: o.order,
      verified: o.verified, is_active: o.is_active,
      all_areas: o.all_areas !== false, areas: (o.areas || []).map(a => a._id),
    });
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const t = toast.loading(editingId ? 'Updating...' : 'Adding...');
    if (!form.all_areas && form.areas.length === 0) {
      toast.error('Select at least one area, or choose All areas', { id: t });
      return;
    }
    try {
      if (editingId) await axios.put(`${API_URL}/officials/${editingId}`, form, config());
      else await axios.post(`${API_URL}/officials`, form, config());
      toast.success(editingId ? 'Official updated' : 'Official added', { id: t });
      setIsModalOpen(false);
      fetchList(false);
    } catch (err: any) {
      toast.error(err.response?.data?.msg || 'Failed to save', { id: t });
    }
  };

  const executeDelete = async () => {
    if (!deleteId) return;
    const t = toast.loading('Deleting...');
    try {
      await axios.delete(`${API_URL}/officials/${deleteId}`, config());
      toast.success('Official deleted', { id: t });
      setDeleteId(null);
      fetchList(false);
    } catch {
      toast.error('Failed to delete', { id: t });
    }
  };

  const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }));

  if (!canManage) {
    return (
      <div className="page-container fade-in">
        <h1 className="page-title">Officials</h1>
        <p className="page-subtitle">Only the Super Admin can manage officials.</p>
      </div>
    );
  }

  return (
    <div className="page-container fade-in">
      <header className="page-header">
        <div>
          <h1 className="page-title">Officials</h1>
          <p className="page-subtitle">Create officials and choose which areas see them on the Community screen ({list.length})</p>
        </div>
        {canManage && (
          <button className="btn btn-primary" onClick={openAdd}><Plus size={18} /> Add Official</button>
        )}
      </header>

      <div className="table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Designation</th>
              <th>Ward</th>
              <th>Areas</th>
              <th>Followers</th>
              <th>Status</th>
              {canManage && <th>Actions</th>}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7}><div className="skeleton skeleton-row" style={{ width: '60%' }} /></td></tr>
            ) : list.length === 0 ? (
              <tr><td colSpan={7} style={{ textAlign: 'center', padding: 30 }}>No officials yet. Add your ward Parshad!</td></tr>
            ) : list.map(o => (
              <tr key={o._id}>
                <td>
                  <div style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
                    {o.name} {o.verified && <BadgeCheck size={16} color="#2563EB" />}
                  </div>
                  {o.phone && <div style={{ color: '#6B7280', fontSize: 13 }}>{o.phone}</div>}
                </td>
                <td>{o.designation || '-'}</td>
                <td>{o.ward || '-'}</td>
                <td style={{ maxWidth: 220, fontSize: 13 }}>
                  {o.all_areas !== false
                    ? <span style={{ fontWeight: 600, color: '#2563EB' }}>All areas</span>
                    : (o.areas || []).map(a => a.name || '?').join(', ') || '-'}
                </td>
                <td>{o.followers_count}</td>
                <td>
                  <span style={{ fontSize: 12, fontWeight: 600, padding: '3px 10px', borderRadius: 12, background: o.is_active ? '#ECFDF5' : '#F3F4F6', color: o.is_active ? '#059669' : '#6B7280' }}>
                    {o.is_active ? 'Visible' : 'Hidden'}
                  </span>
                </td>
                {canManage && (
                  <td>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button className="btn-icon" onClick={() => setPostsFor(o)} title="Updates"><Newspaper size={16} /></button>
                      <button className="btn-icon" onClick={() => openEdit(o)} title="Edit"><Edit size={16} /></button>
                      <button className="btn-icon btn-icon-danger" onClick={() => setDeleteId(o._id)} title="Delete"><Trash2 size={16} /></button>
                    </div>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {isModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h2 className="modal-title">{editingId ? 'Edit Official' : 'Add Official'}</h2>
              <button className="btn-icon" onClick={() => setIsModalOpen(false)}><X size={20} /></button>
            </div>
            <form onSubmit={handleSubmit} className="modal-body">
              <div className="form-group">
                <label className="form-label">Name</label>
                <input className="form-control" value={form.name} onChange={e => set('name', e.target.value)} required placeholder="e.g., Sonia Yadav" />
              </div>
              <div className="form-group">
                <label className="form-label">Designation</label>
                <input className="form-control" value={form.designation} onChange={e => set('designation', e.target.value)} placeholder="e.g., Parshad, MLA" />
              </div>
              <div className="form-group">
                <label className="form-label">Ward (Optional)</label>
                <input className="form-control" value={form.ward} onChange={e => set('ward', e.target.value)} placeholder="e.g., 21" />
              </div>
              <div className="form-group">
                <label className="form-label">About (shown on top of their page)</label>
                <textarea className="form-control" rows={2} maxLength={300} value={form.bio} onChange={e => set('bio', e.target.value)} placeholder="e.g., Updates from your ward councillor on ward works, camps and public meetings." />
              </div>
              <div className="form-group">
                <label className="form-label">Official's App Login Mobile (Optional)</label>
                <input className="form-control" value={form.phone} onChange={e => set('phone', e.target.value)} placeholder="e.g., 9876543210" />
                <small style={{ color: '#6B7280', fontSize: 12, display: 'block', marginTop: 4 }}>
                  When the official logs into the app with this number, they can post updates on their own page. Kept private — not shown to residents.
                </small>
              </div>
              <div className="form-group">
                <label className="form-label">Show in Areas</label>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontWeight: 600, marginBottom: 8 }}>
                  <input type="checkbox" style={{ width: 'auto' }} checked={form.all_areas} onChange={e => set('all_areas', e.target.checked)} />
                  All areas (current and future)
                </label>
                {!form.all_areas && (
                  <div style={{ border: '1px solid var(--border-color)', borderRadius: 8, padding: 10, maxHeight: 200, overflowY: 'auto' }}>
                    {allAreas.length === 0 ? (
                      <span style={{ fontSize: 13, color: '#6B7280' }}>No areas found.</span>
                    ) : (
                      <>
                        <div style={{ display: 'flex', gap: 12, marginBottom: 8, fontSize: 12 }}>
                          <button type="button" className="btn-link" style={{ background: 'none', border: 'none', color: '#2563EB', cursor: 'pointer', padding: 0 }} onClick={() => set('areas', allAreas.map(a => a._id))}>Select all</button>
                          <button type="button" className="btn-link" style={{ background: 'none', border: 'none', color: '#2563EB', cursor: 'pointer', padding: 0 }} onClick={() => set('areas', [])}>Clear</button>
                          <span style={{ marginLeft: 'auto', color: '#6B7280' }}>{form.areas.length} selected</span>
                        </div>
                        {allAreas.map(a => (
                          <label key={a._id} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', padding: '4px 0', fontWeight: 400 }}>
                            <input
                              type="checkbox"
                              style={{ width: 'auto' }}
                              checked={form.areas.includes(a._id)}
                              onChange={e => set('areas', e.target.checked ? [...form.areas, a._id] : form.areas.filter(id => id !== a._id))}
                            />
                            <span style={{ fontSize: 14 }}>{a.name}{a.city ? <span style={{ color: '#6B7280' }}> · {a.city}</span> : null}</span>
                          </label>
                        ))}
                      </>
                    )}
                  </div>
                )}
              </div>
              <div className="form-group">
                <label className="form-label">Display Order (lower shows first)</label>
                <input type="number" className="form-control" value={form.order} onChange={e => set('order', Number(e.target.value))} />
              </div>
              <div className="form-group" style={{ display: 'flex', gap: 20 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                  <input type="checkbox" style={{ width: 'auto' }} checked={form.verified} onChange={e => set('verified', e.target.checked)} /> Verified badge
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                  <input type="checkbox" style={{ width: 'auto' }} checked={form.is_active} onChange={e => set('is_active', e.target.checked)} /> Visible in app
                </label>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-outline" onClick={() => setIsModalOpen(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">{editingId ? 'Update' : 'Add Official'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {postsFor && <PostsModal official={postsFor} onClose={() => setPostsFor(null)} />}

      {deleteId && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: 400 }}>
            <div className="modal-header"><h2 className="modal-title">Delete Official</h2></div>
            <div className="modal-body">
              <p style={{ fontWeight: 600, marginBottom: 12 }}>Are you sure you want to delete this official?</p>
              <p style={{ color: 'var(--text-secondary)' }}>Their followers list will also be removed.</p>
            </div>
            <div className="modal-footer">
              <button className="btn btn-outline" onClick={() => setDeleteId(null)}>Cancel</button>
              <button className="btn btn-primary" style={{ background: 'var(--danger)' }} onClick={executeDelete}>Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
