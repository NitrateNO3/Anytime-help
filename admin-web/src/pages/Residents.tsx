import { useState, useEffect } from 'react';
import axios from 'axios';
import { Home, Trash2, Search, Filter, RotateCcw, X, AlertCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import { io } from 'socket.io-client';

const API_URL = import.meta.env.VITE_API_URL || 'https://anytime-help.onrender.com/api';

export default function Residents() {
  const [residents, setResidents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterPhase, setFilterPhase] = useState('All Groups (Show Everything)');
  const [filterRelation, setFilterRelation] = useState('ALL');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  // Debounce search query (best practice: 350ms delay)
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 350);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    fetchResidents(page, filterPhase, debouncedSearch, filterRelation);
  }, [page, filterPhase, debouncedSearch, filterRelation]);

  useEffect(() => {
    // Socket.io for live updates
    const socketURL = API_URL.replace('/api', '');
    const socket = io(socketURL);

    socket.on('user_created', (newUser: any) => {
      if (newUser.role === 'Resident') {
        fetchResidents(page, filterPhase, debouncedSearch, filterRelation, false);
      }
    });

    socket.on('user_deleted', () => {
      fetchResidents(page, filterPhase, debouncedSearch, filterRelation, false);
    });

    return () => {
      socket.disconnect();
    };
  }, [page, filterPhase, debouncedSearch, filterRelation]);

  const fetchResidents = async (
    currentPage = page, 
    phaseFilter = filterPhase, 
    searchFilter = debouncedSearch, 
    relationFilter = filterRelation, 
    showLoading = true
  ) => {
    try {
      if (showLoading) setLoading(true);
      const token = localStorage.getItem('adminToken');
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: '10',
        phase: phaseFilter
      });
      if (searchFilter.trim()) params.append('search', searchFilter.trim());
      if (relationFilter !== 'ALL') params.append('relation', relationFilter);

      const res = await axios.get(`${API_URL}/users/residents?${params.toString()}`, {
        headers: { 'x-auth-token': token }
      });
      if (res.data && res.data.residents) {
        setResidents(res.data.residents);
        setTotalCount(res.data.total || 0);
        setTotalPages(res.data.totalPages || 1);
      } else if (Array.isArray(res.data)) {
        setResidents(res.data);
        setTotalCount(res.data.length);
        setTotalPages(Math.ceil(res.data.length / 10) || 1);
      }
    } catch (error) {
      console.error('Error fetching residents:', error);
    } finally {
      if (showLoading) setLoading(false);
    }
  };

  const resetFilters = () => {
    setSearch('');
    setDebouncedSearch('');
    setFilterPhase('All Groups (Show Everything)');
    setFilterRelation('ALL');
    setPage(1);
  };

  const isFiltered = search.trim() !== '' || filterPhase !== 'All Groups (Show Everything)' || filterRelation !== 'ALL';

  const requestDelete = (id: string) => {
    toast((t) => (
      <div style={{ padding: '8px' }}>
        <p style={{ fontWeight: 600, marginBottom: 16, fontSize: '15px', color: 'var(--text-main)' }}>
          Are you sure you want to delete this resident?
        </p>
        <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
          <button 
            onClick={() => toast.dismiss(t.id)} 
            style={{ 
              padding: '8px 16px', borderRadius: 8, border: '1px solid var(--border-color)', 
              background: 'white', cursor: 'pointer', fontWeight: 500, color: 'var(--text-main)' 
            }}
          >
            Cancel
          </button>
          <button 
            onClick={async () => {
              toast.dismiss(t.id);
              const loadingToast = toast.loading('Deleting resident...');
              try {
                const token = localStorage.getItem('adminToken');
                await axios.delete(`${API_URL}/users/${id}`, {
                  headers: { 'x-auth-token': token }
                });
                toast.success('Resident deleted successfully', { id: loadingToast });
                fetchResidents(page, filterPhase, debouncedSearch, filterRelation, false);
              } catch (error: any) {
                console.error('Error deleting resident:', error);
                toast.error(error.response?.data?.message || 'Could not delete resident', { id: loadingToast });
              }
            }} 
            style={{ 
              padding: '8px 16px', borderRadius: 8, border: 'none', 
              background: 'var(--danger)', color: 'white', cursor: 'pointer', fontWeight: 600 
            }}
          >
            Delete
          </button>
        </div>
      </div>
    ), { duration: Infinity, style: { minWidth: '320px', borderRadius: '12px' } });
  };

  return (
    <div style={{ padding: '24px', maxWidth: '1200px', margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <h1 className="page-title" style={{ display: 'flex', alignItems: 'center', marginBottom: '8px' }}>
            <Home size={28} color="var(--primary)" style={{ marginRight: '10px' }} />
            Residents Directory
          </h1>
          <p className="page-subtitle" style={{ marginTop: '4px', color: 'var(--text-muted)' }}>
            View all registered residents, filter by area/relation, and search records.
          </p>
        </div>
      </div>

      {/* Filter Toolbar Card */}
      <div className="card" style={{ padding: '20px 24px', marginBottom: '24px', borderRadius: '16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Filter size={20} color="var(--primary)" />
            <h2 style={{ fontSize: 17, fontWeight: 700, color: 'var(--text-main)' }}>Filter Residents</h2>
            {isFiltered && (
              <span style={{ fontSize: 12, background: 'rgba(29, 78, 216, 0.1)', color: 'var(--primary)', padding: '2px 8px', borderRadius: 12, fontWeight: 600 }}>
                Filters Applied
              </span>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: 13, color: 'var(--text-muted)', fontWeight: 500 }}>
              Showing {residents.length} of {totalCount} registered
            </span>
            {isFiltered && (
              <button
                onClick={resetFilters}
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

        {/* Search Input Bar (Debounced) */}
        <div style={{ position: 'relative', marginBottom: 16 }}>
          <Search size={18} color="var(--text-muted)" style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)' }} />
          <input
            type="text"
            placeholder="Search by resident name, phone number, address, or phase..."
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
              title="Clear search"
            >
              <X size={16} />
            </button>
          )}
        </div>

        {/* Dropdown Filters Row */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
          {/* Phase Filter */}
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6 }}>
              Phase / Group
            </label>
            <select 
              value={filterPhase} 
              onChange={(e) => {
                setFilterPhase(e.target.value);
                setPage(1);
              }}
              style={{ 
                width: '100%', 
                padding: '9px 12px', 
                borderRadius: '8px', 
                border: '1px solid var(--border-color)', 
                background: '#FFFFFF',
                fontSize: 13,
                color: 'var(--text-main)',
                fontWeight: 500,
                outline: 'none',
                cursor: 'pointer'
              }}
            >
              <option value="All Groups (Show Everything)">All Groups (Show Everything)</option>
              <option value="Sushant Lok 2 - C,D,E">Sushant Lok 2 - C,D,E</option>
              <option value="Sushant Lok 2 - F,G">Sushant Lok 2 - F,G</option>
              <option value="Sushant Lok 3">Sushant Lok 3</option>
            </select>
          </div>

          {/* Relation Filter */}
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6 }}>
              Resident Relation
            </label>
            <select 
              value={filterRelation} 
              onChange={(e) => {
                setFilterRelation(e.target.value);
                setPage(1);
              }}
              style={{ 
                width: '100%', 
                padding: '9px 12px', 
                borderRadius: '8px', 
                border: '1px solid var(--border-color)', 
                background: '#FFFFFF',
                fontSize: 13,
                color: 'var(--text-main)',
                fontWeight: 500,
                outline: 'none',
                cursor: 'pointer'
              }}
            >
              <option value="ALL">All Relations</option>
              <option value="Owner">Owner</option>
              <option value="Rented">Rented / Tenant</option>
            </select>
          </div>
        </div>
      </div>

      {/* Table Card */}
      <div className="card" style={{ marginTop: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h2 style={{ fontSize: '18px', fontWeight: '600' }}>Registered Residents List</h2>
          <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>
            Page {page} of {totalPages}
          </span>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table className="data-table" style={{ width: '100%', minWidth: 950, textAlign: 'left', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid var(--border)', color: 'var(--text-secondary)' }}>
                <th style={{ padding: '16px', width: '18%' }}>Name</th>
                <th style={{ padding: '16px', width: '16%' }}>Phone Number</th>
                <th style={{ padding: '16px', width: '22%' }}>Address</th>
                <th style={{ padding: '16px', width: '16%' }}>Phase / Group</th>
                <th style={{ padding: '16px', width: '10%' }}>Relation</th>
                <th style={{ padding: '16px', width: '11%' }}>Joined Date</th>
                <th style={{ padding: '16px', width: '7%', textAlign: 'center' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 5 }).map((_, idx) => (
                  <tr key={`skeleton-${idx}`} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '16px' }}><div className="skeleton skeleton-row" style={{ width: '80%' }}></div></td>
                    <td style={{ padding: '16px' }}><div className="skeleton skeleton-row" style={{ width: '100%' }}></div></td>
                    <td style={{ padding: '16px' }}><div className="skeleton skeleton-row" style={{ width: 80, height: 24, borderRadius: 12 }}></div></td>
                    <td style={{ padding: '16px' }}><div className="skeleton skeleton-row" style={{ width: '70%' }}></div></td>
                    <td style={{ padding: '16px' }}><div className="skeleton skeleton-row" style={{ width: '60%' }}></div></td>
                    <td style={{ padding: '16px' }}><div className="skeleton skeleton-row" style={{ width: '90%' }}></div></td>
                    <td style={{ padding: '16px', textAlign: 'center' }}><div className="skeleton skeleton-row" style={{ width: 30, borderRadius: 8, margin: '0 auto' }}></div></td>
                  </tr>
                ))
              ) : residents.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: '48px 16px', color: 'var(--text-muted)' }}>
                    <AlertCircle size={36} color="var(--text-muted)" style={{ margin: '0 auto 12px', display: 'block', opacity: 0.6 }} />
                    <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-main)', marginBottom: 6 }}>
                      No residents found
                    </div>
                    <div style={{ fontSize: 13 }}>
                      {isFiltered ? 'Try clearing or changing your search/filters to see more results.' : 'No residents have registered yet.'}
                    </div>
                    {isFiltered && (
                      <button
                        onClick={resetFilters}
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
                residents.map((r) => (
                  <tr key={r._id} style={{ borderBottom: '1px solid var(--border)', transition: 'background 0.2s' }}>
                    <td style={{ padding: '16px', fontWeight: '600', color: 'var(--text-main)' }}>{r.name || 'N/A'}</td>
                    <td style={{ padding: '16px', color: 'var(--text-muted)' }}>{r.phone_number}</td>
                    <td style={{ padding: '16px' }}>
                      <span className="badge" style={{ backgroundColor: '#DBEAFE', color: '#1D4ED8', padding: '6px 12px', fontWeight: 500, fontSize: 12 }}>
                        {r.address || 'N/A'}
                      </span>
                    </td>
                    <td style={{ padding: '16px', color: 'var(--text-muted)' }}>{r.phase || 'Unassigned'}</td>
                    <td style={{ padding: '16px' }}>
                      <span style={{ 
                        padding: '4px 10px', 
                        borderRadius: 12, 
                        fontSize: 12, 
                        fontWeight: 600,
                        background: r.relation === 'Rented' ? 'rgba(245, 158, 11, 0.1)' : 'rgba(16, 185, 129, 0.1)',
                        color: r.relation === 'Rented' ? 'var(--warning)' : 'var(--success)'
                      }}>
                        {r.relation || 'Owner'}
                      </span>
                    </td>
                    <td style={{ padding: '16px', color: 'var(--text-muted)', fontSize: 13 }}>
                      {new Date(r.createdAt || r.updatedAt || Date.now()).toLocaleDateString()}
                    </td>
                    <td style={{ padding: '16px', textAlign: 'center' }}>
                      <button 
                        onClick={() => requestDelete(r._id)}
                        className="btn-icon" 
                        style={{ color: 'var(--danger)', background: 'transparent', border: 'none', cursor: 'pointer', padding: 6, borderRadius: 6 }}
                        onMouseOver={(e) => e.currentTarget.style.background = 'rgba(239, 68, 68, 0.1)'}
                        onMouseOut={(e) => e.currentTarget.style.background = 'transparent'}
                        title="Remove Resident"
                      >
                        <Trash2 size={18} />
                      </button>
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
  );
}

