import React, { useState, useEffect, useCallback } from 'react';
import { 
  View, Text, StyleSheet, FlatList, TouchableOpacity, 
  ActivityIndicator, RefreshControl, StatusBar, Platform, BackHandler 
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import axios from 'axios';
import * as SecureStore from 'expo-secure-store';
import { io } from 'socket.io-client';

const API_URL = 'https://anytime-help.onrender.com/api';
const SOCKET_URL = 'https://anytime-help.onrender.com';

interface ChatGroupItem {
  _id: string;
  name: string;
  description: string;
  group_type: string;
  can_other_members_view: boolean;
  can_residents_view: boolean;
  members: any[];
  view_only_members: any[];
  last_message?: {
    text: string;
    sender_name: string;
    timestamp: string;
  };
  user_access?: {
    can_view: boolean;
    can_send: boolean;
    is_member: boolean;
    is_view_only: boolean;
  };
  createdAt: string;
}

export default function ResidentChatsScreen() {
  const router = useRouter();
  const [groups, setGroups] = useState<ChatGroupItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useFocusEffect(
    useCallback(() => {
      fetchGroups();

      const onBackPress = () => {
        router.replace('/resident' as any);
        return true;
      };
      const sub = BackHandler.addEventListener('hardwareBackPress', onBackPress);
      return () => sub.remove();
    }, [])
  );

  useEffect(() => {
    const socket = io(SOCKET_URL, { transports: ['websocket', 'polling'] });

    socket.on('chat_group_created', () => fetchGroups(false));
    socket.on('chat_group_updated', () => fetchGroups(false));
    socket.on('chat_group_deleted', () => fetchGroups(false));
    socket.on('chat_group_last_message', ({ group_id, last_message }: any) => {
      try {
        const gId = (group_id?._id || group_id || '').toString();
        setGroups(prev => prev.map(g => {
          if (g?._id && g._id.toString() === gId) {
            return { ...g, last_message };
          }
          return g;
        }));
      } catch (e) {
        console.log('Error handling chat_group_last_message:', e);
      }
    });

    socket.on('new_message', (newMsg: any) => {
      try {
        if (!newMsg) return;
        const gId = (newMsg.group_id?._id || newMsg.group_id || '').toString();
        setGroups(prev => prev.map(g => {
          if (g?._id && g._id.toString() === gId) {
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
      } catch (e) {
        console.log('Error handling new_message in chats list:', e);
      }
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  const fetchGroups = async (showLoading = true) => {
    if (showLoading) setLoading(true);
    try {
      const token = await SecureStore.getItemAsync('userToken');
      const res = await axios.get(`${API_URL}/chat/groups`, {
        headers: { 'x-auth-token': token }
      });
      if (Array.isArray(res.data)) {
        setGroups(res.data);
      }
    } catch (e) {
      console.log('Error fetching resident chat groups:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchGroups(false);
  };

  const formatTime = (dateStr?: string) => {
    if (!dateStr) return '';
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return '';
      const now = new Date();
      const isToday = d.toDateString() === now.toDateString();
      if (isToday) {
        return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      }
      return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
    } catch {
      return '';
    }
  };

  const renderGroupItem = ({ item }: { item: ChatGroupItem }) => {
    const isViewOnly = item.user_access?.is_view_only;
    const canSend = item.user_access?.can_send;

    return (
      <TouchableOpacity
        style={styles.groupCard}
        activeOpacity={0.7}
        onPress={() => router.push({
          pathname: '/resident-chat-room' as any,
          params: {
            groupId: item._id,
            groupName: item.name,
            groupType: item.group_type,
            canSend: canSend ? '1' : '0',
            returnTo: '/resident/chats'
          }
        })}
      >
        {/* Avatar Icon */}
        <View style={[styles.avatarCircle, { backgroundColor: isViewOnly ? '#FEF3C7' : '#EFF6FF' }]}>
          <Ionicons 
            name={isViewOnly ? "megaphone-outline" : "chatbubbles"} 
            size={22} 
            color={isViewOnly ? "#D97706" : "#2563EB"} 
          />
        </View>

        {/* Middle Text Details */}
        <View style={styles.groupInfo}>
          <View style={styles.titleRow}>
            <Text style={styles.groupName} numberOfLines={1}>
              {item.name}
            </Text>
            <Text style={styles.timeText}>
              {formatTime(item.last_message?.timestamp || item.createdAt)}
            </Text>
          </View>

          {/* Subtitle / Last Message */}
          <Text style={styles.lastMessageText} numberOfLines={1}>
            {item.last_message?.text 
              ? `${item.last_message.sender_name ? item.last_message.sender_name + ': ' : ''}${item.last_message.text}`
              : (item.description || 'Tap to open discussion')}
          </Text>

          {/* Badges Row */}
          <View style={styles.tagsRow}>
            <View style={styles.typeBadge}>
              <Text style={styles.typeBadgeText}>{item.group_type || 'General'}</Text>
            </View>

            {isViewOnly ? (
              <View style={styles.viewOnlyBadge}>
                <Ionicons name="eye-outline" size={11} color="#B45309" />
                <Text style={styles.viewOnlyBadgeText}>Notice / View Only</Text>
              </View>
            ) : (
              <View style={styles.chatBadge}>
                <Ionicons name="chatbubble-ellipses-outline" size={11} color="#15803D" />
                <Text style={styles.chatBadgeText}>Can Chat</Text>
              </View>
            )}
          </View>
        </View>

        <Ionicons name="chevron-forward" size={18} color="#CBD5E1" />
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <StatusBar barStyle="dark-content" />

      {/* Modern Top Header */}
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => router.replace('/resident' as any)}
          activeOpacity={0.7}
        >
          <Ionicons name="arrow-back" size={24} color="#0F172A" />
        </TouchableOpacity>

        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Society Chats</Text>
          <Text style={styles.headerSubtitle}>Official Society Discussions & Groups</Text>
        </View>

        <TouchableOpacity 
          style={styles.refreshButton}
          onPress={onRefresh}
          activeOpacity={0.7}
        >
          <Ionicons name="refresh" size={20} color="#2563EB" />
        </TouchableOpacity>
      </View>

      {/* Main List */}
      {loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#2563EB" />
          <Text style={styles.loadingText}>Loading society chats...</Text>
        </View>
      ) : groups.length === 0 ? (
        <View style={styles.centerContainer}>
          <View style={styles.emptyIconCircle}>
            <Ionicons name="chatbubbles-outline" size={42} color="#94A3B8" />
          </View>
          <Text style={styles.emptyTitle}>No Active Society Chats</Text>
          <Text style={styles.emptySubtitle}>
            There are no official society chat groups open for residents right now. Once the RWA committee opens a group, it will appear here.
          </Text>
          <TouchableOpacity style={styles.retryBtn} onPress={onRefresh}>
            <Text style={styles.retryBtnText}>Refresh</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={groups}
          keyExtractor={item => item._id}
          renderItem={renderGroupItem}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#2563EB']} />
          }
          showsVerticalScrollIndicator={false}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC'
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    gap: 12
  },
  backButton: {
    padding: 6,
    borderRadius: 8,
    backgroundColor: '#F1F5F9'
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0F172A'
  },
  headerSubtitle: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 1
  },
  refreshButton: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: '#EFF6FF'
  },
  listContent: {
    padding: 16,
    paddingBottom: 24,
    gap: 10
  },
  groupCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
    gap: 12
  },
  avatarCircle: {
    width: 46,
    height: 46,
    borderRadius: 23,
    justifyContent: 'center',
    alignItems: 'center'
  },
  groupInfo: {
    flex: 1
  },
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 2
  },
  groupName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1E293B',
    flex: 1,
    marginRight: 8
  },
  timeText: {
    fontSize: 11,
    color: '#94A3B8',
    fontWeight: '500'
  },
  lastMessageText: {
    fontSize: 13,
    color: '#64748B',
    marginBottom: 6
  },
  tagsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6
  },
  typeBadge: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6
  },
  typeBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#475569',
    textTransform: 'uppercase'
  },
  viewOnlyBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
    gap: 3
  },
  viewOnlyBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#92400E'
  },
  chatBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
    gap: 3
  },
  chatBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#166534'
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#64748B'
  },
  emptyIconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 8
  },
  emptySubtitle: {
    fontSize: 13,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 18,
    maxWidth: 280,
    marginBottom: 20
  },
  retryBtn: {
    backgroundColor: '#2563EB',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 10
  },
  retryBtnText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 14
  }
});
