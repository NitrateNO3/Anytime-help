import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { toast } from 'react-hot-toast';
import { 
  MessageSquare, Plus, Edit2, Trash2, Search, X, Eye, 
  Send, Shield, RefreshCw, Check, CornerDownRight
} from 'lucide-react';
import { io, Socket } from 'socket.io-client';
import '../index.css';
import './ChatGroups.css';

const API_URL = import.meta.env.VITE_API_URL || 'https://anytime-help.onrender.com/api';
const SOCKET_URL = API_URL.replace('/api', '');

interface MemberUser {
  _id: string;
  name: string;
  phone_number: string;
  designation?: string;
  member_id?: string;
}

interface ChatGroupItem {
  _id: string;
  name: string;
  description: string;
  group_type: string;
  members: MemberUser[];
  view_only_members: MemberUser[];
  can_other_members_view: boolean;
  can_residents_view: boolean;
  last_message?: {
    text: string;
    sender_name: string;
    timestamp: string;
  };
  createdAt: string;
  is_active: boolean;
}

interface MessageItem {
  _id: string;
  group_id: string;
  sender: any;
  sender_name: string;
  sender_role: string;
  sender_designation?: string;
  text: string;
  reply_to?: {
    message_id: string;
    sender_name: string;
    text: string;
  };
  is_edited?: boolean;
  is_deleted?: boolean;
  createdAt: string;
}

