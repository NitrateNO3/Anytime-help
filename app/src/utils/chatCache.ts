import * as SecureStore from 'expo-secure-store';

// Chat caches on the phone are kept per logged-in user, so a different account
// signing in on the same phone never sees the previous account's chats.
export const getChatCacheUserId = async (): Promise<string> => {
  try {
    const raw = await SecureStore.getItemAsync('userData');
    const u = raw ? JSON.parse(raw) : null;
    return ((u && (u._id || u.id)) || 'anon').toString();
  } catch {
    return 'anon';
  }
};

export const chatRoomCacheKey = (userId: string, groupId: string) => `chat_cache_v1_${userId}_${groupId}`;
export const chatGroupsCacheKey = (userId: string, scope: string) => `chat_groups_cache_v1_${userId}_${scope}`;
