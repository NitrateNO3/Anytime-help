import { useState, useEffect } from 'react';
import { Pagination } from '../components/Pagination';
import axios from 'axios';
import { UserPlus, Users, Trash2, Wrench, Edit2, Search, Filter, RotateCcw, X } from 'lucide-react';
import toast from 'react-hot-toast';

const API_URL = 'https://anytime-help.onrender.com/api';

const defaultCategories = [
  'Electricity', 'Garbage', 'Sweeping', 'Sewage cleaning', 
  'Rainwater drainage', 'Tree cutting', 'Street light', 'Water service'
];

const phases = ['All', 'Universal', 'Sushant Lok 2 - C,D,E', 'Sushant Lok 2 - F,G', 'Sushant Lok 3'];

export default function Staff() {
  const [activeTab, setActiveTab] = useState<'list' | 'create'>('list');
  const [staff, setStaff] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Filter States
  const [filterPhase, setFilterPhase] = useState('All');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 350);
    return () => clearTimeout(timer);
  }, [search]);

  // Form State
  const [selectedEntity, setSelectedEntity] = useState('Sushant Lok 2 - C,D,E');
  const [selectedBlock, setSelectedBlock] = useState('C, D, E');
  const [staffPersonalName, setStaffPersonalName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [category, setCategory] = useState('Electricity');
  const [isCreating, setIsCreating] = useState(false);
  const [editingUser, setEditingUser] = useState<any>(null);
  
  // Custom Category State
  const [availableCategories, setAvailableCategories] = useState<string[]>([]);

  useEffect(() => {
    // Fetch categories for the dropdown when tab changes
    if (activeTab === 'create') {
      axios.get(`${API_URL}/categories`)
        .then(res => {
          if (res.data && res.data.length > 0) {
            setAvailableCategories(res.data.map((c: any) => c.title));
            if (!category || !res.data.find((c: any) => c.title === category)) {
              setCategory(res.data[0].title);
            }
          } else {
            setAvailableCategories(defaultCategories);
            if (!category) setCategory(defaultCategories[0]);
          }
        })
        .catch(err => {
          console.error('Error fetching categories for dropdown:', err);
          setAvailableCategories(defaultCategories);
          if (!category) setCategory(defaultCategories[0]);
        });
    }
  }, [activeTab]);

  // Group blocks together into a single option for each entity
  const entityBlocks: any = {
    'All Groups (Universal)': ['All Blocks (Entire Society)'],
    'Sushant Lok 2 - C,D,E': ['C, D, E'],
    'Sushant Lok 2 - F,G': ['F, G'],
    'Sushant Lok 3': ['A, B, B1, C, D, E, F, G, H']
  };

  useEffect(() => {
    // Whenever entity changes, reset block to the single grouped option
    if (entityBlocks[selectedEntity]) {
      setSelectedBlock(entityBlocks[selectedEntity][0]);
    }
  }, [selectedEntity]);

  useEffect(() => {
    if (activeTab === 'list') {
      fetchStaff(page, filterPhase, debouncedSearch);
    }
  }, [activeTab, page, filterPhase, debouncedSearch]);

  const fetchStaff = async (
    currentPage = page, 
    phase = filterPhase,
    searchFilter = debouncedSearch,
    showLoading = true
  ) => {
    try {
      if (showLoading) setLoading(true);
      const token = localStorage.getItem('adminToken');
      
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: '10',
        phase
      });
      if (searchFilter.trim()) params.append('search', searchFilter.trim());

      const res = await axios.get(`${API_URL}/users/staff?${params.toString()}`, {
        headers: { 'x-auth-token': token }
      });
      if (res.data && res.data.staff) {
        setStaff(res.data.staff);
        setTotalCount(res.data.total || 0);
        setTotalPages(res.data.totalPages || 1);
      } else if (Array.isArray(res.data)) {
        setStaff(res.data);
        setTotalCount(res.data.length);
        setTotalPages(Math.ceil(res.data.length / 10) || 1);
      }
    } catch (err) {
      console.error(err);
      toast.error('Failed to load staff members');
    } finally {
      if (showLoading) setLoading(false);
    }
  };

  const handleCreateStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!category) {
      toast.error('Please select or create a category first');
      return;
    }
    
    setIsCreating(true);
    const loadingToast = toast.loading('Creating account...');

    try {
      const token = localStorage.getItem('adminToken');
      const isUniversal = selectedEntity === 'All Groups (Universal)' || selectedEntity === 'Universal';
      const defaultStaffName = isUniversal ? 'Universal: All Groups & Blocks' : `${selectedEntity}: Block ${selectedBlock}`;
      const staffPhase = isUniversal ? 'Universal' : selectedEntity;
      const finalName = staffPersonalName ? `${staffPersonalName} (${defaultStaffName})` : defaultStaffName;
      
      await axios.post(`${API_URL}/users/staff`, {
        name: finalName,
        phone_number: phoneNumber,
        assigned_category: category,
        phase: staffPhase
      }, {
        headers: { 'x-auth-token': token }
      });
      
      toast.success(isUniversal ? 'Universal staff assigned successfully for all groups!' : 'Staff account assigned successfully!', { id: loadingToast });
      
      // Reset form
      setStaffPersonalName('');
      setPhoneNumber('');
      
      // Auto switch back to list
      setActiveTab('list');
    } catch (err: any) {
      toast.error(err.response?.data?.msg || err.response?.data?.message || 'Failed to assign staff', { id: loadingToast });
    } finally {
      setIsCreating(false);
    }
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const loadingToast = toast.loading('Updating staff...');

    try {
      const token = localStorage.getItem('adminToken');
      await axios.put(`${API_URL}/users/${editingUser._id}`, {
        name: editingUser.name,
        phone_number: editingUser.phone_number,
        category: editingUser.assigned_category,
        phase: editingUser.phase
      }, {
        headers: { 'x-auth-token': token }
      });
      
      toast.success('Staff updated successfully!', { id: loadingToast });
      setEditingUser(null);
      fetchStaff(page, filterPhase, debouncedSearch, false);
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to update staff', { id: loadingToast });
    }
  };

  const isFiltered = search !== '' || filterPhase !== 'All';

  const resetFilters = () => {
    setSearch('');
    setDebouncedSearch('');
    setFilterPhase('All');
    setPage(1);
  };

  const handleDelete = (id: string) => {
    toast((t) => (
      <div>
        <p style={{ fontWeight: 600, marginBottom: 12, color: 'var(--text-main)' }}>Are you sure you want to delete this staff member?</p>
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
              const loadingToast = toast.loading('Deleting staff...');
              try {
                const token = localStorage.getItem('adminToken');
                await axios.delete(`${API_URL}/users/${id}`, {
                  headers: { 'x-auth-token': token }
                });
                toast.success('Staff member deleted', { id: loadingToast });
                fetchStaff(page, filterPhase, debouncedSearch, false);
              } catch (err) {
                console.error(err);
                toast.error('Failed to delete staff', { id: loadingToast });
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
          <h1 className="page-title">Staff Team</h1>
          <p style={{ color: 'var(--text-muted)', marginTop: 8 }}>Manage your service staff block-wise and create new accounts for the mobile app.</p>
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
          onClick={() => { setActiveTab('create'); }}
          style={{ 
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '10px 20px', 
            background: activeTab === 'create' ? 'var(--primary)' : 'white', 
            color: activeTab === 'create' ? 'white' : 'var(--text-muted)',
            border: activeTab === 'create' ? 'none' : '1px solid var(--border-color)',
            borderRadius: 12, cursor: 'pointer', fontWeight: 600, transition: 'all 0.2s'
          }}
        >
          <UserPlus size={18} /> <span>Create Account</span>
        </button>
      </div>

      {/* Content Area */}
      {activeTab === 'list' && (
        <div className="glass table-container">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <h2 className="card-title">Staff Members</h2>
            <div style={{ background: 'var(--bg-light)', padding: '6px 12px', borderRadius: 20, fontSize: 13, fontWeight: 600, color: 'var(--text-main)' }}>
              Total: {totalCount}
            </div>
          </div>

          {/* Filter Toolbar */}
          <div style={{ marginBottom: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Filter size={20} color="var(--primary)" />
                <h3 style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-main)' }}>Filter Staff</h3>
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
                placeholder="Search by name, phone number, or category..."
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

            {/* Additional Filters Row */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6 }}>Phase / Location</label>
                <select 
                  value={filterPhase} 
                  onChange={(e) => { setFilterPhase(e.target.value); setPage(1); }}
                  style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid var(--border-color)', background: '#FFFFFF', fontSize: 13, color: 'var(--text-main)', fontWeight: 500, outline: 'none' }}
                >
                  {phases.map(p => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>
          <table>
            <thead>
              <tr>
                <th>Group / Block / Name</th>
                <th>Phone Number</th>
                <th>Category</th>
                <th style={{ width: 100 }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 5 }).map((_, idx) => (
                  <tr key={`skeleton-${idx}`}>
                    <td><div className="skeleton skeleton-row" style={{ width: '80%' }}></div></td>
                    <td><div className="skeleton skeleton-row" style={{ width: '90%' }}></div></td>
                    <td><div className="skeleton skeleton-row" style={{ width: 80, borderRadius: 20 }}></div></td>
                    <td><div className="skeleton skeleton-row" style={{ width: 30, borderRadius: 8 }}></div></td>
                  </tr>
                ))
              ) : staff.length === 0 ? (
                  <tr>
                    <td colSpan={4} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '40px 0' }}>
                      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '16px' }}>
                        <Users size={40} color="var(--border-color)" />
                      </div>
                      No staff members assigned yet.
                    </td>
                  </tr>
                ) : (
                  staff.map(member => {
                    const displayName = member.name || 'Unnamed Staff';
                    const isUniversal = member.phase === 'Universal' || member.phase === 'All' || displayName.toLowerCase().includes('universal');
                    return (
                      <tr key={member._id}>
                        <td style={{ fontWeight: 600 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span>{displayName}</span>
                            {isUniversal && (
                              <span style={{ 
                                background: '#10B98115', 
                                color: '#059669', 
                                border: '1px solid #10B98140', 
                                padding: '2px 8px', 
                                borderRadius: '12px', 
                                fontSize: '11px', 
                                fontWeight: 700,
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px'
                              }}>
                                🌐 UNIVERSAL
                              </span>
                            )}
                          </div>
                        </td>
                        <td style={{ color: 'var(--text-muted)' }}>{member.phone_number}</td>
                        <td>
                          <span style={{ 
                            background: 'rgba(255, 99, 71, 0.1)', 
                            color: 'var(--primary)', 
                            padding: '6px 12px', 
                            borderRadius: '20px', 
                            fontSize: '12px',
                            fontWeight: 600
                          }}>
                            {member.assigned_category}
                          </span>
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                            <button 
                              onClick={() => {
                                setEditingUser({ ...member, password: '' });
                                setSelectedEntity(member.phase);
                                setSelectedBlock(member.block);
                              }}
                              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 8, borderRadius: 8 }}
                              onMouseOver={(e) => e.currentTarget.style.background = 'rgba(59, 130, 246, 0.1)'}
                              onMouseOut={(e) => e.currentTarget.style.background = 'none'}
                              title="Edit"
                            >
                              <Edit2 size={18} color="var(--primary)" />
                            </button>
                            <button 
                              onClick={() => handleDelete(member._id)}
                              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 8, borderRadius: 8 }}
                              onMouseOver={(e) => e.currentTarget.style.background = 'rgba(239, 68, 68, 0.1)'}
                              onMouseOut={(e) => e.currentTarget.style.background = 'none'}
                              title="Delete"
                            >
                              <Trash2 size={20} color="var(--danger)" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
            </tbody>
          </table>

          {/* Pagination Controls */}
          <Pagination page={page} totalPages={totalPages} setPage={setPage} />
        </div>
      )}
      
      {activeTab === 'create' && (
        <div style={{ display: 'flex', justifyContent: 'center', marginTop: '40px' }}>
          <div className="glass" style={{ padding: '40px', width: '100%', maxWidth: '600px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '32px' }}>
              <div style={{ background: 'rgba(255, 99, 71, 0.1)', padding: 12, borderRadius: 12 }}>
                <UserPlus size={28} color="var(--primary)" />
              </div>
              <h2 style={{ fontSize: 24, fontWeight: 700 }}>
                {selectedEntity === 'All Groups (Universal)' ? 'Assign Universal Staff' : 'Assign Staff to Group'}
              </h2>
            </div>

            <form onSubmit={handleCreateStaff}>
            <div className="input-group">
              <label>Staff Name (Optional)</label>
              <input 
                type="text" 
                value={staffPersonalName} 
                onChange={(e) => setStaffPersonalName(e.target.value)} 
                placeholder="e.g. Ramesh Kumar"
              />
            </div>
            
            <div className="input-group">
              <label>Select Entity (Group)</label>
              <select 
                  value={selectedEntity}
                  onChange={(e) => setSelectedEntity(e.target.value)}
                  style={{ 
                    width: '100%', 
                    padding: '14px 16px', 
                    background: 'white', 
                    border: '1px solid var(--border-color)', 
                    borderRadius: '12px',
                    fontSize: '15px',
                    color: 'var(--text-main)',
                    outline: 'none',
                    cursor: 'pointer'
                  }}
                >
                  {Object.keys(entityBlocks).map(entity => (
                    <option key={entity} value={entity}>
                      {entity === 'All Groups (Universal)' ? '🌐 All Groups (Universal - Entire Society)' : entity}
                    </option>
                  ))}
                </select>
            </div>

            {selectedEntity === 'All Groups (Universal)' ? (
              <div style={{
                background: 'rgba(59, 130, 246, 0.08)',
                border: '1px solid rgba(59, 130, 246, 0.25)',
                borderRadius: '12px',
                padding: '16px',
                marginBottom: '20px',
                display: 'flex',
                alignItems: 'flex-start',
                gap: '12px'
              }}>
                <span style={{ fontSize: '24px', lineHeight: 1 }}>🌐</span>
                <div>
                  <strong style={{ color: '#2563EB', display: 'block', fontSize: '14px', marginBottom: '4px' }}>
                    Universal Society Access
                  </strong>
                  <span style={{ color: 'var(--text-muted)', fontSize: '13px', lineHeight: 1.4 }}>
                    Staff member will handle service requests and complaints from all blocks and groups across the entire society.
                  </span>
                </div>
              </div>
            ) : (
              <div className="input-group">
                <label>Select Block</label>
                <select 
                    value={selectedBlock}
                    onChange={(e) => setSelectedBlock(e.target.value)}
                    style={{ 
                      width: '100%', 
                      padding: '14px 16px', 
                      background: 'white', 
                      border: '1px solid var(--border-color)', 
                      borderRadius: '12px',
                      fontSize: '15px',
                      color: 'var(--text-main)',
                      outline: 'none',
                      cursor: 'pointer'
                    }}
                  >
                    {entityBlocks[selectedEntity]?.map((blk: string) => (
                      <option key={blk} value={blk}>Block {blk}</option>
                    ))}
                  </select>
              </div>
            )}
            
            <div className="input-group">
              <label>Phone Number</label>
              <div style={{ position: 'relative' }}>
                <span style={{ position: 'absolute', left: '16px', top: '15px', color: 'var(--text-muted)', fontWeight: 600 }}>+91</span>
                <input 
                  type="tel" 
                  value={phoneNumber} 
                  onChange={(e) => setPhoneNumber(e.target.value)} 
                  required
                  placeholder="9876543210"
                  maxLength={10}
                  style={{ paddingLeft: '50px' }}
                />
              </div>
            </div>
            
            <div className="input-group">
              <label>Assigned Category</label>
              <div style={{ position: 'relative' }}>
                <Wrench size={18} style={{ position: 'absolute', left: '16px', top: '15px', color: 'var(--text-muted)' }} />
                <select 
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  style={{ 
                    width: '100%', 
                    padding: '14px 16px 14px 44px', 
                    background: 'white', 
                    border: '1px solid var(--border-color)', 
                    borderRadius: '12px',
                    fontSize: '15px',
                    color: 'var(--text-main)',
                    outline: 'none',
                    cursor: 'pointer'
                  }}
                  required
                >
                  {availableCategories.length === 0 && <option value="" disabled>No categories available</option>}
                  {availableCategories.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>
            </div>

            <button type="submit" className="btn-primary" disabled={isCreating} style={{ marginTop: '16px', height: '52px' }}>
              {isCreating ? 'Assigning Staff...' : (selectedEntity === 'All Groups (Universal)' ? 'Assign Universal Staff (All Groups)' : 'Assign Staff')}
            </button>
          </form>
        </div>
        </div>
      )}

      {/* Edit Modal */}
      {editingUser && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div className="card" style={{ width: '100%', maxWidth: 500, margin: 20 }}>
            <h2 className="card-title" style={{ marginBottom: 20 }}>Edit Staff Member</h2>
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
                <label>Phone Number</label>
                <input 
                  type="text" 
                  value={editingUser.phone_number} 
                  onChange={(e) => setEditingUser({...editingUser, phone_number: e.target.value})} 
                  required
                />
              </div>

              <div className="input-group">
                <label>Category</label>
                <select 
                  value={editingUser.assigned_category}
                  onChange={(e) => setEditingUser({...editingUser, assigned_category: e.target.value})}
                  style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid var(--border-color)', outline: 'none' }}
                >
                  {availableCategories.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
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
