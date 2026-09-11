import { useState, useEffect } from 'react';
import axios from 'axios';
import { UserPlus, Users, ListPlus, Trash2, Wrench } from 'lucide-react';
import toast from 'react-hot-toast';
import Categories from './Categories';

const API_URL = 'https://anytime-help.onrender.com/api';

const defaultCategories = [
  'Electricity', 'Garbage', 'Sweeping', 'Sewage cleaning', 
  'Rainwater drainage', 'Tree cutting', 'Street light', 'Water service'
];

export default function Staff() {
  const [activeTab, setActiveTab] = useState<'list' | 'create' | 'categories'>('list');
  const [staff, setStaff] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterPhase, setFilterPhase] = useState('All');

  // Form State
  const [selectedEntity, setSelectedEntity] = useState('Sushant Lok 2 Option 1');
  const [selectedBlock, setSelectedBlock] = useState('C, D, E');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [category, setCategory] = useState('Electricity');
  const [isCreating, setIsCreating] = useState(false);
  
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
    'Sushant Lok 2 Option 1': ['C, D, E'],
    'Sushant Lok 2 Option 2': ['F, G'],
    'Sushant Lok 3': ['A, B, C, D, E, F, G, H']
  };

  useEffect(() => {
    // Whenever entity changes, reset block to the single grouped option
    if (entityBlocks[selectedEntity]) {
      setSelectedBlock(entityBlocks[selectedEntity][0]);
    }
  }, [selectedEntity]);

  useEffect(() => {
    if (activeTab === 'list') {
      fetchStaff();
    }
  }, [activeTab]);

  const fetchStaff = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('adminToken');
      const res = await axios.get(`${API_URL}/users/staff`, {
        headers: { 'x-auth-token': token }
      });
      setStaff(res.data);
    } catch (err) {
      console.error(err);
      toast.error('Failed to load staff members');
    } finally {
      setLoading(false);
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
      const staffName = `${selectedEntity}: Block ${selectedBlock}`;
      
      await axios.post(`${API_URL}/users/staff`, {
        name: staffName,
        phone_number: phoneNumber,
        assigned_category: category,
        phase: selectedEntity
      }, {
        headers: { 'x-auth-token': token }
      });
      
      toast.success('Staff account assigned successfully!', { id: loadingToast });
      
      // Reset form
      setPhoneNumber('');
      
      // Auto switch back to list
      setActiveTab('list');
    } catch (err: any) {
      toast.error(err.response?.data?.msg || err.response?.data?.message || 'Failed to assign staff', { id: loadingToast });
    } finally {
      setIsCreating(false);
    }
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
                fetchStaff();
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

  // Show staff based on selected filter
  const displayedStaff = filterPhase === 'All' ? staff : staff.filter(s => s.phase === filterPhase || s.name.includes(filterPhase));

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
        <button 
          onClick={() => { setActiveTab('categories'); }}
          style={{ 
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '10px 20px', 
            background: activeTab === 'categories' ? 'var(--primary)' : 'white', 
            color: activeTab === 'categories' ? 'white' : 'var(--text-muted)',
            border: activeTab === 'categories' ? 'none' : '1px solid var(--border-color)',
            borderRadius: 12, cursor: 'pointer', fontWeight: 600, transition: 'all 0.2s',
            marginLeft: 'auto'
          }}
        >
          <ListPlus size={18} /> <span>Manage Categories</span>
        </button>
      </div>

      {/* Content Area */}
      {activeTab === 'list' && (
        <div className="glass table-container">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <h2 style={{ fontSize: 18, fontWeight: 600 }}>Staff List</h2>
            <select 
              value={filterPhase} 
              onChange={(e) => setFilterPhase(e.target.value)}
              style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--border-color)', outline: 'none' }}
            >
              <option value="All">All Groups</option>
              <option value="Sushant Lok 2 Option 1">Sushant Lok 2 Option 1</option>
              <option value="Sushant Lok 2 Option 2">Sushant Lok 2 Option 2</option>
              <option value="Sushant Lok 3">Sushant Lok 3</option>
            </select>
          </div>
          <table>
            <thead>
              <tr>
                <th>Group / Block / Name</th>
                <th>Phone Number</th>
                <th>Category</th>
                <th style={{ width: 80 }}>Actions</th>
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
              ) : displayedStaff.length === 0 ? (
                  <tr>
                    <td colSpan={4} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '40px 0' }}>
                      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '16px' }}>
                        <Users size={40} color="var(--border-color)" />
                      </div>
                      No staff members assigned yet.
                    </td>
                  </tr>
                ) : (
                  displayedStaff.map(member => {
                    const displayName = member.name || 'Unnamed Staff';
                    return (
                      <tr key={member._id}>
                        <td style={{ fontWeight: 600 }}>{displayName}</td>
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
                          <button 
                            onClick={() => handleDelete(member._id)}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 8, borderRadius: 8 }}
                            onMouseOver={(e) => e.currentTarget.style.background = 'rgba(239, 68, 68, 0.1)'}
                            onMouseOut={(e) => e.currentTarget.style.background = 'none'}
                          >
                            <Trash2 size={20} color="var(--danger)" />
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
            </tbody>
          </table>
        </div>
      )}
      
      {activeTab === 'create' && (
        <div style={{ display: 'flex', justifyContent: 'center', marginTop: '40px' }}>
          <div className="glass" style={{ padding: '40px', width: '100%', maxWidth: '600px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '32px' }}>
              <div style={{ background: 'rgba(255, 99, 71, 0.1)', padding: 12, borderRadius: 12 }}>
                <UserPlus size={28} color="var(--primary)" />
              </div>
              <h2 style={{ fontSize: 24, fontWeight: 700 }}>Assign Staff to Group</h2>
            </div>

            <form onSubmit={handleCreateStaff}>
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
                    <option key={entity} value={entity}>{entity}</option>
                  ))}
                </select>
            </div>

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
              {isCreating ? 'Assigning Staff...' : 'Assign Staff'}
            </button>
          </form>
        </div>
        </div>
      )}

      {activeTab === 'categories' && (
        <Categories />
      )}
    </div>
  );
}
