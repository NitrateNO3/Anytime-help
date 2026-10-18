import { useState, useEffect } from 'react';
import axios from 'axios';
import { Activity, CheckCircle, Clock, Trash2, Search, Filter, RotateCcw, X, AlertCircle, Hash } from 'lucide-react';
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
  const [idFilter, setIdFilter] = useState('');
  const [debouncedIdFilter, setDebouncedIdFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [phaseFilter, setPhaseFilter] = useState('ALL');
  const [sortOrder, setSortOrder] = useState('desc');
  const [availableCategories, setAvailableCategories] = useState<string[]>(defaultCategoriesList);

  // View/Reply Modal States
  const [selectedComplaint, setSelectedComplaint] = useState<any>(null);
  const [replyText, setReplyText] = useState('');
  const [isReplying, setIsReplying] = useState(false);
  const [isFetchingDetails, setIsFetchingDetails] = useState(false);

  const adminUserStr = localStorage.getItem('adminUser');
  const adminUser = adminUserStr ? JSON.parse(adminUserStr) : null;
  const isSubAdmin = adminUser?.role === 'SubAdmin';

  // Debounce search query
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 350);
    return () => clearTimeout(timer);
  }, [search]);

  // Debounce complaint ID filter query
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedIdFilter(idFilter);
      setPage(1);
    }, 350);
    return () => clearTimeout(timer);
  }, [idFilter]);

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
  }, [page, debouncedSearch, debouncedIdFilter, statusFilter, categoryFilter, phaseFilter, sortOrder]);

  // Live Socket.io updates
  useEffect(() => {
    const socket = io(SOCKET_URL, { transports: ['websocket', 'polling'] });
    socket.on('complaint_changed', () => {
      fetchComplaints(page, false);
    });

    return () => {
      socket.disconnect();
    };
  }, [page, debouncedSearch, debouncedIdFilter, statusFilter, categoryFilter, phaseFilter, sortOrder]);

  // Stack-wise sorting: Active Escalated first -> Pending -> In Progress -> Done/Resolved (escalated done at bottom) -> Newest Date
  const sortComplaints = (list: any[], order: string = sortOrder) => {
    return [...list].sort((a, b) => {
      // Only active escalated complaints (NOT DONE / NOT RESOLVED) show first
      const isAActiveEscalated = a.is_escalated && a.status !== 'DONE' && a.status !== 'RESOLVED';
      const isBActiveEscalated = b.is_escalated && b.status !== 'DONE' && b.status !== 'RESOLVED';
      if (isAActiveEscalated && !isBActiveEscalated) return -1;
      if (!isAActiveEscalated && isBActiveEscalated) return 1;

      // Status stack priority: PENDING = 1, IN_PROGRESS = 2, RESOLVED/DONE = 3
      const statusOrder: Record<string, number> = {
        'PENDING': 1,
        'IN_PROGRESS': 2,
        'RESOLVED': 3,
        'DONE': 3
      };
      const orderA = statusOrder[a.status] || 4;
      const orderB = statusOrder[b.status] || 4;
      if (orderA !== orderB) {
        return orderA - orderB;
      }

      // Within the same status stack, sort by creation date
      const timeA = new Date(a.created_at || 0).getTime();
      const timeB = new Date(b.created_at || 0).getTime();
      return order === 'asc' ? timeA - timeB : timeB - timeA;
    });
  };

  // Helper to extract clean staff personal name from "Name (Location...)"
  const getCleanStaffName = (rawName?: string) => {
    if (!rawName) return '';
    const trimmed = rawName.trim();
    if (trimmed.toLowerCase() === 'staff') return '';
    // Extract part before parentheses: "Sanju (Sushant Lok 3...)" -> "Sanju"
    const match = trimmed.match(/^(.*?)\s*\(/);
    if (match && match[1].trim()) {
      return match[1].trim();
    }
    return trimmed;
  };

  const fetchComplaints = async (currentPage: number, showLoading: boolean = true) => {
    const cacheKey = `dashboard_cache_${currentPage}_${debouncedSearch}_${debouncedIdFilter}_${statusFilter}_${categoryFilter}_${phaseFilter}_${sortOrder}`;
    const cachedStr = sessionStorage.getItem(cacheKey);
    
    if (cachedStr) {
      try {
        const cached = JSON.parse(cachedStr);
        setComplaints(sortComplaints(cached.complaints || []));
        if (cached.stats) setStats(cached.stats);
        setTotalCount(cached.total || 0);
        setTotalPages(Math.ceil((cached.total || 0) / 10) || 1);
        showLoading = false;
        setLoading(false); // Hide initial spinner since we have cache
      } catch(e) {}
    }

    if (showLoading) setLoading(true);
    
    try {
      const token = localStorage.getItem('adminToken');
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: '10',
        sortOrder: sortOrder
      });

      if (debouncedSearch.trim()) params.append('search', debouncedSearch.trim());
      if (debouncedIdFilter.trim()) params.append('complaint_id', debouncedIdFilter.trim().replace(/^#/, ''));
      if (statusFilter !== 'ALL') params.append('status', statusFilter);
      if (categoryFilter !== 'ALL') params.append('category', categoryFilter);
      if (phaseFilter !== 'ALL') params.append('phase', phaseFilter);

      const res = await axios.get(`${API_URL}/complaints?${params.toString()}`, {
        headers: { 'x-auth-token': token }
      });

      const sortedData = sortComplaints(res.data.complaints || []);
      const cacheData = { ...res.data, complaints: sortedData };
      sessionStorage.setItem(cacheKey, JSON.stringify(cacheData)); // Cache for next time

      setComplaints(sortedData);
      if (res.data.stats) {
        setStats(res.data.stats);
      }
      setTotalCount(res.data.total || 0);
      setTotalPages(Math.ceil((res.data.total || 0) / 10) || 1);
    } catch (err) {
      console.error(err);
      if (!cachedStr) toast.error('Failed to fetch complaints');
    } finally {
      setLoading(false); // Always turn off loading when done
    }
  };

  const handleReply = async () => {
    if (!replyText.trim() || !selectedComplaint) return;
    const loadingId = toast.loading('Sending reply...');
    setIsReplying(true);
    try {
      const token = localStorage.getItem('adminToken');
      const res = await axios.post(`${API_URL}/complaints/${selectedComplaint._id}/reply`, {
        text: replyText.trim()
      }, {
        headers: { 'x-auth-token': token }
      });
      toast.success('Reply sent!', { id: loadingId });
      setReplyText('');
      setSelectedComplaint(res.data);
      
      // Update in the list as well
      setComplaints(prev => prev.map(c => c._id === res.data._id ? res.data : c));
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to send reply', { id: loadingId });
    } finally {
      setIsReplying(false);
    }
  };

  const fetchAllData = async () => {
    const token = localStorage.getItem('adminToken');
    const params = new URLSearchParams();
    if (debouncedSearch.trim()) params.append('search', debouncedSearch.trim());
    if (debouncedIdFilter.trim()) params.append('complaint_id', debouncedIdFilter.trim().replace(/^#/, ''));
    if (statusFilter !== 'ALL') params.append('status', statusFilter);
    if (categoryFilter !== 'ALL') params.append('category', categoryFilter);
    if (phaseFilter !== 'ALL') params.append('phase', phaseFilter);
    if (sortOrder) params.append('sortOrder', sortOrder);
    params.append('all', 'true');
    
    const res = await axios.get(`${API_URL}/complaints?${params.toString()}`, {
      headers: { 'x-auth-token': token }
    });
    const rawData = Array.isArray(res.data) ? res.data : (res.data.complaints || []);
    return sortComplaints(rawData);
  };

  const openComplaintDetails = async (item: any) => {
    // Open optimistically with what we have
    setSelectedComplaint(item);
    setIsFetchingDetails(true);
    try {
      const token = localStorage.getItem('adminToken');
      const res = await axios.get(`${API_URL}/complaints/${item._id}`, {
        headers: { 'x-auth-token': token }
      });
      setSelectedComplaint(res.data);
    } catch (err) {
      console.error('Failed to load full complaint details', err);
    } finally {
      setIsFetchingDetails(false);
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

  const deleteReply = async (complaintId: string, replyId: string) => {
    toast((t) => (
      <div>
        <p style={{ fontWeight: 600, marginBottom: 12, color: 'var(--text-main)' }}>Delete this reply?</p>
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
              const loadingToast = toast.loading('Deleting reply...');
              try {
                const token = localStorage.getItem('adminToken');
                const res = await axios.delete(`${API_URL}/complaints/${complaintId}/reply/${replyId}`, {
                  headers: { 'x-auth-token': token }
                });
                toast.success('Reply deleted', { id: loadingToast });
                setSelectedComplaint(res.data);
                setComplaints(prev => prev.map(c => c._id === complaintId ? res.data : c));
              } catch (err) {
                console.error(err);
                toast.error('Failed to delete reply', { id: loadingToast });
              }
            }} 
            style={{ padding: '6px 16px', borderRadius: 8, border: 'none', background: 'var(--danger)', color: 'white', cursor: 'pointer', fontWeight: 600 }}
          >
            Delete
          </button>
        </div>
      </div>
    ), { duration: Infinity, style: { minWidth: '250px' } });
  };

  const updateStatus = async (id: string, newStatus: string) => {
    const loadingToast = toast.loading('Updating status...');
    try {
      const token = localStorage.getItem('adminToken');
      await axios.patch(`${API_URL}/complaints/${id}`, { status: newStatus }, {
        headers: { 'x-auth-token': token }
      });
      toast.success('Status updated successfully', { id: loadingToast });
      setComplaints(prev => {
        const updated = prev.map(c => c._id === id ? { ...c, status: newStatus } : c);
        return sortComplaints(updated);
      });
      // Invalidate dashboard session cache so future tab/page switches show the updated stack
      try {
        Object.keys(sessionStorage).forEach(key => {
          if (key.startsWith('dashboard_cache_')) sessionStorage.removeItem(key);
        });
      } catch (e) {}
      fetchComplaints(page, false);
    } catch (err) {
      console.error(err);
      toast.error('Failed to update status.', { id: loadingToast });
    }
  };

  const resetAllFilters = () => {
    setSearch('');
    setDebouncedSearch('');
    setIdFilter('');
    setDebouncedIdFilter('');
    setStatusFilter('ALL');
    setCategoryFilter('ALL');
    setPhaseFilter('ALL');
    setSortOrder('desc');
    setPage(1);
  };

  const isFiltered = search !== '' || idFilter !== '' || statusFilter !== 'ALL' || categoryFilter !== 'ALL' || phaseFilter !== 'ALL' || sortOrder !== 'desc';

  return (
    <div>
      <header className="page-header">
        <div>
          <h1 className="page-title">Platform Overview</h1>
          <p style={{ color: 'var(--text-muted)', marginTop: 8 }}>Real-time statistics, active complaints, and management filters.</p>
        </div>
      </header>

      {/* KPI Widgets (Display only - Now Clickable) */}
      <div className="stats-grid">
        <div 
          className="glass stat-card" 
          onClick={() => { setStatusFilter(statusFilter === 'PENDING' ? 'ALL' : 'PENDING'); setPage(1); }}
          style={{ cursor: 'pointer', border: statusFilter === 'PENDING' ? '2px solid var(--warning)' : undefined }}
        >
          <div className="stat-info">
            <h3>Pending</h3>
            <p>{stats.pending}</p>
          </div>
          <div className="stat-icon" style={{ background: 'rgba(245, 158, 11, 0.1)' }}>
            <Clock color="var(--warning)" size={24} />
          </div>
        </div>
        
        <div 
          className="glass stat-card"
          onClick={() => { setStatusFilter(statusFilter === 'IN_PROGRESS' ? 'ALL' : 'IN_PROGRESS'); setPage(1); }}
          style={{ cursor: 'pointer', border: statusFilter === 'IN_PROGRESS' ? '2px solid #818cf8' : undefined }}
        >
          <div className="stat-info">
            <h3>In Progress</h3>
            <p>{stats.inProgress}</p>
          </div>
          <div className="stat-icon" style={{ background: 'rgba(79, 70, 229, 0.1)' }}>
            <Activity color="#818cf8" size={24} />
          </div>
        </div>

        <div 
          className="glass stat-card"
          onClick={() => { setStatusFilter(statusFilter === 'DONE' ? 'ALL' : 'DONE'); setPage(1); }}
          style={{ cursor: 'pointer', border: statusFilter === 'DONE' ? '2px solid var(--success)' : undefined }}
        >
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
            placeholder="Search by Complaint ID (e.g. AH-1374), title, resident, address..."
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
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', 
          gap: 12 
        }}>
          {/* Complaint ID Filter */}
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6 }}>
              Complaint ID
            </label>
            <div style={{ position: 'relative' }}>
              <Hash size={15} color={idFilter ? 'var(--primary)' : 'var(--text-muted)'} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)' }} />
              <input
                type="text"
                placeholder="e.g. AH-1042 or 1042"
                value={idFilter}
                onChange={(e) => setIdFilter(e.target.value)}
                style={{
                  width: '100%',
                  padding: '9px 28px 9px 30px',
                  borderRadius: 8,
                  border: idFilter ? '1px solid var(--primary)' : '1px solid var(--border-color)',
                  background: idFilter ? '#EEF2FF' : '#FFFFFF',
                  fontSize: 13,
                  color: 'var(--text-main)',
                  fontWeight: 500,
                  outline: 'none',
                  boxSizing: 'border-box'
                }}
              />
              {idFilter && (
                <button
                  onClick={() => setIdFilter('')}
                  title="Clear ID filter"
                  style={{
                    position: 'absolute',
                    right: 8,
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    color: 'var(--text-muted)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: 2
                  }}
                >
                  <X size={14} />
                </button>
              )}
            </div>
          </div>

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
              <option value="Sushant Lok 2">Sushant Lok 2</option>
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
              fetchAllData={fetchAllData}
              hidePdf={true}
              columns={[
                { header: 'Complaint ID', key: (c: any) => c.complaint_id || `AH-${c._id.slice(-5).toUpperCase()}` },
                { header: 'Title', key: 'title' },
                { header: 'Description', key: 'description' },
                { header: 'Category', key: (c: any) => c.category?.name || c.category || 'N/A' },
                { header: 'Phase', key: (c: any) => c.phase || 'N/A' },
                { header: 'Location', key: (c: any) => c.location || 'N/A' },
                { header: 'Complaint Address', key: (c: any) => c.address || 'N/A' },
                { header: 'Resident Name', key: (c: any) => c.user?.name || c.createdBy?.name || 'N/A' },
                { header: 'Resident Address', key: (c: any) => c.user?.address || 'N/A' },
                { header: 'Resident Phone', key: (c: any) => c.user?.phone_number || c.user?.phone || c.createdBy?.phoneNumber || 'N/A' },
                { header: 'Status', key: 'status' },
                { 
                  header: 'Done By Staff', 
                  key: (c: any) => (c.status === 'DONE' || c.status === 'RESOLVED') 
                    ? (c.resolved_by?.name || c.resolved_by_name || c.assigned_staff?.name || 'Staff') 
                    : (c.assigned_staff?.name ? `Assigned: ${c.assigned_staff.name}` : '-') 
                },
                { header: 'Priority', key: 'priority' },
                { header: 'Created At', key: (c: any) => new Date(c.created_at || c.createdAt).toLocaleString() }
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
            <table style={{ width: '100%', minWidth: 1280, tableLayout: 'fixed' }}>
              <thead>
                <tr>
                  <th style={{ width: '9%', minWidth: 90 }}>Complaint ID</th>
                  <th style={{ width: '15%' }}>Title & Desc</th>
                  <th style={{ width: '10%' }}>Category</th>
                  <th style={{ width: '13%' }}>Location / Phase</th>
                  <th style={{ width: '13%' }}>Complaint Address</th>
                  <th style={{ width: '13%' }}>Resident Address</th>
                  <th style={{ width: '11%' }}>Resident Info</th>
                  <th style={{ width: '8%', minWidth: 85, whiteSpace: 'nowrap' }}>Status</th>
                  <th style={{ width: '12%', minWidth: 120, whiteSpace: 'nowrap' }}>Done By Staff</th>
                  {!isSubAdmin && <th style={{ width: '11%', minWidth: 130, whiteSpace: 'nowrap' }}>Actions</th>}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  Array.from({ length: 5 }).map((_, idx) => (
                    <tr key={`skeleton-${idx}`}>
                      <td><div className="skeleton skeleton-row" style={{ height: 16, width: 70, borderRadius: 6 }}></div></td>
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
                      <td><div className="skeleton skeleton-row" style={{ width: 90 }}></div></td>
                      {!isSubAdmin && <td><div className="skeleton skeleton-row" style={{ width: 80 }}></div></td>}
                    </tr>
                  ))
                ) : complaints.length === 0 ? (
                  <tr>
                    <td colSpan={isSubAdmin ? 9 : 10} style={{ textAlign: 'center', padding: '48px 16px', color: 'var(--text-muted)' }}>
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
                    <tr key={item._id} style={{ background: item.is_escalated ? 'rgba(239, 68, 68, 0.04)' : undefined }}>
                      <td 
                        style={{ whiteSpace: 'nowrap', cursor: 'pointer' }}
                        onClick={() => openComplaintDetails(item)}
                        title="Click to view details"
                      >
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 4 }}>
                          <span style={{ 
                            display: 'inline-flex',
                            alignItems: 'center',
                            fontSize: 12, 
                            fontFamily: 'monospace', 
                            fontWeight: 700, 
                            background: '#EEF2FF', 
                            color: '#4338CA', 
                            padding: '3px 8px', 
                            borderRadius: 6, 
                            border: '1px solid #C7D2FE',
                            letterSpacing: '0.5px'
                          }}>
                            {item.complaint_id || `#AH-${item._id.slice(-5).toUpperCase()}`}
                          </span>
                          {item.is_escalated && (
                            <span style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              fontSize: 10,
                              fontWeight: 800,
                              background: '#FEF2F2',
                              color: '#DC2626',
                              border: '1px solid #FCA5A5',
                              padding: '2px 6px',
                              borderRadius: 4
                            }} title={item.escalated_by?.name ? `Escalated by ${item.escalated_by.name}` : 'Escalated'}>
                              🔥 ESCALATED
                            </span>
                          )}
                        </div>
                      </td>
                      <td 
                        style={{ maxWidth: 280, cursor: 'pointer' }}
                        onClick={() => openComplaintDetails(item)}
                        title="Click to view details"
                      >
                        <div style={{ fontWeight: 600, color: 'var(--primary)', marginBottom: 4 }}>{item.title}</div>
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
                        <div style={{ color: (item.user?.address || item.address || item.user?.phase) ? 'var(--text-main)' : 'var(--text-muted)', fontSize: 13 }}>
                          {item.user?.address || item.address || (item.user?.phase ? `Phase: ${item.user.phase}` : 'Not Provided')}
                        </div>
                      </td>
                      <td>
                        <div style={{ fontWeight: 500, color: 'var(--text-main)', fontSize: 13 }}>
                          {item.user?.name || 'Unknown'}
                        </div>
                        {(item.user?.phone_number || item.user?.phone) && (
                          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                            {item.user.phone_number || item.user.phone}
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
                      <td style={{ 
                        maxWidth: 140, 
                        overflow: 'hidden', 
                        textOverflow: 'ellipsis', 
                        whiteSpace: 'nowrap',
                        paddingRight: 8
                      }}>
                        {(item.status === 'DONE' || item.status === 'RESOLVED') ? (() => {
                          const rawName = item.resolved_by?.name || item.resolved_by_name || item.assigned_staff?.name || '';
                          const cleanName = getCleanStaffName(rawName);
                          const isByAdmin = cleanName.toLowerCase().includes('admin') || (!cleanName && !item.assigned_staff);
                          const displayName = cleanName || (isByAdmin ? 'Admin' : 'Assigned Staff');
                          const phone = item.resolved_by?.phone_number || item.assigned_staff?.phone_number || item.resolved_by?.phone || '';

                          return (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 2, overflow: 'hidden' }}>
                              <div 
                                style={{ 
                                  display: 'inline-flex', 
                                  alignItems: 'center', 
                                  gap: 5, 
                                  fontWeight: 600, 
                                  color: isByAdmin ? '#4338CA' : '#15803D', 
                                  fontSize: 13,
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  whiteSpace: 'nowrap'
                                }}
                                title={rawName || displayName}
                              >
                                <span style={{ fontSize: 13, flexShrink: 0 }}>{isByAdmin ? '🛡️' : '👷'}</span>
                                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                  {displayName}
                                </span>
                              </div>
                              {phone ? (
                                <div style={{ fontSize: 11, color: 'var(--text-muted)', paddingLeft: 18, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                  {phone}
                                </div>
                              ) : null}
                            </div>
                          );
                        })() : item.assigned_staff ? (() => {
                          const cleanName = getCleanStaffName(item.assigned_staff.name) || item.assigned_staff.name;
                          return (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 2, overflow: 'hidden' }}>
                              <div 
                                style={{ 
                                  display: 'inline-flex', 
                                  alignItems: 'center', 
                                  gap: 4, 
                                  color: 'var(--text-main)', 
                                  fontSize: 12,
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  whiteSpace: 'nowrap'
                                }}
                                title={item.assigned_staff.name}
                              >
                                <span style={{ fontSize: 12, flexShrink: 0 }}>🔧</span>
                                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                  {cleanName}
                                </span>
                              </div>
                              <span style={{ fontSize: 10, color: 'var(--text-muted)', paddingLeft: 16 }}>In Progress</span>
                            </div>
                          );
                        })() : (
                          <span style={{ color: 'var(--text-muted)', fontSize: 13, paddingLeft: 4 }}>-</span>
                        )}
                      </td>
                      {!isSubAdmin && (
                        <td style={{ whiteSpace: 'nowrap', minWidth: 130 }}>
                          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                            <select 
                              value={item.status}
                              onChange={(e) => updateStatus(item._id, e.target.value)}
                              style={{ 
                                background: '#F8FAFC', 
                                color: 'var(--text-main)', 
                                border: '1px solid var(--border-color)', 
                                padding: '5px 6px', 
                                borderRadius: '6px',
                                outline: 'none',
                                cursor: 'pointer',
                                fontSize: '12px',
                                fontWeight: '500',
                                minWidth: '88px'
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
                      )}
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
      
      {/* View & Reply Modal */}
      {selectedComplaint && (
        <div className="modal-overlay" onClick={() => setSelectedComplaint(null)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: 600 }}>
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <h2 className="modal-title">Complaint Details</h2>
                <span style={{ 
                  fontSize: 13, 
                  fontFamily: 'monospace', 
                  fontWeight: 700, 
                  background: '#EEF2FF', 
                  color: '#4338CA', 
                  padding: '3px 8px', 
                  borderRadius: 6, 
                  border: '1px solid #C7D2FE',
                  letterSpacing: '0.5px'
                }}>
                  {selectedComplaint.complaint_id || `#AH-${selectedComplaint._id.slice(-5).toUpperCase()}`}
                </span>
              </div>
              <button className="modal-close" onClick={() => setSelectedComplaint(null)}><X size={20} /></button>
            </div>
            <div className="modal-body" style={{ maxHeight: '70vh', overflowY: 'auto', padding: '20px' }}>
              {selectedComplaint.is_escalated && (
                <div style={{
                  background: '#FEF2F2',
                  border: '1px solid #FCA5A5',
                  borderRadius: 10,
                  padding: '10px 14px',
                  marginBottom: 16,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10
                }}>
                  <span style={{ fontSize: 20 }}>🔥</span>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#DC2626' }}>
                      ESCALATED COMPLAINT
                    </div>
                    <div style={{ fontSize: 12, color: '#991B1B', marginTop: 2 }}>
                      Escalated by Member: {selectedComplaint.escalated_by?.name || 'Member'}
                    </div>
                  </div>
                </div>
              )}

              <div style={{ marginBottom: 20 }}>
                <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 8, color: 'var(--text-main)' }}>{selectedComplaint.title}</h3>
                <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.6, background: '#f8fafc', padding: 16, borderRadius: 12 }}>
                  {selectedComplaint.description}
                </p>
              </div>

              {isFetchingDetails && !selectedComplaint.before_image ? (
                <div style={{ marginBottom: 20 }}>
                  <h4 style={{ fontSize: 14, fontWeight: 600, marginBottom: 8, color: 'var(--text-main)' }}>Attached Image</h4>
                  <div className="skeleton" style={{ width: '100%', height: 200, borderRadius: 12 }}></div>
                </div>
              ) : selectedComplaint.before_image ? (
                <div style={{ marginBottom: 20 }}>
                  <h4 style={{ fontSize: 14, fontWeight: 600, marginBottom: 8, color: 'var(--text-main)' }}>Attached Image</h4>
                  <img src={selectedComplaint.before_image} alt="Complaint" style={{ width: '100%', maxHeight: 300, objectFit: 'contain', borderRadius: 12, border: '1px solid var(--border-color)', background: '#f8fafc' }} />
                </div>
              ) : null}

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
                <div style={{ background: '#f8fafc', padding: 16, borderRadius: 12 }}>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600, marginBottom: 4 }}>Reported By</div>
                  <div style={{ fontWeight: 600, color: 'var(--text-main)' }}>{selectedComplaint.user?.name || 'Unknown'}</div>
                  <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{selectedComplaint.user?.phone_number || selectedComplaint.user?.phone}</div>
                </div>
                <div style={{ background: '#f8fafc', padding: 16, borderRadius: 12 }}>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600, marginBottom: 4 }}>Status</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ fontWeight: 600, color: selectedComplaint.status === 'DONE' ? 'var(--success)' : 'var(--primary)' }}>
                      {selectedComplaint.status.replace('_', ' ')}
                    </div>
                  </div>
                </div>
              </div>

              {(selectedComplaint.status === 'DONE' || selectedComplaint.status === 'RESOLVED') && (
                <div style={{ background: '#F0FDF4', border: '1px solid #BBF7D0', padding: 16, borderRadius: 12, marginBottom: 20 }}>
                  <div style={{ fontSize: 12, color: '#166534', fontWeight: 700, marginBottom: 4 }}>Done By Staff</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700, color: '#15803D', fontSize: 14 }}>
                    <span style={{ fontSize: 16 }}>👷</span>
                    <span>{selectedComplaint.resolved_by?.name || selectedComplaint.resolved_by_name || selectedComplaint.assigned_staff?.name || 'Staff'}</span>
                  </div>
                  {(selectedComplaint.resolved_by?.phone_number || selectedComplaint.assigned_staff?.phone_number) && (
                    <div style={{ fontSize: 12, color: '#166534', marginTop: 4, marginLeft: 22 }}>
                      📞 {selectedComplaint.resolved_by?.phone_number || selectedComplaint.assigned_staff?.phone_number}
                    </div>
                  )}
                  {selectedComplaint.resolved_at && (
                    <div style={{ fontSize: 11, color: '#15803D', marginTop: 4, marginLeft: 22 }}>
                      🕒 Resolved on: {new Date(selectedComplaint.resolved_at).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}
                    </div>
                  )}
                </div>
              )}

              <div style={{ marginBottom: 20 }}>
                <h4 style={{ fontSize: 15, fontWeight: 600, marginBottom: 12, color: 'var(--text-main)' }}>Replies & Updates</h4>
                {(!selectedComplaint.replies || selectedComplaint.replies.length === 0) ? (
                  <div style={{ padding: 16, textAlign: 'center', color: 'var(--text-muted)', background: '#f8fafc', borderRadius: 12 }}>
                    No replies yet.
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {selectedComplaint.replies.map((reply: any, idx: number) => (
                      <div key={idx} style={{ 
                        background: reply.role === 'Admin' || reply.role === 'Staff' ? 'rgba(59, 130, 246, 0.05)' : '#f8fafc', 
                        borderLeft: reply.role === 'Admin' || reply.role === 'Staff' ? '3px solid var(--primary)' : '3px solid #cbd5e1',
                        padding: 12, 
                        borderRadius: '0 8px 8px 0' 
                      }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                          <span style={{ fontSize: 13, fontWeight: 600, color: reply.role === 'Admin' || reply.role === 'Staff' ? 'var(--primary)' : 'var(--text-main)' }}>
                            {reply.user?.role === 'Member' ? 'Member' : reply.role} {reply.user?.name ? `- ${reply.user.name}` : ''}
                          </span>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                              {new Date(reply.created_at).toLocaleString()}
                            </span>
                            {!isSubAdmin && (
                              <button 
                                onClick={() => deleteReply(selectedComplaint._id, reply._id)}
                                title="Delete Reply"
                                style={{ 
                                  background: 'transparent', 
                                  border: 'none', 
                                  cursor: 'pointer', 
                                  color: 'var(--danger)',
                                  padding: 2,
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center'
                                }}
                              >
                                <Trash2 size={14} />
                              </button>
                            )}
                          </div>
                        </div>
                        {reply.text ? <div style={{ fontSize: 14, color: 'var(--text-secondary)' }}>{reply.text}</div> : null}
                        {reply.image ? (
                          <div style={{ marginTop: 8 }}>
                            <img 
                              src={reply.image} 
                              alt="Reply Attachment" 
                              style={{ maxWidth: '240px', maxHeight: '180px', borderRadius: 8, objectFit: 'cover', border: '1px solid #cbd5e1', cursor: 'pointer', display: 'block' }} 
                              onClick={() => window.open(reply.image, '_blank')} 
                              title="Click to view full size"
                            />
                          </div>
                        ) : null}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {!isSubAdmin && (
                <div style={{ marginTop: 24, borderTop: '1px solid var(--border-color)', paddingTop: 20 }}>
                  <h4 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>Add a Reply</h4>
                <textarea
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  placeholder="Type your reply here... (This will be visible to the resident)"
                  style={{ width: '100%', height: 100, padding: 12, borderRadius: 8, border: '1px solid var(--border-color)', resize: 'none', marginBottom: 12, boxSizing: 'border-box' }}
                />
                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                  <button 
                    onClick={handleReply}
                    disabled={isReplying || !replyText.trim()}
                    style={{ background: 'var(--primary)', color: 'white', border: 'none', padding: '10px 20px', borderRadius: 8, fontWeight: 600, cursor: isReplying || !replyText.trim() ? 'not-allowed' : 'pointer', opacity: isReplying || !replyText.trim() ? 0.7 : 1 }}
                  >
                    {isReplying ? 'Sending...' : 'Send Reply'}
                  </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
