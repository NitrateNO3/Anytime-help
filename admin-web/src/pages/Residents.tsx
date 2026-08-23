import { useState, useEffect } from 'react';
import axios from 'axios';
import { Home, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { io } from 'socket.io-client';

const API_URL = import.meta.env.VITE_API_URL || 'https://anytime-help.onrender.com/api';

export default function Residents() {
  const [residents, setResidents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchResidents();

    // Socket.io for live updates
    const socketURL = API_URL.replace('/api', '');
    const socket = io(socketURL);

    socket.on('user_created', (newUser: any) => {
      if (newUser.role === 'Resident') {
        setResidents(prev => {
          // Prevent duplicates
          if (prev.find(r => r._id === newUser._id || r._id === newUser.id)) return prev;
          return [newUser, ...prev];
        });
      }
    });

    socket.on('user_deleted', (data: { id: string }) => {
      setResidents(prev => prev.filter(r => r._id !== data.id));
    });

    return () => {
      socket.disconnect();
    };
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

  const requestDelete = (id: string) => {
    toast((t) => (
      <div style={{ padding: '8px' }}>
        <p style={{ fontWeight: 600, marginBottom: 16, fontSize: '15px', color: 'var(--text-main)' }}>
          Are you sure you want to delete this resident?
        </p>
        <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
          <button 
            onClick={() => toast.dismiss(t.id)} 
            style={{ 
              padding: '8px 16px', borderRadius: 8, border: '1px solid var(--border-color)', 
              background: 'white', cursor: 'pointer', fontWeight: 500, color: 'var(--text-main)' 
            }}
          >
            Cancel
          </button>
          <button 
            onClick={async () => {
              toast.dismiss(t.id);
              const loadingToast = toast.loading('Deleting resident...');
              try {
                const token = localStorage.getItem('adminToken');
                await axios.delete(`${API_URL}/users/${id}`, {
                  headers: { 'x-auth-token': token }
                });
                toast.success('Resident deleted successfully', { id: loadingToast });
                setResidents(residents.filter(r => r._id !== id));
              } catch (error: any) {
                console.error('Error deleting resident:', error);
                toast.error(error.response?.data?.message || 'Could not delete resident', { id: loadingToast });
              }
            }} 
            style={{ 
              padding: '8px 16px', borderRadius: 8, border: 'none', 
              background: 'var(--danger)', color: 'white', cursor: 'pointer', fontWeight: 600 
            }}
          >
            Delete
          </button>
        </div>
      </div>
    ), { duration: Infinity, style: { minWidth: '320px', borderRadius: '12px' } });
  };

  return (
    <div className="page-container fade-in">
      <div className="page-header" style={{ marginBottom: '32px' }}>
        <div>
          <h1 className="page-title" style={{ display: 'flex', alignItems: 'center', marginBottom: '8px' }}>
            <Home size={28} color="var(--primary)" style={{ marginRight: '10px' }} />
            Residents Directory
          </h1>
          <p className="page-subtitle" style={{ marginTop: '8px', color: 'var(--text-muted)' }}>
            View all registered residents and their details.
          </p>
        </div>
      </div>

      <div className="card" style={{ marginTop: '20px' }}>
        <h2 style={{ marginBottom: '24px', fontSize: '18px', fontWeight: '600' }}>Total Registered: {residents.length}</h2>
        {loading ? (
          <div className="loading-spinner" />
        ) : residents.length === 0 ? (
          <p style={{ color: 'var(--text-secondary)' }}>No residents found.</p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="data-table" style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid var(--border)', color: 'var(--text-secondary)' }}>
                  <th style={{ padding: '16px' }}>Name</th>
                  <th style={{ padding: '16px' }}>Phone Number</th>
                  <th style={{ padding: '16px' }}>Address</th>
                  <th style={{ padding: '16px' }}>Relation</th>
                  <th style={{ padding: '16px' }}>Joined Date</th>
                  <th style={{ padding: '16px', textAlign: 'center' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {residents.map((r) => (
                  <tr key={r._id} style={{ borderBottom: '1px solid var(--border)', transition: 'background 0.2s' }}>
                    <td style={{ padding: '16px', fontWeight: '500' }}>{r.name || 'N/A'}</td>
                    <td style={{ padding: '16px' }}>{r.phone_number}</td>
                    <td style={{ padding: '16px' }}>
                      <span className="badge" style={{ backgroundColor: '#DBEAFE', color: '#1D4ED8', padding: '6px 12px' }}>
                        {r.address || 'N/A'}
                      </span>
                    </td>
                    <td style={{ padding: '16px' }}>{r.relation || 'Owner'}</td>
                    <td style={{ padding: '16px', color: 'var(--text-secondary)' }}>
                      {new Date(r.createdAt || r.updatedAt || Date.now()).toLocaleDateString()}
                    </td>
                    <td style={{ padding: '16px', textAlign: 'center' }}>
                      <button 
                        onClick={() => requestDelete(r._id)}
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
