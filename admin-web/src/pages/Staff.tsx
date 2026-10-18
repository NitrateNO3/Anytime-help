import { useState, useEffect } from 'react';
import { Pagination } from '../components/Pagination';
import axios from 'axios';
import { UserPlus, Users, Edit2, Trash2, Search, Filter, RotateCcw, X, Wrench, Plus, MapPin, Check } from 'lucide-react';
import toast from 'react-hot-toast';
import { ExportButtons } from '../components/ExportButtons';
import { io } from 'socket.io-client';

const API_URL = 'https://anytime-help.onrender.com/api';

const defaultCategories = [
  'Electricity', 'Garbage', 'Sweeping', 'Sewage cleaning', 
  'Rainwater drainage', 'Tree cutting', 'Street light', 'Water service'
];

const defaultPhases = ['All', 'Universal', 'Sushant Lok 2', 'Sushant Lok 3'];

export interface LocationAssignment {
  phase: string;
  blocks: string[];
}

function LocationAssignmentSection({
  locations,
  onChange,
  dynamicEntityBlocks
}: {
  locations: LocationAssignment[];
  onChange: (locs: LocationAssignment[]) => void;
  dynamicEntityBlocks: Record<string, string[]>;
  phases: string[];
}) {
  const [customPhaseInputs, setCustomPhaseInputs] = useState<Record<number, string>>({});
  const [customBlockInputs, setCustomBlockInputs] = useState<Record<number, string>>({});
  const [showCustomBlockFor, setShowCustomBlockFor] = useState<Record<number, boolean>>({});

  const updateLocation = (index: number, updated: Partial<LocationAssignment>) => {
    const next = [...locations];
    next[index] = { ...next[index], ...updated };
    onChange(next);
  };

  const removeLocation = (index: number) => {
    if (locations.length <= 1) return;
    onChange(locations.filter((_, i) => i !== index));
  };

  const addLocation = () => {
    const available = Object.keys(dynamicEntityBlocks).filter(
      k => k !== 'All Groups (Universal)' && !locations.some(l => l.phase === k)
    );
    const newPhase = available[0] || 'Sushant Lok 3';
    const defaultBlocks = dynamicEntityBlocks[newPhase] && dynamicEntityBlocks[newPhase].length > 0
      ? [dynamicEntityBlocks[newPhase][0]]
      : ['ALL'];
    onChange([...locations, { phase: newPhase, blocks: defaultBlocks }]);
  };

  const toggleBlock = (locIndex: number, blk: string) => {
    const loc = locations[locIndex];
    let nextBlocks = [...(loc.blocks || [])];

    if (blk === 'ALL') {
      nextBlocks = ['ALL'];
    } else {
      nextBlocks = nextBlocks.filter(b => b !== 'ALL');
      if (nextBlocks.includes(blk)) {
        nextBlocks = nextBlocks.filter(b => b !== blk);
        if (nextBlocks.length === 0) {
          nextBlocks = ['ALL'];
        }
      } else {
        nextBlocks.push(blk);
      }
    }

    updateLocation(locIndex, { blocks: nextBlocks });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {locations.map((loc, idx) => {
        const isUniversal = loc.phase === 'All Groups (Universal)' || loc.phase === 'Universal';
        const availableBlocks = dynamicEntityBlocks[loc.phase] || [];
        const isAllBlocks = !loc.blocks || loc.blocks.length === 0 || loc.blocks.includes('ALL') || loc.blocks.includes('All Blocks');

        return (
          <div key={idx} style={{
            background: '#F8FAFC',
            border: '1px solid var(--border-color)',
            borderRadius: '12px',
            padding: '16px',
            position: 'relative'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <MapPin size={16} color="var(--primary)" />
                <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-main)' }}>
                  Assigned Location {locations.length > 1 ? `#${idx + 1}` : ''}
                </span>
              </div>
              {locations.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeLocation(idx)}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--danger)',
                    cursor: 'pointer',
                    padding: '4px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    fontSize: '12px',
                    fontWeight: 600
                  }}
                  title="Remove location"
                >
                  <Trash2 size={14} /> Remove
                </button>
              )}
            </div>

            {/* Society / Phase Select */}
            <div style={{ marginBottom: '12px' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '6px' }}>
                Select Society / Group
              </label>
              <select
                value={customPhaseInputs[idx] !== undefined ? 'ADD_NEW' : loc.phase}
                onChange={(e) => {
                  if (e.target.value === 'ADD_NEW') {
                    setCustomPhaseInputs({ ...customPhaseInputs, [idx]: '' });
                  } else {
                    const newInputs = { ...customPhaseInputs };
                    delete newInputs[idx];
                    setCustomPhaseInputs(newInputs);
                    
                    const newPhase = e.target.value;
                    const isNewUniversal = newPhase === 'All Groups (Universal)' || newPhase === 'Universal';
                    const newBlocks = isNewUniversal 
                      ? ['ALL'] 
                      : (dynamicEntityBlocks[newPhase] && dynamicEntityBlocks[newPhase].length > 0 ? [dynamicEntityBlocks[newPhase][0]] : ['ALL']);
                    updateLocation(idx, { phase: newPhase, blocks: newBlocks });
                  }
                }}
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  background: 'white',
                  border: '1px solid var(--border-color)',
                  borderRadius: '10px',
                  fontSize: '14px',
                  color: 'var(--text-main)',
                  outline: 'none',
                  cursor: 'pointer'
                }}
              >
                {Object.keys(dynamicEntityBlocks).map(entity => (
                  <option key={entity} value={entity}>
                    {entity === 'All Groups (Universal)' ? '🌐 All Groups (Universal - Entire Society)' : entity}
                  </option>
                ))}
                <option value="ADD_NEW" style={{ fontWeight: 'bold', color: 'var(--primary)' }}>+ Add New Custom Group...</option>
              </select>

              {customPhaseInputs[idx] !== undefined && (
                <div style={{ marginTop: '8px' }}>
                  <input
                    type="text"
                    placeholder="Enter custom society/group name"
                    value={customPhaseInputs[idx]}
                    onChange={(e) => {
                      setCustomPhaseInputs({ ...customPhaseInputs, [idx]: e.target.value });
                      updateLocation(idx, { phase: e.target.value });
                    }}
                    style={{
                      width: '100%',
                      padding: '10px 14px',
                      borderRadius: '10px',
                      border: '1px dashed var(--primary)',
                      outline: 'none',
                      background: 'rgba(59, 130, 246, 0.03)',
                      fontSize: '13px'
                    }}
                    autoFocus
                  />
                </div>
              )}
            </div>

            {/* Block Selection */}
            {isUniversal ? (
              <div style={{
                background: 'rgba(59, 130, 246, 0.08)',
                border: '1px solid rgba(59, 130, 246, 0.25)',
                borderRadius: '8px',
                padding: '10px 12px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                fontSize: '13px',
                color: '#1D4ED8'
              }}>
                <span>🌐</span>
                <span>Covers all blocks across all phases in the entire society.</span>
              </div>
            ) : (
              <div>
                <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '8px' }}>
                  <span>Assigned Blocks (for {loc.phase})</span>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Multi-select</span>
                </label>

                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                  {/* All Blocks Toggle Chip */}
                  <button
                    type="button"
                    onClick={() => toggleBlock(idx, 'ALL')}
                    style={{
                      padding: '6px 12px',
                      borderRadius: '8px',
                      fontSize: '12px',
                      fontWeight: 600,
                      cursor: 'pointer',
                      border: isAllBlocks ? '1.5px solid var(--primary)' : '1px solid var(--border-color)',
                      background: isAllBlocks ? 'rgba(59, 130, 246, 0.12)' : 'white',
                      color: isAllBlocks ? 'var(--primary)' : 'var(--text-main)',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    {isAllBlocks && <Check size={12} />}
                    All Blocks ({loc.phase})
                  </button>

                  {/* Individual Block Chips */}
                  {availableBlocks.map(blk => {
                    const isSelected = !isAllBlocks && (loc.blocks || []).includes(blk);
                    return (
                      <button
                        key={blk}
                        type="button"
                        onClick={() => toggleBlock(idx, blk)}
                        style={{
                          padding: '6px 12px',
                          borderRadius: '8px',
                          fontSize: '12px',
                          fontWeight: isSelected ? 600 : 500,
                          cursor: 'pointer',
                          border: isSelected ? '1.5px solid var(--primary)' : '1px solid var(--border-color)',
                          background: isSelected ? 'rgba(59, 130, 246, 0.12)' : 'white',
                          color: isSelected ? 'var(--primary)' : 'var(--text-main)',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                          transition: 'all 0.15s ease'
                        }}
                      >
                        {isSelected && <Check size={12} />}
                        Block {blk}
                      </button>
                    );
                  })}

                  {/* Extra custom blocks currently saved on this location */}
                  {(loc.blocks || [])
                    .filter(b => b !== 'ALL' && !availableBlocks.includes(b))
                    .map(b => (
                      <button
                        key={b}
                        type="button"
                        onClick={() => toggleBlock(idx, b)}
                        style={{
                          padding: '6px 12px',
                          borderRadius: '8px',
                          fontSize: '12px',
                          fontWeight: 600,
                          cursor: 'pointer',
                          border: '1.5px solid var(--primary)',
                          background: 'rgba(59, 130, 246, 0.12)',
                          color: 'var(--primary)',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px'
                        }}
                      >
                        <Check size={12} />
                        {b.startsWith('Block') ? b : `Block ${b}`}
                      </button>
                    ))}

                  {/* Add Custom Block Button */}
                  {!showCustomBlockFor[idx] ? (
                    <button
                      type="button"
                      onClick={() => setShowCustomBlockFor({ ...showCustomBlockFor, [idx]: true })}
                      style={{
                        padding: '6px 12px',
                        borderRadius: '8px',
                        fontSize: '12px',
                        fontWeight: 600,
                        cursor: 'pointer',
                        border: '1px dashed var(--primary)',
                        background: 'transparent',
                        color: 'var(--primary)',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px'
                      }}
                    >
                      <Plus size={12} /> Custom Block
                    </button>
                  ) : (
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                      <input
                        type="text"
                        placeholder="e.g. Z or Pocket 1"
                        value={customBlockInputs[idx] || ''}
                        onChange={(e) => setCustomBlockInputs({ ...customBlockInputs, [idx]: e.target.value })}
                        style={{
                          padding: '4px 8px',
                          fontSize: '12px',
                          border: '1px solid var(--primary)',
                          borderRadius: '6px',
                          width: '110px',
                          outline: 'none'
                        }}
                        autoFocus
                      />
                      <button
                        type="button"
                        onClick={() => {
                          const val = (customBlockInputs[idx] || '').trim();
                          if (val) {
                            toggleBlock(idx, val);
                            setCustomBlockInputs({ ...customBlockInputs, [idx]: '' });
                            setShowCustomBlockFor({ ...showCustomBlockFor, [idx]: false });
                          }
                        }}
                        style={{
                          padding: '4px 8px',
                          fontSize: '11px',
                          fontWeight: 600,
                          background: 'var(--primary)',
                          color: 'white',
                          border: 'none',
                          borderRadius: '6px',
                          cursor: 'pointer'
                        }}
                      >
                        Add
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowCustomBlockFor({ ...showCustomBlockFor, [idx]: false })}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: 'var(--text-muted)',
                          cursor: 'pointer',
                          padding: '2px'
                        }}
                      >
                        <X size={14} />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        );
      })}

      {/* Button to add another location */}
      <button
        type="button"
        onClick={addLocation}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '8px',
          padding: '10px 16px',
          borderRadius: '10px',
          border: '1.5px dashed var(--primary)',
          background: 'rgba(59, 130, 246, 0.04)',
          color: 'var(--primary)',
          fontSize: '13px',
          fontWeight: 600,
          cursor: 'pointer',
          transition: 'all 0.2s ease'
        }}
        onMouseOver={(e) => e.currentTarget.style.background = 'rgba(59, 130, 246, 0.08)'}
        onMouseOut={(e) => e.currentTarget.style.background = 'rgba(59, 130, 246, 0.04)'}
      >
        <Plus size={16} /> + Add Another Society / Phase (e.g. Sushant Lok 3)
      </button>
    </div>
  );
}

