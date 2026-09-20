import { useState, useEffect } from 'react';
import axios from 'axios';
import { Trash2, Megaphone, Plus, Bell } from 'lucide-react';
import toast from 'react-hot-toast';
import { io } from 'socket.io-client';

const API_URL = 'https://anytime-help.onrender.com/api';
const SOCKET_URL = 'https://anytime-help.onrender.com';

export default function Announcements() {
  const [activeTab, setActiveTab] = useState<'list' | 'create'>('list');
  const [announcements, setAnnouncements] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterPhase, setFilterPhase] = useState('All Groups (Show Everything)');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  // Form State
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [selectedPhases, setSelectedPhases] = useState<string[]>(['All']);

  const availablePhases = ['Resident', 'Members'];

  useEffect(() => {
    if (activeTab === 'list') {
      fetchAnnouncements(page, filterPhase);
    }
    
    const socket = io(SOCKET_URL, { transports: ['websocket', 'polling'] });
    socket.on('announcement_changed', () => {
      if (activeTab === 'list') fetchAnnouncements(page, filterPhase, false);
    });

    return () => {
      socket.disconnect();
    };
  }, [activeTab, page, filterPhase]);

  const fetchAnnouncements = async (currentPage = page, phaseFilter = filterPhase, showLoading = true) => {
    try {
      if (showLoading) setLoading(true);
      const token = localStorage.getItem('adminToken');
      const res = await axios.get(`${API_URL}/announcements?page=${currentPage}&limit=10&phase=${encodeURIComponent(phaseFilter)}`, {
        headers: { 'x-auth-token': token }
      });
      if (res.data && res.data.announcements) {
        setAnnouncements(res.data.announcements);
        setTotalCount(res.data.total || 0);
        setTotalPages(res.data.totalPages || 1);
      } else if (Array.isArray(res.data)) {
        setAnnouncements(res.data);
        setTotalCount(res.data.length);
        setTotalPages(Math.ceil(res.data.length / 10) || 1);
      }
    } catch (err) {
      console.error(err);
      toast.error('Failed to load announcements');
    } finally {
      if (showLoading) setLoading(false);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsCreating(true);
    const loadingToast = toast.loading('Publishing announcement...');

    try {
      const token = localStorage.getItem('adminToken');
      await axios.post(`${API_URL}/announcements`, {
        title,
        message,
        phases: selectedPhases
      }, {
        headers: { 'x-auth-token': token }
      });
      
      toast.success('Announcement published successfully!', { id: loadingToast });
      
      // Reset form
      setTitle('');
      setMessage('');
      setSelectedPhases(['All']);
      
      // Auto switch back to list
      setActiveTab('list');
    } catch (err: any) {
      toast.error(err.response?.data?.msg || err.response?.data?.message || 'Failed to publish announcement', { id: loadingToast });
    } finally {
      setIsCreating(false);
    }
  };

  const handleDelete = (id: string) => {
    toast((t) => (
      <div>
        <p style={{ fontWeight: 600, marginBottom: 12, color: 'var(--text-main)' }}>Are you sure you want to delete this announcement?</p>
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
              const loadingToast = toast.loading('Deleting...');
              try {
                const token = localStorage.getItem('adminToken');
                await axios.delete(`${API_URL}/announcements/${id}`, {
                  headers: { 'x-auth-token': token }
                });
                toast.success('Announcement deleted', { id: loadingToast });
                fetchAnnouncements(page, filterPhase, false);
              } catch (err) {
                console.error(err);
                toast.error('Failed to delete', { id: loadingToast });
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
          <h1 className="page-title">Announcements</h1>
          <p style={{ color: 'var(--text-muted)', marginTop: 8 }}>Broadcast important notices and updates to all residents.</p>
        </div>
      </header>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 16, borderBottom: '1px solid var(--border-color)', paddingBottom: 16, marginBottom: 32 }}>
        <button 
          onClick={() => setActiveTab('list')}
          style={{ 
            display: 'flex', alignItems: 'center', gap: 8, padding: '10px 20px', 
            background: activeTab === 'list' ? 'var(--primary)' : 'white', 
            color: activeTab === 'list' ? 'white' : 'var(--text-muted)',
            border: activeTab === 'list' ? 'none' : '1px solid var(--border-color)',
            borderRadius: 12, cursor: 'pointer', fontWeight: 600, transition: 'all 0.2s'
          }}
        >
          <Bell size={18} /> Recent Announcements
        </button>
        <button 
          onClick={() => { setActiveTab('create'); }}
          style={{ 
            display: 'flex', alignItems: 'center', gap: 8, padding: '10px 20px', 
            background: activeTab === 'create' ? 'var(--primary)' : 'white', 
            color: activeTab === 'create' ? 'white' : 'var(--text-muted)',
            border: activeTab === 'create' ? 'none' : '1px solid var(--border-color)',
            borderRadius: 12, cursor: 'pointer', fontWeight: 600, transition: 'all 0.2s'
          }}
        >
          <Plus size={18} /> New Broadcast
        </button>
      </div>

      {/* Content Area */}
      {activeTab === 'list' ? (
        <div className="glass table-container">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <h2 style={{ fontSize: 18, fontWeight: 600 }}>Past Announcements ({totalCount})</h2>
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
              <option value="Resident">Resident</option>
              <option value="Members">Members</option>
            </select>
          </div>
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Title</th>
                <th>Message</th>
                <th style={{ width: 80 }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 5 }).map((_, idx) => (
                  <tr key={`skeleton-${idx}`}>
                    <td><div className="skeleton skeleton-row" style={{ width: '80%' }}></div></td>
                    <td><div className="skeleton skeleton-row" style={{ width: '90%' }}></div></td>
                    <td>
                      <div className="skeleton skeleton-row" style={{ height: 16, width: '100%', marginBottom: 8 }}></div>
                      <div className="skeleton skeleton-row" style={{ height: 12, width: '60%' }}></div>
                    </td>
                    <td><div className="skeleton skeleton-row" style={{ width: 30, borderRadius: 8 }}></div></td>
                  </tr>
                ))
              ) : announcements.length === 0 ? (
                  <tr>
                    <td colSpan={4} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '40px 0' }}>
                      <Megaphone size={40} color="var(--border-color)" style={{ margin: '0 auto 16px' }} />
                      No announcements broadcasted yet for this filter.
                    </td>
                  </tr>
                ) : (
                  announcements.map(announcement => (
                    <tr key={announcement._id}>
                      <td style={{ color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                        {new Date(announcement.date).toLocaleDateString()}
                      </td>
                      <td style={{ fontWeight: 600 }}>{announcement.title}</td>
                      <td style={{ color: 'var(--text-muted)' }}>{announcement.message}</td>
                      <td style={{ textAlign: 'center' }}>
                        <button 
                          onClick={() => handleDelete(announcement._id)}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 8, borderRadius: 8 }}
                          onMouseOver={(e) => e.currentTarget.style.background = 'rgba(239, 68, 68, 0.1)'}
                          onMouseOut={(e) => e.currentTarget.style.background = 'none'}
                        >
                          <Trash2 size={20} color="var(--danger)" />
                        </button>
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

      ) : (
        <div style={{ display: 'flex', justifyContent: 'center', marginTop: '40px' }}>
          <div className="glass" style={{ padding: '40px', width: '100%', maxWidth: '600px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '32px' }}>
              <div style={{ background: 'rgba(255, 99, 71, 0.1)', padding: 12, borderRadius: 12 }}>
                <Megaphone size={28} color="var(--primary)" />
              </div>
              <h2 style={{ fontSize: 24, fontWeight: 700 }}>New Broadcast</h2>
            </div>

            <form onSubmit={handleCreate}>
              <div className="input-group">
                <label>Announcement Title</label>
                <input 
                  type="text" 
                  value={title} 
                  onChange={(e) => setTitle(e.target.value)} 
                  required
                  placeholder="e.g. Water Supply Interruption"
                />
              </div>
              
              <div className="input-group">
                <label>Message Detail</label>
                <textarea 
                  value={message} 
                  onChange={(e) => setMessage(e.target.value)} 
                  required
                  placeholder="Type the full message here..."
                  style={{ 
                    width: '100%', 
                    padding: '14px 16px', 
                    background: 'white', 
                    border: '1px solid var(--border-color)', 
                    borderRadius: '12px',
                    fontSize: '15px',
                    color: 'var(--text-main)',
                    minHeight: '120px',
                    fontFamily: 'inherit',
                    resize: 'vertical'
                  }}
                />
              </div>

              <div className="input-group">
                <label>Target Groups</label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 8 }}>
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
                            // If none selected, default back to 'All'
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
              
              <button type="submit" className="btn-primary" disabled={isCreating} style={{ marginTop: '16px', height: '52px' }}>
                {isCreating ? 'Publishing...' : 'Publish Announcement'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
