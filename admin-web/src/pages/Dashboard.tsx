import { useState, useEffect } from 'react';
import axios from 'axios';
import { Activity, CheckCircle, Clock, Trash2, Search, Filter, RotateCcw, X, AlertCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import { io } from 'socket.io-client';
import { ExportButtons } from '../components/ExportButtons';

const API_URL = 'https://anytime-help.onrender.com/api';
const SOCKET_URL = 'https://anytime-help.onrender.com';

const defaultCategoriesList = [
  'Electricity',
  'Water',
  'Sanitation',
  'Road / Infrastructure',
  'Tree trimming',
  'Security',
  'Plumbing',
  'Civil Maintenance',
  'Parks & Greenery',
  'Street Lights'
];

export default function Dashboard() {
  const [complaints, setComplaints] = useState<any[]>([]);
  const [stats, setStats] = useState({ pending: 0, inProgress: 0, resolved: 0 });
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  // Filter States
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [phaseFilter, setPhaseFilter] = useState('ALL');
  const [sortOrder, setSortOrder] = useState('desc');
  const [availableCategories, setAvailableCategories] = useState<string[]>(defaultCategoriesList);

  // Debounce search query
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 350);
    return () => clearTimeout(timer);
  }, [search]);

  // Fetch categories for filter dropdown
  useEffect(() => {
    axios.get(`${API_URL}/categories`)
      .then(res => {
        if (res.data && Array.isArray(res.data) && res.data.length > 0) {
          const titles = res.data.map((c: any) => c.title).filter(Boolean);
          // Combine unique categories
          const combined = Array.from(new Set([...titles, ...defaultCategoriesList]));
          setAvailableCategories(combined);
        }
      })
      .catch(err => {
        console.error('Failed to load categories', err);
      });
  }, []);

  // Fetch complaints whenever filters or page change
  useEffect(() => {
    fetchComplaints(page, true);
  }, [page, debouncedSearch, statusFilter, categoryFilter, phaseFilter, sortOrder]);

  // Live Socket.io updates
  useEffect(() => {
    const socket = io(SOCKET_URL, { transports: ['websocket', 'polling'] });
    socket.on('complaint_changed', () => {
      fetchComplaints(page, false);
    });

    return () => {
      socket.disconnect();
    };
  }, [page, debouncedSearch, statusFilter, categoryFilter, phaseFilter, sortOrder]);

  const fetchComplaints = async (currentPage: number, showLoading: boolean = true) => {
    if (showLoading) setLoading(true);
    try {
      const token = localStorage.getItem('adminToken');
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: '10',
        sortOrder: sortOrder
      });

      if (debouncedSearch.trim()) params.append('search', debouncedSearch.trim());
      if (statusFilter !== 'ALL') params.append('status', statusFilter);
      if (categoryFilter !== 'ALL') params.append('category', categoryFilter);
      if (phaseFilter !== 'ALL') params.append('phase', phaseFilter);

      const res = await axios.get(`${API_URL}/complaints?${params.toString()}`, {
        headers: { 'x-auth-token': token }
      });

      setComplaints(res.data.complaints || []);
      if (res.data.stats) {
        setStats(res.data.stats);
      }
      setTotalCount(res.data.total || 0);
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
                setTotalCount(prev => Math.max(0, prev - 1));
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
      fetchComplaints(page, false);
    } catch (err) {
      console.error(err);
      toast.error('Failed to update status.', { id: loadingToast });
    }
  };

  const resetAllFilters = () => {
    setSearch('');
    setDebouncedSearch('');
    setStatusFilter('ALL');
    setCategoryFilter('ALL');
    setPhaseFilter('ALL');
    setSortOrder('desc');
    setPage(1);
  };

  const isFiltered = search !== '' || statusFilter !== 'ALL' || categoryFilter !== 'ALL' || phaseFilter !== 'ALL' || sortOrder !== 'desc';

  return (
    <div>
      <header className="page-header">
        <div>
          <h1 className="page-title">Platform Overview</h1>
          <p style={{ color: 'var(--text-muted)', marginTop: 8 }}>Real-time statistics, active complaints, and management filters.</p>
        </div>
      </header>

      {/* KPI Widgets (Display only) */}
      <div className="stats-grid">
        <div className="glass stat-card">
          <div className="stat-info">
            <h3>Pending</h3>
            <p>{stats.pending}</p>
          </div>
          <div className="stat-icon" style={{ background: 'rgba(245, 158, 11, 0.1)' }}>
            <Clock color="var(--warning)" size={24} />
          </div>
        </div>
        
        <div className="glass stat-card">
          <div className="stat-info">
            <h3>In Progress</h3>
            <p>{stats.inProgress}</p>
          </div>
          <div className="stat-icon" style={{ background: 'rgba(79, 70, 229, 0.1)' }}>
            <Activity color="#818cf8" size={24} />
          </div>
        </div>

        <div className="glass stat-card">
          <div className="stat-info">
            <h3>Resolved</h3>
            <p>{stats.resolved}</p>
          </div>
          <div className="stat-icon" style={{ background: 'rgba(16, 185, 129, 0.1)' }}>
            <CheckCircle color="var(--success)" size={24} />
          </div>
        </div>
      </div>

      {/* Filter Toolbar Section */}
      <div className="glass" style={{ padding: '20px 24px', marginBottom: '24px', borderRadius: '16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Filter size={20} color="var(--primary)" />
            <h2 style={{ fontSize: 17, fontWeight: 700, color: 'var(--text-main)' }}>Filter Complaints</h2>
            {isFiltered && (
              <span style={{ fontSize: 12, background: 'rgba(29, 78, 216, 0.1)', color: 'var(--primary)', padding: '2px 8px', borderRadius: 12, fontWeight: 600 }}>
                Filters Applied
              </span>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: 13, color: 'var(--text-muted)', fontWeight: 500 }}>
              Showing {complaints.length} of {totalCount} complaints
            </span>
            {isFiltered && (
              <button
                onClick={resetAllFilters}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '6px 12px',
                  borderRadius: 8,
                  border: '1px solid var(--border-color)',
                  background: '#FFFFFF',
                  color: 'var(--danger)',
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'all 0.2s ease'
                }}
                onMouseOver={(e) => e.currentTarget.style.background = 'rgba(239, 68, 68, 0.05)'}
                onMouseOut={(e) => e.currentTarget.style.background = '#FFFFFF'}
              >
                <RotateCcw size={14} />
                Reset Filters
              </button>
            )}
          </div>
        </div>

        {/* Search Input Bar */}
        <div style={{ position: 'relative', marginBottom: 16 }}>
          <Search size={18} color="var(--text-muted)" style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)' }} />
          <input
            type="text"
            placeholder="Search by title, description, location, address, or resident name/phone..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{
              width: '100%',
              padding: '11px 40px 11px 42px',
              borderRadius: 10,
              border: '1px solid var(--border-color)',
              background: '#F8FAFC',
              fontSize: 14,
              color: 'var(--text-main)',
              outline: 'none',
              boxSizing: 'border-box'
            }}
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              style={{
                position: 'absolute',
                right: 12,
                top: '50%',
                transform: 'translateY(-50%)',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: 'var(--text-muted)'
              }}
            >
              <X size={16} />
            </button>
          )}
        </div>

        {/* Filter Dropdowns Grid */}
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', 
          gap: 12 
        }}>
          {/* Status Filter */}
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6 }}>
              Status
            </label>
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
              style={{
                width: '100%',
                padding: '9px 12px',
                borderRadius: 8,
                border: '1px solid var(--border-color)',
                background: '#FFFFFF',
                fontSize: 13,
                color: 'var(--text-main)',
                fontWeight: 500,
                outline: 'none',
                cursor: 'pointer'
              }}
            >
              <option value="ALL">All Statuses</option>
              <option value="PENDING">Pending</option>
              <option value="IN_PROGRESS">In Progress</option>
              <option value="DONE">Resolved</option>
            </select>
          </div>

          {/* Category Filter */}
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6 }}>
              Category
            </label>
            <select
              value={categoryFilter}
              onChange={(e) => {
                setCategoryFilter(e.target.value);
                setPage(1);
              }}
              style={{
                width: '100%',
                padding: '9px 12px',
                borderRadius: 8,
                border: '1px solid var(--border-color)',
                background: '#FFFFFF',
                fontSize: 13,
                color: 'var(--text-main)',
                fontWeight: 500,
                outline: 'none',
                cursor: 'pointer'
              }}
            >
              <option value="ALL">All Categories</option>
              {availableCategories.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>

          {/* Phase / Area Filter */}
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6 }}>
              Phase / Area
            </label>
            <select
              value={phaseFilter}
              onChange={(e) => {
                setPhaseFilter(e.target.value);
                setPage(1);
              }}
              style={{
                width: '100%',
                padding: '9px 12px',
                borderRadius: 8,
                border: '1px solid var(--border-color)',
                background: '#FFFFFF',
                fontSize: 13,
                color: 'var(--text-main)',
                fontWeight: 500,
                outline: 'none',
                cursor: 'pointer'
              }}
            >
              <option value="ALL">All Areas / Phases</option>
              <option value="Sushant Lok 2 - C,D,E">Sushant Lok 2 - C,D,E</option>
              <option value="Sushant Lok 2 - F,G">Sushant Lok 2 - F,G</option>
              <option value="Sushant Lok 3">Sushant Lok 3</option>
            </select>
          </div>

          {/* Sort Order Filter */}
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6 }}>
              Sort by Date
            </label>
            <select
              value={sortOrder}
              onChange={(e) => {
                setSortOrder(e.target.value);
                setPage(1);
              }}
              style={{
                width: '100%',
                padding: '9px 12px',
                borderRadius: 8,
                border: '1px solid var(--border-color)',
                background: '#FFFFFF',
                fontSize: 13,
                color: 'var(--text-main)',
                fontWeight: 500,
                outline: 'none',
                cursor: 'pointer'
              }}
            >
              <option value="desc">Newest First</option>
              <option value="asc">Oldest First</option>
            </select>
          </div>
        </div>
      </div>

      {/* Data Table */}
      <div className="glass table-container">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h2 style={{ fontSize: 18, fontWeight: 600 }}>Complaints List</h2>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <ExportButtons 
              data={complaints}
              columns={[
                { header: 'Title', key: 'title' },
                { header: 'Category', key: (c: any) => c.category?.name || 'N/A' },
                { header: 'Phase', key: (c: any) => c.phase || 'N/A' },
                { header: 'Location', key: (c: any) => c.location || 'N/A' },
                { header: 'Resident', key: (c: any) => c.createdBy?.name || 'N/A' },
                { header: 'Phone', key: (c: any) => c.createdBy?.phoneNumber || 'N/A' },
                { header: 'Status', key: 'status' },
                { header: 'Created At', key: (c: any) => new Date(c.createdAt).toLocaleString() }
              ]}
              filename="Complaints_Export"
            />
            <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>
              Page {page} of {totalPages} ({totalCount} total)
            </span>
          </div>
        </div>
        
        <div className="table-card">
          <div style={{ overflowX: 'auto', width: '100%' }}>
            <table style={{ width: '100%', minWidth: 1100, tableLayout: 'fixed' }}>
              <thead>
                <tr>
                  <th style={{ width: '23%' }}>Title & Desc</th>
                  <th style={{ width: '13%' }}>Category</th>
                  <th style={{ width: '15%' }}>Location / Phase</th>
                  <th style={{ width: '15%' }}>Address</th>
                  <th style={{ width: '13%' }}>Resident</th>
                  <th style={{ width: '10%', minWidth: 105, whiteSpace: 'nowrap' }}>Status</th>
                  <th style={{ width: '11%', minWidth: 140, whiteSpace: 'nowrap' }}>Actions</th>
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
                      <td><div className="skeleton skeleton-row" style={{ width: '80%' }}></div></td>
                      <td><div className="skeleton skeleton-row" style={{ width: 70, borderRadius: 12 }}></div></td>
                      <td><div className="skeleton skeleton-row" style={{ width: 80 }}></div></td>
                    </tr>
                  ))
                ) : complaints.length === 0 ? (
                  <tr>
                    <td colSpan={7} style={{ textAlign: 'center', padding: '48px 16px', color: 'var(--text-muted)' }}>
                      <AlertCircle size={36} color="var(--text-muted)" style={{ margin: '0 auto 12px', display: 'block', opacity: 0.6 }} />
                      <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-main)', marginBottom: 6 }}>
                        No complaints found
                      </div>
                      <div style={{ fontSize: 13 }}>
                        {isFiltered ? 'Try clearing or changing your filters to see more results.' : 'No complaints have been submitted yet.'}
                      </div>
                      {isFiltered && (
                        <button
                          onClick={resetAllFilters}
                          style={{
                            marginTop: 14,
                            padding: '6px 16px',
                            borderRadius: 8,
                            border: '1px solid var(--border-color)',
                            background: '#FFFFFF',
                            color: 'var(--primary)',
                            fontSize: 13,
                            fontWeight: 600,
                            cursor: 'pointer'
                          }}
                        >
                          Clear All Filters
                        </button>
                      )}
                    </td>
                  </tr>
                ) : (
                  complaints.map(item => (
                    <tr key={item._id}>
                      <td style={{ maxWidth: 280 }}>
                        <div style={{ fontWeight: 600, color: 'var(--text-main)', marginBottom: 4 }}>{item.title}</div>
                        <div style={{ color: 'var(--text-muted)', fontSize: 12, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginBottom: 4 }}>
                          {item.description}
                        </div>
                        {item.created_at && (
                          <div style={{ fontSize: 11, color: '#94A3B8' }}>
                            {new Date(item.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                          </div>
                        )}
                      </td>
                      <td>
                        <span style={{ 
                          fontSize: 12, 
                          fontWeight: 500, 
                          background: '#F1F5F9', 
                          color: '#334155', 
                          padding: '4px 8px', 
                          borderRadius: 6,
                          display: 'inline-block'
                        }}>
                          {item.category}
                        </span>
                      </td>
                      <td>
                        <div style={{ fontWeight: 500, color: 'var(--text-main)', fontSize: 13 }}>{item.location}</div>
                        {item.phase && (
                          <div style={{ fontSize: 11, color: 'var(--primary)', marginTop: 2, fontWeight: 500 }}>
                            {item.phase}
                          </div>
                        )}
                      </td>
                      <td>
                        <div style={{ color: item.address ? 'var(--text-main)' : 'var(--text-muted)', fontSize: 13 }}>
                          {item.address || '-'}
                        </div>
                      </td>
                      <td>
                        <div style={{ fontWeight: 500, color: 'var(--text-main)', fontSize: 13 }}>
                          {item.user?.name || 'Unknown'}
                        </div>
                        {item.user?.phone && (
                          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                            {item.user.phone}
                          </div>
                        )}
                      </td>
                      <td style={{ whiteSpace: 'nowrap' }}>
                        <span className={`badge ${
                          item.status === 'PENDING' ? 'pending' : 
                          item.status === 'IN_PROGRESS' ? 'progress' : 'resolved'
                        }`}>
                          {item.status.replace('_', ' ')}
                        </span>
                      </td>
                      <td style={{ whiteSpace: 'nowrap' }}>
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                          <select 
                            value={item.status}
                            onChange={(e) => updateStatus(item._id, e.target.value)}
                            style={{ 
                              background: '#F8FAFC', 
                              color: 'var(--text-main)', 
                              border: '1px solid var(--border-color)', 
                              padding: '5px 8px', 
                              borderRadius: '6px',
                              outline: 'none',
                              cursor: 'pointer',
                              fontSize: '12px',
                              fontWeight: '500',
                              minWidth: '95px'
                            }}
                          >
                            <option value="PENDING">Pending</option>
                            <option value="IN_PROGRESS">In Progress</option>
                            <option value="DONE">Resolved</option>
                          </select>
                          <button 
                            onClick={() => deleteComplaint(item._id)}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 6, borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                            onMouseOver={(e) => e.currentTarget.style.background = 'rgba(239, 68, 68, 0.1)'}
                            onMouseOut={(e) => e.currentTarget.style.background = 'none'}
                            title="Delete Complaint"
                          >
                            <Trash2 size={16} color="var(--danger)" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          
          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 20, padding: '0 10px' }}>
              <span style={{ fontSize: 14, color: 'var(--text-muted)' }}>
                Showing page {page} of {totalPages}
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
    </div>
  );
}
