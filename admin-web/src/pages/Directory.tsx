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
  const [formData, setFormData] = useState({ name: '', phone: '', order: 0 });

  useEffect(() => {
    fetchContacts();

    const socket = io(SOCKET_URL, { transports: ['websocket', 'polling'] });
    
    socket.on('directory_updated', (payload) => {
      if (!payload) {
        fetchContacts();
        return;
      }
      
      setContacts(prev => {
        if (payload.action === 'create') {
          return [...prev, payload.data];
        } else if (payload.action === 'update') {
          return prev.map(c => c._id === payload.data._id ? payload.data : c);
        } else if (payload.action === 'delete') {
          return prev.filter(c => c._id !== payload.id);
        }
        return prev;
      });
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  const fetchContacts = async () => {
    try {
      const res = await axios.get(`${API_URL}/directory`);
      setContacts(res.data);
    } catch (error) {
      console.error(error);
      toast.error('Failed to fetch directory contacts');
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const openAddModal = () => {
    setEditingId(null);
    setFormData({ name: '', phone: '', order: 0 });
    setIsModalOpen(true);
  };

  const openEditModal = (contact: any) => {
    setEditingId(contact._id);
    setFormData({ name: contact.name, phone: contact.phone, order: contact.order || 0 });
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const loadingToast = toast.loading(editingId ? 'Updating contact...' : 'Adding contact...');
    
    const token = localStorage.getItem('adminToken');
    const config = { headers: { 'x-auth-token': token } };

    try {
      if (editingId) {
        await axios.put(`${API_URL}/directory/${editingId}`, formData, config);
        toast.success('Contact updated successfully', { id: loadingToast });
      } else {
        await axios.post(`${API_URL}/directory`, formData, config);
        toast.success('Contact added successfully', { id: loadingToast });
      }
      setIsModalOpen(false);
      fetchContacts();
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
      fetchContacts();
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
          <p className="page-subtitle">Manage important contacts for residents</p>
        </div>
        <button className="btn btn-primary" onClick={openAddModal}>
          <Plus size={18} /> Add Contact
        </button>
      </header>

      <div className="table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Phone</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
                [1, 2, 3].map(idx => (
                  <tr key={`skeleton-${idx}`}>
                    <td><div className="skeleton skeleton-row" style={{ width: '80%' }}></div></td>
                    <td><div className="skeleton skeleton-row" style={{ width: '60%' }}></div></td>
                    <td><div className="skeleton skeleton-row" style={{ width: 60, height: 24, borderRadius: 12 }}></div></td>
                  </tr>
                ))
              ) : contacts.length === 0 ? (
                <tr>
                  <td colSpan={3} style={{ textAlign: 'center', padding: '30px' }}>No contacts found. Add your first important number!</td>
                </tr>
              ) : (
                contacts.map(contact => (
                  <tr key={contact._id}>
                    <td><div style={{ fontWeight: 600 }}>{contact.name}</div></td>
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
                <input type="text" className="form-control" name="name" value={formData.name} onChange={handleInputChange} required placeholder="e.g., Police, Ambulance" />
              </div>
              
              <div className="form-group">
                <label className="form-label">Phone Number</label>
                <input type="text" className="form-control" name="phone" value={formData.phone} onChange={handleInputChange} required placeholder="e.g., 100, 108" />
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