import { useState, useEffect } from 'react';
import axios from 'axios';
import { UserPlus, Users, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';

const API_URL = 'https://anytime-help.onrender.com/api';

export default function SubAdmins() {
  const [activeTab, setActiveTab] = useState<'list' | 'create'>('list');
  const [subadmins, setSubAdmins] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Form State
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  useEffect(() => {
    if (activeTab === 'list') {
      fetchSubAdmins();
    }
  }, [activeTab]);

  const fetchSubAdmins = async (showLoading = true) => {
    try {
      if (showLoading) setLoading(true);
      const token = localStorage.getItem('adminToken');
      const res = await axios.get(`${API_URL}/subadmins`, {
        headers: { 'x-auth-token': token }
      });
      setSubAdmins(res.data);
    } catch (err) {
      console.error(err);
      toast.error('Failed to load sub-admins');
    } finally {
      if (showLoading) setLoading(false);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      toast.error('Email and password are required');
      return;
    }
    
    setIsCreating(true);
    const loadingToast = toast.loading('Creating sub-admin...');

    try {
      const token = localStorage.getItem('adminToken');
      
      await axios.post(`${API_URL}/subadmins`, {
        name,
        email,
        password
      }, {
        headers: { 'x-auth-token': token }
      });
      
      toast.success('Sub-Admin created successfully!', { id: loadingToast });
      
      // Reset form
      setName('');
      setEmail('');
      setPassword('');
      
      // Auto switch back to list
      setActiveTab('list');
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to create sub-admin', { id: loadingToast });
    } finally {
      setIsCreating(false);
    }
  };

  const handleDelete = (id: string) => {
    toast((t) => (
      <div>
        <p style={{ fontWeight: 600, marginBottom: 12, color: 'var(--text-main)' }}>Are you sure you want to delete this Sub-Admin?</p>
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
              const loadingToast = toast.loading('Deleting sub-admin...');
              try {
                const token = localStorage.getItem('adminToken');
                await axios.delete(`${API_URL}/subadmins/${id}`, {
                  headers: { 'x-auth-token': token }
                });
                toast.success('Sub-Admin deleted', { id: loadingToast });
                fetchSubAdmins(false);
              } catch (err) {
                console.error(err);
                toast.error('Failed to delete sub-admin', { id: loadingToast });
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
          <h1 className="page-title">Sub-Admins</h1>
          <p style={{ color: 'var(--text-muted)', marginTop: 8 }}>Manage normal admins who only have access to Residents and Staff.</p>
        </div>
      </header>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 12, borderBottom: '1px solid var(--border-color)', paddingBottom: 16, marginBottom: 32 }}>
        <button 
          onClick={() => setActiveTab('list')}
          style={{ 
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '10px 16px', 
            background: activeTab === 'list' ? 'var(--primary)' : 'white', 
            color: activeTab === 'list' ? 'white' : 'var(--text-muted)',
            border: activeTab === 'list' ? 'none' : '1px solid var(--border-color)',
            borderRadius: 12, cursor: 'pointer', fontWeight: 600, transition: 'all 0.2s'
          }}
        >
          <Users size={18} /> <span>Active Sub-Admins</span>
        </button>
        <button 
          onClick={() => setActiveTab('create')}
          style={{ 
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '10px 16px', 
            background: activeTab === 'create' ? 'var(--primary)' : 'white', 
            color: activeTab === 'create' ? 'white' : 'var(--text-muted)',
            border: activeTab === 'create' ? 'none' : '1px solid var(--border-color)',
            borderRadius: 12, cursor: 'pointer', fontWeight: 600, transition: 'all 0.2s'
          }}
        >
          <UserPlus size={18} /> <span>Create Sub-Admin</span>
        </button>
      </div>

      {activeTab === 'list' && (
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <h2 className="card-title">Sub-Admins List</h2>
            <div style={{ background: 'var(--bg-light)', padding: '6px 12px', borderRadius: 20, fontSize: 13, fontWeight: 600, color: 'var(--text-main)' }}>
              Total: {subadmins.length}
            </div>
          </div>
          
          {loading ? (
            <div style={{ padding: '60px 0', textAlign: 'center', color: 'var(--text-muted)' }}>
              <div style={{ width: 40, height: 40, border: '3px solid #f3f3f3', borderTop: '3px solid var(--primary)', borderRadius: '50%', margin: '0 auto 16px', animation: 'spin 1s linear infinite' }}></div>
              Loading sub-admins...
            </div>
          ) : subadmins.length === 0 ? (
            <div style={{ padding: '60px 0', textAlign: 'center' }}>
              <div style={{ width: 80, height: 80, background: 'var(--bg-light)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                <Users size={32} color="var(--text-muted)" />
              </div>
              <h3 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-main)', marginBottom: 8 }}>No Sub-Admins Found</h3>
              <p style={{ color: 'var(--text-muted)', maxWidth: 400, margin: '0 auto' }}>You haven't created any sub-admins yet.</p>
              <button 
                onClick={() => setActiveTab('create')}
                style={{ marginTop: 24, padding: '10px 20px', background: 'var(--primary)', color: 'white', border: 'none', borderRadius: 8, fontWeight: 600, cursor: 'pointer' }}
              >
                Create Now
              </button>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Email</th>
                    <th style={{ width: 80, textAlign: 'center' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {subadmins.map(user => (
                    <tr key={user._id}>
                      <td style={{ fontWeight: 600 }}>{user.name}</td>
                      <td style={{ color: 'var(--text-muted)' }}>{user.email}</td>
                      <td style={{ textAlign: 'center' }}>
                        <button 
                          onClick={() => handleDelete(user._id)}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 8, borderRadius: 8 }}
                          onMouseOver={(e) => e.currentTarget.style.background = 'rgba(239, 68, 68, 0.1)'}
                          onMouseOut={(e) => e.currentTarget.style.background = 'none'}
                        >
                          <Trash2 size={18} color="var(--danger)" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {activeTab === 'create' && (
        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <div className="card" style={{ width: '100%', maxWidth: '600px' }}>
            <h2 className="card-title" style={{ marginBottom: 24 }}>Create New Sub-Admin</h2>
            <form onSubmit={handleCreate}>
              
              <div className="input-group">
                <label>Name</label>
                <input 
                  type="text" 
                  value={name} 
                  onChange={(e) => setName(e.target.value)} 
                  placeholder="e.g. John Doe"
                />
              </div>

              <div className="input-group">
                <label>Email Address *</label>
                <input 
                  type="email" 
                  value={email} 
                  onChange={(e) => setEmail(e.target.value)} 
                  required
                  placeholder="subadmin@society.com"
                />
                <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>They will use this to login to the admin portal.</p>
              </div>
              
              <div className="input-group">
                <label>Password *</label>
                <input 
                  type="text" 
                  value={password} 
                  onChange={(e) => setPassword(e.target.value)} 
                  required
                  placeholder="Set a password"
                />
              </div>

              <button type="submit" className="btn-primary" disabled={isCreating} style={{ marginTop: '16px', height: '52px' }}>
                {isCreating ? 'Creating Account...' : 'Create Sub-Admin Account'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
