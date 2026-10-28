import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { toast } from 'react-hot-toast';
import { 
  Plus, Edit2, Trash2, Search, X, Eye, 
  Send, Users, RefreshCw, Check, ArrowLeft,
  Megaphone, Zap, Shield, Droplets, Home,
  MessageCircle, Building2, Layers, CheckCircle2
} from 'lucide-react';
import { io, Socket } from 'socket.io-client';
import '../index.css';
import './Communities.css';

const getInitialApiUrl = () => {
  return import.meta.env.VITE_API_URL || (window.location.hostname === 'localhost' ? 'http://localhost:5000/api' : 'https://anytime-help.onrender.com/api');
};

let API_URL = getInitialApiUrl();
let SOCKET_URL = API_URL.replace('/api', '');

interface UserItem {
  _id: string;
  name: string;
  phone_number: string;
  designation?: string;
  member_id?: string;
  role: string;
}

interface CommunitySectionItem {
  _id: string;
  community_id: string;
  name: string;
  description: string;
  icon: string;
  section_type: 'announcement' | 'discussion';
  assigned_members: UserItem[];
  followers: string[];
  followers_count?: number;
  assigned_count?: number;
  last_message?: {
    text: string;
    sender_name: string;
    timestamp: string;
  };
  createdAt: string;
  is_active: boolean;
}

interface CommunityItem {
  _id: string;
  name: string;
  description: string;
  icon: string;
  color: string;
  target_roles: string[];
  sections_count?: number;
  total_followers?: number;
  sections?: CommunitySectionItem[];
  createdAt: string;
  is_active: boolean;
}

interface MessageItem {
  _id: string;
  community_id: string;
  section_id: string;
  sender: any;
  sender_name: string;
  sender_role: string;
  sender_designation?: string;
  text: string;
  attachments?: any[];
  createdAt: string;
}

// Avatar Initials & Color Helpers
const AVATAR_PALETTES = [
  { bg: '#3b82f6', text: '#ffffff' }, // Blue
  { bg: '#8b5cf6', text: '#ffffff' }, // Purple
  { bg: '#ec4899', text: '#ffffff' }, // Pink
  { bg: '#10b981', text: '#ffffff' }, // Emerald
  { bg: '#f59e0b', text: '#ffffff' }, // Amber
  { bg: '#06b6d4', text: '#ffffff' }, // Cyan
  { bg: '#6366f1', text: '#ffffff' }, // Indigo
  { bg: '#f97316', text: '#ffffff' }, // Orange
  { bg: '#14b8a6', text: '#ffffff' }, // Teal
  { bg: '#64748b', text: '#ffffff' }, // Slate
];

const getSenderInitials = (name?: string, fallback = 'U'): string => {
  if (!name || typeof name !== 'string') return fallback;
  const trimmed = name.trim();
  if (!trimmed) return fallback;

  const clean = trimmed.replace(/\(.*?\)/g, '').replace(/\[.*?\]/g, '').trim();
  const parts = clean.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return fallback;

  if (parts.length === 1) {
    const word = parts[0];
    if (word.includes('-')) {
      const sub = word.split('-').filter(Boolean);
      if (sub[0].length >= 2 && /^[A-Za-z]+$/.test(sub[0])) {
        return sub[0].slice(0, 2).toUpperCase();
      }
      return word.slice(0, 2).toUpperCase();
    }
    return word.charAt(0).toUpperCase();
  }

  const first = parts[0].charAt(0);
  const last = parts[parts.length - 1].charAt(0);
  return (first + last).toUpperCase();
};

const getAvatarColor = (name?: string, isAdmin = false) => {
  if (isAdmin) {
    return { bg: '#1e293b', text: '#f59e0b' }; // Dark charcoal with amber letter (matching reference style)
  }
  if (!name) return { bg: '#64748b', text: '#ffffff' };
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const idx = Math.abs(hash) % AVATAR_PALETTES.length;
  return AVATAR_PALETTES[idx];
};

