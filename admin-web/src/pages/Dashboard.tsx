import { useState, useEffect } from 'react';
import axios from 'axios';
import { Activity, CheckCircle, Clock, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { io } from 'socket.io-client';

const API_URL = 'https://anytime-help.onrender.com/api';
const SOCKET_URL = 'https://anytime-help.onrender.com';

export default function Dashboard() {
  const [complaints, setComplaints] = useState<any[]>([]);
  const [stats, setStats] = useState({ pending: 0, inProgress: 0, resolved: 0 });
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  useEffect(() => {
    fetchComplaints(page, true);
    
    const socket = io(SOCKET_URL, { transports: ['websocket', 'polling'] });
    socket.on('complaint_changed', (payload) => {
      fetchComplaints(page, false);
    });

    return () => {
      socket.disconnect();
    };
  }, [page]);

  const fetchComplaints = async (currentPage: number, showLoading: boolean = true) => {
    if (showLoading) setLoading(true);
    try {
      const token = localStorage.getItem('adminToken');
      const res = await axios.get(`${API_URL}/complaints?page=${currentPage}&limit=10`, {
        headers: { 'x-auth-token': token }
      });
      setComplaints(res.data.complaints || []);
      if (res.data.stats) {
        setStats(res.data.stats);
      }
      setTotalPages(Math.ceil((res.data.total || 0) / 10) || 1);
    } catch (err) {
      console.error(err);
      toast.error('Failed to fetch complaints');
    } finally {
      if (showLoading) setLoading(false);
    }
  };

  const deleteComplaint = (id: string) => {
    toast((t) => (
      <div>
        <p style={{ fontWeight: 600, marginBottom: 12, color: 'var(--text-main)' }}>Are you sure you want to delete this complaint?</p>
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
              const loadingToast = toast.loading('Deleting complaint...');
              try {
                const token = localStorage.getItem('adminToken');
                await axios.delete(`${API_URL}/complaints/${id}`, {
                  headers: { 'x-auth-token': token }
                });
                toast.success('Complaint deleted successfully', { id: loadingToast });
                setComplaints(prev => prev.filter(c => c._id !== id));
              } catch (err) {
                console.error(err);
                toast.error('Failed to delete complaint.', { id: loadingToast });
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

  const updateStatus = async (id: string, newStatus: string) => {
    const loadingToast = toast.loading('Updating status...');
    try {
      const token = localStorage.getItem('adminToken');
      await axios.patch(`${API_URL}/complaints/${id}`, { status: newStatus }, {
        headers: { 'x-auth-token': token }
      });
      toast.success('Status updated successfully', { id: loadingToast });
      setComplaints(prev => prev.map(c => c._id === id ? { ...c, status: newStatus } : c));
    } catch (err) {
      console.error(err);
      toast.error('Failed to update status.', { id: loadingToast });
    }
  };

  const pending = stats.pending;
  const inProgress = stats.inProgress;
  const resolved = stats.resolved;

  return (
    <div>
      <header className="page-header">
        <div>
          <h1 className="page-title">Platform Overview</h1>
          <p style={{ color: 'var(--text-muted)', marginTop: 8 }}>Real-time statistics and active complaints.</p>
        </div>
      </header>

      {/* KPI Widgets */}
      <div className="stats-grid">
        <div className="glass stat-card">
          <div className="stat-info">
            <h3>Pending</h3>
            <p>{pending}</p>
          </div>
          <div className="stat-icon" style={{ background: 'rgba(245, 158, 11, 0.1)' }}>
            <Clock color="var(--warning)" size={24} />
          </div>
        </div>
        
        <div className="glass stat-card">
          <div className="stat-info">
            <h3>In Progress</h3>
            <p>{inProgress}</p>
          </div>
          <div className="stat-icon" style={{ background: 'rgba(79, 70, 229, 0.1)' }}>
            <Activity color="#818cf8" size={24} />
          </div>
        </div>

        <div className="glass stat-card">
          <div className="stat-info">
            <h3>Resolved</h3>
            <p>{resolved}</p>
          </div>
          <div className="stat-icon" style={{ background: 'rgba(16, 185, 129, 0.1)' }}>
            <CheckCircle color="var(--success)" size={24} />
          </div>
        </div>
      </div>

      {/* Data Table */}
      <div className="glass table-container">
        <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 20 }}>Recent Complaints</h2>
        <table>
          <thead>
            <tr>
              <th>Title & Desc</th>
              <th>Category</th>
              <th>Location</th>
              <th>Resident</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
              {loading ? (
                Array.from({ length: 5 }).map((_, idx) => (
                  <tr key={`skeleton-${idx}`}>
                    <td>
                      <div className="skeleton skeleton-row" style={{ height: 16, width: '80%', marginBottom: 8 }}></div>
                      <div className="skeleton skeleton-row" style={{ height: 12, width: '60%' }}></div>
                    </td>
                    <td><div className="skeleton skeleton-row" style={{ width: '80%' }}></div></td>
                    <td><div className="skeleton skeleton-row" style={{ width: '70%' }}></div></td>
                    <td><div className="skeleton skeleton-row" style={{ width: '90%' }}></div></td>
                    <td><div className="skeleton skeleton-row" style={{ width: 80, borderRadius: 20 }}></div></td>
                    <td><div className="skeleton skeleton-row" style={{ width: 100 }}></div></td>
                  </tr>
                ))
              ) : complaints.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', color: 'var(--text-muted)' }}>No complaints found.</td>
                </tr>
              ) : (
                complaints.map(item => (
                  <tr key={item._id}>
                    <td style={{ maxWidth: 300 }}>
                      <div style={{ fontWeight: 600, color: 'var(--text-main)', marginBottom: 4 }}>{item.title}</div>
                      <div style={{ color: 'var(--text-muted)', fontSize: 12, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {item.description}
                      </div>
                    </td>
                    <td>{item.category}</td>
                    <td>{item.location}</td>
                    <td>{item.user?.name || 'Unknown'}</td>
                    <td>
                      <span className={`badge ${
                        item.status === 'PENDING' ? 'pending' : 
                        item.status === 'IN_PROGRESS' ? 'progress' : 'resolved'
                      }`}>
                        {item.status.replace('_', ' ')}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                        <select 
                          value={item.status}
                          onChange={(e) => updateStatus(item._id, e.target.value)}
                          style={{ 
                            background: '#F8FAFC', 
                            color: 'var(--text-main)', 
                            border: '1px solid var(--border-color)', 
                            padding: '6px 12px', 
                            borderRadius: '8px',
                            outline: 'none',
                            cursor: 'pointer',
                            fontSize: '13px',
                            fontWeight: '500'
                          }}
                        >
                          <option value="PENDING">Pending</option>
                          <option value="IN_PROGRESS">In Progress</option>
                          <option value="DONE">Resolved</option>
                        </select>
                        <button 
                          onClick={() => deleteComplaint(item._id)}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 8, borderRadius: 8 }}
                          onMouseOver={(e) => e.currentTarget.style.background = 'rgba(239, 68, 68, 0.1)'}
                          onMouseOut={(e) => e.currentTarget.style.background = 'none'}
                        >
                          <Trash2 size={18} color="var(--danger)" />
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
    </div>
  );
}
