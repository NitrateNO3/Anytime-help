import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Trash2, Plus, Briefcase } from 'lucide-react';
import toast from 'react-hot-toast';

const API_URL = 'https://anytime-help.onrender.com/api';

export default function PaidServices() {
  const [services, setServices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Form state
  const [name, setName] = useState('');
  const [icon, setIcon] = useState('flash');
  const [basePrice, setBasePrice] = useState('Paid');
  const [isCreating, setIsCreating] = useState(false);

  useEffect(() => {
    fetchServices();
  }, []);

  const fetchServices = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('adminToken');
      const res = await axios.get(`${API_URL}/paid-services/all`, {
        headers: { 'x-auth-token': token }
      });
      setServices(res.data);
    } catch (error) {
      console.error(error);
      toast.error('Failed to fetch paid services');
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsCreating(true);
    const loadingToast = toast.loading('Creating service...');

    try {
      const token = localStorage.getItem('adminToken');
      await axios.post(`${API_URL}/paid-services`, {
        name,
        icon,
        basePrice,
        isActive: true
      }, {
        headers: { 'x-auth-token': token }
      });
      
      toast.success('Service created successfully!', { id: loadingToast });
      setName('');
      setIcon('flash');
      setBasePrice('Paid');
      fetchServices();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to create service', { id: loadingToast });
    } finally {
      setIsCreating(false);
    }
  };

  const handleDelete = (id: string) => {
    toast((t) => (
      <div>
        <p style={{ fontWeight: 600, marginBottom: 12, color: 'var(--text-main)' }}>Are you sure you want to delete this service?</p>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button 
            onClick={() => toast.dismiss(t.id)} 
            style={{ padding: '6px 16px', borderRadius: 8, border: '1px solid var(--border-color)', background: 'white', cursor: 'pointer', fontWeight: 500, color: 'var(--text-main)' }}
          >
            Cancel
          </button>
          <button 
            onClick={async () => {
              toast.dismiss(t.id);
              const loadingToast = toast.loading('Deleting service...');
              try {
                const token = localStorage.getItem('adminToken');
                await axios.delete(`${API_URL}/paid-services/${id}`, {
                  headers: { 'x-auth-token': token }
                });
                toast.success('Service deleted successfully!', { id: loadingToast });
                fetchServices();
              } catch (error) {
                console.error(error);
                toast.error('Failed to delete service', { id: loadingToast });
              }
            }} 
            style={{ padding: '6px 16px', borderRadius: 8, border: 'none', background: 'var(--danger)', color: 'white', cursor: 'pointer', fontWeight: 600 }}
          >
            Delete
          </button>
        </div>
      </div>
    ), { duration: Infinity, style: { minWidth: '300px' } });
  };

  return (
    <div style={{ maxWidth: 1000, margin: '0 auto' }}>
      <header className="page-header" style={{ marginBottom: 24 }}>
        <div>
          <h1 className="page-title">Paid Services</h1>
          <p style={{ color: 'var(--text-muted)', marginTop: 8 }}>Manage dynamic paid services available for residents.</p>
        </div>
      </header>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
        
        {/* Create Form */}
        <div className="glass" style={{ padding: '24px' }}>
          <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 20, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Plus size={20} color="var(--primary)" /> Add New Service
          </h2>
          <form onSubmit={handleCreate}>
            <div className="input-group">
              <label>Service Name</label>
              <input 
                type="text" 
                value={name} 
                onChange={(e) => setName(e.target.value)} 
                required
                placeholder="e.g. AC Repair"
              />
            </div>
            <div className="input-group">
              <label>Icon Name (Ionicons)</label>
              <input 
                type="text" 
                value={icon} 
                onChange={(e) => setIcon(e.target.value)} 
                required
                placeholder="e.g. snow, flash, water, bug"
              />
              <small style={{ color: 'var(--text-muted)', marginTop: 4, display: 'block' }}>Use valid Ionicons names.</small>
            </div>
            <div className="input-group">
              <label>Price Tag / Base Price</label>
              <input 
                type="text" 
                value={basePrice} 
                onChange={(e) => setBasePrice(e.target.value)} 
                required
                placeholder="e.g. Paid, ₹500, /hour"
              />
            </div>
            <button type="submit" className="btn-primary" disabled={isCreating} style={{ width: '100%', marginTop: '16px' }}>
              {isCreating ? 'Creating...' : 'Create Service'}
            </button>
          </form>
        </div>

        {/* List of Services */}
        <div className="glass table-container">
          <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 20 }}>Active Services</h2>
          {loading ? (
            <table style={{ width: '100%' }}>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Icon</th>
                  <th>Price Tag</th>
                  <th style={{ width: 80, textAlign: 'center' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {Array.from({ length: 4 }).map((_, idx) => (
                  <tr key={`skeleton-${idx}`}>
                    <td><div className="skeleton skeleton-row" style={{ width: '80%' }}></div></td>
                    <td><div className="skeleton skeleton-row" style={{ width: 60, height: 24 }}></div></td>
                    <td><div className="skeleton skeleton-row" style={{ width: 80, height: 24, borderRadius: 12 }}></div></td>
                    <td><div className="skeleton skeleton-row" style={{ width: 30, margin: '0 auto' }}></div></td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : services.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
              <Briefcase size={40} color="var(--border-color)" style={{ margin: '0 auto 16px' }} />
              No paid services created yet.
            </div>
          ) : (
            <table style={{ width: '100%' }}>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Icon</th>
                  <th>Price Tag</th>
                  <th style={{ width: 80, textAlign: 'center' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {services.map(service => (
                  <tr key={service._id}>
                    <td style={{ fontWeight: 600 }}>{service.name}</td>
                    <td><code style={{ background: '#f1f5f9', padding: '2px 6px', borderRadius: 4 }}>{service.icon}</code></td>
                    <td>
                      <span style={{ 
                        background: '#fef3c7', 
                        color: '#d97706', 
                        padding: '4px 10px', 
                        borderRadius: '12px', 
                        fontSize: '12px',
                        fontWeight: 700
                      }}>
                        {service.basePrice}
                      </span>
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <button 
                        onClick={() => handleDelete(service._id)}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 8, borderRadius: 8 }}
                      >
                        <Trash2 size={18} color="var(--danger)" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
