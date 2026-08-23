import { useState, useEffect } from 'react';
import axios from 'axios';
import { Home, Trash2, AlertTriangle, X } from 'lucide-react';
import toast from 'react-hot-toast';

const API_URL = import.meta.env.VITE_API_URL || 'https://anytime-help.onrender.com/api';

export default function Residents() {
  const [residents, setResidents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteModal, setDeleteModal] = useState({ isOpen: false, id: '', name: '' });

  useEffect(() => {
    fetchResidents();
  }, []);

  const fetchResidents = async () => {
    try {
      const token = localStorage.getItem('adminToken');
      const res = await axios.get(`${API_URL}/users/residents`, {
        headers: { 'x-auth-token': token }
      });
      setResidents(res.data);
    } catch (error) {
      console.error('Error fetching residents:', error);
    } finally {
      setLoading(false);
    }
  };

  const requestDelete = (id: string, name: string) => {
    setDeleteModal({ isOpen: true, id, name });
  };

  const confirmDelete = async () => {
    const { id } = deleteModal;
    setDeleteModal({ isOpen: false, id: '', name: '' });
    
    try {
      const token = localStorage.getItem('adminToken');
      await axios.delete(`${API_URL}/users/${id}`, {
        headers: { 'x-auth-token': token }
      });
      toast.success('Resident removed successfully');
      setResidents(residents.filter(r => r._id !== id));
    } catch (error: any) {
      console.error('Error deleting resident:', error);
      toast.error(error.response?.data?.message || 'Could not delete resident');
    }
  };

  return (
    <div className="page-container fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">
            <Home size={28} color="var(--primary)" style={{ marginRight: '10px' }} />
            Residents Directory
          </h1>
          <p className="page-subtitle">View all registered residents and their details.</p>
        </div>
      </div>

      <div className="card" style={{ marginTop: '20px' }}>
        <h2 style={{ marginBottom: '20px', fontSize: '18px', fontWeight: '600' }}>Total Registered: {residents.length}</h2>
        {loading ? (
          <div className="loading-spinner" />
        ) : residents.length === 0 ? (
          <p style={{ color: 'var(--text-secondary)' }}>No residents found.</p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="data-table" style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid var(--border)', color: 'var(--text-secondary)' }}>
                  <th style={{ padding: '12px' }}>Name</th>
                  <th style={{ padding: '12px' }}>Phone Number</th>
                  <th style={{ padding: '12px' }}>Address</th>
                  <th style={{ padding: '12px' }}>Relation</th>
                  <th style={{ padding: '12px' }}>Joined Date</th>
                  <th style={{ padding: '12px', textAlign: 'center' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {residents.map((r) => (
                  <tr key={r._id} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '12px', fontWeight: '500' }}>{r.name || 'N/A'}</td>
                    <td style={{ padding: '12px' }}>{r.phone_number}</td>
                    <td style={{ padding: '12px' }}>
                      <span className="badge" style={{ backgroundColor: '#DBEAFE', color: '#1D4ED8' }}>
                        {r.address || 'N/A'}
                      </span>
                    </td>
                    <td style={{ padding: '12px' }}>{r.relation || 'Owner'}</td>
                    <td style={{ padding: '12px', color: 'var(--text-secondary)' }}>
                      {new Date(r.createdAt || r.updatedAt || Date.now()).toLocaleDateString()}
                    </td>
                    <td style={{ padding: '12px', textAlign: 'center' }}>
                      <button 
                        onClick={() => requestDelete(r._id, r.name)}
                        className="btn-icon" 
                        style={{ color: 'var(--danger)', background: 'transparent', border: 'none', cursor: 'pointer' }}
                        title="Remove Resident"
                      >
                        <Trash2 size={18} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Custom Delete Confirmation Modal */}
      {deleteModal.isOpen && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 9999,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          backdropFilter: 'blur(4px)'
        }}>
          <div style={{
            background: 'white', borderRadius: '12px', padding: '24px',
            width: '90%', maxWidth: '400px',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
            position: 'relative'
          }}>
            <button 
              onClick={() => setDeleteModal({ isOpen: false, id: '', name: '' })}
              style={{ position: 'absolute', top: '16px', right: '16px', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}
            >
              <X size={20} />
            </button>
            
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
              <div style={{ 
                background: '#FEE2E2', color: '#DC2626', 
                width: '48px', height: '48px', borderRadius: '50%', 
                display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '16px' 
              }}>
                <AlertTriangle size={24} />
              </div>
              <h3 style={{ margin: '0 0 8px 0', fontSize: '18px', fontWeight: '600', color: 'var(--text-primary)' }}>
                Remove Resident
              </h3>
              <p style={{ margin: '0 0 24px 0', color: 'var(--text-secondary)', fontSize: '14px', lineHeight: '1.5' }}>
                Are you sure you want to remove <strong>{deleteModal.name || 'this resident'}</strong>? This action cannot be undone and they will lose access to the app.
              </p>
              
              <div style={{ display: 'flex', gap: '12px', width: '100%' }}>
                <button 
                  onClick={() => setDeleteModal({ isOpen: false, id: '', name: '' })}
                  style={{ 
                    flex: 1, padding: '10px', borderRadius: '8px', 
                    background: '#F3F4F6', color: '#374151', border: 'none', 
                    fontWeight: '500', cursor: 'pointer' 
                  }}
                >
                  Cancel
                </button>
                <button 
                  onClick={confirmDelete}
                  style={{ 
                    flex: 1, padding: '10px', borderRadius: '8px', 
                    background: '#DC2626', color: 'white', border: 'none', 
                    fontWeight: '500', cursor: 'pointer' 
                  }}
                >
                  Yes, Remove
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
