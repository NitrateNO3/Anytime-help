import { useState, useEffect } from 'react';
import axios from 'axios';
import { Home, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';

const API_URL = import.meta.env.VITE_API_URL || 'https://anytime-help.onrender.com/api';

export default function Residents() {
  const [residents, setResidents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

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

  const handleDelete = async (id: string, name: string) => {
    if (!window.confirm(`Are you sure you want to remove ${name || 'this resident'}?`)) {
      return;
    }
    
    try {
      const token = localStorage.getItem('adminToken');
      await axios.delete(`${API_URL}/users/${id}`, {
        headers: { 'x-auth-token': token }
      });
      toast.success('Resident removed successfully');
      // Update state without refetching
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
                        onClick={() => handleDelete(r._id, r.name)}
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
    </div>
  );
}
