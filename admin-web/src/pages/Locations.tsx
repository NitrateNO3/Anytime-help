import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { toast } from 'react-hot-toast';
import { 
  MapPin, 
  Plus, 
  Edit2, 
  Trash2, 
  Search, 
  X, 
  Building, 
  Hash, 
  Globe, 
  Sparkles,
  RefreshCw
} from 'lucide-react';
import { io } from 'socket.io-client';
import '../index.css';

const API_URL = import.meta.env.VITE_API_URL || 'https://anytime-help.onrender.com/api';
const SOCKET_URL = API_URL.replace('/api', '');

interface LocationItem {
  _id: string;
  state: string;
  city: string;
  area: string;
  pincode: string;
  is_active: boolean;
  createdAt: string;
  updatedAt: string;
}

export default function Locations() {
  const [locations, setLocations] = useState<LocationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingLocation, setEditingLocation] = useState<LocationItem | null>(null);

  // Form State
  const [stateName, setStateName] = useState('');
  const [cityName, setCityName] = useState('');
  const [areaName, setAreaName] = useState('');
  const [pincode, setPincode] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Filter & Search
  const [search, setSearch] = useState('');
  const [filterState, setFilterState] = useState('ALL');
  const [filterCity, setFilterCity] = useState('ALL');

  const fetchLocations = async (showLoading = true) => {
    if (showLoading) setLoading(true);
    try {
      const token = localStorage.getItem('adminToken');
      const res = await axios.get(`${API_URL}/locations?all=true`, {
        headers: token ? { 'x-auth-token': token } : {}
      });
      if (res.data?.success && Array.isArray(res.data.locations)) {
        setLocations(res.data.locations);
      } else if (Array.isArray(res.data)) {
        setLocations(res.data);
      }
    } catch (err: any) {
      console.error('Failed to fetch locations:', err);
      toast.error(err.response?.data?.message || 'Failed to load locations');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLocations();

    const socket = io(SOCKET_URL, { transports: ['websocket', 'polling'] });
    socket.on('location_created', () => fetchLocations(false));
    socket.on('location_updated', () => fetchLocations(false));
    socket.on('location_deleted', () => fetchLocations(false));

    return () => {
      socket.disconnect();
    };
  }, []);

  // Compute unique states and cities for filters and suggestions
  const uniqueStates = useMemo(() => {
    const s = new Set<string>();
    locations.forEach(l => {
      if (l.state) s.add(l.state.trim());
    });
    return Array.from(s).sort();
  }, [locations]);

  const uniqueCitiesForState = useMemo(() => {
    const c = new Set<string>();
    locations.forEach(l => {
      if (l.city && (filterState === 'ALL' || l.state?.toLowerCase() === filterState.toLowerCase())) {
        c.add(l.city.trim());
      }
    });
    return Array.from(c).sort();
  }, [locations, filterState]);

  // Filtered Locations
  const filteredLocations = useMemo(() => {
    return locations.filter(loc => {
      const matchState = filterState === 'ALL' || (loc.state && loc.state.toLowerCase() === filterState.toLowerCase());
      const matchCity = filterCity === 'ALL' || (loc.city && loc.city.toLowerCase() === filterCity.toLowerCase());
      
      const s = search.trim().toLowerCase();
      const matchSearch = !s || 
        (loc.area && loc.area.toLowerCase().includes(s)) ||
        (loc.city && loc.city.toLowerCase().includes(s)) ||
        (loc.state && loc.state.toLowerCase().includes(s)) ||
        (loc.pincode && loc.pincode.includes(s));

      return matchState && matchCity && matchSearch;
    });
  }, [locations, search, filterState, filterCity]);

  // Statistics
  const stats = useMemo(() => {
    const states = new Set(locations.map(l => l.state?.trim()).filter(Boolean));
    const cities = new Set(locations.map(l => l.city?.trim()).filter(Boolean));
    const areas = new Set(locations.map(l => l.area?.trim()).filter(Boolean));
    return {
      totalLocations: locations.length,
      totalStates: states.size,
      totalCities: cities.size,
      totalAreas: areas.size
    };
  }, [locations]);

  const handleOpenAddModal = () => {
    setEditingLocation(null);
    setStateName(uniqueStates.length > 0 ? uniqueStates[0] : '');
    setCityName('');
    setAreaName('');
    setPincode('');
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (loc: LocationItem) => {
    setEditingLocation(loc);
    setStateName(loc.state || '');
    setCityName(loc.city || '');
    setAreaName(loc.area || '');
    setPincode(loc.pincode || '');
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingLocation(null);
    setStateName('');
    setCityName('');
    setAreaName('');
    setPincode('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stateName.trim() || !cityName.trim() || !areaName.trim() || !pincode.trim()) {
      toast.error('Please fill in State, City, Area, and Pincode');
      return;
    }

    if (!/^\d{4,8}$/.test(pincode.trim())) {
      toast.error('Please enter a valid numeric pincode (e.g. 122002)');
      return;
    }

    setSubmitting(true);
    const toastId = toast.loading(editingLocation ? 'Updating location...' : 'Adding location...');

    try {
      const token = localStorage.getItem('adminToken');
      const payload = {
        state: stateName.trim(),
        city: cityName.trim(),
        area: areaName.trim(),
        pincode: pincode.trim()
      };

      if (editingLocation) {
        await axios.put(`${API_URL}/locations/${editingLocation._id}`, payload, {
          headers: { 'x-auth-token': token }
        });
        toast.success('Location updated successfully!', { id: toastId });
      } else {
        await axios.post(`${API_URL}/locations`, payload, {
          headers: { 'x-auth-token': token }
        });
        toast.success('Location added successfully!', { id: toastId });
      }

      handleCloseModal();
      fetchLocations(false);
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Operation failed', { id: toastId });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = (id: string, name: string) => {
    toast((t) => (
      <div style={{ padding: '8px' }}>
        <p style={{ fontWeight: 600, marginBottom: 8, fontSize: '14px', color: 'var(--text-main)' }}>
          Delete location "{name}"?
        </p>
        <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: 14 }}>
          This will remove it from the mobile registration dropdown list.
        </p>
        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
          <button
            onClick={() => toast.dismiss(t.id)}
            style={{
              padding: '6px 12px',
              borderRadius: '6px',
              border: '1px solid var(--border-color)',
              background: '#FFFFFF',
              fontSize: '12px',
              fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            Cancel
          </button>
          <button
            onClick={async () => {
              toast.dismiss(t.id);
              const delToast = toast.loading('Deleting location...');
              try {
                const token = localStorage.getItem('adminToken');
                await axios.delete(`${API_URL}/locations/${id}`, {
                  headers: { 'x-auth-token': token }
                });
                toast.success('Location deleted successfully!', { id: delToast });
                fetchLocations(false);
              } catch (err: any) {
                toast.error(err.response?.data?.message || 'Failed to delete location', { id: delToast });
              }
            }}
            style={{
              padding: '6px 12px',
              borderRadius: '6px',
              border: 'none',
              background: 'var(--danger)',
              color: '#FFFFFF',
              fontSize: '12px',
              fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            Yes, Delete
          </button>
        </div>
      </div>
    ), { duration: 6000, style: { minWidth: '320px', borderRadius: '12px' } });
  };

  const handleToggleActive = async (loc: LocationItem) => {
    try {
      const token = localStorage.getItem('adminToken');
      const updatedStatus = !loc.is_active;
      await axios.put(`${API_URL}/locations/${loc._id}`, { is_active: updatedStatus }, {
        headers: { 'x-auth-token': token }
      });
      toast.success(`Location set to ${updatedStatus ? 'Active' : 'Inactive'}`);
      setLocations(prev => prev.map(item => item._id === loc._id ? { ...item, is_active: updatedStatus } : item));
    } catch (err: any) {
      toast.error('Failed to change status');
    }
  };

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto' }}>
      {/* Page Header */}
      <div className="page-header" style={{ marginBottom: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 40,
              height: 40,
              borderRadius: 10,
              background: 'linear-gradient(135deg, #1D4ED8 0%, #3B82F6 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#FFFFFF'
            }}>
              <MapPin size={22} />
            </div>
            <div>
              <h1 style={{ fontSize: 24, fontWeight: 800, color: 'var(--text-main)', letterSpacing: '-0.02em', margin: 0 }}>
                Locations & Areas
              </h1>
              <p style={{ color: 'var(--text-muted)', fontSize: 13, marginTop: 2, margin: 0 }}>
                Manage States, Cities, Areas, and Pincodes populated in the app registration dropdowns
              </p>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button
            onClick={() => fetchLocations(true)}
            title="Refresh"
            style={{
              padding: '10px 14px',
              borderRadius: 10,
              border: '1px solid var(--border-color)',
              background: '#FFFFFF',
              color: 'var(--text-muted)',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            <RefreshCw size={15} />
            Refresh
          </button>

          <button
            onClick={handleOpenAddModal}
            style={{
              padding: '10px 18px',
              borderRadius: 10,
              border: 'none',
              background: 'linear-gradient(135deg, #1D4ED8 0%, #2563EB 100%)',
              color: '#FFFFFF',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              fontSize: 14,
              fontWeight: 600,
              cursor: 'pointer',
              boxShadow: '0 4px 12px rgba(29, 78, 216, 0.25)'
            }}
          >
            <Plus size={18} />
            Add Location Manually
          </button>
        </div>
      </div>

      {/* Metrics Row */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
        gap: 16,
        marginBottom: 24
      }}>
        <div className="glass" style={{ padding: '18px 20px', borderRadius: 14, display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ width: 44, height: 44, borderRadius: 10, background: '#EFF6FF', color: '#2563EB', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <MapPin size={22} />
          </div>
          <div>
            <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--text-main)' }}>{stats.totalLocations}</div>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)' }}>Total Configured Areas</div>
          </div>
        </div>

        <div className="glass" style={{ padding: '18px 20px', borderRadius: 14, display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ width: 44, height: 44, borderRadius: 10, background: '#F0FDF4', color: '#16A34A', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Globe size={22} />
          </div>
          <div>
            <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--text-main)' }}>{stats.totalStates}</div>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)' }}>States Covered</div>
          </div>
        </div>

        <div className="glass" style={{ padding: '18px 20px', borderRadius: 14, display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ width: 44, height: 44, borderRadius: 10, background: '#FEF3C7', color: '#D97706', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Building size={22} />
          </div>
          <div>
            <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--text-main)' }}>{stats.totalCities}</div>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)' }}>Cities Covered</div>
          </div>
        </div>

        <div className="glass" style={{ padding: '18px 20px', borderRadius: 14, display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ width: 44, height: 44, borderRadius: 10, background: '#F5F3FF', color: '#7C3AED', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Hash size={22} />
          </div>
          <div>
            <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--text-main)' }}>{stats.totalAreas}</div>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)' }}>Distinct Communities</div>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="glass" style={{ padding: 18, borderRadius: 14, marginBottom: 20 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14, alignItems: 'center' }}>
          {/* Search Box */}
          <div style={{ position: 'relative' }}>
            <Search size={18} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input
              type="text"
              placeholder="Search by Area, City, State or Pincode..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{
                width: '100%',
                padding: '10px 36px 10px 38px',
                borderRadius: 8,
                border: '1px solid var(--border-color)',
                fontSize: 13,
                outline: 'none',
                background: '#FFFFFF'
              }}
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}
              >
                <X size={15} />
              </button>
            )}
          </div>

          {/* State Filter */}
          <div>
            <select
              value={filterState}
              onChange={(e) => {
                setFilterState(e.target.value);
                setFilterCity('ALL');
              }}
              style={{
                width: '100%',
                padding: '10px 12px',
                borderRadius: 8,
                border: '1px solid var(--border-color)',
                fontSize: 13,
                fontWeight: 500,
                outline: 'none',
                background: '#FFFFFF',
                color: 'var(--text-main)',
                cursor: 'pointer'
              }}
            >
              <option value="ALL">All States ({uniqueStates.length})</option>
              {uniqueStates.map(st => (
                <option key={st} value={st}>{st}</option>
              ))}
            </select>
          </div>

          {/* City Filter */}
          <div>
            <select
              value={filterCity}
              onChange={(e) => setFilterCity(e.target.value)}
              style={{
                width: '100%',
                padding: '10px 12px',
                borderRadius: 8,
                border: '1px solid var(--border-color)',
                fontSize: 13,
                fontWeight: 500,
                outline: 'none',
                background: '#FFFFFF',
                color: 'var(--text-main)',
                cursor: 'pointer'
              }}
            >
              <option value="ALL">All Cities ({uniqueCitiesForState.length})</option>
              {uniqueCitiesForState.map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          {/* Clear Filters */}
          {(search || filterState !== 'ALL' || filterCity !== 'ALL') && (
            <div>
              <button
                onClick={() => {
                  setSearch('');
                  setFilterState('ALL');
                  setFilterCity('ALL');
                }}
                style={{
                  padding: '9px 14px',
                  borderRadius: 8,
                  border: '1px dashed #CBD5E1',
                  background: '#F8FAFC',
                  color: 'var(--text-muted)',
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6
                }}
              >
                <X size={14} /> Clear Filters
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Locations Table / Content */}
      <div className="glass" style={{ borderRadius: 14, overflow: 'hidden' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, margin: 0, color: 'var(--text-main)' }}>
            Configured Locations ({filteredLocations.length})
          </h2>
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
            Shown in App Register Dropdowns
          </span>
        </div>

        {loading ? (
          <div style={{ padding: '60px 20px', textAlign: 'center', color: 'var(--text-muted)' }}>
            <div style={{ display: 'inline-block', width: 32, height: 32, border: '3px solid #E2E8F0', borderTopColor: '#2563EB', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
            <p style={{ marginTop: 12, fontSize: 14 }}>Loading locations...</p>
          </div>
        ) : filteredLocations.length === 0 ? (
          <div style={{ padding: '60px 20px', textAlign: 'center' }}>
            <div style={{ width: 64, height: 64, borderRadius: '50%', background: '#EFF6FF', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: '#3B82F6', marginBottom: 16 }}>
              <MapPin size={32} />
            </div>
            <h3 style={{ fontSize: 17, fontWeight: 700, color: 'var(--text-main)', marginBottom: 6 }}>
              {locations.length === 0 ? 'No Locations Added Yet' : 'No Matching Locations Found'}
            </h3>
            <p style={{ color: 'var(--text-muted)', fontSize: 14, maxWidth: 420, margin: '0 auto 18px' }}>
              {locations.length === 0 
                ? 'Enter your State, City, Area, and Pincode so residents can select their community from the mobile app registration dropdown.'
                : 'Try adjusting your search query or reset the state/city filters.'}
            </p>
            {locations.length === 0 && (
              <button
                onClick={handleOpenAddModal}
                style={{
                  padding: '10px 20px',
                  borderRadius: 10,
                  border: 'none',
                  background: '#2563EB',
                  color: '#FFFFFF',
                  fontWeight: 600,
                  fontSize: 14,
                  cursor: 'pointer'
                }}
              >
                + Add Your First Location
              </button>
            )}
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: 700 }}>
              <thead>
                <tr style={{ background: '#F8FAFC', borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)', fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  <th style={{ padding: '14px 20px', fontWeight: 600 }}>Area / Society</th>
                  <th style={{ padding: '14px 20px', fontWeight: 600 }}>City</th>
                  <th style={{ padding: '14px 20px', fontWeight: 600 }}>State</th>
                  <th style={{ padding: '14px 20px', fontWeight: 600 }}>Pincode</th>
                  <th style={{ padding: '14px 20px', fontWeight: 600 }}>App Status</th>
                  <th style={{ padding: '14px 20px', fontWeight: 600, textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredLocations.map((loc, idx) => (
                  <tr 
                    key={loc._id || idx}
                    style={{
                      borderBottom: '1px solid var(--border-color)',
                      transition: 'background 0.15s ease'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.background = '#F8FAFC'}
                    onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                  >
                    <td style={{ padding: '16px 20px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{ width: 34, height: 34, borderRadius: 8, background: 'rgba(37, 99, 235, 0.08)', color: '#2563EB', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <MapPin size={17} />
                        </div>
                        <div>
                          <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-main)' }}>{loc.area}</div>
                          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Pincode: {loc.pincode}</div>
                        </div>
                      </div>
                    </td>

                    <td style={{ padding: '16px 20px', fontSize: 14, color: 'var(--text-main)', fontWeight: 500 }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                        <Building size={14} color="#64748B" />
                        {loc.city}
                      </span>
                    </td>

                    <td style={{ padding: '16px 20px', fontSize: 14, color: 'var(--text-main)', fontWeight: 500 }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                        <Globe size={14} color="#64748B" />
                        {loc.state}
                      </span>
                    </td>

                    <td style={{ padding: '16px 20px' }}>
                      <span style={{
                        padding: '4px 10px',
                        borderRadius: 6,
                        background: '#F1F5F9',
                        color: '#0F172A',
                        fontWeight: 700,
                        fontSize: 13,
                        letterSpacing: '0.04em'
                      }}>
                        {loc.pincode}
                      </span>
                    </td>

                    <td style={{ padding: '16px 20px' }}>
                      <button
                        onClick={() => handleToggleActive(loc)}
                        title="Click to toggle visibility in mobile app dropdown"
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 6,
                          padding: '4px 10px',
                          borderRadius: 20,
                          fontSize: 12,
                          fontWeight: 600,
                          border: 'none',
                          cursor: 'pointer',
                          background: loc.is_active ? '#DCFCE7' : '#F1F5F9',
                          color: loc.is_active ? '#15803D' : '#64748B'
                        }}
                      >
                        <span style={{ width: 6, height: 6, borderRadius: '50%', background: loc.is_active ? '#16A34A' : '#94A3B8' }} />
                        {loc.is_active ? 'Active in App' : 'Hidden'}
                      </button>
                    </td>

                    <td style={{ padding: '16px 20px', textAlign: 'right' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 8 }}>
                        <button
                          onClick={() => handleOpenEditModal(loc)}
                          title="Edit location"
                          style={{
                            padding: '6px 10px',
                            borderRadius: 6,
                            border: '1px solid var(--border-color)',
                            background: '#FFFFFF',
                            color: '#2563EB',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 4,
                            fontSize: 12,
                            fontWeight: 600
                          }}
                        >
                          <Edit2 size={13} />
                          Edit
                        </button>

                        <button
                          onClick={() => handleDelete(loc._id, loc.area)}
                          title="Delete location"
                          style={{
                            padding: '6px 10px',
                            borderRadius: 6,
                            border: '1px solid #FCA5A5',
                            background: '#FFF5F5',
                            color: '#DC2626',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 4,
                            fontSize: 12,
                            fontWeight: 600
                          }}
                        >
                          <Trash2 size={13} />
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add / Edit Location Modal */}
      {isModalOpen && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(15, 23, 42, 0.65)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          padding: 16
        }}>
          <div style={{
            background: '#FFFFFF',
            borderRadius: 16,
            maxWidth: 500,
            width: '100%',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
            overflow: 'hidden'
          }}>
            {/* Modal Header */}
            <div style={{
              padding: '20px 24px',
              borderBottom: '1px solid var(--border-color)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              background: '#F8FAFC'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{
                  width: 36,
                  height: 36,
                  borderRadius: 8,
                  background: 'rgba(37, 99, 235, 0.1)',
                  color: '#2563EB',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <MapPin size={18} />
                </div>
                <div>
                  <h3 style={{ fontSize: 17, fontWeight: 700, margin: 0, color: 'var(--text-main)' }}>
                    {editingLocation ? 'Edit Location' : 'Add Location Manually'}
                  </h3>
                  <p style={{ margin: 0, fontSize: 12, color: 'var(--text-muted)' }}>
                    Enter State, City, Area, and Pincode for the mobile app dropdown
                  </p>
                </div>
              </div>

              <button
                onClick={handleCloseModal}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 4 }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Body / Form */}
            <form onSubmit={handleSubmit} style={{ padding: 24 }}>
              {/* State Field */}
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--text-main)', marginBottom: 6 }}>
                  State <span style={{ color: 'var(--danger)' }}>*</span>
                </label>
                <input
                  type="text"
                  list="state-suggestions"
                  placeholder="e.g. Haryana, Delhi, Uttar Pradesh"
                  value={stateName}
                  onChange={(e) => setStateName(e.target.value)}
                  required
                  style={{
                    width: '100%',
                    padding: '11px 14px',
                    borderRadius: 8,
                    border: '1px solid var(--border-color)',
                    fontSize: 14,
                    outline: 'none',
                    boxSizing: 'border-box'
                  }}
                />
                <datalist id="state-suggestions">
                  {uniqueStates.map(st => (
                    <option key={st} value={st} />
                  ))}
                  <option value="Haryana" />
                  <option value="Delhi" />
                  <option value="Uttar Pradesh" />
                  <option value="Maharashtra" />
                  <option value="Karnataka" />
                </datalist>
                <span style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4, display: 'block' }}>
                  Select existing or type a new state name
                </span>
              </div>

              {/* City Field */}
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--text-main)', marginBottom: 6 }}>
                  City <span style={{ color: 'var(--danger)' }}>*</span>
                </label>
                <input
                  type="text"
                  list="city-suggestions"
                  placeholder="e.g. Gurugram, New Delhi, Noida"
                  value={cityName}
                  onChange={(e) => setCityName(e.target.value)}
                  required
                  style={{
                    width: '100%',
                    padding: '11px 14px',
                    borderRadius: 8,
                    border: '1px solid var(--border-color)',
                    fontSize: 14,
                    outline: 'none',
                    boxSizing: 'border-box'
                  }}
                />
                <datalist id="city-suggestions">
                  {uniqueCitiesForState.map(c => (
                    <option key={c} value={c} />
                  ))}
                  <option value="Gurugram" />
                  <option value="New Delhi" />
                  <option value="Noida" />
                  <option value="Faridabad" />
                  <option value="Bengaluru" />
                  <option value="Mumbai" />
                </datalist>
              </div>

              {/* Area & Pincode Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 14, marginBottom: 20 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--text-main)', marginBottom: 6 }}>
                    Area / Society / Sector <span style={{ color: 'var(--danger)' }}>*</span>
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Sushant Lok 2"
                    value={areaName}
                    onChange={(e) => setAreaName(e.target.value)}
                    required
                    style={{
                      width: '100%',
                      padding: '11px 14px',
                      borderRadius: 8,
                      border: '1px solid var(--border-color)',
                      fontSize: 14,
                      outline: 'none',
                      boxSizing: 'border-box'
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--text-main)', marginBottom: 6 }}>
                    Pincode <span style={{ color: 'var(--danger)' }}>*</span>
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. 122002"
                    value={pincode}
                    onChange={(e) => setPincode(e.target.value.replace(/\D/g, '').slice(0, 8))}
                    required
                    maxLength={8}
                    style={{
                      width: '100%',
                      padding: '11px 14px',
                      borderRadius: 8,
                      border: '1px solid var(--border-color)',
                      fontSize: 14,
                      fontWeight: 600,
                      outline: 'none',
                      boxSizing: 'border-box'
                    }}
                  />
                </div>
              </div>

              {/* Live Preview Card */}
              {areaName && cityName && (
                <div style={{
                  padding: '12px 14px',
                  borderRadius: 10,
                  background: 'rgba(37, 99, 235, 0.05)',
                  border: '1px dashed #BFDBFE',
                  marginBottom: 20,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10
                }}>
                  <Sparkles size={18} color="#2563EB" />
                  <div style={{ fontSize: 13, color: '#1E3A8A' }}>
                    <strong>Preview in App:</strong> {areaName}, {cityName}, {stateName || 'State'} {pincode ? `(${pincode})` : ''}
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  onClick={handleCloseModal}
                  disabled={submitting}
                  style={{
                    padding: '10px 18px',
                    borderRadius: 8,
                    border: '1px solid var(--border-color)',
                    background: '#FFFFFF',
                    color: 'var(--text-muted)',
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={submitting}
                  style={{
                    padding: '10px 22px',
                    borderRadius: 8,
                    border: 'none',
                    background: 'linear-gradient(135deg, #1D4ED8 0%, #2563EB 100%)',
                    color: '#FFFFFF',
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: 'pointer',
                    boxShadow: '0 4px 12px rgba(29, 78, 216, 0.25)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6
                  }}
                >
                  {submitting ? 'Saving...' : (editingLocation ? 'Save Changes' : 'Add Location')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
