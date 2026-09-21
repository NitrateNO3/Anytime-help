import { useState, useEffect } from 'react';
import { Pagination } from '../components/Pagination';
import { SkeletonTable } from '../components/SkeletonTable';
import axios from 'axios';
import { UserPlus, Users, Trash2, Edit, Search, Filter, RotateCcw, X } from 'lucide-react';
import toast from 'react-hot-toast';

const API_URL = 'https://anytime-help.onrender.com/api';

export default function SubAdmins() {
  const [activeTab, setActiveTab] = useState<'list' | 'create'>('list');
  const [subadmins, setSubAdmins] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const limit = 10;
  
  // Filter States
  const [search, setSearch] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const filteredSubAdmins = subadmins.filter(admin => {
    let match = true;
    if (search.trim()) {
      const s = search.toLowerCase();
      const n = admin.name?.toLowerCase() || '';
      const e = admin.email?.toLowerCase() || '';
      if (!n.includes(s) && !e.includes(s)) match = false;
    }
    if (dateFrom) {
      if (new Date(admin.createdAt) < new Date(dateFrom)) match = false;
    }
    if (dateTo) {
      const end = new Date(dateTo);
      end.setHours(23, 59, 59, 999);
      if (new Date(admin.createdAt) > end) match = false;
    }
    return match;
  });

  const totalPages = Math.ceil(filteredSubAdmins.length / limit) || 1;
  const currentSubAdmins = filteredSubAdmins.slice((page - 1) * limit, page * limit);

  // Form State
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [permissions, setPermissions] = useState<string[]>(['Residents', 'Staff Team']);
  const [isCreating, setIsCreating] = useState(false);
  
  // Edit State
  const [editingUser, setEditingUser] = useState<any>(null);
  
  const availablePermissions = ['Residents', 'Staff Team', 'Committee Members', 'Announcements', 'Banners', 'Directory'];

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
        password,
        permissions
      }, {
        headers: { 'x-auth-token': token }
      });
      
      toast.success('Sub-Admin created successfully!', { id: loadingToast });
      
      // Reset form
      setName('');
      setEmail('');
      setPassword('');
      setPermissions(['Residents', 'Staff Team']);
      
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

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const loadingToast = toast.loading('Updating sub-admin...');

    try {
      const token = localStorage.getItem('adminToken');
      await axios.put(`${API_URL}/subadmins/${editingUser._id}`, {
        name: editingUser.name,
        email: editingUser.email,
        permissions: editingUser.permissions,
        password: editingUser.password || undefined // Only send if changed
      }, {
        headers: { 'x-auth-token': token }
      });
      
      toast.success('Sub-Admin updated successfully!', { id: loadingToast });
      setEditingUser(null);
      fetchSubAdmins(false);
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to update sub-admin', { id: loadingToast });
    }
  };

  const isFiltered = search !== '' || dateFrom !== '' || dateTo !== '';

  const resetFilters = () => {
    setSearch('');
    setDateFrom('');
    setDateTo('');
    setPage(1);
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
              Total: {filteredSubAdmins.length}
            </div>
          </div>

          {/* Filter Toolbar */}
          <div style={{ marginBottom: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Filter size={20} color="var(--primary)" />
                <h3 style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-main)' }}>Filter Sub-Admins</h3>
                {isFiltered && (
                  <span style={{ fontSize: 12, background: 'rgba(29, 78, 216, 0.1)', color: 'var(--primary)', padding: '2px 8px', borderRadius: 12, fontWeight: 600 }}>
                    Filters Applied
                  </span>
                )}
              </div>

              {isFiltered && (
                <button
                  onClick={resetFilters}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 8,
                    border: '1px solid var(--border-color)', background: '#FFFFFF', color: 'var(--danger)',
                    fontSize: 13, fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s ease'
                  }}
                  onMouseOver={(e) => e.currentTarget.style.background = 'rgba(239, 68, 68, 0.05)'}
                  onMouseOut={(e) => e.currentTarget.style.background = '#FFFFFF'}
                >
                  <RotateCcw size={14} /> Reset Filters
                </button>
              )}
            </div>

            {/* Search Input Bar */}
            <div style={{ position: 'relative' }}>
              <Search size={18} color="var(--text-muted)" style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)' }} />
              <input
                type="text"
                placeholder="Search by name or email..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={{
                  width: '100%', padding: '11px 40px 11px 42px', borderRadius: 10,
                  border: '1px solid var(--border-color)', background: '#F8FAFC',
                  fontSize: 14, color: 'var(--text-main)', outline: 'none', boxSizing: 'border-box'
                }}
              />
              {search && (
                <button
                  onClick={() => setSearch('')}
                  style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}
                  title="Clear search"
                >
                  <X size={16} />
                </button>
              )}
            </div>

            {/* Date Filters Row */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6 }}>From Date</label>
                <input 
                  type="date" value={dateFrom} onChange={(e) => { setDateFrom(e.target.value); setPage(1); }}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--border-color)', background: '#FFFFFF', fontSize: 13, color: 'var(--text-main)', fontWeight: 500, outline: 'none' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6 }}>To Date</label>
                <input 
                  type="date" value={dateTo} onChange={(e) => { setDateTo(e.target.value); setPage(1); }}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--border-color)', background: '#FFFFFF', fontSize: 13, color: 'var(--text-main)', fontWeight: 500, outline: 'none' }}
                />
              </div>
            </div>
          </div>
          
          {loading ? (
            <SkeletonTable rows={4} columns={4} />
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
                    <th>Permissions</th>
                    <th style={{ width: 80, textAlign: 'center' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {currentSubAdmins.map(user => (
                    <tr key={user._id}>
                      <td style={{ fontWeight: 600 }}>{user.name}</td>
                      <td style={{ color: 'var(--text-muted)' }}>{user.email}</td>
                      <td>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                          {user.permissions && user.permissions.length > 0 ? user.permissions.map((p: string) => (
                            <span key={p} style={{ background: 'var(--bg-light)', padding: '2px 8px', borderRadius: 4, fontSize: 12, color: 'var(--text-main)', border: '1px solid var(--border-color)' }}>
                              {p}
                            </span>
                          )) : (
                            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>None</span>
                          )}
                        </div>
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <button 
                          onClick={() => setEditingUser({ ...user, password: '' })}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 8, borderRadius: 8, marginRight: 4 }}
                          onMouseOver={(e) => e.currentTarget.style.background = 'rgba(59, 130, 246, 0.1)'}
                          onMouseOut={(e) => e.currentTarget.style.background = 'none'}
                          title="Edit"
                        >
                          <Edit size={18} color="var(--primary)" />
                        </button>
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
              <Pagination page={page} totalPages={totalPages} setPage={setPage} />
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

              <div className="input-group" style={{ marginBottom: 24 }}>
                <label>Access Permissions</label>
                <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 12 }}>Select the sections this Sub-Admin should have access to.</p>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  {availablePermissions.map(p => (
                    <label key={p} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', padding: '12px 16px', border: '1px solid ' + (permissions.includes(p) ? 'var(--primary)' : 'var(--border-color)'), borderRadius: 8, background: permissions.includes(p) ? 'rgba(79, 70, 229, 0.05)' : 'white' }}>
                      <input 
                        type="checkbox" 
                        checked={permissions.includes(p)}
                        onChange={(e) => {
                          if (e.target.checked) setPermissions([...permissions, p]);
                          else setPermissions(permissions.filter(perm => perm !== p));
                        }}
                        style={{ width: 18, height: 18, accentColor: 'var(--primary)', cursor: 'pointer' }}
                      />
                      <span style={{ fontWeight: permissions.includes(p) ? 600 : 500, color: permissions.includes(p) ? 'var(--primary)' : 'var(--text-main)' }}>{p}</span>
                    </label>
                  ))}
                </div>
              </div>

              <button type="submit" className="btn-primary" disabled={isCreating} style={{ marginTop: '16px', height: '52px' }}>
                {isCreating ? 'Creating Account...' : 'Create Sub-Admin Account'}
              </button>
            </form>
          </div>
        </div>
      )}
      {/* Edit Modal */}
      {editingUser && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div className="card" style={{ width: '100%', maxWidth: 500, margin: 20 }}>
            <h2 className="card-title" style={{ marginBottom: 20 }}>Edit Sub-Admin</h2>
            <form onSubmit={handleEditSubmit}>
              <div className="input-group">
                <label>Name</label>
                <input 
                  type="text" 
                  value={editingUser.name} 
                  onChange={(e) => setEditingUser({...editingUser, name: e.target.value})} 
                  required
                />
              </div>
              
              <div className="input-group">
                <label>Email</label>
                <input 
                  type="email" 
                  value={editingUser.email} 
                  onChange={(e) => setEditingUser({...editingUser, email: e.target.value})} 
                  required
                />
              </div>
              
              <div className="input-group">
                <label>New Password (leave blank to keep current)</label>
                <input 
                  type="password" 
                  value={editingUser.password} 
                  onChange={(e) => setEditingUser({...editingUser, password: e.target.value})} 
                  placeholder="Enter new password"
                />
              </div>
              
              <div className="input-group">
                <label>Permissions</label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 8 }}>
                  {availablePermissions.map(perm => (
                    <label key={perm} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                      <input 
                        type="checkbox"
                        checked={editingUser.permissions.includes(perm)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setEditingUser({...editingUser, permissions: [...editingUser.permissions, perm]});
                          } else {
                            setEditingUser({...editingUser, permissions: editingUser.permissions.filter((p: string) => p !== perm)});
                          }
                        }}
                      />
                      <span style={{ fontSize: 14 }}>{perm}</span>
                    </label>
                  ))}
                </div>
              </div>
              
              <div style={{ display: 'flex', gap: 12, marginTop: 32 }}>
                <button type="button" onClick={() => setEditingUser(null)} style={{ flex: 1, padding: '12px', background: 'white', border: '1px solid var(--border-color)', borderRadius: 8, fontWeight: 600, cursor: 'pointer' }}>
                  Cancel
                </button>
                <button type="submit" style={{ flex: 1, padding: '12px', background: 'var(--primary)', color: 'white', border: 'none', borderRadius: 8, fontWeight: 600, cursor: 'pointer' }}>
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
