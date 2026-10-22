import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Platform,
  KeyboardAvoidingView,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import Toast from 'react-native-toast-message';
import { useTranslation } from 'react-i18next';

const API_BASE_URL = 'https://anytime-help.onrender.com';

interface DeleteAccountModalProps {
  visible: boolean;
  onClose: () => void;
  userName?: string;
  userId?: string;
  token?: string;
  onSuccess?: () => void;
}

export default function DeleteAccountModal({
  visible,
  onClose,
  userName = '',
  userId = '',
  token = '',
  onSuccess,
}: DeleteAccountModalProps) {
  const router = useRouter();
  const { t } = useTranslation();

  const [inputName, setInputName] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [resolvedName, setResolvedName] = useState(userName);
  const [resolvedId, setResolvedId] = useState(userId);
  const [resolvedToken, setResolvedToken] = useState(token);

  useEffect(() => {
    if (visible) {
      setInputName('');
      setIsDeleting(false);
      loadAuthData();
    }
  }, [visible, userName, userId, token]);

  const loadAuthData = async () => {
    try {
      if (!token) {
        const storedToken = await SecureStore.getItemAsync('userToken');
        if (storedToken) setResolvedToken(storedToken);
      } else {
        setResolvedToken(token);
      }

      if (!userName || !userId) {
        const userDataStr = await SecureStore.getItemAsync('userData');
        if (userDataStr) {
          const parsed = JSON.parse(userDataStr);
          if (!userName && parsed.name) setResolvedName(parsed.name);
          if (!userId && (parsed.id || parsed._id)) setResolvedId(parsed.id || parsed._id);
        }
      } else {
        setResolvedName(userName);
        setResolvedId(userId);
      }
    } catch (e) {
      console.error('Error loading auth data for delete account:', e);
    }
  };

  const targetName = (userName || resolvedName || '').trim();
  const normalizedExpected = targetName.toLowerCase();
  const normalizedInput = inputName.trim().toLowerCase();
  const isMatch = targetName.length > 0 && normalizedInput === normalizedExpected;

  const handleDelete = async () => {
    if (!isMatch || isDeleting) return;

    setIsDeleting(true);
    try {
      const activeToken = token || resolvedToken || (await SecureStore.getItemAsync('userToken'));
      const activeUserId = userId || resolvedId;

      let responseOk = false;
      let errorMessage = '';

      // 1. Primary endpoint: DELETE /api/users/me
      try {
        const res = await fetch(`${API_BASE_URL}/api/users/me`, {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json',
            'x-auth-token': activeToken || '',
          },
        });

        if (res.ok) {
          responseOk = true;
        } else {
          const data = await res.json().catch(() => ({}));
          errorMessage = data.message || 'Failed to delete account';
        }
      } catch (e: any) {
        errorMessage = e?.message || 'Network error';
      }

      // 2. Fallback endpoint if /api/users/me was not recognized: DELETE /api/users/:id
      if (!responseOk && activeUserId) {
        try {
          const res2 = await fetch(`${API_BASE_URL}/api/users/${activeUserId}`, {
            method: 'DELETE',
            headers: {
              'Content-Type': 'application/json',
              'x-auth-token': activeToken || '',
            },
          });
          if (res2.ok) {
            responseOk = true;
          } else {
            const data2 = await res2.json().catch(() => ({}));
            errorMessage = data2.message || errorMessage;
          }
        } catch (e: any) {
          errorMessage = e?.message || errorMessage;
        }
      }

      if (!responseOk) {
        throw new Error(errorMessage || 'Could not delete your account. Please try again.');
      }

      // Optional: Inform auth logout
      if (activeUserId) {
        try {
          await fetch(`${API_BASE_URL}/api/auth/logout`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: activeUserId }),
          });
        } catch (e) {}
      }

      // Clear local storage
      await SecureStore.deleteItemAsync('userToken');
      await SecureStore.deleteItemAsync('userData');

      if (onSuccess) {
        onSuccess();
      }

      onClose();

      Toast.show({
        type: 'success',
        text1: t('settings.accountDeleted', { defaultValue: 'Account Deleted' }),
        text2: t('settings.accountDeletedDesc', { defaultValue: 'Your account has been deleted permanently.' }),
      });

      setTimeout(() => {
        router.replace('/' as any);
      }, 150);
    } catch (err: any) {
      Toast.show({
        type: 'error',
        text1: t('settings.deleteFailed', { defaultValue: 'Deletion Failed' }),
        text2: err.message || t('settings.deleteFailedDesc', { defaultValue: 'Could not delete account. Please try again.' }),
      });
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={isDeleting ? undefined : onClose}
    >
      <KeyboardAvoidingView
        style={styles.backdrop}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.card}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.iconCircle}>
              <Ionicons name="trash" size={24} color="#DC2626" />
            </View>
            <View style={styles.headerTextGroup}>
              <Text style={styles.title}>
                {t('settings.deleteAccountModalTitle', { defaultValue: 'Delete Account' })}
              </Text>
              <Text style={styles.subtitle}>
                {t('settings.deleteAccountSubtitle', { defaultValue: 'Permanent Action' })}
              </Text>
            </View>
            <TouchableOpacity
              onPress={onClose}
              disabled={isDeleting}
              style={styles.closeBtn}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons name="close" size={22} color="#64748B" />
            </TouchableOpacity>
          </View>

          <ScrollView bounces={false} keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 4 }}>
            {/* Warning Callout Box */}
            <View style={styles.warningBox}>
              <Ionicons name="warning" size={22} color="#DC2626" style={{ marginRight: 10, marginTop: 1 }} />
              <Text style={styles.warningText}>
                {t('settings.deleteAccountWarning', {
                  defaultValue: 'This action cannot be undone. This will permanently delete your profile, complaints history, and account credentials from Anytime Help.',
                })}
              </Text>
            </View>

            {/* Instruction & Name Highlight Box (GitHub Repo Deletion Style) */}
            <Text style={styles.instructionsText}>
              {t('settings.typeToConfirm', {
                defaultValue: 'To verify, type your account name below:',
              })}
            </Text>

            <View style={styles.targetNameBox}>
              <Text style={styles.targetNameText} selectable>
                {targetName || 'Account Name'}
              </Text>
            </View>

            {/* Text Input */}
            <TextInput
              style={[
                styles.input,
                isMatch ? styles.inputMatch : (inputName.length > 0 ? styles.inputTyping : null),
              ]}
              value={inputName}
              onChangeText={setInputName}
              placeholder={targetName || 'Type your name'}
              placeholderTextColor="#94A3B8"
              autoCapitalize="none"
              autoCorrect={false}
              editable={!isDeleting}
            />

            {/* Match Indicator Helper */}
            {inputName.length > 0 && (
              <View style={styles.indicatorRow}>
                {isMatch ? (
                  <>
                    <Ionicons name="checkmark-circle" size={16} color="#16A34A" style={{ marginRight: 4 }} />
                    <Text style={styles.matchText}>Name matched</Text>
                  </>
                ) : (
                  <>
                    <Ionicons name="alert-circle-outline" size={16} color="#EF4444" style={{ marginRight: 4 }} />
                    <Text style={styles.mismatchText}>Name does not match yet</Text>
                  </>
                )}
              </View>
            )}

            {/* Delete Confirmation Button */}
            <TouchableOpacity
              style={[
                styles.deleteBtn,
                isMatch ? styles.deleteBtnActive : styles.deleteBtnDisabled,
              ]}
              onPress={handleDelete}
              disabled={!isMatch || isDeleting}
              activeOpacity={0.8}
            >
              {isDeleting ? (
                <View style={styles.btnLoadingRow}>
                  <ActivityIndicator size="small" color="#FFFFFF" style={{ marginRight: 8 }} />
                  <Text style={styles.deleteBtnText}>Deleting Account...</Text>
                </View>
              ) : (
                <Text
                  style={[
                    styles.deleteBtnText,
                    !isMatch && styles.deleteBtnTextDisabled,
                  ]}
                >
                  {t('settings.deletePermanently', {
                    defaultValue: 'Permanently Delete My Account',
                  })}
                </Text>
              )}
            </TouchableOpacity>

            {/* Cancel Button */}
            <TouchableOpacity
              style={styles.cancelBtn}
              onPress={onClose}
              disabled={isDeleting}
              activeOpacity={0.7}
            >
              <Text style={styles.cancelBtnText}>
                {t('common.cancel', { defaultValue: 'Cancel' })}
              </Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  card: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    padding: 22,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.18,
    shadowRadius: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FEE2E2',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  headerTextGroup: {
    flex: 1,
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: -0.3,
  },
  subtitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#DC2626',
    marginTop: 2,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  warningBox: {
    flexDirection: 'row',
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
  },
  warningText: {
    flex: 1,
    fontSize: 12.5,
    color: '#991B1B',
    lineHeight: 18,
    fontWeight: '500',
  },
  instructionsText: {
    fontSize: 13,
    color: '#334155',
    fontWeight: '600',
    marginBottom: 8,
  },
  targetNameBox: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderStyle: 'dashed',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 12,
    alignItems: 'center',
  },
  targetNameText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: 0.3,
  },
  input: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 11,
    fontSize: 14.5,
    color: '#0F172A',
    fontWeight: '600',
  },
  inputTyping: {
    borderColor: '#94A3B8',
  },
  inputMatch: {
    borderColor: '#16A34A',
    backgroundColor: '#F0FDF4',
  },
  indicatorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
    paddingHorizontal: 2,
  },
  matchText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#16A34A',
  },
  mismatchText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#EF4444',
  },
  deleteBtn: {
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 18,
  },
  deleteBtnActive: {
    backgroundColor: '#DC2626',
    elevation: 3,
    shadowColor: '#DC2626',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
  },
  deleteBtnDisabled: {
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  deleteBtnText: {
    fontSize: 14.5,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.2,
  },
  deleteBtnTextDisabled: {
    color: '#94A3B8',
  },
  btnLoadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  cancelBtn: {
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 6,
  },
  cancelBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#64748B',
  },
});
