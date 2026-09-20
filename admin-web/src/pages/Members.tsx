import { useState, useEffect } from 'react';
import axios from 'axios';
import { UserPlus, Users, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';

const API_URL = 'https://anytime-help.onrender.com/api';

export default function Members() {
  const [activeTab, setActiveTab] = useState<'list' | 'create'>('list');
  const [members, setMembers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  // Form State
  const [name, setName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [designation, setDesignation] = useState('Member');
  const [address, setAddress] = useState('');
  const [memberId, setMemberId] = useState('');
  const [permissions, setPermissions] = useState<string[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  
  const availablePermissions = ['All Complaints', 'Announcements', 'Directory'];

  useEffect(() => {
    if (activeTab === 'list') {
      fetchMembers(page);
    }
  }, [activeTab, page]);

  const fetchMembers = async (currentPage = page, showLoading = true) => {
    try {
      if (showLoading) setLoading(true);
      const token = localStorage.getItem('adminToken');
      const res = await axios.get(`${API_URL}/users/members?page=${currentPage}&limit=10`, {
        headers: { 'x-auth-token': token }
      });
      if (res.data && res.data.members) {
        setMembers(res.data.members);
        setTotalCount(res.data.total || 0);
        setTotalPages(res.data.totalPages || 1);
      } else if (Array.isArray(res.data)) {
        setMembers(res.data);
        setTotalCount(res.data.length);
        setTotalPages(Math.ceil(res.data.length / 10) || 1);
      }
    } catch (err) {
      console.error(err);
      toast.error('Failed to load members');
    } finally {
      if (showLoading) setLoading(false);
    }
  };

  const handleCreateMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !phoneNumber || !designation || !memberId) {
      toast.error('Please fill in all required fields');
      return;
    }
    
    setIsCreating(true);
    const loadingToast = toast.loading('Creating member...');

    try {
      const token = localStorage.getItem('adminToken');
      
      await axios.post(`${API_URL}/users/members`, {
        name,
        phone_number: phoneNumber,
        designation,
        address,
        member_id: memberId,
        permissions
      }, {
        headers: { 'x-auth-token': token }
      });
      
      toast.success('Member created successfully!', { id: loadingToast });
      
      // Reset form
      setName('');
      setPhoneNumber('');
      setDesignation('Member');
      setAddress('');
      setMemberId('');
      setPermissions([]);
      
      // Auto switch back to list
      setActiveTab('list');
    } catch (err: any) {
      toast.error(err.response?.data?.msg || err.response?.data?.message || 'Failed to create member', { id: loadingToast });
    } finally {
      setIsCreating(false);
    }
  };

  const handleDelete = (id: string) => {
    toast((t) => (
      <div>
        <p style={{ fontWeight: 600, marginBottom: 12, color: 'var(--text-main)' }}>Are you sure you want to delete this member?</p>
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
              const loadingToast = toast.loading('Deleting member...');
              try {
                const token = localStorage.getItem('adminToken');
                await axios.delete(`${API_URL}/users/${id}`, {
                  headers: { 'x-auth-token': token }
                });
                toast.success('Member deleted', { id: loadingToast });
                fetchMembers(page, false);
              } catch (err) {
                console.error(err);
                toast.error('Failed to delete member', { id: loadingToast });
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
          <h1 className="page-title">Members</h1>
          <p style={{ color: 'var(--text-muted)', marginTop: 8 }}>Manage RWA / society members.</p>
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
          <Users size={18} /> <span>Active Members</span>
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
          <UserPlus size={18} /> <span>Add New Member</span>
        </button>
      </div>

      {activeTab === 'list' && (
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <h2 className="card-title">Members List</h2>
            <div style={{ background: 'var(--bg-light)', padding: '6px 12px', borderRadius: 20, fontSize: 13, fontWeight: 600, color: 'var(--text-main)' }}>
              Total: {totalCount}
            </div>
          </div>
          
          {loading ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16, minHeight: '50vh', justifyContent: 'center', alignItems: 'center' }}>
              <style>{`
                @keyframes pulse {
                  0%, 100% { opacity: 1; }
                  50% { opacity: 0.5; }
                }
                .skeleton-row {
                  width: 100%;
                  height: 64px;
                  background-color: #E2E8F0;
                  border-radius: 12px;
                  animation: pulse 1.5s cubic-bezier(0.4, 0, 0.6, 1) infinite;
                }
              `}</style>
              <div style={{ width: '100%', maxWidth: '900px', display: 'flex', flexDirection: 'column', gap: 12, padding: '20px 0' }}>
                {[1, 2, 3, 4, 5].map((item) => (
                  <div key={item} className="skeleton-row"></div>
                ))}
              </div>
            </div>
          ) : members.length === 0 ? (
            <div style={{ padding: '60px 0', textAlign: 'center' }}>
              <div style={{ width: 80, height: 80, background: 'var(--bg-light)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                <Users size={32} color="var(--text-muted)" />
              </div>
              <h3 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-main)', marginBottom: 8 }}>No Members Found</h3>
              <p style={{ color: 'var(--text-muted)', maxWidth: 400, margin: '0 auto' }}>You haven't added any members yet.</p>
              <button 
                onClick={() => setActiveTab('create')}
                style={{ marginTop: 24, padding: '10px 20px', background: 'var(--primary)', color: 'white', border: 'none', borderRadius: 8, fontWeight: 600, cursor: 'pointer' }}
              >
                Add Member Now
              </button>
            </div>
          ) : (
            <>
              <div style={{ overflowX: 'auto' }}>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Member ID</th>
                      <th>Phone</th>
                      <th>Designation</th>
                      <th>Permissions</th>
                      <th>Address</th>
                      <th style={{ width: 80, textAlign: 'center' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {members.map(member => (
                      <tr key={member._id}>
                        <td>
                          <div style={{ fontWeight: 600, color: 'var(--text-main)' }}>{member.name}</div>
                        </td>
                        <td>{member.member_id || '-'}</td>
                        <td>{member.phone_number}</td>
                        <td>
                          <span style={{ background: 'var(--primary-light)', color: 'var(--primary)', padding: '4px 10px', borderRadius: 12, fontSize: 13, fontWeight: 600 }}>
                            {member.designation || 'Member'}
                          </span>
                        </td>
                        <td>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                            {member.permissions && member.permissions.length > 0 ? member.permissions.map((p: string) => (
                              <span key={p} style={{ background: 'var(--bg-light)', padding: '2px 8px', borderRadius: 4, fontSize: 12, color: 'var(--text-main)', border: '1px solid var(--border-color)' }}>
                                {p}
                              </span>
                            )) : (
                              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>None</span>
                            )}
                          </div>
                        </td>
                        <td>{member.address || '-'}</td>
                        <td>
                          <div style={{ display: 'flex', justifyContent: 'center' }}>
                            <button 
                              className="icon-btn" 
                              style={{ color: 'var(--danger)' }}
                              onClick={() => handleDelete(member._id)}
                              title="Delete Member"
                            >
                              <Trash2 size={18} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              
              {/* Pagination */}
              {totalPages > 1 && (
                <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 16, marginTop: 24, paddingTop: 20, borderTop: '1px solid var(--border-color)' }}>
                  <button 
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={page === 1}
                    style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid var(--border-color)', background: page === 1 ? 'var(--bg-light)' : 'white', color: page === 1 ? 'var(--text-muted)' : 'var(--text-main)', cursor: page === 1 ? 'not-allowed' : 'pointer', fontWeight: 600 }}
                  >
                    Previous
                  </button>
                  <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-muted)' }}>
                    Page <span style={{ color: 'var(--text-main)' }}>{page}</span> of {totalPages}
                  </span>
                  <button 
                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                    style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid var(--border-color)', background: page === totalPages ? 'var(--bg-light)' : 'white', color: page === totalPages ? 'var(--text-muted)' : 'var(--text-main)', cursor: page === totalPages ? 'not-allowed' : 'pointer', fontWeight: 600 }}
                  >
                    Next
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {activeTab === 'create' && (
        <div className="card" style={{ maxWidth: 600 }}>
          <div style={{ marginBottom: 24, borderBottom: '1px solid var(--border-color)', paddingBottom: 16 }}>
            <h2 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <UserPlus size={20} color="var(--primary)" />
              Add New Member
            </h2>
            <p style={{ color: 'var(--text-muted)', marginTop: 4, fontSize: 14 }}>Create an account for a member to login to the app.</p>
          </div>
          
          <form onSubmit={handleCreateMember}>
            <div className="form-group">
              <label className="form-label">Name *</label>
              <input 
                type="text" 
                className="form-input" 
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="e.g. Rahul Sharma"
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">Member ID *</label>
              <input 
                type="text" 
                className="form-input" 
                value={memberId}
                onChange={e => setMemberId(e.target.value)}
                placeholder="e.g. SLERWA-101"
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">Phone Number *</label>
              <div style={{ display: 'flex', alignItems: 'center', background: 'white', border: '1px solid var(--border-color)', borderRadius: 12, overflow: 'hidden' }}>
                <div style={{ padding: '0 16px', background: 'var(--bg-light)', borderRight: '1px solid var(--border-color)', fontWeight: 600, color: 'var(--text-muted)' }}>
                  +91
                </div>
                <input 
                  type="tel" 
                  className="form-input" 
                  value={phoneNumber.replace('+91', '')}
                  onChange={e => setPhoneNumber(e.target.value.replace(/[^0-9]/g, ''))}
                  placeholder="9876543210"
                  style={{ border: 'none', borderRadius: 0 }}
                  maxLength={10}
                  required
                />
              </div>
              <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 6 }}>This will be used for OTP login.</p>
            </div>

            <div className="form-group">
              <label className="form-label">Designation *</label>
              <select 
                className="form-input"
                value={designation}
                onChange={e => setDesignation(e.target.value)}
                required
              >
                <option value="President">President</option>
                <option value="Vice President">Vice President</option>
                <option value="General Secretary">General Secretary</option>
                <option value="Joint Secretary">Joint Secretary</option>
                <option value="Treasurer">Treasurer</option>
                <option value="Executive Member">Executive Member</option>
                <option value="Member">Member</option>
              </select>
            </div>
            
            <div className="form-group">
              <label className="form-label">Address / Flat No (Optional)</label>
              <input 
                type="text" 
                className="form-input" 
                value={address}
                onChange={e => setAddress(e.target.value)}
                placeholder="e.g. Block C, Flat 104"
              />
            </div>

            <div className="form-group">
              <label className="form-label">App Access Permissions</label>
              <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 12 }}>Select which sections this member can access in the mobile app.</p>
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
            
            <div style={{ marginTop: 32, display: 'flex', gap: 12 }}>
              <button 
                type="button" 
                onClick={() => setActiveTab('list')}
                className="btn btn-outline"
                style={{ flex: 1 }}
              >
                Cancel
              </button>
              <button 
                type="submit" 
                className="btn btn-primary"
                disabled={isCreating || !name || !phoneNumber || phoneNumber.length < 10 || !memberId}
                style={{ flex: 2, display: 'flex', justifyContent: 'center', gap: 8 }}
              >
                {isCreating ? (
                  <>
                    <div style={{ width: 16, height: 16, border: '2px solid rgba(255,255,255,0.3)', borderTop: '2px solid white', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
                    Creating...
                  </>
                ) : (
                  <>
                    <UserPlus size={18} /> Add Member
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