export default function Communities() {
  const [communities, setCommunities] = useState<CommunityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [allUsers, setAllUsers] = useState<UserItem[]>([]);

  // Navigation: currently viewed community (null = list view)
  const [selectedCommunity, setSelectedCommunity] = useState<CommunityItem | null>(null);
  const [sections, setSections] = useState<CommunitySectionItem[]>([]);
  const [loadingSections, setLoadingSections] = useState(false);

  // Modals
  const [isCommModalOpen, setIsCommModalOpen] = useState(false);
  const [editingComm, setEditingComm] = useState<CommunityItem | null>(null);
  const [isSavingComm, setIsSavingComm] = useState(false);

  const [isSectionModalOpen, setIsSectionModalOpen] = useState(false);
  const [editingSection, setEditingSection] = useState<CommunitySectionItem | null>(null);
  const [isSavingSection, setIsSavingSection] = useState(false);

  // Assigned Members Modal for a Section
  const [assigningSection, setAssigningSection] = useState<CommunitySectionItem | null>(null);
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([]);
  const [memberSearch, setMemberSearch] = useState('');

  // Followers view Modal for a Section
  const [viewFollowersSection, setViewFollowersSection] = useState<CommunitySectionItem | null>(null);

  // Messenger / Live Channel State
  const [activeSection, setActiveSection] = useState<CommunitySectionItem | null>(null);
  const [messages, setMessages] = useState<MessageItem[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [msgInput, setMsgInput] = useState('');

  // Form states - Community
  const [commName, setCommName] = useState('');
  const [commDesc, setCommDesc] = useState('');
  const [commIcon, setCommIcon] = useState('building');
  const [commColor, setCommColor] = useState('#2563EB');
  const [commRoles, setCommRoles] = useState<string[]>(['All']);

  // Form states - Section
  const [secName, setSecName] = useState('');
  const [secDesc, setSecDesc] = useState('');
  const [secType, setSecType] = useState<'announcement' | 'discussion'>('announcement');
  const [secIcon, setSecIcon] = useState('megaphone');

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const socketRef = useRef<Socket | null>(null);
  const activeSectionRef = useRef<CommunitySectionItem | null>(null);

  // Live typing state
  const [communityTypingUsers, setCommunityTypingUsers] = useState<string[]>([]);
  const isTypingRef = useRef(false);
  const typingTimeoutRef = useRef<any>(null);

  const availableRoles = ['All', 'Resident', 'Member', 'Staff', 'PaidStaff'];

  const getHeaders = () => {
    const token = localStorage.getItem('adminToken');
    return { headers: { 'x-auth-token': token } };
  };

  useEffect(() => {
    fetchCommunities();
    fetchUsers();

    const socket = io(SOCKET_URL, { 
      transports: ['websocket', 'polling'],
      autoConnect: true,
      reconnection: true
    });
    socketRef.current = socket;

    socket.on('community_created', () => fetchCommunities(false));
    socket.on('community_updated', () => fetchCommunities(false));
    socket.on('community_deleted', () => fetchCommunities(false));

    socket.on('community_section_created', () => {
      if (selectedCommunity) fetchSections(selectedCommunity._id, false);
      fetchCommunities(false);
    });
    socket.on('community_section_updated', () => {
      if (selectedCommunity) fetchSections(selectedCommunity._id, false);
      fetchCommunities(false);
    });
    socket.on('community_section_deleted', () => {
      if (selectedCommunity) fetchSections(selectedCommunity._id, false);
      fetchCommunities(false);
    });

    socket.on('new_community_message', (newMsg: MessageItem) => {
      const currentActiveId = activeSectionRef.current?._id;
      if (currentActiveId && newMsg.section_id === currentActiveId) {
        setMessages(prev => {
          if (prev.some(m => m._id === newMsg._id)) return prev;
          const optIdx = prev.findIndex(m => m._id.startsWith('temp_') && m.text === newMsg.text);
          if (optIdx !== -1) {
            const copy = [...prev];
            copy[optIdx] = newMsg;
            return copy;
          }
          return [...prev, newMsg];
        });

        // Clear typing indicator for the sender who just sent the message
        if (newMsg.sender_name) {
          setCommunityTypingUsers(prev => prev.filter(u => u !== newMsg.sender_name));
        }

        setTimeout(() => {
          messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
        }, 50);
      }
    });

    socket.on('community_user_typing', ({ sectionId, userName, isTyping }: any) => {
      if (userName === 'Admin') return;
      const currentActiveId = activeSectionRef.current?._id;
      if (currentActiveId && currentActiveId === sectionId) {
        if (isTyping) {
          setCommunityTypingUsers(prev => prev.includes(userName) ? prev : [...prev, userName]);
        } else {
          setCommunityTypingUsers(prev => prev.filter(u => u !== userName));
        }
      }
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  useEffect(() => {
    activeSectionRef.current = activeSection;
    if (activeSection && socketRef.current) {
      socketRef.current.emit('join_community_section', activeSection._id);
    }
    return () => {
      if (activeSection && socketRef.current) {
        socketRef.current.emit('leave_community_section', activeSection._id);
      }
    };
  }, [activeSection]);

  const fetchCommunities = async (showLoading = true) => {
    if (showLoading) setLoading(true);
    try {
      let res;
      try {
        res = await axios.get(`${API_URL}/community?include_sections=true`, getHeaders());
      } catch (err: any) {
        if (err.response?.status === 404 || !err.response) {
          const altUrl = API_URL.includes('localhost') 
            ? 'https://anytime-help.onrender.com/api' 
            : 'http://localhost:5000/api';
          res = await axios.get(`${altUrl}/community?include_sections=true`, getHeaders());
          API_URL = altUrl;
          SOCKET_URL = altUrl.replace('/api', '');
        } else {
          throw err;
        }
      }
      if (Array.isArray(res.data)) {
        setCommunities(res.data);
      }
    } catch (err) {
      console.error('Error fetching communities:', err);
      toast.error('Failed to load communities');
    } finally {
      if (showLoading) setLoading(false);
    }
  };

  const fetchUsers = async () => {
    try {
      let res;
      try {
        res = await axios.get(`${API_URL}/users/members?all=true`, getHeaders());
      } catch (err: any) {
        if (err.response?.status === 404 || !err.response) {
          const altUrl = API_URL.includes('localhost') 
            ? 'https://anytime-help.onrender.com/api' 
            : 'http://localhost:5000/api';
          res = await axios.get(`${altUrl}/users/members?all=true`, getHeaders());
          API_URL = altUrl;
          SOCKET_URL = altUrl.replace('/api', '');
        } else {
          throw err;
        }
      }
      const data = res.data.members || (Array.isArray(res.data) ? res.data : []);
      setAllUsers(data);
    } catch (err) {
      console.error('Error fetching members:', err);
    }
  };

  const fetchSections = async (communityId: string, showLoading = true) => {
    if (showLoading) setLoadingSections(true);
    try {
      let res;
      try {
        res = await axios.get(`${API_URL}/community/${communityId}/sections`, getHeaders());
      } catch (err: any) {
        if (err.response?.status === 404 || !err.response) {
          const altUrl = API_URL.includes('localhost') 
            ? 'https://anytime-help.onrender.com/api' 
            : 'http://localhost:5000/api';
          res = await axios.get(`${altUrl}/community/${communityId}/sections`, getHeaders());
          API_URL = altUrl;
          SOCKET_URL = altUrl.replace('/api', '');
        } else {
          throw err;
        }
      }
      if (Array.isArray(res.data)) {
        setSections(res.data);
      }
    } catch (err) {
      console.error('Error fetching sections:', err);
      toast.error('Failed to load community sections');
    } finally {
      if (showLoading) setLoadingSections(false);
    }
  };

  const handleSelectCommunity = (comm: CommunityItem) => {
    setSelectedCommunity(comm);
    fetchSections(comm._id, true);
  };

  // Save Community (Create/Edit)
  const handleSaveCommunity = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!commName.trim()) {
      toast.error('Please enter a community name');
      return;
    }

    setIsSavingComm(true);
    try {
      const payload = {
        name: commName.trim(),
        description: commDesc.trim(),
        icon: commIcon,
        color: commColor,
        target_roles: commRoles
      };

      if (editingComm) {
        await axios.put(`${API_URL}/community/${editingComm._id}`, payload, getHeaders());
        toast.success('Community updated successfully');
      } else {
        await axios.post(`${API_URL}/community`, payload, getHeaders());
        toast.success('Community created successfully');
      }

      setIsCommModalOpen(false);
      setEditingComm(null);
      fetchCommunities(false);
    } catch (err: any) {
      toast.error(err.response?.data?.msg || 'Error saving community');
    } finally {
      setIsSavingComm(false);
    }
  };

  // Delete Community
  const handleDeleteCommunity = async (id: string, name: string) => {
    if (!window.confirm(`Are you sure you want to delete community "${name}" and all its sections?`)) {
      return;
    }
    try {
      await axios.delete(`${API_URL}/community/${id}`, getHeaders());
      toast.success('Community deleted');
      if (selectedCommunity?._id === id) {
        setSelectedCommunity(null);
      }
      fetchCommunities(false);
    } catch (err: any) {
      toast.error(err.response?.data?.msg || 'Failed to delete community');
    }
  };

  // Open Section Modal
  const openCreateSectionModal = () => {
    setEditingSection(null);
    setSecName('');
    setSecDesc('');
    setSecType('discussion');
    setSecIcon('megaphone');
    setIsSectionModalOpen(true);
  };

  const openEditSectionModal = (sec: CommunitySectionItem) => {
    setEditingSection(sec);
    setSecName(sec.name);
    setSecDesc(sec.description);
    setSecType(sec.section_type);
    setSecIcon(sec.icon || 'megaphone');
    setIsSectionModalOpen(true);
  };

  // Save Section
  const handleSaveSection = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!secName.trim() || !selectedCommunity) {
      toast.error('Please enter section name');
      return;
    }

    setIsSavingSection(true);
    try {
      const payload = {
        name: secName.trim(),
        description: secDesc.trim(),
        section_type: secType,
        icon: secIcon
      };

      if (editingSection) {
        await axios.put(`${API_URL}/community/sections/${editingSection._id}`, payload, getHeaders());
        toast.success('Section updated successfully');
      } else {
        await axios.post(`${API_URL}/community/${selectedCommunity._id}/sections`, payload, getHeaders());
        toast.success('New community section created');
      }

      setIsSectionModalOpen(false);
      setEditingSection(null);
      fetchSections(selectedCommunity._id, false);
      fetchCommunities(false);
    } catch (err: any) {
      toast.error(err.response?.data?.msg || 'Error saving section');
    } finally {
      setIsSavingSection(false);
    }
  };

  // Delete Section
  const handleDeleteSection = async (secId: string, name: string) => {
    if (!window.confirm(`Delete section "${name}"?`)) return;
    try {
      await axios.delete(`${API_URL}/community/sections/${secId}`, getHeaders());
      toast.success('Section deleted');
      if (selectedCommunity) {
        fetchSections(selectedCommunity._id, false);
      }
      fetchCommunities(false);
    } catch (err: any) {
      toast.error(err.response?.data?.msg || 'Failed to delete section');
    }
  };

  // Open Assign Members Modal for Section
  const openAssignMembersModal = (sec: CommunitySectionItem) => {
    setAssigningSection(sec);
    const currentAssigned = (sec.assigned_members || []).map((m: any) => m._id || m);
    setSelectedMemberIds(currentAssigned);
    setMemberSearch('');
  };

  const handleSaveAssignedMembers = async () => {
    if (!assigningSection) return;
    try {
      await axios.put(`${API_URL}/community/sections/${assigningSection._id}`, {
        assigned_members: selectedMemberIds
      }, getHeaders());
      toast.success('Section members updated successfully');
      setAssigningSection(null);
      if (selectedCommunity) {
        fetchSections(selectedCommunity._id, false);
      }
    } catch (err: any) {
      toast.error(err.response?.data?.msg || 'Error updating members');
    }
  };

  // Open Live Messenger / Broadcast view
  const openMessenger = async (sec: CommunitySectionItem) => {
    setActiveSection(sec);
    setMessages([]);
    setLoadingMessages(true);
    setMsgInput('');

    try {
      const res = await axios.get(`${API_URL}/community/sections/${sec._id}/messages`, getHeaders());
      if (res.data?.messages) {
        setMessages(res.data.messages);
        setTimeout(() => {
          messagesEndRef.current?.scrollIntoView({ behavior: 'auto' });
        }, 100);
      }
    } catch (err: any) {
      toast.error('Failed to load messages');
    } finally {
      setLoadingMessages(false);
    }
  };

  // Admin continuous typing handler
  const handleAdminTextChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setMsgInput(val);
    if (!socketRef.current || !activeSection) return;

    if (val.trim().length > 0) {
      if (!isTypingRef.current) {
        isTypingRef.current = true;
        socketRef.current.emit('community_typing_start', {
          sectionId: activeSection._id,
          userName: 'Admin'
        });
      }
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = setTimeout(() => {
        isTypingRef.current = false;
        socketRef.current?.emit('community_typing_stop', {
          sectionId: activeSection._id,
          userName: 'Admin'
        });
      }, 2000);
    } else {
      if (isTypingRef.current) {
        isTypingRef.current = false;
        if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
        socketRef.current.emit('community_typing_stop', {
          sectionId: activeSection._id,
          userName: 'Admin'
        });
      }
    }
  };

  // Send Message / Broadcast Update - WhatsApp-style instant optimistic send
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!msgInput.trim() || !activeSection) return;

    const textToSend = msgInput.trim();
    const tempId = `temp_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;

    // Immediately stop typing
    if (isTypingRef.current) {
      isTypingRef.current = false;
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      socketRef.current?.emit('community_typing_stop', {
        sectionId: activeSection._id,
        userName: 'Admin'
      });
    }

    // 1. Instant optimistic message on screen (0ms delay)
    const optimisticMsg: MessageItem = {
      _id: tempId,
      community_id: activeSection.community_id,
      section_id: activeSection._id,
      sender: null,
      sender_name: 'Admin',
      sender_role: 'Admin',
      text: textToSend,
      createdAt: new Date().toISOString()
    };

    setMessages(prev => [...prev, optimisticMsg]);
    setMsgInput('');
    setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 40);

    // 2. Background HTTP request
    try {
      const res = await axios.post(`${API_URL}/community/sections/${activeSection._id}/messages`, {
        text: textToSend
      }, getHeaders());
      if (res.data) {
        setMessages(prev => prev.map(m => m._id === tempId ? res.data : m));
      }
    } catch (err: any) {
      setMessages(prev => prev.filter(m => m._id !== tempId));
      toast.error(err.response?.data?.msg || 'Failed to post update');
    }
  };

  const renderIcon = (iconName: string, color = '#2563EB', size = 24) => {
    switch (iconName) {
      case 'building':
      case 'society':
      case 'default':
      case 'flash':
      case 'zap':
        return <Building2 size={size} color={color} />;
      case 'users':
        return <Users size={size} color={color} />;
      case 'shield':
        return <Shield size={size} color={color} />;
      case 'water':
      case 'droplets':
        return <Droplets size={size} color={color} />;
      case 'home':
        return <Home size={size} color={color} />;
      case 'chatbubbles':
        return <MessageCircle size={size} color={color} />;
      case 'megaphone':
        return <Megaphone size={size} color={color} />;
      default:
        return <Building2 size={size} color={color} />;
    }
  };

  const filteredCommunities = communities.filter(c => 
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.description.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="communities-container">
      {/* View 1: Communities List */}
      {!selectedCommunity ? (
        <>
          {/* Header */}
          <div className="comm-header-row">
            <div className="comm-header-title">
              <h1>
                <Building2 size={26} color="#2563EB" />
                Communities
              </h1>
              <p>
                Manage society communities and channels.
              </p>
            </div>

            <div className="comm-top-actions">
              <button 
                className="btn btn-secondary" 
                onClick={() => fetchCommunities()}
                title="Refresh"
              >
                <RefreshCw size={16} />
              </button>

              <button 
                className="btn btn-primary"
                onClick={() => {
                  setEditingComm(null);
                  setCommName('');
                  setCommDesc('');
                  setCommIcon('building');
                  setCommColor('#2563EB');
                  setCommRoles(['All']);
                  setIsCommModalOpen(true);
                }}
              >
                <Plus size={18} />
                Create Community
              </button>
            </div>
          </div>

          {/* Search Card */}
          <div className="comm-search-card">
            <div className="comm-search-input-wrap">
              <Search size={18} style={{ position: 'absolute', left: 14, top: 12, color: '#94a3b8' }} />
              <input 
                type="text" 
                className="form-input" 
                placeholder="Search communities by name or description..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                style={{ paddingLeft: 42 }}
              />
            </div>
            <div style={{ fontSize: 13, color: '#64748b' }}>
              Showing <strong>{filteredCommunities.length}</strong> communities
            </div>
          </div>

          {/* Grid */}
          {loading ? (
            <div style={{ textAlign: 'center', padding: '60px 0', color: '#64748b' }}>
              <RefreshCw className="spin" size={32} style={{ margin: '0 auto 12px' }} />
              <p>Loading communities...</p>
            </div>
          ) : filteredCommunities.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '80px 20px', background: '#fff', borderRadius: 16, border: '1px solid #e2e8f0' }}>
              <div style={{ width: 64, height: 64, borderRadius: 32, background: '#FEF3C7', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                <Zap size={32} color="#D97706" />
              </div>
              <h3 style={{ fontSize: 18, fontWeight: 700, margin: '0 0 8px 0', color: '#0f172a' }}>No Communities Yet</h3>
              <p style={{ color: '#64748b', maxWidth: 460, margin: '0 auto 20px', fontSize: 14 }}>
                Click below to create a new community (e.g. "Electricity") and start adding sections.
              </p>
              <button 
                className="btn btn-primary"
                onClick={() => {
                  setEditingComm(null);
                  setCommName('Electricity');
                  setCommDesc('Official electricity announcements, DG backup, and meter updates.');
                  setCommIcon('flash');
                  setCommColor('#F59E0B');
                  setCommRoles(['All']);
                  setIsCommModalOpen(true);
                }}
              >
                <Plus size={16} />
                Create Community
              </button>
            </div>
          ) : (
            <div className="comm-grid">
              {filteredCommunities.map(comm => (
                <div key={comm._id} className="comm-card">
                  <div className="comm-card-accent-bar" style={{ background: '#2563EB' }} />
                  <div>
                    <div className="comm-card-header">
                      <div className="comm-icon-box" style={{ background: '#EFF6FF' }}>
                        {renderIcon(comm.icon || 'building', '#2563EB', 24)}
                      </div>
                      <div className="comm-info">
                        <h3 className="comm-name">{comm.name}</h3>
                        <p className="comm-desc">{comm.description || 'No description provided'}</p>
                      </div>
                    </div>

                    {/* Stats pills */}
                    <div className="comm-stats-row">
                      <div className="comm-stat-pill">
                        <Layers size={14} color="#2563EB" />
                        <span>{comm.sections_count || (comm.sections ? comm.sections.length : 0)} Channels</span>
                      </div>
                      <div className="comm-stat-pill">
                        <Eye size={14} color="#16A34A" />
                        <span>{comm.total_followers || 0} Followers</span>
                      </div>
                    </div>

                    {/* Target Roles */}
                    <div className="comm-roles-wrap">
                      <span style={{ fontSize: 11, color: '#64748b', fontWeight: 600 }}>Visible to:</span>
                      {comm.target_roles?.map((r, i) => (
                        <span key={i} className="comm-role-badge">
                          {r}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Footer */}
                  <div className="comm-card-footer">
                    <button 
                      className="btn btn-primary"
                      style={{ flex: 1, justifyContent: 'center' }}
                      onClick={() => handleSelectCommunity(comm)}
                    >
                      <Layers size={16} />
                      Manage Channels ({comm.sections_count || 0})
                    </button>
                    
                    <button 
                      className="btn btn-secondary" 
                      style={{ padding: '8px 10px' }}
                      title="Edit Community"
                      onClick={() => {
                        setEditingComm(comm);
                        setCommName(comm.name);
                        setCommDesc(comm.description);
                        setCommIcon(comm.icon || 'flash');
                        setCommColor(comm.color || '#F59E0B');
                        setCommRoles(comm.target_roles || ['All']);
                        setIsCommModalOpen(true);
                      }}
                    >
                      <Edit2 size={16} />
                    </button>

                    <button 
                      className="btn btn-secondary"
                      style={{ padding: '8px 10px', color: '#ef4444' }}
                      title="Delete Community"
                      onClick={() => handleDeleteCommunity(comm._id, comm.name)}
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      ) : (
        /* View 2: Inside a Selected Community (Sections / Channels List) */
        <div>
          {/* Back breadcrumb */}
          <div className="sections-header-banner">
            <div>
              <div className="sections-breadcrumb">
                <span 
                  className="sections-breadcrumb-link"
                  onClick={() => setSelectedCommunity(null)}
                >
                  <ArrowLeft size={14} style={{ display: 'inline', marginRight: 4 }} />
                  All Communities
                </span>
                <span>/</span>
                <span style={{ color: '#0f172a', fontWeight: 600 }}>{selectedCommunity.name}</span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <div className="comm-icon-box" style={{ background: '#EFF6FF' }}>
                  {renderIcon(selectedCommunity.icon || 'building', '#2563EB', 26)}
                </div>
                <div>
                  <h1 style={{ fontSize: 22, fontWeight: 700, margin: '0 0 4px 0', color: '#0f172a' }}>
                    {selectedCommunity.name}
                  </h1>
                  <p style={{ margin: 0, fontSize: 13, color: '#64748b' }}>
                    {selectedCommunity.description}
                  </p>
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 10 }}>
              <button 
                className="btn btn-secondary"
                onClick={() => fetchSections(selectedCommunity._id)}
              >
                <RefreshCw size={16} />
              </button>

              <button 
                className="btn btn-primary"
                onClick={openCreateSectionModal}
              >
                <Plus size={18} />
                New Channel
              </button>
            </div>
          </div>

          {/* Sections List */}
          <div style={{ marginBottom: 16 }}>
            <h3 style={{ fontSize: 16, fontWeight: 700, color: '#0f172a', margin: '0 0 4px 0' }}>
              Channels & Sections
            </h3>
            <p style={{ fontSize: 13, color: '#64748b', margin: 0 }}>
              Members follow channels for read-only access. Assigned members have posting permissions.
            </p>
          </div>

          {loadingSections ? (
            <div style={{ textAlign: 'center', padding: '50px 0', color: '#64748b' }}>
              <RefreshCw className="spin" size={28} style={{ margin: '0 auto 10px' }} />
              <p>Loading community sections...</p>
            </div>
          ) : sections.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px 20px', background: '#fff', borderRadius: 16, border: '1px solid #e2e8f0' }}>
              <Megaphone size={32} color="#94A3B8" style={{ margin: '0 auto 12px' }} />
              <h4 style={{ fontSize: 16, fontWeight: 600, color: '#0f172a', margin: '0 0 6px 0' }}>No Channels In This Community Yet</h4>
              <p style={{ fontSize: 13, color: '#64748b', maxWidth: 440, margin: '0 auto 16px' }}>
                Add your first section (e.g. "DHBVN Power Outage Alerts" or "DG Set Status") to broadcast updates to residents and members.
              </p>
              <button className="btn btn-primary" onClick={openCreateSectionModal}>
                <Plus size={16} />
                Create Section Now
              </button>
            </div>
          ) : (
            <div className="section-grid">
              {sections.map(sec => (
                <div key={sec._id} className="section-card">
                  <div>
                    <div className="section-card-header">
                      <div className="section-icon-box" style={{ background: '#EFF6FF' }}>
                        <Megaphone size={20} color="#2563EB" />
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <h4 className="section-name" style={{ margin: '0 0 4px 0' }}>{sec.name}</h4>
                        <p className="section-desc">{sec.description || 'No description'}</p>
                      </div>
                    </div>

                    {/* Stats */}
                    <div className="section-stats-bar">
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <Eye size={14} color="#16A34A" />
                        <span><strong>{sec.followers_count || 0}</strong> Followers (Read-Only)</span>
                      </div>
                      <div style={{ width: 4, height: 4, borderRadius: 2, background: '#cbd5e1' }} />
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <Users size={14} color="#2563EB" />
                        <span><strong>{sec.assigned_count || 0}</strong> Assigned Members</span>
                      </div>
                    </div>

                    {/* Last message preview */}
                    {sec.last_message?.text && (
                      <div style={{ padding: '8px 12px', background: '#F8FAFC', borderRadius: 8, fontSize: 12, color: '#475569', marginBottom: 14 }}>
                        <span style={{ fontWeight: 600, color: '#0F172A' }}>{sec.last_message.sender_name}: </span>
                        {sec.last_message.text}
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="section-actions-row">
                    <button 
                      className="btn btn-primary"
                      style={{ padding: '8px 14px', fontSize: 13, flex: 1, justifyContent: 'center' }}
                      onClick={() => openMessenger(sec)}
                    >
                      <Send size={14} />
                      Open Messenger
                    </button>

                    <button 
                      className="btn btn-secondary"
                      style={{ padding: '8px 10px', fontSize: 13 }}
                      title="Manage Assigned Members"
                      onClick={() => openAssignMembersModal(sec)}
                    >
                      <Users size={15} />
                    </button>

                    <button 
                      className="btn btn-secondary"
                      style={{ padding: '8px 10px', fontSize: 13 }}
                      title="View Followers"
                      onClick={() => setViewFollowersSection(sec)}
                    >
                      <Eye size={15} />
                    </button>

                    <button 
                      className="btn btn-secondary"
                      style={{ padding: '8px 10px', fontSize: 13 }}
                      title="Edit Section"
                      onClick={() => openEditSectionModal(sec)}
                    >
                      <Edit2 size={15} />
                    </button>

                    <button 
                      className="btn btn-secondary"
                      style={{ padding: '8px 10px', fontSize: 13, color: '#EF4444' }}
                      title="Delete Section"
                      onClick={() => handleDeleteSection(sec._id, sec.name)}
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* MODAL 1: Create / Edit Community */}
      {isCommModalOpen && (
        <div className="comm-modal-overlay">
          <div className="comm-modal-box">
            <div className="comm-modal-header">
              <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>
                {editingComm ? 'Edit Community' : 'Create New Community'}
              </h3>
              <button 
                onClick={() => setIsCommModalOpen(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSaveCommunity}>
              <div className="comm-modal-body">
                <div style={{ marginBottom: 16 }}>
                  <label className="form-label" style={{ fontWeight: 600, fontSize: 13, marginBottom: 6, display: 'block' }}>
                    Community Name * (e.g. Electricity)
                  </label>
                  <input 
                    type="text" 
                    className="form-input"
                    placeholder="e.g. Electricity, Water Supply, Security Hub..."
                    value={commName}
                    onChange={e => setCommName(e.target.value)}
                    required
                  />
                </div>

                <div style={{ marginBottom: 16 }}>
                  <label className="form-label" style={{ fontWeight: 600, fontSize: 13, marginBottom: 6, display: 'block' }}>
                    Description
                  </label>
                  <textarea 
                    className="form-input"
                    rows={3}
                    placeholder="Briefly describe what this community covers..."
                    value={commDesc}
                    onChange={e => setCommDesc(e.target.value)}
                  />
                </div>

                <div>
                  <label className="form-label" style={{ fontWeight: 600, fontSize: 13, marginBottom: 6, display: 'block' }}>
                    Role-Based Visibility (Visible to)
                  </label>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {availableRoles.map(role => {
                      const isSelected = commRoles.includes(role);
                      return (
                        <button
                          key={role}
                          type="button"
                          className="btn"
                          style={{
                            padding: '6px 12px',
                            fontSize: 12,
                            borderRadius: 20,
                            background: isSelected ? '#2563EB' : '#F1F5F9',
                            color: isSelected ? '#ffffff' : '#334155',
                            border: '1px solid',
                            borderColor: isSelected ? '#2563EB' : '#E2E8F0'
                          }}
                          onClick={() => {
                            if (role === 'All') {
                              setCommRoles(['All']);
                            } else {
                              const withoutAll = commRoles.filter(r => r !== 'All');
                              if (isSelected) {
                                const next = withoutAll.filter(r => r !== role);
                                setCommRoles(next.length === 0 ? ['All'] : next);
                              } else {
                                setCommRoles([...withoutAll, role]);
                              }
                            }
                          }}
                        >
                          {isSelected && <Check size={12} style={{ marginRight: 4, display: 'inline' }} />}
                          {role}
                        </button>
                      );
                    })}
                  </div>
                  <small style={{ color: '#64748b', fontSize: 11, marginTop: 4, display: 'block' }}>
                    Visible to all members/residents matching selected roles.
                  </small>
                </div>
              </div>

              <div className="comm-modal-footer">
                <button 
                  type="button" 
                  className="btn btn-secondary"
                  onClick={() => setIsCommModalOpen(false)}
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="btn btn-primary"
                  disabled={isSavingComm}
                >
                  {isSavingComm ? 'Saving...' : (editingComm ? 'Update Community' : 'Create Community')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: Create / Edit Community Section (Channel/Group) */}
      {isSectionModalOpen && (
        <div className="comm-modal-overlay">
          <div className="comm-modal-box">
            <div className="comm-modal-header">
              <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>
                {editingSection ? 'Edit Channel / Section' : `New Channel for "${selectedCommunity?.name}"`}
              </h3>
              <button 
                onClick={() => setIsSectionModalOpen(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSaveSection}>
              <div className="comm-modal-body">
                <div style={{ marginBottom: 16 }}>
                  <label className="form-label" style={{ fontWeight: 600, fontSize: 13, marginBottom: 6, display: 'block' }}>
                    Section / Channel Name *
                  </label>
                  <input 
                    type="text" 
                    className="form-input"
                    placeholder="e.g. DHBVN Power Outage Updates, DG Backup Alerts..."
                    value={secName}
                    onChange={e => setSecName(e.target.value)}
                    required
                  />
                </div>

                <div style={{ marginBottom: 16 }}>
                  <label className="form-label" style={{ fontWeight: 600, fontSize: 13, marginBottom: 6, display: 'block' }}>
                    Description
                  </label>
                  <textarea 
                    className="form-input"
                    rows={3}
                    placeholder="Purpose of this channel..."
                    value={secDesc}
                    onChange={e => setSecDesc(e.target.value)}
                  />
                </div>

                <div style={{ marginTop: 16, padding: '12px 16px', background: '#EFF6FF', borderRadius: 8, fontSize: 12, color: '#1E40AF', border: '1px solid #DBEAFE' }}>
                  <strong>How it works:</strong> Anyone who follows this channel gets <strong>visible read-only access</strong>. You can assign specific members to this channel afterwards who can post updates. Assigned members are strictly scoped to this channel only and cannot access other channels.
                </div>
              </div>

              <div className="comm-modal-footer">
                <button 
                  type="button" 
                  className="btn btn-secondary"
                  onClick={() => setIsSectionModalOpen(false)}
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="btn btn-primary"
                  disabled={isSavingSection}
                >
                  {isSavingSection ? 'Saving...' : (editingSection ? 'Update Section' : 'Create Section')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: Assign Members to Particular Section */}
      {assigningSection && (
        <div className="comm-modal-overlay">
          <div className="comm-modal-box" style={{ maxWidth: 640 }}>
            <div className="comm-modal-header">
              <div>
                <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>
                  Assign Members to "{assigningSection.name}"
                </h3>
                <small style={{ color: '#64748b' }}>
                  Assigned members are scoped strictly to THIS section only.
                </small>
              </div>
              <button 
                onClick={() => setAssigningSection(null)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}
              >
                <X size={20} />
              </button>
            </div>

            <div className="comm-modal-body">
              {/* Search */}
              <div style={{ position: 'relative', marginBottom: 14 }}>
                <Search size={16} style={{ position: 'absolute', left: 12, top: 12, color: '#94a3b8' }} />
                <input 
                  type="text" 
                  className="form-input" 
                  placeholder="Search members by name, phone, or ID..."
                  value={memberSearch}
                  onChange={e => setMemberSearch(e.target.value)}
                  style={{ paddingLeft: 36, fontSize: 13 }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12, color: '#64748b', marginBottom: 10, flexWrap: 'wrap', gap: 8 }}>
                <span>Selected: <strong>{selectedMemberIds.length}</strong> members</span>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button 
                    type="button" 
                    onClick={() => {
                      const filtered = allUsers.filter(u => {
                        const q = memberSearch.toLowerCase();
                        return (
                          (u.name || '').toLowerCase().includes(q) ||
                          (u.phone_number || '').includes(q) ||
                          (u.member_id || '').toLowerCase().includes(q)
                        );
                      });
                      setSelectedMemberIds(Array.from(new Set([...selectedMemberIds, ...filtered.map(u => u._id)])));
                    }}
                    style={{ background: '#EFF6FF', border: '1px solid #BFDBFE', color: '#1D4ED8', cursor: 'pointer', fontSize: 12, padding: '4px 10px', borderRadius: 6, fontWeight: 600 }}
                  >
                    Select All ({allUsers.length})
                  </button>
                  {selectedMemberIds.length > 0 && (
                    <button 
                      type="button" 
                      onClick={() => setSelectedMemberIds([])}
                      style={{ background: 'none', border: '1px solid #FCA5A5', color: '#EF4444', cursor: 'pointer', fontSize: 12, padding: '4px 10px', borderRadius: 6 }}
                    >
                      Clear all
                    </button>
                  )}
                </div>
              </div>

              <div style={{ maxHeight: 340, overflowY: 'auto', border: '1px solid #E2E8F0', borderRadius: 8 }}>
                {allUsers
                  .filter(u => {
                    const q = memberSearch.toLowerCase();
                    return (
                      (u.name || '').toLowerCase().includes(q) ||
                      (u.phone_number || '').includes(q) ||
                      (u.member_id || '').toLowerCase().includes(q)
                    );
                  })
                  .map(user => {
                    const isChecked = selectedMemberIds.includes(user._id);
                    return (
                      <div 
                        key={user._id}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '10px 14px',
                          borderBottom: '1px solid #F1F5F9',
                          cursor: 'pointer',
                          background: isChecked ? '#EFF6FF' : '#ffffff'
                        }}
                        onClick={() => {
                          if (isChecked) {
                            setSelectedMemberIds(selectedMemberIds.filter(id => id !== user._id));
                          } else {
                            setSelectedMemberIds([...selectedMemberIds, user._id]);
                          }
                        }}
                      >
                        <div>
                          <div style={{ fontWeight: 600, fontSize: 13, color: '#0F172A' }}>
                            {user.name || 'Unnamed'}
                            {user.designation && <span style={{ color: '#2563EB', marginLeft: 6, fontWeight: 500 }}>({user.designation})</span>}
                          </div>
                          <div style={{ fontSize: 11, color: '#64748b' }}>
                            {user.phone_number} {user.member_id ? `• ID: ${user.member_id}` : ''}
                          </div>
                        </div>

                        <input 
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => {}}
                          style={{ width: 18, height: 18, cursor: 'pointer' }}
                        />
                      </div>
                    );
                  })}
              </div>
            </div>

            <div className="comm-modal-footer">
              <button 
                type="button" 
                className="btn btn-secondary"
                onClick={() => setAssigningSection(null)}
              >
                Cancel
              </button>
              <button 
                type="button" 
                className="btn btn-primary"
                onClick={handleSaveAssignedMembers}
              >
                Save Assigned Members ({selectedMemberIds.length})
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 4: Followers List Modal */}
      {viewFollowersSection && (
        <div className="comm-modal-overlay">
          <div className="comm-modal-box" style={{ maxWidth: 540 }}>
            <div className="comm-modal-header">
              <div>
                <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>
                  Channel Followers ({viewFollowersSection.followers_count || (viewFollowersSection.followers?.length || 0)})
                </h3>
                <small style={{ color: '#64748b' }}>
                  Members & residents who followed this channel for read-only access.
                </small>
              </div>
              <button 
                onClick={() => setViewFollowersSection(null)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}
              >
                <X size={20} />
              </button>
            </div>

            <div className="comm-modal-body">
              <div style={{ padding: '12px 16px', background: '#F8FAFC', borderRadius: 8, fontSize: 13, color: '#475569', marginBottom: 16 }}>
                <Eye size={16} color="#16A34A" style={{ display: 'inline', marginRight: 6 }} />
                Followers have <strong>read-only access</strong>. They can read messages and receive real-time updates as soon as an admin or assigned member posts.
              </div>

              <div style={{ textAlign: 'center', padding: '24px 0', color: '#64748b' }}>
                <CheckCircle2 size={36} color="#16A34A" style={{ margin: '0 auto 8px' }} />
                <p style={{ margin: 0, fontSize: 14, fontWeight: 600 }}>
                  {viewFollowersSection.followers_count || 0} Total Active Followers
                </p>
                <p style={{ fontSize: 12, margin: '4px 0 0 0', color: '#94a3b8' }}>
                  Users can follow or unfollow instantly from the mobile app.
                </p>
              </div>
            </div>

            <div className="comm-modal-footer">
              <button 
                type="button" 
                className="btn btn-primary"
                onClick={() => setViewFollowersSection(null)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 5: Live Messenger / Broadcast Modal */}
      {activeSection && (
        <div className="comm-modal-overlay">
          <div className="messenger-modal-box">
            {/* Header */}
            <div className="messenger-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 40, height: 40, borderRadius: 10, background: '#1E293B', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {renderIcon(activeSection.icon || 'megaphone', '#F59E0B', 20)}
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>
                    {activeSection.name}
                  </h3>
                  <small style={{ color: '#94A3B8' }}>
                    {activeSection.section_type === 'announcement' ? 'Broadcast Channel' : 'Discussion Section'} • {activeSection.followers_count || 0} Followers
                  </small>
                </div>
              </div>

              <button 
                onClick={() => setActiveSection(null)}
                style={{ background: 'none', border: 'none', color: '#FFFFFF', cursor: 'pointer' }}
              >
                <X size={22} />
              </button>
            </div>

            {/* Messages Area */}
            <div className="messenger-messages-area">
              {loadingMessages ? (
                <div style={{ textAlign: 'center', padding: '40px 0', color: '#64748b' }}>
                  <RefreshCw className="spin" size={24} style={{ margin: '0 auto 8px' }} />
                  <p>Loading messages...</p>
                </div>
              ) : messages.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '60px 20px', color: '#94a3b8' }}>
                  <Megaphone size={36} color="#CBD5E1" style={{ margin: '0 auto 12px' }} />
                  <p style={{ margin: 0, fontSize: 15, fontWeight: 600 }}>No Updates Posted Yet</p>
                  <p style={{ margin: '4px 0 0 0', fontSize: 13 }}>
                    Send an official broadcast message or alert below. All {activeSection.followers_count || 0} followers will see it immediately!
                  </p>
                </div>
              ) : (
                messages.map(msg => {
                  const isMine = msg.sender_role === 'Admin' || msg.sender_role === 'SubAdmin';
                  const senderName = msg.sender_name || (isMine ? 'Admin' : 'Member');
                  const initials = getSenderInitials(senderName);
                  const avatarColor = getAvatarColor(senderName, isMine);

                  return (
                    <div 
                      key={msg._id} 
                      className={`comm-msg-row ${isMine ? 'mine' : 'theirs'}`}
                    >
                      {/* Left Avatar for other members */}
                      {!isMine && (
                        <div 
                          className="comm-msg-avatar"
                          style={{ backgroundColor: avatarColor.bg, color: avatarColor.text }}
                          title={`${senderName}${msg.sender_role ? ` (${msg.sender_role})` : ''}`}
                        >
                          {initials}
                        </div>
                      )}

                      <div className={`msg-bubble-wrap ${isMine ? 'mine' : 'theirs'}`}>
                        <div className={`msg-sender-info ${isMine ? 'mine' : 'theirs'}`}>
                          {msg.sender_name} {msg.sender_role ? `(${msg.sender_role})` : ''}
                        </div>

                        <div className={`msg-bubble ${isMine ? 'mine' : 'theirs'}`}>
                          {msg.text}
                          <div className="msg-time">
                            {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </div>
                        </div>
                      </div>

                      {/* Right Avatar for Admin (You) */}
                      {isMine && (
                        <div 
                          className="comm-msg-avatar mine"
                          style={{ backgroundColor: avatarColor.bg, color: avatarColor.text }}
                          title={`${senderName} (You)`}
                        >
                          {initials}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Live Typing Indicator */}
            {communityTypingUsers.length > 0 && (
              <div 
                style={{ 
                  padding: '6px 16px', 
                  fontSize: 12, 
                  color: 'var(--text-muted)', 
                  fontStyle: 'italic', 
                  background: '#F8FAFC', 
                  borderTop: '1px solid var(--border-color)', 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: 6 
                }}
              >
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--primary)', display: 'inline-block' }} />
                {communityTypingUsers.join(', ')} {communityTypingUsers.length > 1 ? 'are' : 'is'} typing...
              </div>
            )}

            {/* Input Bar */}
            <form onSubmit={handleSendMessage} className="messenger-input-bar">
              <input 
                type="text" 
                className="messenger-input"
                placeholder={`Post update in ${activeSection.name}...`}
                value={msgInput}
                onChange={handleAdminTextChange}
              />
              <button 
                type="submit" 
                className="btn btn-primary"
                style={{ borderRadius: 24, padding: '10px 20px', display: 'flex', alignItems: 'center', gap: 6 }}
                disabled={!msgInput.trim()}
              >
                <Send size={16} />
                Send
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
