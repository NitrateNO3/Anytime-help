import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'react-hot-toast';
import { Plus, Edit, Trash2, Phone, X } from 'lucide-react';
import { io } from 'socket.io-client';
import '../index.css';

const API_URL = 'https://anytime-help.onrender.com/api';
const SOCKET_URL = 'https://anytime-help.onrender.com';

export default function Directory() {
  const [contacts, setContacts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({ name: '', phone: '', role: '', order: 100 });
  const [selectedPhases, setSelectedPhases] = useState<string[]>(['All']);
  const [filterPhase, setFilterPhase] = useState('All Groups (Show Everything)');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  const availablePhases = ['Sushant Lok 2 - C,D,E', 'Sushant Lok 2 - F,G', 'Sushant Lok 3'];

  useEffect(() => {
    fetchContacts(page, filterPhase);

    const socket = io(SOCKET_URL, { transports: ['websocket', 'polling'] });
    socket.on('directory_updated', () => {
      fetchContacts(page, filterPhase, false);
    });

    return () => {
      socket.disconnect();
    };
  }, [page, filterPhase]);

  const fetchContacts = async (currentPage = page, phaseFilter = filterPhase, showLoading = true) => {
    try {
      if (showLoading) setLoading(true);
      const token = localStorage.getItem('adminToken');
      const res = await axios.get(`${API_URL}/directory?page=${currentPage}&limit=10&phase=${encodeURIComponent(phaseFilter)}`, {
        headers: { 'x-auth-token': token }
      });
      if (res.data && res.data.directory) {
        setContacts(res.data.directory);
        setTotalCount(res.data.total || 0);
        setTotalPages(res.data.totalPages || 1);
      } else if (Array.isArray(res.data)) {
        setContacts(res.data);
        setTotalCount(res.data.length);
        setTotalPages(Math.ceil(res.data.length / 10) || 1);
      }
    } catch (error) {
      console.error(error);
      toast.error('Failed to fetch directory contacts');
    } finally {
      if (showLoading) setLoading(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const openAddModal = () => {
    setEditingId(null);
    setFormData({ name: '', phone: '', role: '', order: 100 });
    setSelectedPhases(['All']);
    setIsModalOpen(true);
  };

  const openEditModal = (contact: any) => {
    setEditingId(contact._id);
    setFormData({ name: contact.name, phone: contact.phone, role: contact.role || '', order: contact.order || 100 });
    setSelectedPhases(contact.phases && contact.phases.length > 0 ? contact.phases : ['All']);
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const loadingToast = toast.loading(editingId ? 'Updating contact...' : 'Adding contact...');
    
    const token = localStorage.getItem('adminToken');
    const config = { headers: { 'x-auth-token': token } };

    try {
      let calculatedOrder = 100;
      if (formData.role === 'President') calculatedOrder = 1;
      else if (formData.role === 'VP') calculatedOrder = 2;
      else if (formData.role === 'G.Secretary') calculatedOrder = 3;
      else if (formData.role === 'Asst. Secretary') calculatedOrder = 4;
      else if (formData.role === 'Treasurer') calculatedOrder = 5;
      else if (formData.role === 'Executive') calculatedOrder = 6;

      const payload = { ...formData, order: calculatedOrder, phases: selectedPhases };

      if (editingId) {
        await axios.put(`${API_URL}/directory/${editingId}`, payload, config);
        toast.success('Contact updated successfully', { id: loadingToast });
      } else {
        await axios.post(`${API_URL}/directory`, payload, config);
        toast.success('Contact added successfully', { id: loadingToast });
      }
      setIsModalOpen(false);
      fetchContacts(page, filterPhase, false);
    } catch (error) {
      console.error(error);
      toast.error('Failed to save contact', { id: loadingToast });
    }
  };

  const confirmDelete = (id: string) => {
    setDeleteId(id);
  };

  const executeDelete = async () => {
    if (!deleteId) return;
    
    const token = localStorage.getItem('adminToken');
    const loadingToast = toast.loading('Deleting contact...');
    
    try {
      await axios.delete(`${API_URL}/directory/${deleteId}`, { headers: { 'x-auth-token': token } });
      toast.success('Contact deleted successfully', { id: loadingToast });
      setDeleteId(null);
      fetchContacts(page, filterPhase, false);
    } catch (error) {
      console.error(error);
      toast.error('Failed to delete contact', { id: loadingToast });
    }
  };

  return (
    <div className="page-container fade-in">
      <header className="page-header">
        <div>
          <h1 className="page-title">Directory Management</h1>
          <p className="page-subtitle">Manage important contacts for residents ({totalCount})</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <select 
            value={filterPhase} 
            onChange={(e) => {
              setFilterPhase(e.target.value);
              setPage(1);
            }}
            style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--border-color)', outline: 'none' }}
          >
            <option value="All Groups (Show Everything)">All Groups (Show Everything)</option>
            <option value="Universal (Sent to Everyone)">Universal (Sent to Everyone)</option>
            <option value="Sushant Lok 2 - C,D,E">Sushant Lok 2 - C,D,E</option>
            <option value="Sushant Lok 2 - F,G">Sushant Lok 2 - F,G</option>
            <option value="Sushant Lok 3">Sushant Lok 3</option>
          </select>
          <button className="btn btn-primary" onClick={openAddModal}>
            <Plus size={18} /> Add Contact
          </button>
        </div>
      </header>

      <div className="table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Role / Designation</th>
              <th>Phone</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
                [1, 2, 3].map(idx => (
                  <tr key={`skeleton-${idx}`}>
                    <td><div className="skeleton skeleton-row" style={{ width: '80%' }}></div></td>
                    <td><div className="skeleton skeleton-row" style={{ width: '50%' }}></div></td>
                    <td><div className="skeleton skeleton-row" style={{ width: '60%' }}></div></td>
                    <td><div className="skeleton skeleton-row" style={{ width: 60, height: 24, borderRadius: 12 }}></div></td>
                  </tr>
                ))
              ) : contacts.length === 0 ? (
                <tr>
                  <td colSpan={4} style={{ textAlign: 'center', padding: '30px' }}>No contacts found for this filter. Add your first important number!</td>
                </tr>
              ) : (
                contacts.map(contact => (
                  <tr key={contact._id}>
                    <td><div style={{ fontWeight: 600 }}>{contact.name}</div></td>
                    <td><div style={{ color: '#6B7280', fontSize: 14 }}>{contact.role || '-'}</div></td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Phone size={14} color="#6B7280" /> {contact.phone}
                      </div>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button className="btn-icon" onClick={() => openEditModal(contact)} title="Edit">
                          <Edit size={16} />
                        </button>
                        <button className="btn-icon btn-icon-danger" onClick={() => confirmDelete(contact._id)} title="Delete">
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>

        {/* Pagination Controls */}
        {totalPages > 1 && (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 20, padding: '0 10px' }}>
            <span style={{ fontSize: 14, color: 'var(--text-muted)' }}>
              Page {page} of {totalPages}
            </span>
            <div style={{ display: 'flex', gap: 10 }}>
              <button 
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                style={{ padding: '6px 12px', borderRadius: 8, border: '1px solid var(--border-color)', background: page === 1 ? '#f3f4f6' : 'white', cursor: page === 1 ? 'not-allowed' : 'pointer' }}
              >
                Previous
              </button>
              <button 
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                style={{ padding: '6px 12px', borderRadius: 8, border: '1px solid var(--border-color)', background: page === totalPages ? '#f3f4f6' : 'white', cursor: page === totalPages ? 'not-allowed' : 'pointer' }}
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {isModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h2 className="modal-title">{editingId ? 'Edit Contact' : 'Add Contact'}</h2>
              <button className="btn-icon" onClick={() => setIsModalOpen(false)}><X size={20} /></button>
            </div>
            
            <form onSubmit={handleSubmit} className="modal-body">
              <div className="form-group">
                <label className="form-label">Contact Name</label>
                <input type="text" className="form-control" name="name" value={formData.name} onChange={handleInputChange} required placeholder="e.g., Police, Ambulance, John Doe" />
              </div>
              
              <div className="form-group">
                <label className="form-label">Role / Designation (Optional)</label>
                <select className="form-control" name="role" value={formData.role} onChange={handleInputChange} style={{ padding: '10px 14px', borderRadius: '8px', border: '1px solid var(--border-color)', outline: 'none', backgroundColor: '#F8FAFC' }}>
                  <option value="">None (e.g. Police, Ambulance)</option>
                  <option value="President">President</option>
                  <option value="VP">VP</option>
                  <option value="G.Secretary">G.Secretary</option>
                  <option value="Asst. Secretary">Asst. Secretary</option>
                  <option value="Treasurer">Treasurer</option>
                  <option value="Executive">Executive</option>
                </select>
              </div>
              
              <div className="form-group">
                <label className="form-label">Phone Number</label>
                <input type="text" className="form-control" name="phone" value={formData.phone} onChange={handleInputChange} required placeholder="e.g., 100, 108" />
              </div>

              <div className="form-group" style={{ marginBottom: 16 }}>
                <label className="form-label" style={{ marginBottom: 8, display: 'block', fontWeight: 500, fontSize: 14 }}>Target Groups</label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', margin: 0, fontWeight: 500 }}>
                    <input 
                      type="checkbox" 
                      style={{ width: 'auto', marginBottom: 0 }}
                      checked={selectedPhases.includes('All')}
                      onChange={(e) => {
                        if (e.target.checked) setSelectedPhases(['All']);
                      }}
                    />
                    <span style={{ fontSize: 14 }}>All Groups (Send to Everyone)</span>
                  </label>
                  
                  <div style={{ paddingLeft: 24, display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {availablePhases.map(phase => (
                      <label key={phase} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', margin: 0, fontWeight: 400 }}>
                        <input 
                          type="checkbox" 
                          style={{ width: 'auto', marginBottom: 0 }}
                          checked={selectedPhases.includes(phase)}
                          onChange={(e) => {
                            let updated = [...selectedPhases].filter(p => p !== 'All');
                            if (e.target.checked) {
                              updated.push(phase);
                            } else {
                              updated = updated.filter(p => p !== phase);
                            }
                            if (updated.length === 0) updated = ['All'];
                            setSelectedPhases(updated);
                          }}
                        />
                        <span style={{ fontSize: 14 }}>{phase}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-outline" onClick={() => setIsModalOpen(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">{editingId ? 'Update Contact' : 'Add Contact'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteId && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '400px' }}>
            <div className="modal-header">
              <h2 className="modal-title">Delete Contact</h2>
            </div>
            <div className="modal-body">
              <p style={{ fontWeight: 600, marginBottom: 12, color: 'var(--text-main)' }}>Are you sure you want to delete this contact?</p>
              <p style={{ color: 'var(--text-secondary)' }}>This action cannot be undone and will be immediately reflected in the app.</p>
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