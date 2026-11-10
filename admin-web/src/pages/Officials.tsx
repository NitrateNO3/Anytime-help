import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { toast } from 'react-hot-toast';
import { Plus, Edit, Trash2, X, BadgeCheck } from 'lucide-react';
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
  phone: string;
  verified: boolean;
  is_active: boolean;
  order: number;
  followers_count: number;
}

const EMPTY = { name: '', designation: 'Parshad', ward: '', phone: '', order: 100, verified: true, is_active: true };

export default function Officials() {
  const [list, setList] = useState<Official[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [form, setForm] = useState({ ...EMPTY });

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
    const socket = io(SOCKET_URL, { ...socketAuth(), transports: ['websocket', 'polling'] });
    socket.on('officials_updated', () => fetchList(false));
    return () => { socket.disconnect(); };
  }, []);

  const openAdd = () => { setEditingId(null); setForm({ ...EMPTY }); setIsModalOpen(true); };
  const openEdit = (o: Official) => {
    setEditingId(o._id);
    setForm({ name: o.name, designation: o.designation, ward: o.ward, phone: o.phone, order: o.order, verified: o.verified, is_active: o.is_active });
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const t = toast.loading(editingId ? 'Updating...' : 'Adding...');
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
          <p className="page-subtitle">Shown to residents of every area on the Community screen ({list.length})</p>
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
              <th>Followers</th>
              <th>Status</th>
              {canManage && <th>Actions</th>}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6}><div className="skeleton skeleton-row" style={{ width: '60%' }} /></td></tr>
            ) : list.length === 0 ? (
              <tr><td colSpan={6} style={{ textAlign: 'center', padding: 30 }}>No officials yet. Add your ward Parshad!</td></tr>
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
                <td>{o.followers_count}</td>
                <td>
                  <span style={{ fontSize: 12, fontWeight: 600, padding: '3px 10px', borderRadius: 12, background: o.is_active ? '#ECFDF5' : '#F3F4F6', color: o.is_active ? '#059669' : '#6B7280' }}>
                    {o.is_active ? 'Visible' : 'Hidden'}
                  </span>
                </td>
                {canManage && (
                  <td>
                    <div style={{ display: 'flex', gap: 8 }}>
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
                <label className="form-label">Phone (Optional)</label>
                <input className="form-control" value={form.phone} onChange={e => set('phone', e.target.value)} />
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