export default function Staff() {
  const [activeTab, setActiveTab] = useState<'list' | 'create'>('list');
  const [staff, setStaff] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  const adminUserStr = localStorage.getItem('adminUser');
  const adminUser = adminUserStr ? JSON.parse(adminUserStr) : null;
  const isSubAdmin = adminUser?.role === 'SubAdmin';

  // Filter States
  const [filterPhase, setFilterPhase] = useState('All');
  const [filterStatus, setFilterStatus] = useState('ALL');
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
  const [assignedLocations, setAssignedLocations] = useState<LocationAssignment[]>([
    { phase: 'Sushant Lok 2', blocks: ['C'] }
  ]);
  const [editLocations, setEditLocations] = useState<LocationAssignment[]>([]);
  const [staffPersonalName, setStaffPersonalName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [categories, setCategories] = useState<string[]>(['Electricity']);
  const [isCreating, setIsCreating] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [editingUser, setEditingUser] = useState<any>(null);
  
  // Custom Category State
  const [availableCategories, setAvailableCategories] = useState<string[]>([]);
  const [phases, setPhases] = useState<string[]>(defaultPhases);
  const [dynamicEntityBlocks, setDynamicEntityBlocks] = useState<Record<string, string[]>>({
    'All Groups (Universal)': ['All Blocks (Entire Society)'],
    'Sushant Lok 2': ['C', 'D', 'E', 'F', 'G'],
    'Sushant Lok 3': ['A', 'B', 'B1', 'C', 'D', 'E', 'F', 'G', 'H']
  });
  
  
  // Group Management State
  const [showManageGroupsModal, setShowManageGroupsModal] = useState(false);
  const [editingPhaseName, setEditingPhaseName] = useState<string | null>(null);
  const [newPhaseName, setNewPhaseName] = useState('');

  useEffect(() => {
    // Fetch categories for the dropdown when tab changes or when editing a user
    if (activeTab === 'create' || editingUser) {
      axios.get(`${API_URL}/categories`)
        .then(res => {
          if (res.data && res.data.length > 0) {
            setAvailableCategories(res.data.map((c: any) => c.title));
            if (categories.length === 0) {
              setCategories([res.data[0].title]);
            }
          } else {
            setAvailableCategories(defaultCategories);
            if (categories.length === 0) setCategories([defaultCategories[0]]);
          }
        })
        .catch(err => {
          console.error('Error fetching categories for dropdown:', err);
          setAvailableCategories(defaultCategories);
          if (categories.length === 0) setCategories([defaultCategories[0]]);
        });
    }
  }, [activeTab, editingUser]);

  const fetchDynamicPhases = () => {
    const token = localStorage.getItem('adminToken');
    axios.get(`${API_URL}/users/phases`, { headers: { 'x-auth-token': token } })
      .then(res => {
        if (res.data && Array.isArray(res.data)) {
          const newPhases = [...new Set([...defaultPhases, ...res.data])];
          setPhases(newPhases);
          
          // Build dynamic entityBlocks mapping
          const newEntityBlocks: Record<string, string[]> = {
            'All Groups (Universal)': ['All Blocks (Entire Society)'],
            'Sushant Lok 2': ['C', 'D', 'E', 'F', 'G'],
            'Sushant Lok 3': ['A', 'B', 'B1', 'C', 'D', 'E', 'F', 'G', 'H']
          };
          res.data.forEach((p: string) => {
            if (!newEntityBlocks[p]) {
              newEntityBlocks[p] = [];
            }
          });
          setDynamicEntityBlocks(newEntityBlocks);
        }
      })
      .catch(err => {
        console.error('Error fetching phases:', err);
      });
  };

  useEffect(() => {
    // Fetch categories for the dropdown when tab changes
    if (activeTab === 'create') {
      axios.get(`${API_URL}/categories`)
        .then(res => {
          if (res.data && res.data.length > 0) {
            setAvailableCategories(res.data.map((c: any) => c.title));
            if (categories.length === 0) {
              setCategories([res.data[0].title]);
            }
          } else {
            setAvailableCategories(defaultCategories);
            if (categories.length === 0) setCategories([defaultCategories[0]]);
          }
        })
        .catch(err => {
          console.error('Error fetching categories for dropdown:', err);
          setAvailableCategories(defaultCategories);
          if (categories.length === 0) setCategories([defaultCategories[0]]);
        });
    }

    // Fetch dynamic phases
    fetchDynamicPhases();
  }, [activeTab]);


  useEffect(() => {
    if (activeTab === 'list') {
      fetchStaff(page, filterPhase, debouncedSearch, filterStatus);
    }
  }, [activeTab, page, filterPhase, debouncedSearch, filterStatus]);

  useEffect(() => {
    const socketURL = API_URL.replace('/api', '');
    const socket = io(socketURL);

    socket.on('user_created', (newUser: any) => {
      if (newUser.role === 'Staff') {
        fetchStaff(page, filterPhase, debouncedSearch, filterStatus, false);
      }
    });

    socket.on('user_deleted', () => {
      fetchStaff(page, filterPhase, debouncedSearch, filterStatus, false);
    });

    socket.on('user_updated', () => {
      fetchStaff(page, filterPhase, debouncedSearch, filterStatus, false);
    });

    return () => {
      socket.disconnect();
    };
  }, [page, filterPhase, debouncedSearch, filterStatus]);

  const fetchStaff = async (
    currentPage = page, 
    phase = filterPhase,
    searchFilter = debouncedSearch,
    statusFilter = filterStatus,
    showLoading = true
  ) => {
    try {
      const cacheKey = `staff_cache_${currentPage}_${phase}_${searchFilter}_${statusFilter}`;
      const cachedStr = sessionStorage.getItem(cacheKey);

      if (cachedStr) {
        try {
          const cached = JSON.parse(cachedStr);
          if (cached && cached.staff) {
            setStaff(cached.staff);
            setTotalCount(cached.total || 0);
            setTotalPages(Math.ceil((cached.total || 0) / 10) || 1);
            showLoading = false;
            setLoading(false);
          }
        } catch(e) {}
      }

      if (showLoading) setLoading(true);
      const token = localStorage.getItem('adminToken');
      
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: '10',
        phase
      });
      if (searchFilter.trim()) params.append('search', searchFilter.trim());
      if (statusFilter !== 'ALL') params.append('status', statusFilter);

      const res = await axios.get(`${API_URL}/users/staff?${params.toString()}`, {
        headers: { 'x-auth-token': token }
      });

      sessionStorage.setItem(cacheKey, JSON.stringify(res.data));

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
      setLoading(false);
    }
  };

  const fetchAllData = async () => {
    const token = localStorage.getItem('adminToken');
    const params = new URLSearchParams({ phase: filterPhase });
    if (debouncedSearch.trim()) params.append('search', debouncedSearch.trim());
    if (filterStatus !== 'ALL') params.append('status', filterStatus);
    params.append('all', 'true');

    const res = await axios.get(`${API_URL}/users/staff?${params.toString()}`, {
      headers: { 'x-auth-token': token }
    });
    return Array.isArray(res.data) ? res.data : (res.data.staff || []);
  };

  const handleCreateStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    if (categories.length === 0) {
      toast.error('Please select at least one category');
      return;
    }
    if (assignedLocations.length === 0) {
      toast.error('Please assign at least one society/location');
      return;
    }
    
    setIsCreating(true);
    const loadingToast = toast.loading('Creating account...');

    try {
      const token = localStorage.getItem('adminToken');
      const hasUniversal = assignedLocations.some(l => l.phase === 'All Groups (Universal)' || l.phase === 'Universal');
      
      const locSummary = hasUniversal 
        ? 'Universal: All Groups & Blocks' 
        : assignedLocations.map(l => {
            const blk = !l.blocks || l.blocks.length === 0 || l.blocks.includes('ALL') ? 'All Blocks' : `Block ${l.blocks.join(', ')}`;
            return `${l.phase} (${blk})`;
          }).join(' | ');

      const defaultStaffName = locSummary;
      const finalName = staffPersonalName ? `${staffPersonalName} (${defaultStaffName})` : defaultStaffName;
      
      const cleanLocations = assignedLocations.map(l => ({
        phase: (l.phase === 'All Groups (Universal)' || l.phase === 'Universal') ? 'Universal' : l.phase,
        blocks: (!l.blocks || l.blocks.length === 0 || l.blocks.includes('ALL') || l.phase.includes('Universal')) ? ['ALL'] : l.blocks
      }));

      const staffPhase = hasUniversal ? 'Universal' : locSummary;

      await axios.post(`${API_URL}/users/staff`, {
        name: finalName,
        phone_number: phoneNumber,
        assigned_categories: categories,
        assigned_locations: cleanLocations,
        phase: staffPhase
      }, {
        headers: { 'x-auth-token': token }
      });
      
      toast.success(hasUniversal ? 'Universal staff assigned successfully for all groups!' : 'Staff account assigned successfully!', { id: loadingToast });
      
      // Reset form
      setStaffPersonalName('');
      setPhoneNumber('');
      setAssignedLocations([{ phase: 'Sushant Lok 2', blocks: ['C'] }]);
      
      // Auto switch back to list
      setActiveTab('list');
      fetchStaff(1, filterPhase, debouncedSearch, filterStatus, false);
    } catch (err: any) {
      toast.error(err.response?.data?.msg || err.response?.data?.message || 'Failed to assign staff', { id: loadingToast });
    } finally {
      setIsCreating(false);
    }
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsUpdating(true);
    const loadingToast = toast.loading('Updating staff...');

    try {
      const token = localStorage.getItem('adminToken');

      const cleanLocations = (editLocations || []).map(l => ({
        phase: (l.phase === 'All Groups (Universal)' || l.phase === 'Universal') ? 'Universal' : l.phase,
        blocks: (!l.blocks || l.blocks.length === 0 || l.blocks.includes('ALL') || l.phase.includes('Universal')) ? ['ALL'] : l.blocks
      }));

      const hasUniversal = cleanLocations.some(l => l.phase === 'Universal');
      const locSummary = hasUniversal 
        ? 'Universal: All Groups & Blocks' 
        : cleanLocations.map(l => {
            const blk = !l.blocks || l.blocks.length === 0 || l.blocks.includes('ALL') ? 'All Blocks' : `Block ${l.blocks.join(', ')}`;
            return `${l.phase} (${blk})`;
          }).join(' | ');

      await axios.put(`${API_URL}/users/${editingUser._id}`, {
        name: editingUser.name,
        phone_number: editingUser.phone_number,
        assigned_categories: editingUser.assigned_categories || (editingUser.assigned_category ? [editingUser.assigned_category] : []),
        assigned_locations: cleanLocations,
        phase: hasUniversal ? 'Universal' : (locSummary || editingUser.phase)
      }, {
        headers: { 'x-auth-token': token }
      });
      
      toast.success('Staff updated successfully!', { id: loadingToast });
      setEditingUser(null);
      fetchStaff(page, filterPhase, debouncedSearch, filterStatus, false);
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to update staff', { id: loadingToast });
    } finally {
      setIsUpdating(false);
    }
  };

  const isFiltered = search !== '' || filterPhase !== 'All';

  const resetFilters = () => {
    setSearch('');
    setDebouncedSearch('');
    setFilterPhase('All');
    setPage(1);
  };

  const handleRenameGroup = async (oldName: string, newName: string) => {
    if (!newName.trim() || oldName === newName) {
      setEditingPhaseName(null);
      return;
    }
    const token = localStorage.getItem('adminToken');
    const loadId = toast.loading('Renaming group...');
    try {
      await axios.put(`${API_URL}/users/phases/${encodeURIComponent(oldName)}`, { newName }, {
        headers: { 'x-auth-token': token }
      });
      toast.success('Group renamed successfully!', { id: loadId });
      setEditingPhaseName(null);
      fetchDynamicPhases();
      fetchStaff(page, filterPhase, debouncedSearch, filterStatus, false);
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to rename group', { id: loadId });
    }
  };

  const handleDeleteGroup = (phaseName: string) => {
    toast((t) => (
      <div>
        <p style={{ fontWeight: 600, marginBottom: 8, color: 'var(--text-main)' }}>Delete group "{phaseName}"?</p>
        <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 16 }}>All Staff and Residents in this group will be moved to "Unassigned". This cannot be undone.</p>
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
              const loadId = toast.loading('Deleting group...');
              try {
                const token = localStorage.getItem('adminToken');
                await axios.delete(`${API_URL}/users/phases/${encodeURIComponent(phaseName)}`, {
                  headers: { 'x-auth-token': token }
                });
                toast.success('Group deleted successfully!', { id: loadId });
                fetchDynamicPhases();
                fetchStaff(page, filterPhase, debouncedSearch, filterStatus, false);
              } catch (err: any) {
                toast.error(err.response?.data?.message || 'Failed to delete group', { id: loadId });
              }
            }}
            style={{ padding: '6px 16px', borderRadius: 8, border: 'none', background: 'var(--danger)', color: 'white', cursor: 'pointer', fontWeight: 500 }}
          >
            Delete Group
          </button>
        </div>
      </div>
    ), { duration: Infinity, style: { minWidth: '300px' } });
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
                fetchStaff(page, filterPhase, debouncedSearch, filterStatus, false);
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
        {!isSubAdmin && (
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
        )}
      </div>

      {/* Content Area */}
      {activeTab === 'list' && (
        <div className="glass table-container">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <h2 className="card-title">Staff Members</h2>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <ExportButtons 
                data={staff}
                fetchAllData={fetchAllData}
                columns={[
                  { header: 'Name', key: 'name' },
                  { header: 'Phone Number', key: 'phone_number' },
                  { header: 'Categories', key: (r: any) => Array.isArray(r.assigned_categories) && r.assigned_categories.length > 0 ? r.assigned_categories.join(', ') : r.assigned_category || 'N/A' },
                  { header: 'Assigned Locations', key: (r: any) => Array.isArray(r.assigned_locations) && r.assigned_locations.length > 0 ? r.assigned_locations.map((l: any) => `${l.phase} (${l.blocks && l.blocks.length > 0 ? (l.blocks.includes('ALL') ? 'All Blocks' : l.blocks.join(', ')) : 'All Blocks'})`).join(' | ') : r.phase || 'N/A' },
                  { header: 'Created At', key: (r: any) => new Date(r.createdAt).toLocaleString() }
                ]}
                filename="Staff_Members"
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
                <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6 }}>
                  <span>Phase / Location</span>
                  {!isSubAdmin && (
                    <button 
                      onClick={() => setShowManageGroupsModal(true)}
                      style={{ background: 'none', border: 'none', color: 'var(--primary)', cursor: 'pointer', fontSize: 12, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}
                    >
                      <Wrench size={12} /> Manage Groups
                    </button>
                  )}
                </label>
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
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6 }}>
                  Status
                </label>
                <select 
                  value={filterStatus} 
                  onChange={(e) => { setFilterStatus(e.target.value); setPage(1); }}
                  style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid var(--border-color)', background: '#FFFFFF', fontSize: 13, color: 'var(--text-main)', fontWeight: 500, outline: 'none' }}
                >
                  <option value="ALL">All Status</option>
                  <option value="Active">Active</option>
                  <option value="Pending">Pending</option>
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
                <th>Status</th>
                {!isSubAdmin && <th style={{ width: 100 }}>Actions</th>}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 5 }).map((_, idx) => (
                  <tr key={`skeleton-${idx}`}>
                    <td><div className="skeleton skeleton-row" style={{ width: '80%' }}></div></td>
                    <td><div className="skeleton skeleton-row" style={{ width: '90%' }}></div></td>
                    <td><div className="skeleton skeleton-row" style={{ width: 80, borderRadius: 20 }}></div></td>
                    <td><div className="skeleton skeleton-row" style={{ width: 60, borderRadius: 12 }}></div></td>
                    {!isSubAdmin && <td><div className="skeleton skeleton-row" style={{ width: 30, borderRadius: 8 }}></div></td>}
                  </tr>
                ))
              ) : staff.length === 0 ? (
                  <tr>
                    <td colSpan={5} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '40px 0' }}>
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
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <span style={{ fontSize: '15px' }}>{displayName}</span>
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
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                              {Array.isArray(member.assigned_locations) && member.assigned_locations.length > 0 ? (
                                member.assigned_locations.map((loc: any, idx: number) => {
                                  const isAll = !loc.blocks || loc.blocks.length === 0 || loc.blocks.includes('ALL') || loc.blocks.includes('All Blocks');
                                  const blkText = isAll ? 'All Blocks' : loc.blocks.map((b: string) => `Block ${b}`).join(', ');
                                  return (
                                    <span key={idx} style={{
                                      fontSize: '11px',
                                      fontWeight: 600,
                                      background: '#EFF6FF',
                                      color: '#1D4ED8',
                                      border: '1px solid #BFDBFE',
                                      padding: '2px 8px',
                                      borderRadius: '6px',
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      gap: '4px'
                                    }}>
                                      📍 {loc.phase} ({blkText})
                                    </span>
                                  );
                                })
                              ) : (
                                member.phase && (
                                  <span style={{
                                    fontSize: '11px',
                                    fontWeight: 500,
                                    background: '#F1F5F9',
                                    color: '#475569',
                                    padding: '2px 8px',
                                    borderRadius: '6px'
                                  }}>
                                    📍 {member.phase}
                                  </span>
                                )
                              )}
                            </div>
                          </div>
                        </td>
                        <td style={{ color: 'var(--text-muted)' }}>{member.phone_number}</td>
                        <td>
                          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                            {(member.assigned_categories && member.assigned_categories.length > 0 ? member.assigned_categories : [member.assigned_category]).map((cat: string) => (
                              <span key={cat} style={{ 
                                background: 'rgba(255, 99, 71, 0.1)', 
                                color: 'var(--primary)', 
                                padding: '6px 12px', 
                                borderRadius: '20px', 
                                fontSize: '12px',
                                fontWeight: 600
                              }}>
                                {cat}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td>
                          <span style={{
                            background: member.has_logged_in ? '#DCFCE7' : '#FEF3C7',
                            color: member.has_logged_in ? '#166534' : '#92400E',
                            padding: '4px 10px', borderRadius: 12, fontSize: 11, fontWeight: 600,
                            display: 'inline-flex',
                            alignItems: 'center',
                            whiteSpace: 'nowrap'
                          }}>
                            {member.has_logged_in ? 'Active' : 'Pending'}
                          </span>
                        </td>
                        {!isSubAdmin && (
                          <td style={{ textAlign: 'center' }}>
                            <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                              <button 
                                onClick={() => {
                                  setEditingUser({ ...member, password: '' });
                                  let initialLocs: LocationAssignment[] = [];
                                  if (Array.isArray(member.assigned_locations) && member.assigned_locations.length > 0) {
                                    initialLocs = member.assigned_locations.map((l: any) => ({
                                      phase: l.phase === 'Universal' ? 'All Groups (Universal)' : l.phase,
                                      blocks: Array.isArray(l.blocks) && l.blocks.length > 0 ? l.blocks : ['ALL']
                                    }));
                                  } else if (member.phase) {
                                    if (member.phase === 'Universal' || member.phase === 'All') {
                                      initialLocs = [{ phase: 'All Groups (Universal)', blocks: ['ALL'] }];
                                    } else if (member.phase.includes(' - ')) {
                                      const parts = member.phase.split(' - ');
                                      initialLocs = [{ phase: parts[0].trim(), blocks: [parts[1].trim()] }];
                                    } else {
                                      initialLocs = [{ phase: member.phase, blocks: member.block ? [member.block] : ['ALL'] }];
                                    }
                                  } else {
                                    initialLocs = [{ phase: 'Sushant Lok 2', blocks: ['C'] }];
                                  }
                                  setEditLocations(initialLocs);
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
                        )}
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
                Assign Staff to Societies & Blocks
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
              <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <span style={{ fontWeight: 600 }}>Assigned Societies & Blocks</span>
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Can assign to multiple societies</span>
              </label>
              <LocationAssignmentSection
                locations={assignedLocations}
                onChange={setAssignedLocations}
                dynamicEntityBlocks={dynamicEntityBlocks}
                phases={phases}
              />
            </div>
            
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
              <label style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Assigned Categories</span>
                <span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 'normal' }}>Select multiple</span>
              </label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '8px' }}>
                {availableCategories.length === 0 && <span style={{ color: 'var(--text-muted)' }}>No categories available</span>}
                {availableCategories.map(cat => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => {
                      if (categories.includes(cat)) {
                        setCategories(categories.filter(c => c !== cat));
                      } else {
                        setCategories([...categories, cat]);
                      }
                    }}
                    style={{
                      padding: '8px 16px',
                      borderRadius: '20px',
                      border: categories.includes(cat) ? '1px solid var(--primary)' : '1px solid var(--border-color)',
                      background: categories.includes(cat) ? 'rgba(59, 130, 246, 0.1)' : 'white',
                      color: categories.includes(cat) ? 'var(--primary)' : 'var(--text-main)',
                      fontSize: '14px',
                      fontWeight: categories.includes(cat) ? 600 : 500,
                      cursor: 'pointer',
                      transition: 'all 0.2s'
                    }}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>

            <button type="submit" className="btn-primary" disabled={isCreating} style={{ marginTop: '16px', height: '52px' }}>
              {isCreating ? 'Assigning Staff...' : 'Assign Staff'}
            </button>
          </form>
        </div>
        </div>
      )}

      {/* Edit Modal */}
      {editingUser && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(15, 23, 42, 0.75)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}>
          <div className="card" style={{ width: '100%', maxWidth: 620, margin: 20, padding: 0, borderRadius: 16, maxHeight: '90vh', display: 'flex', flexDirection: 'column', background: '#ffffff', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)' }}>
            <div style={{ padding: '24px 24px 16px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 className="card-title" style={{ margin: 0, fontSize: 20 }}>Edit Staff Member</h2>
              <button type="button" onClick={() => setEditingUser(null)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 4, borderRadius: 8 }} title="Close">
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleEditSubmit} style={{ padding: '24px', overflowY: 'auto' }}>
              <div className="form-group">
                <label className="form-label">Name</label>
                <input 
                  type="text" 
                  className="form-input"
                  value={editingUser.name} 
                  onChange={(e) => setEditingUser({...editingUser, name: e.target.value})} 
                  required
                />
              </div>
              
              <div className="form-group">
                <label className="form-label">Phone Number</label>
                <input 
                  type="text" 
                  className="form-input"
                  value={editingUser.phone_number} 
                  onChange={(e) => setEditingUser({...editingUser, phone_number: e.target.value})} 
                  required
                />
              </div>

              {/* Assigned Locations in Edit Modal */}
              <div className="form-group">
                <label className="form-label" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <span style={{ fontWeight: 600 }}>Assigned Societies & Blocks</span>
                  <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Can assign to multiple societies</span>
                </label>
                <LocationAssignmentSection
                  locations={editLocations}
                  onChange={setEditLocations}
                  dynamicEntityBlocks={dynamicEntityBlocks}
                  phases={phases}
                />
              </div>

              <div className="form-group">
                <label className="form-label" style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Categories</span>
                  <span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 'normal' }}>Select multiple</span>
                </label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '8px' }}>
                  {availableCategories.map(cat => {
                    const currentCats = editingUser.assigned_categories && editingUser.assigned_categories.length > 0 
                      ? editingUser.assigned_categories 
                      : (editingUser.assigned_category ? [editingUser.assigned_category] : []);
                    const isSelected = currentCats.includes(cat);
                    return (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => {
                          if (isSelected) {
                            setEditingUser({...editingUser, assigned_categories: currentCats.filter((c: string) => c !== cat)});
                          } else {
                            setEditingUser({...editingUser, assigned_categories: [...currentCats, cat]});
                          }
                        }}
                        style={{
                          padding: '6px 12px',
                          borderRadius: '20px',
                          border: isSelected ? '1px solid var(--primary)' : '1px solid var(--border-color)',
                          background: isSelected ? 'rgba(59, 130, 246, 0.1)' : 'white',
                          color: isSelected ? 'var(--primary)' : 'var(--text-main)',
                          fontSize: '13px',
                          fontWeight: 500,
                          cursor: 'pointer',
                          transition: 'all 0.2s'
                        }}
                      >
                        {cat}
                      </button>
                    );
                  })}
                </div>
              </div>
              
              <div style={{ display: 'flex', gap: 12, marginTop: 32 }}>
                <button type="button" onClick={() => setEditingUser(null)} className="btn btn-outline" style={{ flex: 1 }} disabled={isUpdating}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" style={{ flex: 1 }} disabled={isUpdating}>
                  {isUpdating ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Manage Groups Modal */}
      {showManageGroupsModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '500px', width: '90%', padding: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h2 style={{ margin: 0, fontSize: 20, color: 'var(--text-main)' }}>Manage Custom Groups</h2>
              <button onClick={() => setShowManageGroupsModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
                <X size={24} />
              </button>
            </div>
            
            <p style={{ color: 'var(--text-muted)', fontSize: 14, marginBottom: 20 }}>
              Rename or delete your custom groups. Note: Default groups cannot be modified. Deleting a group will move its members to "Unassigned".
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, maxHeight: '400px', overflowY: 'auto' }}>
              {phases.filter(p => !defaultPhases.includes(p) && p !== 'Unassigned').length === 0 ? (
                <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '20px' }}>
                  No custom groups found.
                </div>
              ) : (
                phases.filter(p => !defaultPhases.includes(p) && p !== 'Unassigned').map(phase => (
                  <div key={phase} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', background: '#F8FAFC', border: '1px solid var(--border-color)', borderRadius: '8px' }}>
                    
                    {editingPhaseName === phase ? (
                      <input 
                        type="text" 
                        value={newPhaseName} 
                        onChange={(e) => setNewPhaseName(e.target.value)}
                        autoFocus
                        style={{ padding: '6px 12px', borderRadius: '4px', border: '1px solid var(--primary)', outline: 'none', flex: 1, marginRight: '12px' }}
                      />
                    ) : (
                      <span style={{ fontWeight: 500, color: 'var(--text-main)', flex: 1 }}>{phase}</span>
                    )}

                    <div style={{ display: 'flex', gap: '8px' }}>
                      {editingPhaseName === phase ? (
                        <>
                          <button onClick={() => handleRenameGroup(phase, newPhaseName)} style={{ background: 'var(--primary)', color: 'white', border: 'none', padding: '6px 12px', borderRadius: '6px', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>Save</button>
                          <button onClick={() => setEditingPhaseName(null)} style={{ background: '#E2E8F0', color: 'var(--text-main)', border: 'none', padding: '6px 12px', borderRadius: '6px', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>Cancel</button>
                        </>
                      ) : (
                        <>
                          <button 
                            onClick={() => { setEditingPhaseName(phase); setNewPhaseName(phase); }}
                            style={{ background: 'rgba(59,130,246,0.1)', color: 'var(--primary)', border: 'none', padding: '6px', borderRadius: '6px', cursor: 'pointer' }}
                            title="Rename Group"
                          >
                            <Edit2 size={16} />
                          </button>
                          <button 
                            onClick={() => handleDeleteGroup(phase)}
                            style={{ background: 'rgba(239,68,68,0.1)', color: 'var(--danger)', border: 'none', padding: '6px', borderRadius: '6px', cursor: 'pointer' }}
                            title="Delete Group"
                          >
                            <Trash2 size={16} />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
