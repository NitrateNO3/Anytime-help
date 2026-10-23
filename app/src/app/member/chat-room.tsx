import React, { useState, useEffect, useRef } from 'react';
import { 
  View, Text, StyleSheet, FlatList, TextInput, TouchableOpacity, 
  KeyboardAvoidingView, Platform, ActivityIndicator, StatusBar, Alert 
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import axios from 'axios';
import * as SecureStore from 'expo-secure-store';
import { io, Socket } from 'socket.io-client';

const API_URL = 'https://anytime-help.onrender.com/api';
const SOCKET_URL = 'https://anytime-help.onrender.com';

interface ChatMessageItem {
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

export default function MemberChatRoomScreen() {
  const router = useRouter();
  const { groupId, groupName, groupType, canSend } = useLocalSearchParams();

  const isWriteAllowed = canSend === '1';

  const [messages, setMessages] = useState<ChatMessageItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [inputText, setInputText] = useState('');
  const [sending, setSending] = useState(false);
  const [currentUser, setCurrentUser] = useState<any>(null);

  // WhatsApp-like reply & edit state
  const [replyingTo, setReplyingTo] = useState<ChatMessageItem | null>(null);
  const [editingMessage, setEditingMessage] = useState<ChatMessageItem | null>(null);

  const flatListRef = useRef<FlatList>(null);
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    loadUserAndMessages();

    // Setup Socket.io connection & join group room
    const socket = io(SOCKET_URL, { transports: ['websocket', 'polling'] });
    socketRef.current = socket;

    socket.emit('join_chat_group', groupId);

    socket.on('new_message', (newMsg: ChatMessageItem) => {
      if (newMsg.group_id === groupId) {
        setMessages(prev => {
          if (prev.some(m => m._id === newMsg._id)) return prev;
          return [...prev, newMsg];
        });
        setTimeout(() => {
          flatListRef.current?.scrollToEnd({ animated: true });
        }, 100);
      }
    });

    socket.on('message_edited', ({ message_id, new_text, is_edited }: any) => {
      setMessages(prev => prev.map(m => {
        if (m._id === message_id) {
          return { ...m, text: new_text, is_edited: true };
        }
        return m;
      }));
    });

    socket.on('message_deleted', ({ message_id }: any) => {
      setMessages(prev => prev.map(m => {
        if (m._id === message_id) {
          return { ...m, text: 'This message was deleted', is_deleted: true };
        }
        return m;
      }));
    });

    return () => {
      socket.emit('leave_chat_group', groupId);
      socket.disconnect();
    };
  }, [groupId]);

  const loadUserAndMessages = async () => {
    try {
      const stored = await SecureStore.getItemAsync('userData');
      if (stored) {
        setCurrentUser(JSON.parse(stored));
      }

      const token = await SecureStore.getItemAsync('userToken');
      const res = await axios.get(`${API_URL}/chat/groups/${groupId}/messages`, {
        headers: { 'x-auth-token': token }
      });
      if (res.data?.messages) {
        setMessages(res.data.messages);
      }
    } catch (e) {
      console.log('Error loading messages:', e);
    } finally {
      setLoading(false);
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: false });
      }, 200);
    }
  };

  const handleSendOrUpdate = async () => {
    if (!inputText.trim() || sending) return;

    const token = await SecureStore.getItemAsync('userToken');

    // Case 1: Editing existing message
    if (editingMessage) {
      setSending(true);
      try {
        await axios.put(
          `${API_URL}/chat/messages/${editingMessage._id}`,
          { new_text: inputText.trim() },
          { headers: { 'x-auth-token': token } }
        );
        setEditingMessage(null);
        setInputText('');
      } catch (err: any) {
        Alert.alert('Error', err.response?.data?.msg || 'Could not edit message');
      } finally {
        setSending(false);
      }
      return;
    }

    // Case 2: Sending a new message (or quoted reply)
    setSending(true);
    const payload: any = {
      text: inputText.trim(),
    };
    if (replyingTo) {
      payload.reply_to_message_id = replyingTo._id;
    }

    try {
      await axios.post(
        `${API_URL}/chat/groups/${groupId}/messages`,
        payload,
        { headers: { 'x-auth-token': token } }
      );
      setInputText('');
      setReplyingTo(null);
    } catch (err: any) {
      Alert.alert('Error', err.response?.data?.msg || 'Failed to send message');
    } finally {
      setSending(false);
    }
  };

  const handleMessageLongPress = (item: ChatMessageItem) => {
    if (item.is_deleted) return;

    const myId = currentUser?._id || currentUser?.id;
    const isMyMessage = item.sender?._id === myId || item.sender === myId;

    const options: any[] = [
      { text: 'Reply', onPress: () => setReplyingTo(item) },
    ];

    if (isMyMessage) {
      options.push({
        text: 'Edit',
        onPress: () => {
          setEditingMessage(item);
          setInputText(item.text);
          setReplyingTo(null);
        }
      });
      options.push({
        text: 'Delete',
        style: 'destructive',
        onPress: () => confirmDeleteMessage(item._id)
      });
    }

    options.push({ text: 'Cancel', style: 'cancel' });

    Alert.alert('Message Options', item.text, options);
  };

  const confirmDeleteMessage = async (msgId: string) => {
    try {
      const token = await SecureStore.getItemAsync('userToken');
      await axios.delete(`${API_URL}/chat/messages/${msgId}`, {
        headers: { 'x-auth-token': token }
      });
    } catch (err: any) {
      Alert.alert('Error', err.response?.data?.msg || 'Could not delete message');
    }
  };

  const formatMessageTime = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
      return '';
    }
  };

  const renderMessageBubble = ({ item }: { item: ChatMessageItem }) => {
    const myId = currentUser?._id || currentUser?.id;
    const isMe = item.sender?._id === myId || item.sender === myId;

    return (
      <TouchableOpacity
        activeOpacity={0.8}
        onLongPress={() => handleMessageLongPress(item)}
        style={[
          styles.messageRow,
          isMe ? styles.messageRowMe : styles.messageRowOther
        ]}
      >
        <View style={[styles.bubble, isMe ? styles.bubbleMe : styles.bubbleOther]}>
          {/* Sender Name & Designation */}
          {!isMe && (
            <View style={styles.senderHeader}>
              <Text style={styles.senderName}>{item.sender_name}</Text>
              {item.sender_designation ? (
                <Text style={styles.senderDesignation}>• {item.sender_designation}</Text>
              ) : null}
            </View>
          )}

          {/* WhatsApp-like Quoted Reply Preview */}
          {item.reply_to && (
            <View style={[styles.quoteBox, isMe ? styles.quoteBoxMe : styles.quoteBoxOther]}>
              <Text style={styles.quoteSender}>{item.reply_to.sender_name}</Text>
              <Text style={styles.quoteText} numberOfLines={2}>
                {item.reply_to.text}
              </Text>
            </View>
          )}

          {/* Message Text */}
          <Text style={[styles.messageText, isMe ? styles.messageTextMe : styles.messageTextOther, item.is_deleted ? styles.deletedText : null]}>
            {item.is_deleted ? '🚫 This message was deleted' : item.text}
          </Text>

          {/* Time & Edited Badge */}
          <View style={styles.metaRow}>
            {item.is_edited && !item.is_deleted && (
              <Text style={[styles.metaText, isMe ? styles.metaTextMe : styles.metaTextOther]}>edited • </Text>
            )}
            <Text style={[styles.metaText, isMe ? styles.metaTextMe : styles.metaTextOther]}>
              {formatMessageTime(item.createdAt)}
            </Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right', 'bottom']}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

      {/* Screen Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#0F172A" />
        </TouchableOpacity>

        <View style={{ flex: 1, marginRight: 8 }}>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {groupName || 'Committee Chat'}
          </Text>
          <Text style={styles.headerSubtitle}>
            {groupType ? `${groupType} Committee • ` : ''}
            {isWriteAllowed ? 'You can chat' : 'View Only Mode'}
          </Text>
        </View>

        {!isWriteAllowed && (
          <View style={styles.viewOnlyHeaderBadge}>
            <Ionicons name="eye" size={14} color="#B45309" />
            <Text style={styles.viewOnlyHeaderText}>Spectator</Text>
          </View>
        )}
      </View>

      {/* WhatsApp-style KeyboardAvoiding wrapper around messages + input bar */}
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 88 : 0}
      >
        {/* Messages List */}
        {loading ? (
          <View style={styles.centerContainer}>
            <ActivityIndicator size="large" color="#2563EB" />
          </View>
        ) : (
          <FlatList
            ref={flatListRef}
            data={messages}
            keyExtractor={(item) => item._id}
            renderItem={renderMessageBubble}
            contentContainerStyle={styles.messagesList}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            onContentSizeChange={() => {
              flatListRef.current?.scrollToEnd({ animated: true });
            }}
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Ionicons name="chatbubble-ellipses-outline" size={48} color="#CBD5E1" />
                <Text style={styles.emptyText}>No messages yet in this group.</Text>
                <Text style={styles.emptySubText}>
                  {isWriteAllowed ? 'Say hello and start the discussion!' : 'Discussions will appear here once active.'}
                </Text>
              </View>
            }
          />
        )}

        {/* Bottom Bar: Input OR View-Only Banner */}
        {isWriteAllowed ? (
          <View style={styles.inputContainer}>
            {/* WhatsApp Quote / Reply Bar Preview */}
            {replyingTo && (
              <View style={styles.activeQuoteBar}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.activeQuoteSender}>Replying to {replyingTo.sender_name}</Text>
                  <Text style={styles.activeQuoteText} numberOfLines={1}>{replyingTo.text}</Text>
                </View>
                <TouchableOpacity onPress={() => setReplyingTo(null)}>
                  <Ionicons name="close" size={18} color="#64748B" />
                </TouchableOpacity>
              </View>
            )}

            {/* Editing Bar Preview */}
            {editingMessage && (
              <View style={styles.activeEditBar}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.activeEditTitle}>Editing message</Text>
                </View>
                <TouchableOpacity onPress={() => { setEditingMessage(null); setInputText(''); }}>
                  <Ionicons name="close" size={18} color="#64748B" />
                </TouchableOpacity>
              </View>
            )}

            <View style={styles.inputRow}>
              <TextInput
                style={styles.textInput}
                placeholder={editingMessage ? "Edit message..." : "Type a message..."}
                placeholderTextColor="#94A3B8"
                value={inputText}
                onChangeText={setInputText}
                multiline
                maxLength={1000}
                onFocus={() => {
                  setTimeout(() => {
                    flatListRef.current?.scrollToEnd({ animated: true });
                  }, 150);
                }}
              />
              <TouchableOpacity
                style={[styles.sendButton, !inputText.trim() ? styles.sendButtonDisabled : null]}
                onPress={handleSendOrUpdate}
                disabled={!inputText.trim() || sending}
              >
                {sending ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Ionicons 
                    name={editingMessage ? "checkmark" : "send"} 
                    size={18} 
                    color="#FFFFFF" 
                  />
                )}
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <View style={styles.viewOnlyFooter}>
            <Ionicons name="lock-closed" size={16} color="#B45309" />
            <Text style={styles.viewOnlyFooterText}>
              You have View-Only access to this group. You can read discussions but cannot send messages.
            </Text>
          </View>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F1F5F9',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  backButton: {
    padding: 6,
    marginRight: 8,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
  },
  headerSubtitle: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  viewOnlyHeaderBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  viewOnlyHeaderText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#B45309',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  messagesList: {
    padding: 16,
    paddingBottom: 20,
    gap: 8,
  },
  messageRow: {
    flexDirection: 'row',
    marginVertical: 4,
  },
  messageRowMe: {
    justifyContent: 'flex-end',
  },
  messageRowOther: {
    justifyContent: 'flex-start',
  },
  bubble: {
    maxWidth: '82%',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 16,
  },
  bubbleMe: {
    backgroundColor: '#2563EB',
    borderBottomRightRadius: 4,
  },
  bubbleOther: {
    backgroundColor: '#FFFFFF',
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  senderHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 4,
  },
  senderName: {
    fontSize: 12,
    fontWeight: '700',
    color: '#2563EB',
  },
  senderDesignation: {
    fontSize: 10,
    color: '#64748B',
  },
  quoteBox: {
    borderLeftWidth: 3,
    paddingLeft: 8,
    paddingVertical: 4,
    marginBottom: 6,
    borderRadius: 4,
  },
  quoteBoxMe: {
    borderLeftColor: '#93C5FD',
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
  },
  quoteBoxOther: {
    borderLeftColor: '#2563EB',
    backgroundColor: '#F8FAFC',
  },
  quoteSender: {
    fontSize: 11,
    fontWeight: '700',
    color: '#2563EB',
  },
  quoteText: {
    fontSize: 11,
    color: '#475569',
  },
  messageText: {
    fontSize: 14,
    lineHeight: 20,
  },
  messageTextMe: {
    color: '#FFFFFF',
  },
  messageTextOther: {
    color: '#0F172A',
  },
  deletedText: {
    fontStyle: 'italic',
    opacity: 0.8,
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    marginTop: 4,
  },
  metaText: {
    fontSize: 10,
  },
  metaTextMe: {
    color: 'rgba(255, 255, 255, 0.7)',
  },
  metaTextOther: {
    color: '#94A3B8',
  },
  emptyContainer: {
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#64748B',
    marginTop: 12,
  },
  emptySubText: {
    fontSize: 12,
    color: '#94A3B8',
    textAlign: 'center',
    marginTop: 4,
  },
  inputContainer: {
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    padding: 10,
  },
  activeQuoteBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#EFF6FF',
    borderLeftWidth: 3,
    borderLeftColor: '#2563EB',
    padding: 8,
    borderRadius: 6,
    marginBottom: 8,
  },
  activeQuoteSender: {
    fontSize: 11,
    fontWeight: '700',
    color: '#2563EB',
  },
  activeQuoteText: {
    fontSize: 11,
    color: '#475569',
  },
  activeEditBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FEF3C7',
    borderLeftWidth: 3,
    borderLeftColor: '#D97706',
    padding: 8,
    borderRadius: 6,
    marginBottom: 8,
  },
  activeEditTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: '#B45309',
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
  },
  textInput: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 10,
    fontSize: 14,
    color: '#0F172A',
    maxHeight: 100,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#2563EB',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: '#94A3B8',
  },
  viewOnlyFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FEF3C7',
    padding: 14,
    borderTopWidth: 1,
    borderTopColor: '#FDE68A',
  },
  viewOnlyFooterText: {
    fontSize: 12,
    color: '#92400E',
    fontWeight: '500',
    flex: 1,
    lineHeight: 16,
  },
});
