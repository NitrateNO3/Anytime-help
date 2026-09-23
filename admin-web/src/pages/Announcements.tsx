import { useState, useEffect } from 'react';
import { Pagination } from '../components/Pagination';
import axios from 'axios';
import { Bell, Plus, Trash2, Edit2, Search, Filter, RotateCcw, X, Megaphone } from 'lucide-react';
import toast from 'react-hot-toast';
import { ExportButtons } from '../components/ExportButtons';
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

  const adminUserStr = localStorage.getItem('adminUser');
  const adminUser = adminUserStr ? JSON.parse(adminUserStr) : null;
  const isSubAdmin = adminUser?.role === 'SubAdmin';

  // Filter States
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 350);
    return () => clearTimeout(timer);
  }, [search]);

  // Form State
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [selectedPhases, setSelectedPhases] = useState<string[]>(['All']);
  const [editingAnnouncement, setEditingAnnouncement] = useState<any>(null);

  const availablePhases = ['Resident', 'Members'];

  useEffect(() => {
    if (activeTab === 'list') {
      fetchAnnouncements(page, filterPhase);
    }
    const socket = io(SOCKET_URL, { transports: ['websocket', 'polling'] });
    socket.on('announcement_changed', () => {
      if (activeTab === 'list') fetchAnnouncements(page, filterPhase, debouncedSearch, dateFrom, dateTo, false);
    });

    return () => {
      socket.disconnect();
    };
  }, [activeTab, page, filterPhase, debouncedSearch, dateFrom, dateTo]);

  useEffect(() => {
    if (activeTab === 'list') {
      fetchAnnouncements(page, filterPhase, debouncedSearch, dateFrom, dateTo);
    }
  }, [activeTab, page, filterPhase, debouncedSearch, dateFrom, dateTo]);

  const fetchAnnouncements = async (
    currentPage = page, 
    phase = filterPhase,
    searchFilter = debouncedSearch,
    from = dateFrom,
    to = dateTo,
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
      if (from) params.append('dateFrom', from);
      if (to) params.append('dateTo', to);

      const res = await axios.get(`${API_URL}/announcements?${params.toString()}`, {
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

  const fetchAllData = async () => {
    const token = localStorage.getItem('adminToken');
    const params = new URLSearchParams({ phase: filterPhase });
    if (debouncedSearch.trim()) params.append('search', debouncedSearch.trim());
    if (dateFrom) params.append('dateFrom', dateFrom);
    if (dateTo) params.append('dateTo', dateTo);

    const res = await axios.get(`${API_URL}/announcements?${params.toString()}`, {
      headers: { 'x-auth-token': token }
    });
    return Array.isArray(res.data) ? res.data : (res.data.announcements || []);
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
                fetchAnnouncements(page, filterPhase, debouncedSearch, dateFrom, dateTo, false);
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

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const loadingToast = toast.loading('Updating announcement...');

    try {
      const token = localStorage.getItem('adminToken');
      await axios.put(`${API_URL}/announcements/${editingAnnouncement._id}`, {
        title: editingAnnouncement.title,
        message: editingAnnouncement.message
      }, {
        headers: { 'x-auth-token': token }
      });
      
      toast.success('Announcement updated successfully!', { id: loadingToast });
      setEditingAnnouncement(null);
      fetchAnnouncements(page, filterPhase, debouncedSearch, dateFrom, dateTo, false);
    } catch (err: any) {
      toast.error(err.response?.data?.message || err.response?.data?.msg || 'Failed to update', { id: loadingToast });
    }
  };

  const isFiltered = search !== '' || dateFrom !== '' || dateTo !== '' || filterPhase !== 'All Groups (Show Everything)';

  const resetFilters = () => {
    setSearch('');
    setDebouncedSearch('');
    setDateFrom('');
    setDateTo('');
    setFilterPhase('All Groups (Show Everything)');
    setPage(1);
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
        {!isSubAdmin && (
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
        )}
      </div>

      {/* Content Area */}
      {activeTab === 'list' ? (
        <div className="glass table-container">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <h2 className="card-title">Recent Announcements</h2>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <ExportButtons 
                data={announcements}
                fetchAllData={fetchAllData}
                columns={[
                  { header: 'Title', key: 'title' },
                  { header: 'Message', key: 'message' },
                  { header: 'Target Phase', key: 'targetPhase' },
                  { header: 'Is Global', key: (r: any) => r.isGlobal ? 'Yes' : 'No' },
                  { header: 'Created At', key: (r: any) => new Date(r.createdAt).toLocaleString() }
                ]}
                filename="Announcements"
              />
              <div style={{ background: 'var(--bg-light)', padding: '6px 12px', borderRadius: 20, fontSize: 13, fontWeight: 600, color: 'var(--text-main)' }}>
                Total: {totalCount}
              </div>
            </div>
          </div>

          {/* Filter Toolbar */}
          <div style={{ marginBottom: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Filter size={20} color="var(--primary)" />
                <h3 style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-main)' }}>Filter Announcements</h3>
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
                placeholder="Search by title, message, or creator..."
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
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6 }}>Target Phase</label>
                <select 
                  value={filterPhase} 
                  onChange={(e) => { setFilterPhase(e.target.value); setPage(1); }}
                  style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid var(--border-color)', background: '#FFFFFF', fontSize: 13, color: 'var(--text-main)', fontWeight: 500, outline: 'none' }}
                >
                  <option value="All Groups (Show Everything)">All Groups (Show Everything)</option>
                  <option value="Universal (Sent to Everyone)">Universal (Sent to Everyone)</option>
                  <option value="Resident">Resident</option>
                  <option value="Members">Members</option>
                </select>
              </div>
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
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Title</th>
                <th>Message</th>
                {!isSubAdmin && <th style={{ width: 100 }}>Actions</th>}
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
                      {!isSubAdmin && (
                        <td style={{ textAlign: 'center' }}>
                          <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                            <button 
                              onClick={() => {
                                setEditingAnnouncement(announcement);
                              }}
                              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 8, borderRadius: 8 }}
                              onMouseOver={(e) => e.currentTarget.style.background = 'rgba(59, 130, 246, 0.1)'}
                              onMouseOut={(e) => e.currentTarget.style.background = 'none'}
                              title="Edit"
                            >
                              <Edit2 size={18} color="var(--primary)" />
                            </button>
                            <button 
                              onClick={() => handleDelete(announcement._id)}
                              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 8, borderRadius: 8 }}
                              onMouseOver={(e) => e.currentTarget.style.background = 'rgba(239, 68, 68, 0.1)'}
                              onMouseOut={(e) => e.currentTarget.style.background = 'none'}
                              title="Delete"
                            >
                              <Trash2 size={20} color="var(--danger)" />
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  ))
                )}
              </tbody>
          </table>

          <Pagination page={page} totalPages={totalPages} setPage={setPage} />
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
      {/* Edit Modal */}
      {editingAnnouncement && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div className="card" style={{ width: '100%', maxWidth: 600, margin: 20 }}>
            <h2 className="card-title" style={{ marginBottom: 20 }}>Edit Announcement</h2>
            <form onSubmit={handleEditSubmit}>
              <div className="input-group">
                <label>Title</label>
                <input 
                  type="text" 
                  value={editingAnnouncement.title} 
                  onChange={(e) => setEditingAnnouncement({...editingAnnouncement, title: e.target.value})} 
                  required
                />
              </div>
              
              <div className="input-group">
                <label>Message</label>
                <textarea 
                  value={editingAnnouncement.message} 
                  onChange={(e) => setEditingAnnouncement({...editingAnnouncement, message: e.target.value})} 
                  required
                  style={{ 
                    width: '100%', 
                    padding: '14px 16px', 
                    background: 'white', 
                    border: '1px solid var(--border-color)', 
                    borderRadius: '12px', 
                    minHeight: '120px', 
                    resize: 'vertical',
                    fontFamily: 'inherit',
                    fontSize: '15px'
                  }}
                />
              </div>
              
              <div style={{ display: 'flex', gap: 12, marginTop: 32 }}>
                <button type="button" onClick={() => setEditingAnnouncement(null)} style={{ flex: 1, padding: '12px', background: 'white', border: '1px solid var(--border-color)', borderRadius: 8, fontWeight: 600, cursor: 'pointer' }}>
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
