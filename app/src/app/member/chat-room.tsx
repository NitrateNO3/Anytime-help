import React, { useState, useEffect, useRef } from 'react';
import { 
  View, Text, StyleSheet, FlatList, TextInput, TouchableOpacity, 
  KeyboardAvoidingView, Platform, ActivityIndicator, StatusBar, Alert,
  Keyboard, TouchableWithoutFeedback, Animated
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

// WhatsApp-like Typing Indicator with 3 animated bouncing dots
function TypingIndicator({ typingUsers }: { typingUsers: string[] }) {
  const dot1 = useRef(new Animated.Value(0)).current;
  const dot2 = useRef(new Animated.Value(0)).current;
  const dot3 = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const createAnim = (val: Animated.Value, delay: number) => {
      return Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(val, {
            toValue: -5,
            duration: 260,
            useNativeDriver: true,
          }),
          Animated.timing(val, {
            toValue: 0,
            duration: 260,
            useNativeDriver: true,
          }),
          Animated.delay(520 - delay),
        ])
      );
    };

    const a1 = createAnim(dot1, 0);
    const a2 = createAnim(dot2, 140);
    const a3 = createAnim(dot3, 280);

    a1.start();
    a2.start();
    a3.start();

    return () => {
      a1.stop();
      a2.stop();
      a3.stop();
    };
  }, []);

  if (!typingUsers || typingUsers.length === 0) return null;

  const label = typingUsers.length === 1 
    ? `${typingUsers[0]} is typing...` 
    : `${typingUsers.join(', ')} are typing...`;

  return (
    <View style={styles.typingRow}>
      <View style={styles.typingAvatar}>
        <Text style={styles.typingAvatarText}>
          {(typingUsers[0] || '?').charAt(0).toUpperCase()}
        </Text>
      </View>
      <View style={styles.typingBubble}>
        <Animated.View style={[styles.typingDot, { transform: [{ translateY: dot1 }] }]} />
        <Animated.View style={[styles.typingDot, { transform: [{ translateY: dot2 }] }]} />
        <Animated.View style={[styles.typingDot, { transform: [{ translateY: dot3 }] }]} />
      </View>
      <Text style={styles.typingLabelText} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

export default function MemberChatRoomScreen() {
  const router = useRouter();
  const { groupId, groupName, groupType, canSend } = useLocalSearchParams();

  const cleanGroupId = (Array.isArray(groupId) ? groupId[0] : (groupId || '')).toString().trim();
  const isWriteAllowed = canSend === '1';

  const [messages, setMessages] = useState<ChatMessageItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [inputText, setInputText] = useState('');
  const [sending, setSending] = useState(false);
  const [currentUser, setCurrentUser] = useState<any>(null);

  // WhatsApp-like reply & edit state
  const [replyingTo, setReplyingTo] = useState<ChatMessageItem | null>(null);
  const [editingMessage, setEditingMessage] = useState<ChatMessageItem | null>(null);

  // WhatsApp-like typing indicator state
  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  const isTypingRef = useRef<boolean>(false);
  const typingTimeoutRef = useRef<any>(null);
  const typingTimersRef = useRef<{ [userName: string]: any }>({});

  const flatListRef = useRef<FlatList>(null);
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    loadUserAndMessages();

    // Setup Socket.io connection with auto-reconnection
    const socket = io(SOCKET_URL, { 
      transports: ['websocket', 'polling'],
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000
    });
    socketRef.current = socket;

    socket.emit('join_chat_group', cleanGroupId);

    const onJoin = () => {
      if (cleanGroupId) {
        socket.emit('join_chat_group', cleanGroupId);
      }
    };
    socket.on('connect', onJoin);
    socket.on('reconnect', onJoin);

    socket.on('new_message', (newMsg: ChatMessageItem) => {
      const msgGroupId = ((newMsg.group_id as any)?._id || newMsg.group_id || '').toString().trim();
      if (!cleanGroupId || msgGroupId === cleanGroupId || msgGroupId.includes(cleanGroupId) || cleanGroupId.includes(msgGroupId)) {
        setMessages(prev => {
          if (prev.some(m => m._id === newMsg._id)) return prev;
          return [...prev, newMsg];
        });

        // Clear typing indicator for the sender who just sent the message
        if (newMsg.sender_name) {
          setTypingUsers(prev => prev.filter(u => u !== newMsg.sender_name));
        }

        setTimeout(() => {
          flatListRef.current?.scrollToEnd({ animated: true });
        }, 80);
      }
    });

    socket.on('message_edited', ({ message_id, new_text }: any) => {
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

    // Real-time user typing listener
    socket.on('user_typing', ({ groupId: tGid, userName, isTyping }: any) => {
      const gId = (tGid || '').toString().trim();
      if (cleanGroupId && gId && gId !== cleanGroupId) return;
      if (!userName) return;

      const myName = (currentUser?.name || '').trim();
      if (myName && userName.trim() === myName) return;

      setTypingUsers(prev => {
        if (isTyping) {
          if (typingTimersRef.current[userName]) {
            clearTimeout(typingTimersRef.current[userName]);
          }
          typingTimersRef.current[userName] = setTimeout(() => {
            setTypingUsers(curr => curr.filter(u => u !== userName));
          }, 3500);

          if (!prev.includes(userName)) {
            setTimeout(() => {
              flatListRef.current?.scrollToEnd({ animated: true });
            }, 80);
            return [...prev, userName];
          }
          return prev;
        } else {
          if (typingTimersRef.current[userName]) {
            clearTimeout(typingTimersRef.current[userName]);
            delete typingTimersRef.current[userName];
          }
          return prev.filter(u => u !== userName);
        }
      });
    });

    // 2-second real-time silent sync polling fallback for bulletproof message delivery
    const syncInterval = setInterval(() => {
      syncMessagesSilently();
    }, 2000);

    return () => {
      clearInterval(syncInterval);
      if (isTypingRef.current) {
        socket.emit('typing_stop', {
          groupId: cleanGroupId,
          userName: currentUser?.name || 'Member'
        });
      }
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      Object.values(typingTimersRef.current).forEach(t => clearTimeout(t));
      socket.emit('leave_chat_group', cleanGroupId);
      socket.disconnect();
    };
  }, [cleanGroupId, currentUser?.name]);

  const syncMessagesSilently = async () => {
    if (!cleanGroupId) return;
    try {
      const token = await SecureStore.getItemAsync('userToken');
      const res = await axios.get(`${API_URL}/chat/groups/${cleanGroupId}/messages`, {
        headers: { 'x-auth-token': token }
      });
      if (res.data?.messages && Array.isArray(res.data.messages)) {
        const incoming: ChatMessageItem[] = res.data.messages;
        setMessages(prev => {
          if (incoming.length !== prev.length || 
              (incoming.length > 0 && prev.length > 0 && incoming[incoming.length - 1]._id !== prev[prev.length - 1]._id)) {
            setTimeout(() => {
              flatListRef.current?.scrollToEnd({ animated: true });
            }, 60);
            return incoming;
          }
          const hasEditsOrDeletes = incoming.some((m, idx) => {
            const p = prev[idx];
            return !p || p.text !== m.text || p.is_deleted !== m.is_deleted || p.is_edited !== m.is_edited;
          });
          if (hasEditsOrDeletes) {
            return incoming;
          }
          return prev;
        });
      }
    } catch {
      // silent background check
    }
  };

  const loadUserAndMessages = async () => {
    try {
      const stored = await SecureStore.getItemAsync('userData');
      if (stored) {
        setCurrentUser(JSON.parse(stored));
      }

      const token = await SecureStore.getItemAsync('userToken');
      const res = await axios.get(`${API_URL}/chat/groups/${cleanGroupId}/messages`, {
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

  const handleTextChange = (text: string) => {
    setInputText(text);

    if (!socketRef.current || !cleanGroupId) return;

    const myName = currentUser?.name || 'Member';

    if (text.trim().length > 0) {
      if (!isTypingRef.current) {
        isTypingRef.current = true;
        socketRef.current.emit('typing_start', {
          groupId: cleanGroupId,
          userName: myName
        });
      }

      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }

      typingTimeoutRef.current = setTimeout(() => {
        isTypingRef.current = false;
        socketRef.current?.emit('typing_stop', {
          groupId: cleanGroupId,
          userName: myName
        });
      }, 2200);
    } else {
      if (isTypingRef.current) {
        isTypingRef.current = false;
        if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
        socketRef.current.emit('typing_stop', {
          groupId: cleanGroupId,
          userName: myName
        });
      }
    }
  };

  const handleSendOrUpdate = async () => {
    if (!inputText.trim() || sending) return;

    // Immediately stop typing indicator on send
    if (isTypingRef.current) {
      isTypingRef.current = false;
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      socketRef.current?.emit('typing_stop', {
        groupId: cleanGroupId,
        userName: currentUser?.name || 'Member'
      });
    }

    const token = await SecureStore.getItemAsync('userToken');

    // Case 1: Editing existing message
    if (editingMessage) {
      setSending(true);
      const updatedText = inputText.trim();
      const editingId = editingMessage._id;

      // Immediately reflect edit on screen
      setMessages(prev => prev.map(m => {
        if (m._id === editingId) {
          return { ...m, text: updatedText, is_edited: true };
        }
        return m;
      }));
      setEditingMessage(null);
      setInputText('');

      try {
        await axios.put(
          `${API_URL}/chat/messages/${editingId}`,
          { new_text: updatedText },
          { headers: { 'x-auth-token': token } }
        );
      } catch (err: any) {
        Alert.alert('Error', err.response?.data?.msg || 'Could not edit message');
      } finally {
        setSending(false);
      }
      return;
    }

    // Case 2: Sending a new message (or quoted reply)
    setSending(true);
    const textToSend = inputText.trim();
    const payload: any = {
      text: textToSend,
    };
    if (replyingTo) {
      payload.reply_to_message_id = replyingTo._id;
    }

    try {
      const res = await axios.post(
        `${API_URL}/chat/groups/${cleanGroupId}/messages`,
        payload,
        { headers: { 'x-auth-token': token } }
      );

      // Immediately render new message on sender screen in real time
      if (res.data?.message) {
        const sentMsg = res.data.message;
        setMessages(prev => {
          if (prev.some(m => m._id === sentMsg._id)) return prev;
          return [...prev, sentMsg];
        });
        setTimeout(() => {
          flatListRef.current?.scrollToEnd({ animated: true });
        }, 80);
      }

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

    const myId = (currentUser?._id || currentUser?.id || '').toString().trim();
    const senderId = ((item.sender as any)?._id || item.sender || '').toString().trim();
    const isMyMessage = Boolean(myId && senderId && myId === senderId);

    const roleLower = (currentUser?.role || '').toLowerCase();
    const isAdmin = roleLower === 'admin' || roleLower === 'subadmin';
    const canDelete = isMyMessage || isAdmin;
    const canEdit = isMyMessage;

    const options: any[] = [];

    // Any member with write access can reply
    if (isWriteAllowed) {
      options.push({ text: 'Reply', onPress: () => setReplyingTo(item) });
    }

    // Only the original author can edit their message
    if (canEdit) {
      options.push({
        text: 'Edit',
        onPress: () => {
          setEditingMessage(item);
          setInputText(item.text);
          setReplyingTo(null);
        }
      });
    }

    // Members can ONLY delete their own messages. Admins can delete any message.
    if (canDelete) {
      options.push({
        text: 'Delete',
        style: 'destructive',
        onPress: () => confirmDeleteMessage(item._id)
      });
    }

    if (options.length === 0) return;

    options.push({ text: 'Cancel', style: 'cancel' });

    Alert.alert('Message Options', item.text, options);
  };

  const confirmDeleteMessage = async (msgId: string) => {
    // Immediately show "This message was deleted" on screen
    setMessages(prev => prev.map(m => {
      if (m._id === msgId) {
        return { ...m, text: 'This message was deleted', is_deleted: true };
      }
      return m;
    }));

    try {
      const token = await SecureStore.getItemAsync('userToken');
      await axios.delete(`${API_URL}/chat/messages/${msgId}`, {
        headers: { 'x-auth-token': token }
      });
    } catch (err: any) {
      Alert.alert('Error', err.response?.data?.msg || 'Could not delete message');
      syncMessagesSilently();
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
    const myId = (currentUser?._id || currentUser?.id || '').toString().trim();
    const senderId = ((item.sender as any)?._id || item.sender || '').toString().trim();
    const isMe = Boolean(myId && senderId && myId === senderId);

    return (
      <TouchableOpacity
        activeOpacity={0.8}
        onPress={Keyboard.dismiss}
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
              <Text style={[styles.quoteSender, isMe ? styles.quoteSenderMe : styles.quoteSenderOther]}>
                {item.reply_to.sender_name}
              </Text>
              <Text style={[styles.quoteText, isMe ? styles.quoteTextMe : styles.quoteTextOther]} numberOfLines={2}>
                {item.reply_to.text}
              </Text>
            </View>
          )}

          {/* Message Text */}
          <Text style={[styles.messageText, isMe ? styles.messageTextMe : styles.messageTextOther, item.is_deleted ? styles.deletedText : null]}>
            {item.is_deleted ? '🚫 This message was deleted' : item.text}
          </Text>

          {/* Time, Edited Badge & Quick Reply Button */}
          <View style={styles.metaRow}>
            {item.is_edited && !item.is_deleted && (
              <Text style={[styles.metaText, isMe ? styles.metaTextMe : styles.metaTextOther]}>edited • </Text>
            )}
            <Text style={[styles.metaText, isMe ? styles.metaTextMe : styles.metaTextOther]}>
              {formatMessageTime(item.createdAt)}
            </Text>

            {/* Quick Reply Icon on the bubble */}
            {!item.is_deleted && isWriteAllowed && (
              <TouchableOpacity
                onPress={() => setReplyingTo(item)}
                style={{ marginLeft: 8, padding: 2 }}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons 
                  name="return-down-back-outline" 
                  size={15} 
                  color={isMe ? '#FFFFFF' : '#2563EB'} 
                />
              </TouchableOpacity>
            )}
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const isAnyoneTyping = typingUsers.length > 0;
  const typingHeaderLabel = typingUsers.length === 1 
    ? `${typingUsers[0]} typing...` 
    : `${typingUsers.join(', ')} typing...`;

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right', 'bottom']}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

      {/* Screen Header - Touch header to auto-close keyboard */}
      <TouchableOpacity activeOpacity={1} onPress={Keyboard.dismiss} style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#0F172A" />
        </TouchableOpacity>

        <View style={{ flex: 1, marginRight: 8 }}>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {groupName || 'Committee Chat'}
          </Text>
          {isAnyoneTyping ? (
            <Text style={styles.headerSubtitleTyping} numberOfLines={1}>
              {typingHeaderLabel}
            </Text>
          ) : (
            <Text style={styles.headerSubtitle} numberOfLines={1}>
              {groupType ? `${groupType} Committee • ` : ''}
              {isWriteAllowed ? 'You can chat' : 'View Only Mode'}
            </Text>
          )}
        </View>

        {!isWriteAllowed && (
          <View style={styles.viewOnlyHeaderBadge}>
            <Ionicons name="eye" size={14} color="#B45309" />
            <Text style={styles.viewOnlyHeaderText}>Spectator</Text>
          </View>
        )}
      </TouchableOpacity>

      {/* WhatsApp-style KeyboardAvoiding wrapper around messages + input bar */}
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 88 : 0}
      >
        {/* Messages List - Touch outside input auto-closes keyboard */}
        <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
          <View style={{ flex: 1 }}>
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
                onScrollBeginDrag={Keyboard.dismiss}
                onContentSizeChange={() => {
                  flatListRef.current?.scrollToEnd({ animated: true });
                }}
                showsVerticalScrollIndicator={false}
                ListFooterComponent={<TypingIndicator typingUsers={typingUsers} />}
                ListEmptyComponent={
                  <TouchableOpacity activeOpacity={1} onPress={Keyboard.dismiss} style={styles.emptyContainer}>
                    <Ionicons name="chatbubble-ellipses-outline" size={48} color="#CBD5E1" />
                    <Text style={styles.emptyText}>No messages yet in this group.</Text>
                    <Text style={styles.emptySubText}>
                      {isWriteAllowed ? 'Say hello and start the discussion!' : 'Discussions will appear here once active.'}
                    </Text>
                  </TouchableOpacity>
                }
              />
            )}
          </View>
        </TouchableWithoutFeedback>

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
                onChangeText={handleTextChange}
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
  headerSubtitleTyping: {
    fontSize: 11,
    color: '#2563EB',
    fontWeight: '700',
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
    borderLeftWidth: 3.5,
    paddingHorizontal: 9,
    paddingVertical: 5,
    marginBottom: 6,
    borderRadius: 6,
  },
  quoteBoxMe: {
    borderLeftColor: '#FFFFFF',
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
  },
  quoteBoxOther: {
    borderLeftColor: '#2563EB',
    backgroundColor: '#F8FAFC',
  },
  quoteSender: {
    fontSize: 11,
    fontWeight: '700',
    marginBottom: 2,
  },
  quoteSenderMe: {
    color: '#FFFFFF',
  },
  quoteSenderOther: {
    color: '#2563EB',
  },
  quoteText: {
    fontSize: 11,
    lineHeight: 15,
  },
  quoteTextMe: {
    color: '#F8FAFC',
  },
  quoteTextOther: {
    color: '#475569',
  },
  typingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginVertical: 6,
    paddingLeft: 4,
  },
  typingAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#2563EB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  typingAvatarText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  typingBubble: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 4,
  },
  typingDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#2563EB',
  },
  typingLabelText: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '500',
    maxWidth: 160,
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
