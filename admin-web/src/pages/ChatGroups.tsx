import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { toast } from 'react-hot-toast';
import { 
  MessageSquare, Plus, Edit2, Trash2, Search, X, Eye, 
  Send, Shield, RefreshCw, Check, CornerDownRight, Users
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

// Avatar Initials & Color Helpers
const AVATAR_PALETTES = [
  { bg: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)', text: '#ffffff', border: '1.5px solid rgba(255, 255, 255, 0.85)' }, // Blue
  { bg: 'linear-gradient(135deg, #8b5cf6 0%, #6d28d9 100%)', text: '#ffffff', border: '1.5px solid rgba(255, 255, 255, 0.85)' }, // Purple
  { bg: 'linear-gradient(135deg, #ec4899 0%, #be185d 100%)', text: '#ffffff', border: '1.5px solid rgba(255, 255, 255, 0.85)' }, // Pink
  { bg: 'linear-gradient(135deg, #10b981 0%, #047857 100%)', text: '#ffffff', border: '1.5px solid rgba(255, 255, 255, 0.85)' }, // Emerald
  { bg: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)', text: '#ffffff', border: '1.5px solid rgba(255, 255, 255, 0.85)' }, // Amber
  { bg: 'linear-gradient(135deg, #06b6d4 0%, #0e7490 100%)', text: '#ffffff', border: '1.5px solid rgba(255, 255, 255, 0.85)' }, // Cyan
  { bg: 'linear-gradient(135deg, #6366f1 0%, #4338ca 100%)', text: '#ffffff', border: '1.5px solid rgba(255, 255, 255, 0.85)' }, // Indigo
  { bg: 'linear-gradient(135deg, #f97316 0%, #c2410c 100%)', text: '#ffffff', border: '1.5px solid rgba(255, 255, 255, 0.85)' }, // Orange
  { bg: 'linear-gradient(135deg, #14b8a6 0%, #0f766e 100%)', text: '#ffffff', border: '1.5px solid rgba(255, 255, 255, 0.85)' }, // Teal
  { bg: 'linear-gradient(135deg, #475569 0%, #1e293b 100%)', text: '#ffffff', border: '1.5px solid rgba(255, 255, 255, 0.85)' }, // Slate
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
    return { 
      bg: 'linear-gradient(135deg, #452b14 0%, #221307 100%)', 
      text: '#fbbf24',
      border: '1.5px solid rgba(245, 158, 11, 0.5)',
      boxShadow: '0 2px 8px rgba(245, 158, 11, 0.25)'
    };
  }
  if (!name) return { 
    bg: 'linear-gradient(135deg, #475569 0%, #1e293b 100%)', 
    text: '#ffffff', 
    border: '1.5px solid rgba(255, 255, 255, 0.85)',
    boxShadow: '0 2px 6px rgba(0, 0, 0, 0.15)'
  };
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const idx = Math.abs(hash) % AVATAR_PALETTES.length;
  return {
    ...AVATAR_PALETTES[idx],
    boxShadow: '0 2px 6px rgba(0, 0, 0, 0.15)'
  };
};

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
  const [replyingMessage, setReplyingMessage] = useState<MessageItem | null>(null);
  const [editingMsgId, setEditingMsgId] = useState<string | null>(null);
  const [showMembersPopover, setShowMembersPopover] = useState(false);
  const [participantFilter, setParticipantFilter] = useState('');

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
          // Reconcile optimistic temp message if present
          const tempIdx = prev.findIndex(m => m._id.startsWith('temp_') && m.text === newMsg.text);
          if (tempIdx !== -1) {
            const copy = [...prev];
            copy[tempIdx] = newMsg;
            return copy;
          }
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
            const pendingOptimistic = prev.filter(p => p._id.startsWith('temp_') || (p as any).is_optimistic);

            if (pendingOptimistic.length === 0) {
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
            }

            // Preserve pending optimistic messages that the server hasn't committed yet so they never hide
            const unacknowledged = pendingOptimistic.filter(opt => {
              const inIncoming = incoming.some(inc => 
                inc._id === opt._id || 
                (inc.text.trim() === opt.text.trim() && (
                  (inc.sender_role || '').toLowerCase() === (opt.sender_role || '').toLowerCase() ||
                  inc.sender_name === opt.sender_name
                ))
              );
              return !inIncoming;
            });

            return [...incoming, ...unacknowledged];
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
    setShowMembersPopover(false);
    setParticipantFilter('');
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
    if (!chatInput.trim() || !activeChatGroup) return;

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

    if (editingMsgId) {
      const textToEdit = chatInput.trim();
      const idToEdit = editingMsgId;
      // Optimistically update
      setChatMessages(prev => prev.map(m => m._id === idToEdit ? { ...m, text: textToEdit, is_edited: true } : m));
      setEditingMsgId(null);
      setChatInput('');

      try {
        await axios.put(
          `${API_URL}/chat/messages/${idToEdit}`,
          { new_text: textToEdit },
          getHeaders()
        );
      } catch (err: any) {
        toast.error(err.response?.data?.msg || 'Failed to edit message');
      }
      return;
    }

    const textToSend = chatInput.trim();
    const currentReplying = replyingMessage;
    const tempId = `temp_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;

    // 1. WhatsApp-style instant optimistic send (0ms delay) - message appears on screen immediately
    const optimisticMsg: MessageItem = {
      _id: tempId,
      group_id: activeChatGroup._id,
      sender: adminUser?._id || 'admin',
      sender_name: adminName,
      sender_role: 'Admin',
      text: textToSend,
      reply_to: currentReplying ? {
        message_id: currentReplying._id,
        sender_name: currentReplying.sender_name,
        text: currentReplying.text
      } : undefined,
      createdAt: new Date().toISOString()
    };

    setChatMessages(prev => [...prev, optimisticMsg]);
    setChatInput('');
    setReplyingMessage(null);
    scrollToBottom();

    // 2. Background HTTP request
    try {
      const payload: any = {
        text: textToSend
      };
      if (currentReplying) {
        payload.reply_to_message_id = currentReplying._id;
      }

      const res = await axios.post(
        `${API_URL}/chat/groups/${activeChatGroup._id}/messages`,
        payload,
        getHeaders()
      );

      if (res.data?.message) {
        const sentMsg = res.data.message;
        setChatMessages(prev => {
          if (prev.some(m => m._id === sentMsg._id)) {
            return prev.filter(m => m._id !== tempId);
          }
          const hasTemp = prev.some(m => m._id === tempId);
          if (hasTemp) {
            return prev.map(m => m._id === tempId ? sentMsg : m);
          }
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
    } catch (err: any) {
      // Revert optimistic message if network fails
      setChatMessages(prev => prev.filter(m => m._id !== tempId));
      toast.error(err.response?.data?.msg || 'Failed to send message');
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

  const selectAllMembers = (asViewOnly = false) => {
    const targetIds = filteredModalMembers.map(m => m._id);
    if (asViewOnly) {
      const newViewOnly = Array.from(new Set([...selectedViewOnlyIds, ...targetIds]));
      setSelectedViewOnlyIds(newViewOnly);
      setSelectedMemberIds(selectedMemberIds.filter(id => !targetIds.includes(id)));
      toast.success(`Selected ${targetIds.length} members as View Only`);
    } else {
      const newChat = Array.from(new Set([...selectedMemberIds, ...targetIds]));
      setSelectedMemberIds(newChat);
      setSelectedViewOnlyIds(selectedViewOnlyIds.filter(id => !targetIds.includes(id)));
      toast.success(`Selected ${targetIds.length} members (View & Chat)`);
    }
  };

  const deselectAllFiltered = () => {
    const targetIds = filteredModalMembers.map(m => m._id);
    setSelectedMemberIds(selectedMemberIds.filter(id => !targetIds.includes(id)));
    setSelectedViewOnlyIds(selectedViewOnlyIds.filter(id => !targetIds.includes(id)));
    toast.success('Cleared member selection');
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
            {(() => {
              const activeMembers = activeChatGroup.members || [];
              const viewOnlyMembers = activeChatGroup.view_only_members || [];
              const memberNames = activeMembers.map((m: any) => {
                const mId = m.member_id || (allMembers.find((u: any) => u._id === m._id)?.member_id);
                return mId || m.name || 'Member';
              });
              const totalActive = memberNames.length;
              const totalViewOnly = viewOnlyMembers.length;

              let participantSubtitle = 'No members';
              if (totalActive > 0 && totalActive <= 3) {
                participantSubtitle = `Participants: ${memberNames.join(', ')}`;
              } else if (totalActive > 3) {
                participantSubtitle = `${totalActive} Active Members (${memberNames.slice(0, 3).join(', ')} +${totalActive - 3} more)`;
              }

              const fullParticipantTooltip = `Group: ${activeChatGroup.name} (${activeChatGroup.group_type || 'General'} Committee)\nActive Members (${totalActive}):\n${memberNames.join(', ') || 'None'}${totalViewOnly > 0 ? `\n\nView-Only Members (${totalViewOnly})` : ''}`;

              return (
                <div 
                  className="chat-modal-header" 
                  style={{ 
                    padding: '12px 18px', 
                    flexShrink: 0, 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'space-between',
                    gap: 12
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <h3 
                      style={{ 
                        margin: 0, 
                        fontSize: 16, 
                        fontWeight: 700, 
                        color: '#0f172a', 
                        display: 'flex', 
                        alignItems: 'center', 
                        gap: 8,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap'
                      }}
                      title={activeChatGroup.name}
                    >
                      <MessageSquare size={18} color="#1d4ed8" style={{ flexShrink: 0 }} />
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {activeChatGroup.name}
                      </span>
                    </h3>

                    <div 
                      style={{ 
                        fontSize: 12, 
                        color: typingUsers.length > 0 ? '#1d4ed8' : '#64748b',
                        marginTop: 2,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap'
                      }}
                      title={typingUsers.length > 0 ? undefined : fullParticipantTooltip}
                    >
                      {typingUsers.length > 0 ? (
                        <span className="admin-typing-header">
                          <span className="admin-typing-pulse-dot" />
                          {typingUsers.length === 1 
                            ? `${typingUsers[0]} is typing...` 
                            : `${typingUsers.join(', ')} are typing...`}
                        </span>
                      ) : (
                        <span>
                          {activeChatGroup.group_type || 'General'} Committee • {participantSubtitle}
                          {totalViewOnly > 0 && ` • ${totalViewOnly} View-Only`}
                        </span>
                      )}
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                    <button
                      type="button"
                      onClick={() => setShowMembersPopover(prev => !prev)}
                      className="btn"
                      title={showMembersPopover ? "Hide participants list" : "View all participants"}
                      style={{
                        padding: '5px 10px',
                        fontSize: 12,
                        borderRadius: 6,
                        background: showMembersPopover ? '#e0e7ff' : '#f1f5f9',
                        color: showMembersPopover ? '#1d4ed8' : '#475569',
                        border: '1px solid #cbd5e1',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 5,
                        cursor: 'pointer',
                        fontWeight: 600
                      }}
                    >
                      <Users size={14} color={showMembersPopover ? '#1d4ed8' : '#64748b'} />
                      <span>{totalActive}</span>
                    </button>

                    <button 
                      onClick={() => {
                        setActiveChatGroup(null);
                        setShowMembersPopover(false);
                      }}
                      className="btn-icon"
                      style={{ cursor: 'pointer' }}
                      title="Close chat"
                    >
                      <X size={20} />
                    </button>
                  </div>
                </div>
              );
            })()}

            {/* Participants Popover Drawer */}
            {showMembersPopover && (() => {
              const activeMembers = activeChatGroup.members || [];
              const viewOnlyMembers = activeChatGroup.view_only_members || [];
              const allGroupMembers = [
                ...activeMembers.map((m: any) => ({ ...m, isViewOnly: false })),
                ...viewOnlyMembers.map((m: any) => ({ ...m, isViewOnly: true }))
              ];

              const filtered = allGroupMembers.filter((m: any) => {
                const matched = allMembers.find((u: any) => u._id === m._id);
                const memberId = (m.member_id || matched?.member_id || '').toLowerCase();
                const name = (m.name || matched?.name || '').toLowerCase();
                const q = participantFilter.toLowerCase();
                return memberId.includes(q) || name.includes(q);
              });

              return (
                <div style={{
                  background: '#ffffff',
                  borderBottom: '1px solid #e2e8f0',
                  padding: '12px 18px',
                  maxHeight: 240,
                  display: 'flex',
                  flexDirection: 'column',
                  flexShrink: 0,
                  boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)',
                  zIndex: 10
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: '#1e293b', display: 'flex', alignItems: 'center', gap: 6 }}>
                      <Users size={15} color="#1d4ed8" />
                      Participants ({activeMembers.length} Active Chat{viewOnlyMembers.length > 0 ? `, ${viewOnlyMembers.length} View-Only` : ''})
                    </span>
                    <button 
                      type="button" 
                      onClick={() => setShowMembersPopover(false)} 
                      style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#64748b' }}
                      title="Close participants list"
                    >
                      <X size={15} />
                    </button>
                  </div>

                  <div style={{ position: 'relative', marginBottom: 8 }}>
                    <Search size={14} style={{ position: 'absolute', left: 10, top: 9, color: '#94a3b8' }} />
                    <input
                      type="text"
                      placeholder="Search member ID or name..."
                      value={participantFilter}
                      onChange={(e) => setParticipantFilter(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '6px 10px 6px 30px',
                        fontSize: 12,
                        borderRadius: 6,
                        border: '1px solid #cbd5e1',
                        outline: 'none'
                      }}
                    />
                  </div>

                  <div style={{ overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {filtered.length === 0 ? (
                      <div style={{ fontSize: 12, color: '#94a3b8', textAlign: 'center', padding: '12px 0' }}>
                        No participants match "{participantFilter}"
                      </div>
                    ) : (
                      filtered.map((m: any, idx: number) => {
                        const matched = allMembers.find((u: any) => u._id === m._id);
                        const memberId = m.member_id || matched?.member_id;
                        const name = m.name || matched?.name || 'Member';
                        const desig = m.designation || matched?.designation;

                        return (
                          <div
                            key={m._id ? `${m._id}-${idx}` : idx}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              padding: '6px 10px',
                              borderRadius: 6,
                              background: m.isViewOnly ? '#fffbeb' : '#f8fafc',
                              border: '1px solid #e2e8f0',
                              fontSize: 12
                            }}
                          >
                            <div>
                              <strong style={{ color: '#0f172a' }}>{memberId ? `${memberId} - ` : ''}{name}</strong>
                              {desig && <span style={{ color: '#64748b', marginLeft: 6 }}>({desig})</span>}
                            </div>
                            <span
                              style={{
                                fontSize: 10,
                                fontWeight: 600,
                                padding: '2px 8px',
                                borderRadius: 12,
                                background: m.isViewOnly ? '#fef3c7' : '#dcfce7',
                                color: m.isViewOnly ? '#b45309' : '#15803d'
                              }}
                            >
                              {m.isViewOnly ? 'View Only' : 'Active Chat'}
                            </span>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              );
            })()}

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

                  const actualName = isAdminMsg 
                    ? (adminName || 'Admin') 
                    : (senderObj?.name || matchedMember?.name || msg.sender_name || memberId || 'Member');
                  const initials = getSenderInitials(actualName);
                  const avatarColor = getAvatarColor(actualName, isAdminMsg);

                  return (
                    <div 
                      key={msg._id} 
                      className={`admin-msg-row ${isAdminMsg ? 'admin-msg-row-me' : 'admin-msg-row-other'}`}
                    >
                      {/* Left Avatar for other members */}
                      {!isAdminMsg && (
                        <div 
                          className="admin-msg-avatar"
                          style={{ 
                            background: avatarColor.bg, 
                            color: avatarColor.text,
                            border: avatarColor.border,
                            boxShadow: avatarColor.boxShadow
                          }}
                          title={`${actualName}${designation ? ` (${designation})` : ''}`}
                        >
                          {initials}
                        </div>
                      )}

                      <div 
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

                      {/* Right Avatar for Admin (You) */}
                      {isAdminMsg && (
                        <div 
                          className="admin-msg-avatar"
                          style={{ 
                            background: avatarColor.bg, 
                            color: avatarColor.text,
                            border: avatarColor.border,
                            boxShadow: avatarColor.boxShadow
                          }}
                          title="Admin (You)"
                        >
                          {initials}
                        </div>
                      )}
                    </div>
                  );
                })
              )}

              {/* Typing indicator bubble */}
              {typingUsers.length > 0 && (
                <div className="admin-typing-row">
                  <div className="admin-typing-avatar">
                    {getSenderInitials(typingUsers[0])}
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
                  disabled={!chatInput.trim()}
                  className={`admin-chat-send-btn ${chatInput.trim() ? 'admin-chat-send-btn-active' : ''}`}
                  title={editingMsgId ? "Save edited message" : "Send message (Enter)"}
                >
                  {editingMsgId ? (
                    <Check size={18} strokeWidth={2.4} />
                  ) : (
                    <Send size={16} strokeWidth={2.2} style={{ transform: 'translate(1px, -0.5px)' }} />
                  )}
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

                  {/* Filter members search & Select All Controls */}
                  <div style={{ display: 'flex', gap: 10, marginBottom: 10, flexWrap: 'wrap' }}>
                    <div style={{ position: 'relative', flex: 1, minWidth: 220 }}>
                      <Search size={15} style={{ position: 'absolute', left: 12, top: 11, color: '#94a3b8' }} />
                      <input
                        type="text"
                        className="form-input"
                        placeholder="Filter members by name, designation, phone..."
                        value={memberSearch}
                        onChange={(e) => setMemberSearch(e.target.value)}
                        style={{ paddingLeft: 36, height: 38, fontSize: 13, width: '100%' }}
                      />
                    </div>

                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      <button
                        type="button"
                        onClick={() => selectAllMembers(false)}
                        className="btn"
                        style={{
                          padding: '6px 12px',
                          fontSize: 12,
                          borderRadius: 8,
                          background: '#f0fdf4',
                          color: '#15803d',
                          border: '1px solid #bbf7d0',
                          fontWeight: 600,
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 5
                        }}
                      >
                        <Users size={13} />
                        Select All (View & Chat) ({filteredModalMembers.length})
                      </button>

                      <button
                        type="button"
                        onClick={() => selectAllMembers(true)}
                        className="btn"
                        style={{
                          padding: '6px 12px',
                          fontSize: 12,
                          borderRadius: 8,
                          background: '#fffbeb',
                          color: '#b45309',
                          border: '1px solid #fde68a',
                          fontWeight: 600,
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 5
                        }}
                      >
                        <Eye size={13} />
                        Select All (View Only)
                      </button>

                      {(selectedMemberIds.length > 0 || selectedViewOnlyIds.length > 0) && (
                        <button
                          type="button"
                          onClick={deselectAllFiltered}
                          style={{
                            padding: '6px 10px',
                            fontSize: 12,
                            borderRadius: 8,
                            background: '#ffffff',
                            color: '#ef4444',
                            border: '1px solid #fca5a5',
                            cursor: 'pointer',
                            fontWeight: 500
                          }}
                        >
                          Clear All
                        </button>
                      )}
                    </div>
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
