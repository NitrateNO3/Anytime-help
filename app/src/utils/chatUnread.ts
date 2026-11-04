// Unread chat counts shared by the chat tab dot, the chat lists and the chat
// room. Counts come from the server (GET /chat/unread); opening a chat marks
// it read (POST /chat/groups/:id/read).
import { useEffect, useState } from 'react';
import axios from 'axios';
import * as SecureStore from 'expo-secure-store';

const API_URL = 'https://anytime-help.onrender.com/api';

type State = { total: number; groups: Record<string, number> };

let state: State = { total: 0, groups: {} };
const listeners = new Set<(s: State) => void>();

// Chat currently open on screen: its messages are read as they arrive, and a
// push for it is not shown as a banner.
let activeChatGroupId: string | null = null;

const emit = () => listeners.forEach((l) => l(state));

const setState = (groups: Record<string, number>) => {
  const total = Object.values(groups).reduce((a, b) => a + (b || 0), 0);
  state = { total, groups };
  emit();
};

let refreshTimer: any = null;
let refreshing = false;

export const refreshChatUnread = async () => {
  if (refreshing) return;
  refreshing = true;
  try {
    const token = await SecureStore.getItemAsync('userToken');
    if (!token) return;
    const res = await axios.get(`${API_URL}/chat/unread`, { headers: { 'x-auth-token': token } });
    const groups: Record<string, number> = { ...(res.data?.groups || {}) };
    if (activeChatGroupId) groups[activeChatGroupId] = 0;
    setState(groups);
  } catch {
    // keep the last known counts
  } finally {
    refreshing = false;
  }
};

// Coalesce bursts (several messages arriving together) into one request
export const refreshChatUnreadSoon = (delay = 1200) => {
  if (refreshTimer) clearTimeout(refreshTimer);
  refreshTimer = setTimeout(() => { refreshTimer = null; refreshChatUnread(); }, delay);
};

// Counts that came with the chat list response
export const setChatUnreadFromGroups = (groups: { _id: string; unread_count?: number }[]) => {
  const map: Record<string, number> = {};
  groups.forEach((g) => { if (g?._id) map[g._id.toString()] = g._id.toString() === activeChatGroupId ? 0 : (g.unread_count || 0); });
  setState(map);
};

let markTimers: Record<string, any> = {};

export const markChatRead = (groupId: string, delay = 0) => {
  if (!groupId) return;
  if (state.groups[groupId]) setState({ ...state.groups, [groupId]: 0 });
  if (markTimers[groupId]) clearTimeout(markTimers[groupId]);
  markTimers[groupId] = setTimeout(async () => {
    delete markTimers[groupId];
    try {
      const token = await SecureStore.getItemAsync('userToken');
      if (!token) return;
      await axios.post(`${API_URL}/chat/groups/${groupId}/read`, {}, { headers: { 'x-auth-token': token } });
    } catch {
      // next open marks it again
    }
  }, delay);
};

export const setActiveChatGroup = (groupId: string | null) => { activeChatGroupId = groupId; };
export const getActiveChatGroup = () => activeChatGroupId;

export const useChatUnread = () => {
  const [s, setS] = useState<State>(state);
  useEffect(() => {
    listeners.add(setS);
    setS(state);
    return () => { listeners.delete(setS); };
  }, []);
  return s;
};
