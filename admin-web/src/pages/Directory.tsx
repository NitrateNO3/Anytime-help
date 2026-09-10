import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'react-hot-toast';
import { Plus, Edit, Trash2, Phone, X } from 'lucide-react';
import '../index.css';

const API_URL = 'https://anytime-help.onrender.com/api';

export default function Directory() {
  const [contacts, setContacts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({ name: '', role: '', phone: '', icon: 'call', order: 0 });

  useEffect(() => {
    fetchContacts();
  }, []);

  const fetchContacts = async () => {
    try {
      const res = await axios.get(${API_URL}/directory);
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
    setFormData({ name: '', role: '', phone: '', icon: 'call', order: 0 });
    setIsModalOpen(true);
  };

  const openEditModal = (contact: any) => {
    setEditingId(contact._id);
    setFormData({ name: contact.name, role: contact.role, phone: contact.phone, icon: contact.icon || 'call', order: contact.order || 0 });
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const loadingToast = toast.loading(editingId ? 'Updating contact...' : 'Adding contact...');
    
    const token = localStorage.getItem('token');
    const config = { headers: { Authorization: \Bearer \\ } };

    try {
      if (editingId) {
        await axios.put(${API_URL}/directory/\, formData, config);
        toast.success('Contact updated successfully', { id: loadingToast });
      } else {
        await axios.post(${API_URL}/directory, formData, config);
        toast.success('Contact added successfully', { id: loadingToast });
      }
      setIsModalOpen(false);
      fetchContacts();
    } catch (error) {
      console.error(error);
      toast.error('Failed to save contact', { id: loadingToast });
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this contact?')) return;
    
    const token = localStorage.getItem('token');
    const loadingToast = toast.loading('Deleting contact...');
    
    try {
      await axios.delete(${API_URL}/directory/\, { headers: { Authorization: \Bearer \\ } });
      toast.success('Contact deleted successfully', { id: loadingToast });
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

      {loading ? (
        <div style={{ textAlign: 'center', padding: '40px' }}>Loading contacts...</div>
      ) : (
        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Role / Category</th>
                <th>Phone</th>
                <th>Icon Name</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {contacts.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ textAlign: 'center', padding: '30px' }}>No contacts found. Add your first important number!</td>
                </tr>
              ) : (
                contacts.map(contact => (
                  <tr key={contact._id}>
                    <td><div style={{ fontWeight: 600 }}>{contact.name}</div></td>
                    <td><span className="badge badge-blue">{contact.role}</span></td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Phone size={14} color="#6B7280" /> {contact.phone}
                      </div>
                    </td>
                    <td>{contact.icon}</td>
                    <td>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button className="btn-icon" onClick={() => openEditModal(contact)} title="Edit">
                          <Edit size={16} />
                        </button>
                        <button className="btn-icon btn-icon-danger" onClick={() => handleDelete(contact._id)} title="Delete">
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
      )}

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
                <label className="form-label">Role / Category</label>
                <input type="text" className="form-control" name="role" value={formData.role} onChange={handleInputChange} required placeholder="e.g., Law Enforcement" />
              </div>
              
              <div className="form-group">
                <label className="form-label">Phone Number</label>
                <input type="text" className="form-control" name="phone" value={formData.phone} onChange={handleInputChange} required placeholder="e.g., 100, 108" />
              </div>

              <div className="form-group">
                <label className="form-label">Icon (Ionicons name)</label>
                <input type="text" className="form-control" name="icon" value={formData.icon} onChange={handleInputChange} placeholder="e.g., call, shield-checkmark" />
                <small style={{ color: '#6B7280', marginTop: '4px', display: 'block' }}>See ionic.io/ionicons for valid names.</small>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-outline" onClick={() => setIsModalOpen(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">{editingId ? 'Update Contact' : 'Add Contact'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}