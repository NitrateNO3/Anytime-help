import React, { useState, useEffect } from 'react';
import { Pagination } from '../components/Pagination';
import { SkeletonTable } from '../components/SkeletonTable';
import axios from 'axios';
import { UserPlus, Trash2, Edit2, Search, Filter, RotateCcw, X, Users, ShieldCheck, ShieldAlert } from 'lucide-react';
import toast from 'react-hot-toast';
import { ExportButtons } from '../components/ExportButtons';
import { io } from 'socket.io-client';

const API_URL = import.meta.env.VITE_API_URL || 'https://anytime-help.onrender.com/api';

export default function SubAdmins() {
  const [activeTab, setActiveTab] = useState<'list' | 'create'>('list');
  const [subadmins, setSubAdmins] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const limit = 10;
  
  const adminUserStr = localStorage.getItem('adminUser');
  const adminUser = adminUserStr ? JSON.parse(adminUserStr) : null;
  const isSubAdmin = adminUser?.role === 'SubAdmin';
  const currentUserId = adminUser?._id || adminUser?.id;

  // Filter States
  const [search, setSearch] = useState('');

  const filteredSubAdmins = subadmins.filter(admin => {
    let match = true;
    if (search.trim()) {
      const s = search.toLowerCase();
      const n = admin.name?.toLowerCase() || '';
      const e = admin.email?.toLowerCase() || '';
      const r = admin.role?.toLowerCase() || '';
      if (!n.includes(s) && !e.includes(s) && !r.includes(s)) match = false;
    }
    return match;
  });

  const totalPages = Math.ceil(filteredSubAdmins.length / limit) || 1;
  const currentSubAdmins = filteredSubAdmins.slice((page - 1) * limit, page * limit);

  // Form State
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<'SubAdmin' | 'Admin'>('SubAdmin');
  const [permissions, setPermissions] = useState<string[]>(['Residents', 'Staff Team']);
  const [isCreating, setIsCreating] = useState(false);
  
  // Edit State
  const [editingUser, setEditingUser] = useState<any>(null);
  
  const availablePermissions = [
    'Overview', 
    'Residents', 
    'Locations', 
    'Staff Team', 
    'Committee Members', 
    'Community', 
    'Announcements', 
    'Banners', 
    'Staff Banner', 
    'Directory'
  ];

  useEffect(() => {
    if (activeTab === 'list') {
      fetchSubAdmins();
    }
  }, [activeTab]);

  useEffect(() => {
    const socketURL = API_URL.replace('/api', '');
    const socket = io(socketURL);

    socket.on('user_created', (newUser: any) => {
      if (['Admin', 'SubAdmin'].includes(newUser.role)) {
        fetchSubAdmins(false);
      }
    });

    socket.on('user_deleted', () => {
      fetchSubAdmins(false);
    });

    socket.on('user_updated', () => {
      fetchSubAdmins(false);
    });

    return () => {
      socket.disconnect();
    };
  }, []);

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
      toast.error('Failed to load admin accounts');
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
    const loadingToast = toast.loading(`Creating ${role === 'Admin' ? 'Super Admin' : 'Sub-Admin'}...`);

    try {
      const token = localStorage.getItem('adminToken');
      
      await axios.post(`${API_URL}/subadmins`, {
        name,
        email,
        password,
        role,
        permissions: role === 'Admin' ? [] : permissions
      }, {
        headers: { 'x-auth-token': token }
      });
      
      toast.success(`${role === 'Admin' ? 'Super Admin' : 'Sub-Admin'} created successfully!`, { id: loadingToast });
      
      // Reset form
      setName('');
      setEmail('');
      setPassword('');
      setRole('SubAdmin');
      setPermissions(['Residents', 'Staff Team']);
      
      // Auto switch back to list
      setActiveTab('list');
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to create account', { id: loadingToast });
    } finally {
      setIsCreating(false);
    }
  };

  const handleDelete = (id: string, adminRole: string) => {
    toast((t) => (
      <div>
        <p style={{ fontWeight: 600, marginBottom: 8, color: 'var(--text-main)' }}>
          Delete {adminRole === 'Admin' ? 'Super Admin' : 'Sub-Admin'} account?
        </p>
        <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 12 }}>
          This user will immediately lose access to the admin dashboard.
        </p>
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
              const loadingToast = toast.loading('Deleting account...');
              try {
                const token = localStorage.getItem('adminToken');
                await axios.delete(`${API_URL}/subadmins/${id}`, {
                  headers: { 'x-auth-token': token }
                });
                toast.success('Account deleted successfully!', { id: loadingToast });
                fetchSubAdmins(false);
              } catch (err: any) {
                toast.error(err.response?.data?.message || 'Failed to delete account', { id: loadingToast });
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
    const loadingToast = toast.loading('Updating account...');

    try {
      const token = localStorage.getItem('adminToken');
      await axios.put(`${API_URL}/subadmins/${editingUser._id}`, {
        name: editingUser.name,
        email: editingUser.email,
        role: editingUser.role,
        permissions: editingUser.role === 'Admin' ? [] : editingUser.permissions,
        password: editingUser.password || undefined // Only send if changed
      }, {
        headers: { 'x-auth-token': token }
      });
      
      toast.success(`${editingUser.role === 'Admin' ? 'Super Admin' : 'Sub-Admin'} updated successfully!`, { id: loadingToast });
      setEditingUser(null);
      fetchSubAdmins(false);
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to update account', { id: loadingToast });
    }
  };

  const isFiltered = search !== '';

  const resetFilters = () => {
    setSearch('');
    setPage(1);
  };

  return (
    <div style={{ maxWidth: 1050, margin: '0 auto' }}>
      <header className="page-header" style={{ marginBottom: 24 }}>
        <div>
          <h1 className="page-title">Admin Management</h1>
          <p style={{ color: 'var(--text-muted)', marginTop: 8 }}>
            Manage Super Admins (universal access) and Sub-Admins (custom restricted access).
          </p>
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
          <Users size={18} /> <span>Admin Accounts ({subadmins.length})</span>
        </button>
        {!isSubAdmin && (
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
            <UserPlus size={18} /> <span>Create Admin / Sub-Admin</span>
          </button>
        )}
      </div>

      {activeTab === 'list' && (
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <h2 className="card-title">All Admin Accounts</h2>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <ExportButtons 
                data={filteredSubAdmins}
                fetchAllData={async () => filteredSubAdmins}
                columns={[
                  { header: 'Name', key: 'name' },
                  { header: 'Role', key: (r: any) => r.role === 'Admin' ? 'Super Admin' : 'Sub-Admin' },
                  { header: 'Email', key: 'email' },
                  { header: 'Permissions', key: (r: any) => r.role === 'Admin' ? 'Full Universal Access' : (r.permissions?.join(', ') || 'None') },
                  { header: 'Created At', key: (r: any) => new Date(r.createdAt).toLocaleString() }
                ]}
                filename="Admin_Accounts"
              />
              <div style={{ background: 'var(--bg-light)', padding: '6px 12px', borderRadius: 20, fontSize: 13, fontWeight: 600, color: 'var(--text-main)' }}>
                Total: {filteredSubAdmins.length}
              </div>
            </div>
          </div>

          {/* Filter Toolbar */}
          <div style={{ marginBottom: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Filter size={20} color="var(--primary)" />
                <h3 style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-main)' }}>Filter Accounts</h3>
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
                placeholder="Search by name, email, or role..."
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
          </div>
          
          {loading ? (
            <SkeletonTable rows={4} columns={5} />
          ) : subadmins.length === 0 ? (
            <div style={{ padding: '60px 0', textAlign: 'center' }}>
              <div style={{ width: 80, height: 80, background: 'var(--bg-light)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                <Users size={32} color="var(--text-muted)" />
              </div>
              <h3 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-main)', marginBottom: 8 }}>No Admin Accounts Found</h3>
              <p style={{ color: 'var(--text-muted)', maxWidth: 400, margin: '0 auto' }}>You haven't created any additional admin accounts yet.</p>
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
                    <th>Role</th>
                    <th>Email</th>
                    <th>Access Permissions</th>
                    {!isSubAdmin && <th style={{ width: 100, textAlign: 'center' }}>Actions</th>}
                  </tr>
                </thead>
                <tbody>
                  {currentSubAdmins.map(user => {
                    const isSelf = currentUserId === user._id || adminUser?.email === user.email;
                    const isPrimary = user.email === 'admin@anytimehelp.com';
                    const isCurrentPrimary = adminUser?.email === 'admin@anytimehelp.com';
                    const canDelete = !isSelf && !isPrimary && (user.role !== 'Admin' || isCurrentPrimary);

                    return (
                      <tr key={user._id}>
                        <td style={{ fontWeight: 600 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <span>{user.name}</span>
                            {isPrimary && (
                              <span style={{ fontSize: 11, background: '#FEF3C7', color: '#92400E', border: '1px solid #FCD34D', padding: '1px 6px', borderRadius: 4, fontWeight: 700 }}>
                                Main Admin
                              </span>
                            )}
                            {isSelf && (
                              <span style={{ fontSize: 11, background: '#EFF6FF', color: '#2563EB', padding: '1px 6px', borderRadius: 4, fontWeight: 700 }}>
                                You
                              </span>
                            )}
                          </div>
                        </td>
                        <td>
                          <span style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 5,
                            padding: '4px 10px',
                            borderRadius: 12,
                            fontSize: 12,
                            fontWeight: 700,
                            background: user.role === 'Admin' ? 'rgba(37, 99, 235, 0.1)' : '#F1F5F9',
                            color: user.role === 'Admin' ? '#1D4ED8' : '#475569'
                          }}>
                            {user.role === 'Admin' ? <ShieldCheck size={14} color="#1D4ED8" /> : <ShieldAlert size={14} color="#64748B" />}
                            {user.role === 'Admin' ? (isPrimary ? 'Main Super Admin' : 'Super Admin') : 'Sub-Admin'}
                          </span>
                        </td>
                        <td style={{ color: 'var(--text-muted)' }}>{user.email}</td>
                        <td>
                          {user.role === 'Admin' ? (
                            <span style={{ color: '#16A34A', fontWeight: 600, fontSize: 13, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                              Full Universal Access (All Features)
                            </span>
                          ) : (
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                              {user.permissions && user.permissions.length > 0 ? user.permissions.map((p: string) => (
                                <span key={p} style={{ background: 'var(--bg-light)', padding: '2px 8px', borderRadius: 4, fontSize: 12, color: 'var(--text-main)', border: '1px solid var(--border-color)' }}>
                                  {p}
                                </span>
                              )) : (
                                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>None</span>
                              )}
                            </div>
                          )}
                        </td>
                        {!isSubAdmin && (
                          <td style={{ textAlign: 'center' }}>
                            <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                              <button 
                                onClick={() => setEditingUser({ ...user, role: user.role || 'SubAdmin', password: '' })}
                                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 8, borderRadius: 8 }}
                                onMouseOver={(e) => e.currentTarget.style.background = 'rgba(59, 130, 246, 0.1)'}
                                onMouseOut={(e) => e.currentTarget.style.background = 'none'}
                                title="Edit"
                              >
                                <Edit2 size={18} color="var(--primary)" />
                              </button>
                              
                              {canDelete && (
                                <button 
                                  onClick={() => handleDelete(user._id, user.role)}
                                  style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 8, borderRadius: 8 }}
                                  onMouseOver={(e) => e.currentTarget.style.background = 'rgba(239, 68, 68, 0.1)'}
                                  onMouseOut={(e) => e.currentTarget.style.background = 'none'}
                                  title="Delete"
                                >
                                  <Trash2 size={18} color="var(--danger)" />
                                </button>
                              )}
                            </div>
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              <Pagination page={page} totalPages={totalPages} setPage={setPage} />
            </div>
          )}
        </div>
      )}

      {activeTab === 'create' && (
        <div style={{ maxWidth: 650, margin: '0 auto' }}>
          <div className="card">
            <h2 className="card-title" style={{ marginBottom: 8 }}>Create New Admin Account</h2>
            <p style={{ color: 'var(--text-muted)', fontSize: 14, marginBottom: 24 }}>
              Choose whether to create a full Super Admin or a Sub-Admin with restricted permissions.
            </p>

            <form onSubmit={handleCreate}>
              {/* Account Role Selector */}
              <div className="input-group" style={{ marginBottom: 20 }}>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: 'var(--text-main)', marginBottom: 8 }}>
                  Account Type / Role <span style={{ color: 'var(--danger)' }}>*</span>
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <label style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    padding: '14px 16px',
                    borderRadius: 12,
                    border: '1.5px solid ' + (role === 'SubAdmin' ? 'var(--primary)' : 'var(--border-color)'),
                    background: role === 'SubAdmin' ? 'rgba(79, 70, 229, 0.05)' : '#FFFFFF',
                    cursor: 'pointer'
                  }}>
                    <input 
                      type="radio" 
                      name="adminRoleCreate" 
                      checked={role === 'SubAdmin'} 
                      onChange={() => setRole('SubAdmin')} 
                      style={{ width: 18, height: 18, accentColor: 'var(--primary)' }}
                    />
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-main)' }}>Sub-Admin</div>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>Restricted access by section</div>
                    </div>
                  </label>

                  <label style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    padding: '14px 16px',
                    borderRadius: 12,
                    border: '1.5px solid ' + (role === 'Admin' ? '#2563EB' : 'var(--border-color)'),
                    background: role === 'Admin' ? '#EFF6FF' : '#FFFFFF',
                    cursor: 'pointer'
                  }}>
                    <input 
                      type="radio" 
                      name="adminRoleCreate" 
                      checked={role === 'Admin'} 
                      onChange={() => setRole('Admin')} 
                      style={{ width: 18, height: 18, accentColor: '#2563EB' }}
                    />
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 14, color: '#1E40AF' }}>Super Admin</div>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>Universal full access to all features</div>
                    </div>
                  </label>
                </div>
              </div>
              
              <div className="input-group">
                <label>Full Name</label>
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
                  placeholder="admin@society.com"
                />
                <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>They will use this email to log in to the admin portal.</p>
              </div>
              
              <div className="input-group">
                <label>Password *</label>
                <input 
                  type="text" 
                  value={password} 
                  onChange={(e) => setPassword(e.target.value)} 
                  required
                  placeholder="Set a secure password"
                />
              </div>

              {/* Permissions or Super Admin Notice */}
              {role === 'Admin' ? (
                <div style={{
                  padding: '16px 18px',
                  borderRadius: 12,
                  background: '#EFF6FF',
                  border: '1px solid #BFDBFE',
                  marginBottom: 24,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12
                }}>
                  <ShieldCheck size={26} color="#2563EB" />
                  <div>
                    <strong style={{ color: '#1E40AF', fontSize: 14 }}>Full Super Admin Privileges</strong>
                    <p style={{ fontSize: 13, color: '#1E3A8A', margin: '4px 0 0 0', lineHeight: 1.4 }}>
                      This user will have the exact same full access as you to all features, pages, settings, resident records, complaints, staff, and locations automatically.
                    </p>
                  </div>
                </div>
              ) : (
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
              )}

              <button type="submit" className="btn-primary" disabled={isCreating} style={{ marginTop: '16px', height: '52px' }}>
                {isCreating ? 'Creating Account...' : (role === 'Admin' ? 'Create Super Admin Account' : 'Create Sub-Admin Account')}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {editingUser && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(15, 23, 42, 0.75)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}>
          <div className="card" style={{ width: '100%', maxWidth: 500, margin: 20, padding: 0, borderRadius: 16, maxHeight: '90vh', display: 'flex', flexDirection: 'column', background: '#ffffff', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)' }}>
            <div style={{ padding: '24px 24px 16px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 className="card-title" style={{ margin: 0, fontSize: 20 }}>
                Edit {editingUser.role === 'Admin' ? 'Super Admin' : 'Sub-Admin'}
              </h2>
              <button type="button" onClick={() => setEditingUser(null)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 4, borderRadius: 8 }} title="Close">
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleEditSubmit} style={{ padding: '24px', overflowY: 'auto' }}>
              {/* Role Selection in Edit */}
              <div className="form-group" style={{ marginBottom: 16 }}>
                <label className="form-label" style={{ fontWeight: 600, fontSize: 13, marginBottom: 6, display: 'block' }}>Account Type / Role</label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <label style={{
                    display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px',
                    borderRadius: 8, border: '1.5px solid ' + (editingUser.role === 'SubAdmin' ? 'var(--primary)' : 'var(--border-color)'),
                    background: editingUser.role === 'SubAdmin' ? 'rgba(79, 70, 229, 0.05)' : '#FFFFFF',
                    cursor: 'pointer'
                  }}>
                    <input 
                      type="radio" 
                      name="editAdminRole" 
                      checked={editingUser.role === 'SubAdmin'} 
                      onChange={() => setEditingUser({ ...editingUser, role: 'SubAdmin' })} 
                      style={{ width: 16, height: 16, accentColor: 'var(--primary)' }}
                    />
                    <span style={{ fontWeight: 600, fontSize: 13, color: 'var(--text-main)' }}>Sub-Admin</span>
                  </label>

                  <label style={{
                    display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px',
                    borderRadius: 8, border: '1.5px solid ' + (editingUser.role === 'Admin' ? '#2563EB' : 'var(--border-color)'),
                    background: editingUser.role === 'Admin' ? '#EFF6FF' : '#FFFFFF',
                    cursor: 'pointer'
                  }}>
                    <input 
                      type="radio" 
                      name="editAdminRole" 
                      checked={editingUser.role === 'Admin'} 
                      onChange={() => setEditingUser({ ...editingUser, role: 'Admin' })} 
                      style={{ width: 16, height: 16, accentColor: '#2563EB' }}
                    />
                    <span style={{ fontWeight: 600, fontSize: 13, color: '#1E40AF' }}>Super Admin</span>
                  </label>
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Name</label>
                <input 
                  type="text" 
                  className="form-input"
                  value={editingUser.name || ''} 
                  onChange={(e) => setEditingUser({...editingUser, name: e.target.value})} 
                  required
                />
              </div>
              
              <div className="form-group">
                <label className="form-label">Email</label>
                <input 
                  type="email" 
                  className="form-input"
                  value={editingUser.email || ''} 
                  onChange={(e) => setEditingUser({...editingUser, email: e.target.value})} 
                  required
                />
              </div>
              
              <div className="form-group">
                <label className="form-label">New Password (leave blank to keep current)</label>
                <input 
                  type="password" 
                  className="form-input"
                  value={editingUser.password || ''} 
                  onChange={(e) => setEditingUser({...editingUser, password: e.target.value})} 
                  placeholder="Enter new password"
                />
              </div>
              
              {editingUser.role === 'Admin' ? (
                <div style={{
                  padding: '12px 14px',
                  borderRadius: 8,
                  background: '#EFF6FF',
                  border: '1px solid #BFDBFE',
                  color: '#1E40AF',
                  fontSize: 13,
                  marginTop: 8
                }}>
                  Super Admins automatically have universal access to all dashboard features and settings.
                </div>
              ) : (
                <div className="form-group">
                  <label className="form-label">Permissions</label>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 8 }}>
                    {availablePermissions.map(perm => {
                      const isChecked = (editingUser.permissions || []).includes(perm);
                      return (
                        <label key={perm} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', padding: '12px 16px', border: '1px solid ' + (isChecked ? 'var(--primary)' : 'var(--border-color)'), borderRadius: 8, background: isChecked ? 'rgba(79, 70, 229, 0.05)' : 'white' }}>
                          <input 
                            type="checkbox"
                            checked={isChecked}
                            onChange={(e) => {
                              const currentPerms = editingUser.permissions || [];
                              if (e.target.checked) {
                                setEditingUser({...editingUser, permissions: [...currentPerms, perm]});
                              } else {
                                setEditingUser({...editingUser, permissions: currentPerms.filter((p: string) => p !== perm)});
                              }
                            }}
                            style={{ width: 18, height: 18, accentColor: 'var(--primary)', cursor: 'pointer' }}
                          />
                          <span style={{ fontWeight: isChecked ? 600 : 500, color: isChecked ? 'var(--primary)' : 'var(--text-main)', fontSize: 14 }}>{perm}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              )}
              
              <div style={{ display: 'flex', gap: 12, marginTop: 32 }}>
                <button type="button" onClick={() => setEditingUser(null)} className="btn btn-outline" style={{ flex: 1 }}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" style={{ flex: 1 }}>
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