export default function ChatGroups() {
  const [groups, setGroups] = useState<ChatGroupItem[]>([]);
  const [allMembers, setAllMembers] = useState<MemberUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState<ChatGroupItem | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  // Admin Live Chat State
  const [activeChatGroup, setActiveChatGroup] = useState<ChatGroupItem | null>(null);
  const [chatMessages, setChatMessages] = useState<MessageItem[]>([]);
  const [loadingChat, setLoadingChat] = useState(false);
  const [chatInput, setChatInput] = useState('');
  const [sendingMsg, setSendingMsg] = useState(false);
  const [replyingMessage, setReplyingMessage] = useState<MessageItem | null>(null);
  const [editingMsgId, setEditingMsgId] = useState<string | null>(null);

  const adminUserStr = localStorage.getItem('adminUser');
  const adminUser = adminUserStr ? JSON.parse(adminUserStr) : null;
  const adminName = adminUser?.name || 'Super Admin';

  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  const adminTypingTimerRef = useRef<any>(null);
  const isAdminTypingRef = useRef<boolean>(false);
  const lastAdminTypingHeartbeatRef = useRef<number>(0);
  const typingTimersRef = useRef<{ [userName: string]: any }>({});

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const socketRef = useRef<Socket | null>(null);
  const activeChatGroupRef = useRef<ChatGroupItem | null>(null);

  // Form State
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [groupType, setGroupType] = useState('General');
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([]);
  const [selectedViewOnlyIds, setSelectedViewOnlyIds] = useState<string[]>([]);
  const [canOtherMembersView, setCanOtherMembersView] = useState(false);
  const [canResidentsView, setCanResidentsView] = useState(false);
  const [memberSearch, setMemberSearch] = useState('');

  const groupTypes = ['General', 'Executive', 'Finance', 'Security', 'Maintenance', 'Events', 'SubCommittee', 'Other'];

  const getHeaders = () => {
    const token = localStorage.getItem('adminToken');
    return { headers: { 'x-auth-token': token } };
  };

  useEffect(() => {
    fetchGroups();
    fetchMembers();

    const socket = io(SOCKET_URL, { 
      transports: ['websocket', 'polling'],
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000
    });
    socketRef.current = socket;

    const onJoin = () => {
      if (activeChatGroupRef.current) {
        socket.emit('join_chat_group', activeChatGroupRef.current._id);
      }
    };
    socket.on('connect', onJoin);
    socket.on('reconnect', onJoin);

    socket.on('chat_group_created', () => fetchGroups(false));
    socket.on('chat_group_updated', () => fetchGroups(false));
    socket.on('chat_group_deleted', () => fetchGroups(false));

    socket.on('chat_group_last_message', ({ group_id, last_message }: any) => {
      const gId = (group_id?._id || group_id || '').toString();
      setGroups(prev => prev.map(g => {
        if (g._id.toString() === gId) {
          return { ...g, last_message };
        }
        return g;
      }));
    });

    // Realtime incoming messages
    socket.on('new_message', (newMsg: MessageItem) => {
      const gId = ((newMsg.group_id as any)?._id || newMsg.group_id || '').toString();
      const currentActiveId = (activeChatGroupRef.current?._id || '').toString();

      if (currentActiveId && gId === currentActiveId) {
        setChatMessages(prev => {
          if (prev.some(m => m._id === newMsg._id)) return prev;
          return [...prev, newMsg];
        });

        // Clear typing indicator for this sender
        if (newMsg.sender_name) {
          setTypingUsers(prev => prev.filter(u => u !== newMsg.sender_name));
        }

        scrollToBottom();
      }

      // Keep group list cards updated in real-time
      setGroups(prev => prev.map(g => {
        if (g._id.toString() === gId) {
          return {
            ...g,
            last_message: {
              text: newMsg.text || 'Sent an attachment',
              sender_name: newMsg.sender_name || 'Member',
              timestamp: newMsg.createdAt || new Date().toISOString()
            }
          };
        }
        return g;
      }));
    });

    socket.on('message_edited', ({ message_id, new_text }: any) => {
      setChatMessages(prev => prev.map(m => m._id === message_id ? { ...m, text: new_text, is_edited: true } : m));
    });

    socket.on('message_deleted', ({ message_id }: any) => {
      setChatMessages(prev => prev.map(m => m._id === message_id ? { ...m, text: 'This message was deleted', is_deleted: true } : m));
    });

    // Real-time user typing listener in Admin web
    socket.on('user_typing', ({ groupId: tGid, userName, isTyping }: any) => {
      const incomingGid = (tGid || '').toString().trim();
      const currentGid = (activeChatGroupRef.current?._id || '').toString().trim();
      if (currentGid && incomingGid && incomingGid !== currentGid) return;
      if (!userName || userName.trim() === adminName.trim()) return;

      setTypingUsers(prev => {
        if (isTyping) {
          // Continuous typing: refresh safety timeout on every heartbeat
          if (typingTimersRef.current[userName]) {
            clearTimeout(typingTimersRef.current[userName]);
          }
          typingTimersRef.current[userName] = setTimeout(() => {
            setTypingUsers(curr => curr.filter(u => u !== userName));
            delete typingTimersRef.current[userName];
          }, 3000);

          if (!prev.includes(userName)) {
            scrollToBottom();
            return [...prev, userName];
          }
          return prev;
        } else {
          // User stopped typing - immediately remove
          if (typingTimersRef.current[userName]) {
            clearTimeout(typingTimersRef.current[userName]);
            delete typingTimersRef.current[userName];
          }
          return prev.filter(u => u !== userName);
        }
      });
    });

    return () => {
      socket.disconnect();
    };
  }, [adminName]);

  // Sync activeChatGroup with ref & room subscription + 2s fallback auto-sync
  useEffect(() => {
    activeChatGroupRef.current = activeChatGroup;
    setTypingUsers([]);
    if (!activeChatGroup) return;

    if (socketRef.current) {
      socketRef.current.emit('join_chat_group', activeChatGroup._id);
    }

    const interval = setInterval(async () => {
      try {
        const res = await axios.get(`${API_URL}/chat/groups/${activeChatGroup._id}/messages`, getHeaders());
        if (res.data?.messages && Array.isArray(res.data.messages)) {
          const incoming: MessageItem[] = res.data.messages;
          setChatMessages(prev => {
            if (incoming.length !== prev.length || 
                (incoming.length > 0 && prev.length > 0 && incoming[incoming.length - 1]._id !== prev[prev.length - 1]._id)) {
              scrollToBottom();
              return incoming;
            }
            const hasChanges = incoming.some((m, idx) => {
              const p = prev[idx];
              return !p || p.text !== m.text || p.is_deleted !== m.is_deleted || p.is_edited !== m.is_edited;
            });
            if (hasChanges) return incoming;
            return prev;
          });
        }
      } catch {
        // silent
      }
    }, 2000);

    return () => {
      clearInterval(interval);
      if (isAdminTypingRef.current && socketRef.current && activeChatGroup) {
        isAdminTypingRef.current = false;
        lastAdminTypingHeartbeatRef.current = 0;
        socketRef.current.emit('typing_stop', {
          groupId: activeChatGroup._id,
          userName: adminName
        });
      }
      if (adminTypingTimerRef.current) clearTimeout(adminTypingTimerRef.current);
      Object.values(typingTimersRef.current).forEach(t => clearTimeout(t));
    };
  }, [activeChatGroup, adminName]);

  const scrollToBottom = () => {
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 80);
  };

  const fetchGroups = async (showLoading = true) => {
    if (showLoading) setLoading(true);
    try {
      const res = await axios.get(`${API_URL}/chat/groups`, getHeaders());
      setGroups(res.data);
    } catch (err: any) {
      console.error(err);
      toast.error('Failed to load chat groups');
    } finally {
      if (showLoading) setLoading(false);
    }
  };

  const fetchMembers = async () => {
    try {
      const res = await axios.get(`${API_URL}/users/members?all=true`, getHeaders());
      const data = res.data.members || (Array.isArray(res.data) ? res.data : []);
      setAllMembers(data);
    } catch (err) {
      console.error('Failed to load members for selection:', err);
    }
  };

  // Open Chat Room for Group
  const openChatRoom = async (group: ChatGroupItem) => {
    setActiveChatGroup(group);
    setChatMessages([]);
    setTypingUsers([]);
    setLoadingChat(true);
    setReplyingMessage(null);
    setEditingMsgId(null);
    setChatInput('');

    try {
      const res = await axios.get(`${API_URL}/chat/groups/${group._id}/messages`, getHeaders());
      if (res.data?.messages) {
        setChatMessages(res.data.messages);
        scrollToBottom();
      }
    } catch (err) {
      toast.error('Failed to load messages');
    } finally {
      setLoadingChat(false);
    }
  };

  const handleChatInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setChatInput(val);

    if (!socketRef.current || !activeChatGroup) return;

    if (val.trim().length > 0) {
      const now = Date.now();
      // Continuous typing: send typing_start on first character OR every 1.5s as long as typing continues
      if (!isAdminTypingRef.current || (now - lastAdminTypingHeartbeatRef.current > 1500)) {
        isAdminTypingRef.current = true;
        lastAdminTypingHeartbeatRef.current = now;
        socketRef.current.emit('typing_start', {
          groupId: activeChatGroup._id,
          userName: adminName
        });
      }

      if (adminTypingTimerRef.current) clearTimeout(adminTypingTimerRef.current);

      // Stop typing after 2000ms pause
      adminTypingTimerRef.current = setTimeout(() => {
        isAdminTypingRef.current = false;
        lastAdminTypingHeartbeatRef.current = 0;
        socketRef.current?.emit('typing_stop', {
          groupId: activeChatGroup._id,
          userName: adminName
        });
      }, 2000);
    } else {
      if (isAdminTypingRef.current) {
        isAdminTypingRef.current = false;
        lastAdminTypingHeartbeatRef.current = 0;
        if (adminTypingTimerRef.current) clearTimeout(adminTypingTimerRef.current);
        socketRef.current.emit('typing_stop', {
          groupId: activeChatGroup._id,
          userName: adminName
        });
      }
    }
  };

  // Send Message / Edit Message / Reply
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim() || !activeChatGroup || sendingMsg) return;

    // Immediately stop typing indicator on send
    if (isAdminTypingRef.current) {
      isAdminTypingRef.current = false;
      lastAdminTypingHeartbeatRef.current = 0;
      if (adminTypingTimerRef.current) clearTimeout(adminTypingTimerRef.current);
      socketRef.current?.emit('typing_stop', {
        groupId: activeChatGroup._id,
        userName: adminName
      });
    }

    setSendingMsg(true);

    try {
      if (editingMsgId) {
        const textToEdit = chatInput.trim();
        const idToEdit = editingMsgId;
        // Optimistically update
        setChatMessages(prev => prev.map(m => m._id === idToEdit ? { ...m, text: textToEdit, is_edited: true } : m));
        setEditingMsgId(null);
        setChatInput('');

        await axios.put(
          `${API_URL}/chat/messages/${idToEdit}`,
          { new_text: textToEdit },
          getHeaders()
        );
      } else {
        const payload: any = {
          text: chatInput.trim()
        };
        if (replyingMessage) {
          payload.reply_to_message_id = replyingMessage._id;
        }

        const res = await axios.post(
          `${API_URL}/chat/groups/${activeChatGroup._id}/messages`,
          payload,
          getHeaders()
        );

        if (res.data?.message) {
          const sentMsg = res.data.message;
          setChatMessages(prev => {
            if (prev.some(m => m._id === sentMsg._id)) return prev;
            return [...prev, sentMsg];
          });
          // Update last_message in groups array preview
          setGroups(prev => prev.map(g => {
            if (g._id === activeChatGroup._id) {
              return {
                ...g,
                last_message: {
                  text: sentMsg.text,
                  sender_name: sentMsg.sender_name || 'Admin',
                  timestamp: sentMsg.createdAt || new Date().toISOString()
                }
              };
            }
            return g;
          }));
        }
        setReplyingMessage(null);
        setChatInput('');
      }

      scrollToBottom();
    } catch (err: any) {
      toast.error(err.response?.data?.msg || 'Failed to send message');
    } finally {
      setSendingMsg(false);
    }
  };

  // Delete message as Admin
  const handleDeleteMessage = async (msgId: string) => {
    // Immediately reflect deleted message on screen
    setChatMessages(prev => prev.map(m => m._id === msgId ? { ...m, text: 'This message was deleted', is_deleted: true } : m));
    try {
      await axios.delete(`${API_URL}/chat/messages/${msgId}`, getHeaders());
      toast.success('Message deleted');
    } catch (err) {
      toast.error('Failed to delete message');
    }
  };

  const openCreateModal = () => {
    setEditingGroup(null);
    setName('');
    setDescription('');
    setGroupType('General');
    setSelectedMemberIds([]);
    setSelectedViewOnlyIds([]);
    setCanOtherMembersView(false);
    setCanResidentsView(false);
    setMemberSearch('');
    setIsModalOpen(true);
  };

  const openEditModal = (group: ChatGroupItem) => {
    setEditingGroup(group);
    setName(group.name || '');
    setDescription(group.description || '');
    setGroupType(group.group_type || 'General');
    setSelectedMemberIds((group.members || []).map((m: any) => m._id || m));
    setSelectedViewOnlyIds((group.view_only_members || []).map((m: any) => m._id || m));
    setCanOtherMembersView(!!group.can_other_members_view);
    setCanResidentsView(!!group.can_residents_view);
    setMemberSearch('');
    setIsModalOpen(true);
  };

  const toggleMemberSelection = (memberId: string) => {
    if (selectedMemberIds.includes(memberId)) {
      setSelectedMemberIds(selectedMemberIds.filter(id => id !== memberId));
    } else {
      setSelectedMemberIds([...selectedMemberIds, memberId]);
      setSelectedViewOnlyIds(selectedViewOnlyIds.filter(id => id !== memberId));
    }
  };

  const toggleViewOnlySelection = (memberId: string) => {
    if (selectedViewOnlyIds.includes(memberId)) {
      setSelectedViewOnlyIds(selectedViewOnlyIds.filter(id => id !== memberId));
    } else {
      setSelectedViewOnlyIds([...selectedViewOnlyIds, memberId]);
      setSelectedMemberIds(selectedMemberIds.filter(id => id !== memberId));
    }
  };

  const handleSaveGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error('Group name is required');
      return;
    }

    setIsSaving(true);
    const payload = {
      name: name.trim(),
      description: description.trim(),
      group_type: groupType,
      members: selectedMemberIds,
      view_only_members: selectedViewOnlyIds,
      can_other_members_view: canOtherMembersView,
      can_residents_view: canResidentsView
    };

    try {
      if (editingGroup) {
        await axios.put(`${API_URL}/chat/groups/${editingGroup._id}`, payload, getHeaders());
        toast.success('Chat group updated successfully');
      } else {
        await axios.post(`${API_URL}/chat/groups`, payload, getHeaders());
        toast.success('Chat group created successfully');
      }
      setIsModalOpen(false);
      fetchGroups();
    } catch (err: any) {
      console.error(err);
      toast.error(err.response?.data?.msg || 'Error saving chat group');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteGroup = async () => {
    if (!deleteId) return;
    try {
      await axios.delete(`${API_URL}/chat/groups/${deleteId}`, getHeaders());
      toast.success('Chat group deleted/archived');
      setDeleteId(null);
      fetchGroups();
    } catch (err: any) {
      toast.error(err.response?.data?.msg || 'Failed to delete chat group');
    }
  };

  const filteredGroups = groups.filter(g => {
    if (!search.trim()) return true;
    const s = search.toLowerCase();
    return (
      g.name.toLowerCase().includes(s) ||
      (g.description && g.description.toLowerCase().includes(s)) ||
      (g.group_type && g.group_type.toLowerCase().includes(s))
    );
  });

  const filteredModalMembers = allMembers.filter(m => {
    if (!memberSearch.trim()) return true;
    const s = memberSearch.toLowerCase();
    return (
      (m.name && m.name.toLowerCase().includes(s)) ||
      (m.phone_number && m.phone_number.includes(s)) ||
      (m.designation && m.designation.toLowerCase().includes(s))
    );
  });

  return (
    <div className="chat-groups-container">
      {/* Top Header */}
      <div className="chat-header-row">
        <div className="chat-header-title">
          <h1>
            <MessageSquare size={26} color="var(--primary, #1D4ED8)" />
            Committee Chat Groups
          </h1>
          <p>
            Create groups for committee members, set active chat members, and chat/reply directly from here.
          </p>
        </div>
        <button 
          onClick={openCreateModal}
          className="btn btn-primary"
        >
          <Plus size={18} />
          Create Chat Group
        </button>
      </div>

      {/* Search Bar */}
      <div className="chat-search-card">
        <div className="chat-search-input-wrap">
          <Search size={18} style={{ position: 'absolute', left: 14, top: 12, color: '#94a3b8' }} />
          <input
            type="text"
            className="form-input"
            placeholder="Search groups by name, type, or description..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ paddingLeft: 42 }}
          />
        </div>
        <button 
          onClick={() => fetchGroups()}
          className="btn btn-secondary"
          style={{ whiteSpace: 'nowrap' }}
        >
          <RefreshCw size={16} />
          Refresh
        </button>
      </div>

      {/* Groups Grid */}
      {loading ? (
        <div style={{ padding: 60, textAlign: 'center', color: '#64748b' }}>
          <RefreshCw size={24} className="spin" style={{ animation: 'spin 1s linear infinite', marginBottom: 12 }} />
          <div>Loading chat groups...</div>
        </div>
      ) : filteredGroups.length === 0 ? (
        <div style={{ background: '#fff', padding: 60, borderRadius: 16, textAlign: 'center', color: '#64748b', border: '1px solid #e2e8f0' }}>
          <MessageSquare size={48} style={{ opacity: 0.25, marginBottom: 12, margin: '0 auto' }} />
          <h3 style={{ fontSize: 18, fontWeight: 700, color: '#1e293b', margin: '8px 0' }}>No Chat Groups Found</h3>
          <p style={{ fontSize: 14, margin: '0 0 16px 0' }}>Create your first committee chat group to get started.</p>
          <button onClick={openCreateModal} className="btn btn-primary">
            <Plus size={16} /> Create Group
          </button>
        </div>
      ) : (
        <div className="chat-grid">
          {filteredGroups.map(group => {
            const memberCount = (group.members || []).length;
            const viewOnlyCount = (group.view_only_members || []).length;

            return (
              <div key={group._id} className="chat-card">
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                    <div>
                      <span 
                        style={{ 
                          fontSize: 11, 
                          fontWeight: 700, 
                          letterSpacing: '0.04em',
                          textTransform: 'uppercase', 
                          background: '#eff6ff', 
                          color: '#1d4ed8', 
                          padding: '4px 10px', 
                          borderRadius: 20 
                        }}
                      >
                        {group.group_type || 'General'}
                      </span>
                      <h3 style={{ fontSize: 18, fontWeight: 700, color: '#0f172a', margin: '10px 0 4px 0' }}>
                        {group.name}
                      </h3>
                    </div>

                    <div style={{ display: 'flex', gap: 6 }}>
                      <button 
                        onClick={() => openEditModal(group)}
                        title="Edit Group & Permissions"
                        className="btn-icon"
                        style={{ cursor: 'pointer' }}
                      >
                        <Edit2 size={16} />
                      </button>
                      <button 
                        onClick={() => setDeleteId(group._id)}
                        title="Delete Group"
                        className="btn-icon"
                        style={{ color: 'var(--danger)', cursor: 'pointer' }}
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>

                  {group.description && (
                    <p style={{ fontSize: 13, color: '#64748b', margin: '0 0 16px 0', lineHeight: 1.5 }}>
                      {group.description}
                    </p>
                  )}

                  {/* Badges */}
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
                    <div 
                      style={{ 
                        display: 'inline-flex', 
                        alignItems: 'center', 
                        gap: 6, 
                        fontSize: 12, 
                        background: '#f0fdf4', 
                        color: '#15803d', 
                        padding: '4px 10px', 
                        borderRadius: 8,
                        fontWeight: 600
                      }}
                    >
                      <Send size={13} />
                      {memberCount} Active Chat {memberCount === 1 ? 'Member' : 'Members'}
                    </div>

                    {viewOnlyCount > 0 && (
                      <div 
                        style={{ 
                          display: 'inline-flex', 
                          alignItems: 'center', 
                          gap: 6, 
                          fontSize: 12, 
                          background: '#fffbeb', 
                          color: '#b45309', 
                          padding: '4px 10px', 
                          borderRadius: 8,
                          fontWeight: 600
                        }}
                      >
                        <Eye size={13} />
                        {viewOnlyCount} View-Only
                      </div>
                    )}
                  </div>

                  {/* Permission Indicators */}
                  <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: 14, fontSize: 12, color: '#475569' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                      <span style={{ width: 8, height: 8, borderRadius: '50%', background: group.can_other_members_view ? '#10b981' : '#cbd5e1' }} />
                      <span>Other Committee Members: <strong style={{ color: group.can_other_members_view ? '#059669' : '#64748b' }}>{group.can_other_members_view ? 'Can View' : 'Restricted'}</strong></span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ width: 8, height: 8, borderRadius: '50%', background: group.can_residents_view ? '#10b981' : '#cbd5e1' }} />
                      <span>Residents: <strong style={{ color: group.can_residents_view ? '#059669' : '#64748b' }}>{group.can_residents_view ? 'Public Read-Only' : 'Restricted'}</strong></span>
                    </div>
                  </div>
                </div>

                {/* Footer with Open Chat Button */}
                <div style={{ borderTop: '1px solid #f1f5f9', marginTop: 16, paddingTop: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ fontSize: 12, color: '#94a3b8' }}>
                    {group.last_message?.text ? (
                      <span style={{ maxWidth: 170, display: 'inline-block', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', color: '#475569' }}>
                        💬 {group.last_message.text}
                      </span>
                    ) : (
                      <span>Created {new Date(group.createdAt).toLocaleDateString()}</span>
                    )}
                  </div>

                  <button
                    onClick={() => openChatRoom(group)}
                    className="btn btn-primary"
                    style={{ padding: '6px 14px', fontSize: 12, borderRadius: 8, gap: 6 }}
                  >
                    <MessageSquare size={14} />
                    Open Chat
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ADMIN LIVE CHAT ROOM MODAL */}
      {activeChatGroup && (
        <div className="chat-modal-overlay">
          <div className="admin-chat-modal">
            {/* Header */}
            <div className="chat-modal-header" style={{ padding: '14px 20px' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#0f172a', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <MessageSquare size={18} color="#1d4ed8" />
                  {activeChatGroup.name}
                </h3>
                <span style={{ fontSize: 12, color: typingUsers.length > 0 ? '#1d4ed8' : '#64748b' }}>
                  {typingUsers.length > 0 ? (
                    <span className="admin-typing-header">
                      <span className="admin-typing-pulse-dot" />
                      {typingUsers.length === 1 
                        ? `${typingUsers[0]} is typing...` 
                        : `${typingUsers.join(', ')} are typing...`}
                    </span>
                  ) : (
                    <span>
                      {activeChatGroup.group_type} Committee • Participants: {(activeChatGroup.members || []).map((m: any) => {
                        const mId = m.member_id || (allMembers.find((u: any) => u._id === m._id)?.member_id);
                        return mId || m.name || 'Member';
                      }).join(', ') || 'No members'}
                    </span>
                  )}
                </span>
              </div>
              <button 
                onClick={() => setActiveChatGroup(null)}
                className="btn-icon"
                style={{ cursor: 'pointer' }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Message Stream */}
            <div className="admin-chat-body">
              {loadingChat ? (
                <div style={{ textAlign: 'center', padding: 40, color: '#64748b' }}>
                  <RefreshCw size={20} className="spin" style={{ animation: 'spin 1s linear infinite' }} />
                  <div style={{ marginTop: 8, fontSize: 13 }}>Loading conversation...</div>
                </div>
              ) : chatMessages.length === 0 ? (
                <div style={{ textAlign: 'center', padding: 40, color: '#94a3b8' }}>
                  <MessageSquare size={36} style={{ opacity: 0.3, margin: '0 auto 8px auto' }} />
                  <div>No messages yet. Send a message to start the discussion with members.</div>
                </div>
              ) : (
                chatMessages.map(msg => {
                  const roleLower = (msg.sender_role || '').toLowerCase();
                  const isAdminMsg = roleLower === 'admin' || roleLower === 'subadmin';
                  const senderObj = typeof msg.sender === 'object' && msg.sender !== null ? (msg.sender as any) : null;
                  const senderId = (senderObj?._id || msg.sender || '').toString();
                  const matchedMember = (activeChatGroup?.members || []).find((m: any) => (m._id || '').toString() === senderId)
                    || (allMembers || []).find((m: any) => (m._id || '').toString() === senderId);

                  const memberId = senderObj?.member_id || matchedMember?.member_id;
                  const senderLabel = isAdminMsg 
                    ? 'Admin (You)' 
                    : (memberId || (msg.sender_name && msg.sender_name !== senderObj?.name ? msg.sender_name : null) || senderObj?.name || msg.sender_name || 'Member');
                  const rawDesignation = senderObj?.designation || matchedMember?.designation || msg.sender_designation;
                  const designation = (rawDesignation && rawDesignation.trim().toLowerCase() !== 'member') ? rawDesignation.trim() : null;

                  return (
                    <div 
                      key={msg._id} 
                      className={`admin-bubble ${isAdminMsg ? 'admin-bubble-me' : 'admin-bubble-other'}`}
                    >
                      {/* Sender Info: Displays Member ID for members */}
                      <div style={{ fontSize: 11, fontWeight: 700, color: isAdminMsg ? '#dbeafe' : '#1d4ed8', marginBottom: 2 }}>
                        {senderLabel}{!isAdminMsg && designation ? ` (${designation})` : ''}
                      </div>

                      {/* Quoted Reply */}
                      {msg.reply_to && (
                        <div className={`admin-quote-preview ${isAdminMsg ? 'admin-quote-me' : 'admin-quote-other'}`}>
                          <strong>{msg.reply_to.sender_name}</strong>
                          <div style={{ textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                            {msg.reply_to.text}
                          </div>
                        </div>
                      )}

                      {/* Message Text */}
                      <div style={{ fontStyle: msg.is_deleted ? 'italic' : 'normal', opacity: msg.is_deleted ? 0.75 : 1 }}>
                        {msg.is_deleted ? 'This message was deleted' : msg.text}
                      </div>

                      {/* Metadata & Actions */}
                      <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 6, marginTop: 4, fontSize: 10, opacity: 0.75 }}>
                        {msg.is_edited && !msg.is_deleted && <span>(edited)</span>}
                        <span>{new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>

                        {!msg.is_deleted && (
                          <div style={{ display: 'flex', gap: 4, marginLeft: 6 }}>
                            <button
                              onClick={() => {
                                setReplyingMessage({
                                  ...msg,
                                  sender_name: senderLabel
                                });
                                setEditingMsgId(null);
                              }}
                              title="Reply"
                              style={{ border: 'none', background: 'none', color: 'inherit', cursor: 'pointer', padding: 0 }}
                            >
                              <CornerDownRight size={12} />
                            </button>
                            {isAdminMsg && (
                              <button
                                onClick={() => {
                                  setEditingMsgId(msg._id);
                                  setChatInput(msg.text);
                                  setReplyingMessage(null);
                                }}
                                title="Edit"
                                style={{ border: 'none', background: 'none', color: 'inherit', cursor: 'pointer', padding: 0 }}
                              >
                                <Edit2 size={11} />
                              </button>
                            )}
                            <button
                              onClick={() => handleDeleteMessage(msg._id)}
                              title="Delete message"
                              style={{ border: 'none', background: 'none', color: '#ef4444', cursor: 'pointer', padding: 0 }}
                            >
                              <Trash2 size={11} />
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })
              )}

              {/* Typing indicator bubble */}
              {typingUsers.length > 0 && (
                <div className="admin-typing-row">
                  <div className="admin-typing-avatar">
                    {(typingUsers[0] || '?').charAt(0).toUpperCase()}
                  </div>
                  <div className="admin-typing-bubble">
                    <div className="typing-dots">
                      <span></span>
                      <span></span>
                      <span></span>
                    </div>
                  </div>
                  <span className="admin-typing-label">
                    {typingUsers.length === 1 
                      ? `${typingUsers[0]} is typing...` 
                      : `${typingUsers.join(', ')} are typing...`}
                  </span>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Composer Footer */}
            <form onSubmit={handleSendMessage} className="admin-chat-composer">
              {/* Quoted preview bar */}
              {replyingMessage && (
                <div style={{ background: '#eff6ff', padding: '6px 12px', borderRadius: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12, borderLeft: '3px solid #1d4ed8' }}>
                  <span>Replying to <strong>{replyingMessage.sender_name}</strong>: {replyingMessage.text.slice(0, 50)}...</span>
                  <X size={14} style={{ cursor: 'pointer' }} onClick={() => setReplyingMessage(null)} />
                </div>
              )}

              {/* Editing preview bar */}
              {editingMsgId && (
                <div style={{ background: '#fef3c7', padding: '6px 12px', borderRadius: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12, borderLeft: '3px solid #d97706' }}>
                  <span>Editing message...</span>
                  <X size={14} style={{ cursor: 'pointer' }} onClick={() => { setEditingMsgId(null); setChatInput(''); }} />
                </div>
              )}

              <div className="admin-chat-input-row">
                <input
                  type="text"
                  className="admin-chat-input"
                  placeholder={editingMsgId ? "Edit your message..." : "Type response to committee members..."}
                  value={chatInput}
                  onChange={handleChatInputChange}
                />
                <button
                  type="submit"
                  disabled={!chatInput.trim() || sendingMsg}
                  className="admin-chat-send-btn"
                >
                  <Send size={16} />
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CREATE / EDIT MODAL */}
      {isModalOpen && (
        <div className="chat-modal-overlay">
          <div className="chat-modal-box">
            <div className="chat-modal-header">
              <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                <MessageSquare size={20} color="var(--primary)" />
                {editingGroup ? 'Edit Committee Group & Access' : 'Create Committee Chat Group'}
              </h2>
              <button 
                onClick={() => setIsModalOpen(false)}
                className="btn-icon"
                style={{ cursor: 'pointer' }}
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSaveGroup} style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
              <div className="chat-modal-body">
                {/* Group Name & Type */}
                <div className="chat-form-grid" style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 14, marginBottom: 16 }}>
                  <div>
                    <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6, color: '#334155' }}>
                      Group Name *
                    </label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="e.g. Security & CCTV Committee"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      required
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6, color: '#334155' }}>
                      Group Type
                    </label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="e.g. General, Finance, Security"
                      value={groupType}
                      onChange={(e) => setGroupType(e.target.value)}
                      list="group-type-suggestions"
                    />
                    <datalist id="group-type-suggestions">
                      {groupTypes.map(t => (
                        <option key={t} value={t} />
                      ))}
                    </datalist>
                  </div>
                </div>

                {/* Description */}
                <div style={{ marginBottom: 18 }}>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6, color: '#334155' }}>
                    Description / Purpose
                  </label>
                  <textarea
                    className="form-input"
                    rows={2}
                    placeholder="Briefly state what this group discusses..."
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    style={{ resize: 'vertical' }}
                  />
                </div>

                {/* Visibility Controls */}
                <div style={{ background: '#f8fafc', borderRadius: 12, padding: 16, marginBottom: 20, border: '1px solid #e2e8f0' }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#1e293b', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Shield size={16} color="var(--primary)" />
                    General Visibility Controls
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', fontSize: 13, color: '#334155' }}>
                      <input
                        type="checkbox"
                        checked={canOtherMembersView}
                        onChange={(e) => setCanOtherMembersView(e.target.checked)}
                        style={{ width: 17, height: 17, accentColor: 'var(--primary)' }}
                      />
                      <span>Allow <strong>all other Committee Members</strong> to view this chat (Read-Only)</span>
                    </label>

                    <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', fontSize: 13, color: '#334155' }}>
                      <input
                        type="checkbox"
                        checked={canResidentsView}
                        onChange={(e) => setCanResidentsView(e.target.checked)}
                        style={{ width: 17, height: 17, accentColor: 'var(--primary)' }}
                      />
                      <span>Allow <strong>Residents</strong> to view this chat (Public Read-Only Transparency)</span>
                    </label>
                  </div>
                </div>

                {/* Granular Member Selection */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, flexWrap: 'wrap', gap: 8 }}>
                    <label style={{ fontSize: 13, fontWeight: 700, color: '#1e293b', margin: 0 }}>
                      Assign Committee Members & View Permissions
                    </label>
                    <span style={{ fontSize: 12, color: '#64748b' }}>
                      <strong>{selectedMemberIds.length}</strong> View & Chat | <strong>{selectedViewOnlyIds.length}</strong> View Only
                    </span>
                  </div>

                  <p style={{ fontSize: 12, color: '#64748b', margin: '0 0 10px 0' }}>
                    Choose <strong>Add (View & Chat)</strong> for full communication or <strong>View Only</strong> for spectator reading access.
                  </p>

                  {/* Filter members search */}
                  <div style={{ position: 'relative', marginBottom: 10 }}>
                    <Search size={15} style={{ position: 'absolute', left: 12, top: 11, color: '#94a3b8' }} />
                    <input
                      type="text"
                      className="form-input"
                      placeholder="Filter members by name, designation, phone..."
                      value={memberSearch}
                      onChange={(e) => setMemberSearch(e.target.value)}
                      style={{ paddingLeft: 36, height: 38, fontSize: 13 }}
                    />
                  </div>

                  {/* Members List Box */}
                  <div style={{ border: '1px solid #e2e8f0', borderRadius: 10, maxHeight: 240, overflowY: 'auto', background: '#fff' }}>
                    {filteredModalMembers.length === 0 ? (
                      <div style={{ padding: 24, textAlign: 'center', fontSize: 13, color: '#94a3b8' }}>
                        No committee members found
                      </div>
                    ) : (
                      filteredModalMembers.map(m => {
                        const isChat = selectedMemberIds.includes(m._id);
                        const isView = selectedViewOnlyIds.includes(m._id);

                        return (
                          <div 
                            key={m._id}
                            className="chat-member-row"
                            style={{
                              background: isChat ? '#f0fdf4' : isView ? '#fffbeb' : '#fff'
                            }}
                          >
                            <div>
                              <div style={{ fontWeight: 600, fontSize: 13, color: '#0f172a' }}>
                                {m.name} {m.designation && <span style={{ fontSize: 11, color: '#64748b', fontWeight: 'normal' }}>({m.designation})</span>}
                              </div>
                              <div style={{ fontSize: 11, color: '#94a3b8' }}>
                                {m.phone_number} {m.member_id && `• ID: ${m.member_id}`}
                              </div>
                            </div>

                            <div className="chat-member-actions" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                              {/* Option 1: Add (View & Chat) */}
                              <button
                                type="button"
                                onClick={() => toggleMemberSelection(m._id)}
                                title="Grants full view and sending messages permission"
                                style={{
                                  padding: '6px 12px',
                                  fontSize: 12,
                                  borderRadius: 8,
                                  border: '1px solid',
                                  cursor: 'pointer',
                                  fontWeight: 600,
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: 5,
                                  borderColor: isChat ? '#15803d' : '#cbd5e1',
                                  background: isChat ? '#15803d' : '#ffffff',
                                  color: isChat ? '#ffffff' : '#334155'
                                }}
                              >
                                {isChat ? <Check size={13} /> : null}
                                {isChat ? 'Added (View & Chat)' : '+ Add (View & Chat)'}
                              </button>

                              {/* Option 2: View Only */}
                              <button
                                type="button"
                                onClick={() => toggleViewOnlySelection(m._id)}
                                title="Grants read-only access to this group"
                                style={{
                                  padding: '6px 12px',
                                  fontSize: 12,
                                  borderRadius: 8,
                                  border: '1px solid',
                                  cursor: 'pointer',
                                  fontWeight: 600,
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: 5,
                                  borderColor: isView ? '#b45309' : '#cbd5e1',
                                  background: isView ? '#b45309' : '#ffffff',
                                  color: isView ? '#ffffff' : '#334155'
                                }}
                              >
                                {isView ? <Check size={13} /> : null}
                                {isView ? 'View Only' : '+ View Only'}
                              </button>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              </div>

              {/* Actions Footer */}
              <div className="chat-modal-footer">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="btn btn-secondary"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="btn btn-primary"
                >
                  {isSaving ? 'Saving...' : editingGroup ? 'Save Changes' : 'Create Group'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DELETE CONFIRMATION MODAL */}
      {deleteId && (
        <div className="chat-modal-overlay">
          <div style={{ background: '#fff', borderRadius: 16, width: '100%', maxWidth: 420, padding: 24, textAlign: 'center', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)' }}>
            <Trash2 size={40} color="var(--danger)" style={{ margin: '0 auto 12px auto' }} />
            <h3 style={{ fontSize: 18, fontWeight: 700, margin: '0 0 8px 0', color: '#0f172a' }}>Delete Chat Group?</h3>
            <p style={{ fontSize: 13, color: '#64748b', margin: '0 0 20px 0', lineHeight: 1.5 }}>
              Are you sure you want to delete this group? The group will be archived and hidden from all members.
            </p>
            <div style={{ display: 'flex', justifyContent: 'center', gap: 10 }}>
              <button onClick={() => setDeleteId(null)} className="btn btn-secondary">
                Cancel
              </button>
              <button onClick={handleDeleteGroup} className="btn" style={{ background: 'var(--danger)', color: '#fff' }}>
                Yes, Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
