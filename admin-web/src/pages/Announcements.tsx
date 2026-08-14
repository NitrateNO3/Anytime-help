import { useState, useEffect } from 'react';
import axios from 'axios';
import { Trash2, Megaphone, Plus, Bell } from 'lucide-react';
import toast from 'react-hot-toast';

export default function Announcements() {
  const [activeTab, setActiveTab] = useState<'list' | 'create'>('list');
  const [announcements, setAnnouncements] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Form State
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  useEffect(() => {
    if (activeTab === 'list') {
      fetchAnnouncements();
    }
  }, [activeTab]);

  const fetchAnnouncements = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('adminToken');
      const res = await axios.get('http://172.20.10.2:5000/api/announcements', {
        headers: { 'x-auth-token': token }
      });
      setAnnouncements(res.data);
    } catch (err) {
      console.error(err);
      toast.error('Failed to load announcements');
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsCreating(true);
    const loadingToast = toast.loading('Publishing announcement...');

    try {
      const token = localStorage.getItem('adminToken');
      await axios.post('http://172.20.10.2:5000/api/announcements', {
        title,
        message
      }, {
        headers: { 'x-auth-token': token }
      });
      
      toast.success('Announcement published successfully!', { id: loadingToast });
      
      // Reset form
      setTitle('');
      setMessage('');
      
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
                await axios.delete(`http://172.20.10.2:5000/api/announcements/${id}`, {
                  headers: { 'x-auth-token': token }
                });
                toast.success('Announcement deleted', { id: loadingToast });
                fetchAnnouncements();
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
          <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 20 }}>Past Announcements</h2>
          {loading ? (
            <p style={{ color: 'var(--text-muted)' }}>Loading announcements...</p>
          ) : (
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
                {announcements.length === 0 ? (
                  <tr>
                    <td colSpan={4} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '40px 0' }}>
                      <Megaphone size={40} color="var(--border-color)" style={{ margin: '0 auto 16px' }} />
                      No announcements broadcasted yet.
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
