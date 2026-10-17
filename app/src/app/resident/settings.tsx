import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform, StatusBar, ScrollView, Linking, BackHandler, TextInput, Alert, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import { useTranslation } from 'react-i18next';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Toast from 'react-native-toast-message';
import { io } from 'socket.io-client';

import { getNextLanguage, getLanguageDisplayName } from '../../utils/localization';

const API_URL = 'https://anytime-help.onrender.com';
const RELATIONS = ['Spouse', 'Father', 'Mother', 'Son', 'Daughter', 'Brother', 'Sister', 'Other'];

export default function SettingsScreen() {
  const router = useRouter();
  const { t, i18n } = useTranslation();
  const [user, setUser] = useState<any>(null);
  const [token, setToken] = useState<string>('');
  
  // Family Management State
  const [familyMembers, setFamilyMembers] = useState<any[]>([]);
  const [loadingFamily, setLoadingFamily] = useState(false);

  // Add Family Member Modal State
  const [showAddModal, setShowAddModal] = useState(false);
  const [addName, setAddName] = useState('');
  const [addRelation, setAddRelation] = useState('Spouse');
  const [addCustomRelation, setAddCustomRelation] = useState('');
  const [addPhone, setAddPhone] = useState('');
  const [submittingAdd, setSubmittingAdd] = useState(false);

  // Edit Family Member Modal State
  const [editingFamily, setEditingFamily] = useState<any>(null);
  const [editName, setEditName] = useState('');
  const [editRelation, setEditRelation] = useState('Spouse');
  const [editCustomRelation, setEditCustomRelation] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [submittingEdit, setSubmittingEdit] = useState(false);

  const toggleLanguage = async () => {
    const newLang = getNextLanguage(i18n.language);
    await i18n.changeLanguage(newLang);
    await AsyncStorage.setItem('user-language', newLang);
  };

  useFocusEffect(
    useCallback(() => {
      loadUser();

      const onBackPress = () => {
        router.replace('/resident');
        return true;
      };
      const sub = BackHandler.addEventListener('hardwareBackPress', onBackPress);
      return () => sub.remove();
    }, [])
  );

  const loadUser = async () => {
    const userData = await SecureStore.getItemAsync('userData');
    const storedToken = await SecureStore.getItemAsync('userToken');
    if (userData) setUser(JSON.parse(userData));
    if (storedToken) {
      setToken(storedToken);
      fetchFamilyMembers(storedToken);
    }
  };

  useEffect(() => {
    const socket = io(API_URL, { transports: ['websocket', 'polling'] });
    socket.on('user_updated', async (data: any) => {
      const stored = await SecureStore.getItemAsync('userData');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed._id === data.userId || parsed.id === data.userId) {
          setTimeout(() => {
            loadUser();
          }, 1500);
        }
      }
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  const fetchFamilyMembers = async (authToken: string) => {
    try {
      setLoadingFamily(true);
      const res = await fetch(`${API_URL}/api/users/profile/family`, {
        headers: { 'x-auth-token': authToken }
      });
      const text = await res.text();
      let data: any = [];
      try {
        data = JSON.parse(text);
      } catch (err) {}
      if (res.ok && data) {
        setFamilyMembers(Array.isArray(data) ? data : (data.family_members || []));
      }
    } catch (e) {
      console.log('Failed to fetch family members', e);
    } finally {
      setLoadingFamily(false);
    }
  };

  const handleAddFamilyMember = async () => {
    if (!addName.trim()) {
      Toast.show({ type: 'error', text1: 'Name Required', text2: 'Please enter the family member full name' });
      return;
    }
    const finalRelation = addRelation === 'Other' ? addCustomRelation.trim() : addRelation;
    if (!finalRelation) {
      Toast.show({ type: 'error', text1: 'Relation Required', text2: 'Please specify the relation' });
      return;
    }
    const cleanPhone = addPhone.replace(/^\+91/, '').trim();
    if (cleanPhone.length !== 10) {
      Toast.show({ type: 'error', text1: 'Invalid Phone', text2: 'Please enter a valid 10-digit mobile number' });
      return;
    }

    const userPhone = (user?.phone_number || '').replace(/^\+91/, '').trim();
    if (userPhone && userPhone === cleanPhone) {
      Toast.show({ type: 'error', text1: 'Invalid Phone', text2: 'Cannot add your own number as a family member' });
      return;
    }

    const duplicate = familyMembers.some(m => (m.phone_number || '').replace(/^\+91/, '').trim() === cleanPhone);
    if (duplicate) {
      Toast.show({ type: 'error', text1: 'Already Added', text2: 'This mobile number is already in your family members' });
      return;
    }

    setSubmittingAdd(true);
    try {
      const newMember = {
        name: addName.trim(),
        relation: finalRelation,
        phone_number: `+91${cleanPhone}`
      };
      const updatedMembers = [...familyMembers, newMember];

      const res = await fetch(`${API_URL}/api/users/profile/family`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'x-auth-token': token },
        body: JSON.stringify({ family_members: updatedMembers })
      });

      const text = await res.text();
      let data: any = null;
      try {
        data = JSON.parse(text);
      } catch (err) {}

      if (res.ok) {
        setFamilyMembers(data?.family_members || updatedMembers);
        setShowAddModal(false);
        setAddName('');
        setAddRelation('Spouse');
        setAddCustomRelation('');
        setAddPhone('');
        Toast.show({ type: 'success', text1: 'Member Added', text2: 'Family member added successfully!' });
      } else {
        Toast.show({ type: 'error', text1: 'Failed to Add', text2: data?.message || 'Could not add family member' });
      }
    } catch (e: any) {
      Toast.show({ type: 'error', text1: 'Error', text2: e.message || 'Network error, please try again' });
    } finally {
      setSubmittingAdd(false);
    }
  };

  const saveFamilyMember = async () => {
    if (!editingFamily) return;
    if (!editName.trim()) {
      Toast.show({ type: 'error', text1: 'Name Required', text2: 'Please enter the family member name' });
      return;
    }
    const finalRelation = editRelation === 'Other' ? editCustomRelation.trim() : editRelation;
    if (!finalRelation) {
      Toast.show({ type: 'error', text1: 'Relation Required', text2: 'Please specify the relation' });
      return;
    }
    const cleanPhone = editPhone.replace(/^\+91/, '').trim();
    if (cleanPhone.length !== 10) {
      Toast.show({ type: 'error', text1: 'Invalid Phone', text2: 'Please enter a valid 10-digit mobile number' });
      return;
    }

    setSubmittingEdit(true);
    try {
      const formattedPhone = `+91${cleanPhone}`;
      const updatedMembers = familyMembers.map(m =>
        (m._id && m._id === editingFamily._id) || (m.phone_number && m.phone_number === editingFamily.phone_number)
          ? { ...m, name: editName.trim(), relation: finalRelation, phone_number: formattedPhone }
          : m
      );

      const res = await fetch(`${API_URL}/api/users/profile/family`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'x-auth-token': token },
        body: JSON.stringify({ family_members: updatedMembers })
      });

      const text = await res.text();
      let data: any = null;
      try {
        data = JSON.parse(text);
      } catch (err) {}

      if (res.ok) {
        setFamilyMembers(data?.family_members || updatedMembers);
        setEditingFamily(null);
        Toast.show({ type: 'success', text1: 'Updated', text2: 'Family member updated successfully!' });
      } else {
        Toast.show({ type: 'error', text1: 'Update Failed', text2: data?.message || 'Could not update family member' });
      }
    } catch (e: any) {
      Toast.show({ type: 'error', text1: 'Error', text2: e.message || 'Network error' });
    } finally {
      setSubmittingEdit(false);
    }
  };

  const confirmRemoveFamilyMember = (member: any) => {
    Alert.alert(
      'Remove Family Member',
      `Are you sure you want to remove ${member.name}? They will no longer be able to log in to this household account.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Remove', 
          style: 'destructive', 
          onPress: () => removeFamilyMember(member._id || member.phone_number) 
        }
      ]
    );
  };

  const removeFamilyMember = async (memberId: string) => {
    try {
      const updatedMembers = familyMembers.filter(m => m._id !== memberId && m.phone_number !== memberId);
      const res = await fetch(`${API_URL}/api/users/profile/family`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'x-auth-token': token },
        body: JSON.stringify({ family_members: updatedMembers })
      });

      const text = await res.text();
      let data: any = null;
      try {
        data = JSON.parse(text);
      } catch (err) {}

      if (res.ok) {
        setFamilyMembers(data?.family_members || updatedMembers);
        Toast.show({ type: 'success', text1: 'Removed', text2: 'Family member removed successfully' });
      } else {
        Toast.show({ type: 'error', text1: 'Error', text2: data?.message || 'Failed to remove member' });
      }
    } catch (e: any) {
      Toast.show({ type: 'error', text1: 'Error', text2: e.message || 'Failed to remove member' });
    }
  };

  const handleLogout = async () => {
    try {
      const userData = await SecureStore.getItemAsync('userData');
      if (userData) {
        const parsed = JSON.parse(userData);
        await fetch('https://anytime-help.onrender.com/api/auth/logout', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: parsed.id })
        });
      }
    } catch (e) {
      console.error('Error logging out from server', e);
    }
    await SecureStore.deleteItemAsync('userToken');
    await SecureStore.deleteItemAsync('userData');
    router.replace('/' as any);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor="#1D4ED8" />

      {/* Header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight ? StatusBar.currentHeight + 8 : 24) : 20, paddingBottom: 14, paddingHorizontal: 20, backgroundColor: '#1D4ED8', zIndex: 1, elevation: 4 }}>
        <TouchableOpacity 
          onPress={() => router.replace('/resident')} 
          style={{ width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center', marginRight: 12 }}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Ionicons name="arrow-back" size={22} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={{ fontSize: 20, fontWeight: '700', color: '#FFFFFF' }}>{t('settings.settingsTitle') || 'Settings'}</Text>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 120, paddingTop: 20, paddingHorizontal: 16 }} showsVerticalScrollIndicator={false}>
      
        {/* Profile Card */}
        <TouchableOpacity style={styles.profileCard} onPress={() => router.push('/resident/edit-profile')}>
          <View style={styles.avatarBox}>
            <Ionicons name="person" size={36} color="#1D4ED8" />
          </View>
          <View style={styles.profileInfo}>
            <Text style={styles.profileName}>{user?.name || 'Resident'}</Text>
            <Text style={styles.profileEmail}>{user?.phone_number || 'Update your profile'}</Text>
          </View>
          <Ionicons name="chevron-forward" size={24} color="#9CA3AF" />
        </TouchableOpacity>

        {/* Preferences */}
        <View style={styles.settingsGroup}>
          <Text style={styles.groupTitle}>{t('settings.preferences') || 'PREFERENCES'}</Text>
          <View style={styles.cardGroup}>
            <View style={[styles.settingRow, { borderBottomWidth: 0 }]}>
              <View style={styles.settingRowLeft}>
                <View style={[styles.iconContainer, { backgroundColor: '#E0E7FF' }]}>
                  <Ionicons name="language-outline" size={20} color="#4338CA" />
                </View>
                <Text style={styles.settingText}>{t('settings.language') || 'Language'}: {getLanguageDisplayName(i18n.language)}</Text>
              </View>
              <TouchableOpacity onPress={toggleLanguage} style={styles.changeBtn}>
                <Text style={styles.changeBtnText}>{t('settings.change') || 'Change'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* Account Sharing (Family) */}
        <View style={styles.settingsGroup}>
          <Text style={styles.groupTitle}>
            {t('settings.accountSharingFamily', { defaultValue: 'ACCOUNT SHARING (FAMILY)' })}
          </Text>

          <View style={styles.cardGroup}>
            {loadingFamily ? (
              <View style={{ padding: 24, alignItems: 'center' }}>
                <ActivityIndicator size="small" color="#1D4ED8" />
                <Text style={{ marginTop: 8, color: '#64748B', fontSize: 13 }}>Loading family members...</Text>
              </View>
            ) : familyMembers.length === 0 ? (
              <View style={{ padding: 24, alignItems: 'center' }}>
                <View style={{ width: 52, height: 52, borderRadius: 26, backgroundColor: '#EFF6FF', justifyContent: 'center', alignItems: 'center', marginBottom: 12 }}>
                  <Ionicons name="people-outline" size={26} color="#2563EB" />
                </View>
                <Text style={{ fontSize: 16, fontWeight: '700', color: '#1E293B', marginBottom: 4 }}>No Family Members Added</Text>
                <Text style={{ fontSize: 13, color: '#64748B', textAlign: 'center', lineHeight: 18, marginBottom: 16, paddingHorizontal: 10 }}>
                  Add family members so they can log in using their own phone number and manage household requests.
                </Text>
                <TouchableOpacity 
                  onPress={() => {
                    setAddName('');
                    setAddRelation('Spouse');
                    setAddCustomRelation('');
                    setAddPhone('');
                    setShowAddModal(true);
                  }}
                  style={styles.primaryAddBtn}
                  activeOpacity={0.8}
                >
                  <Ionicons name="add-circle-outline" size={18} color="#FFF" style={{ marginRight: 6 }} />
                  <Text style={styles.primaryAddBtnText}>Add Family Member</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <>
                {familyMembers.map((member, index) => (
                  <View key={member._id || index} style={styles.settingRow}>
                    <View style={styles.familyAvatar}>
                      <Ionicons name="person" size={18} color="#2563EB" />
                    </View>
                    <View style={{ flex: 1, paddingRight: 8 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                        <Text style={{ fontSize: 15, fontWeight: '700', color: '#1E293B' }}>{member.name}</Text>
                        <View style={styles.relationBadge}>
                          <Text style={styles.relationBadgeText}>{member.relation || 'Family'}</Text>
                        </View>
                      </View>
                      <Text style={{ fontSize: 13, color: '#64748B', marginTop: 3 }}>{member.phone_number}</Text>
                    </View>
                    <TouchableOpacity 
                      onPress={() => {
                        setEditingFamily(member);
                        setEditName(member.name || '');
                        const isStandard = RELATIONS.includes(member.relation);
                        setEditRelation(isStandard ? member.relation : 'Other');
                        setEditCustomRelation(isStandard ? '' : (member.relation || ''));
                        setEditPhone((member.phone_number || '').replace('+91', '').trim());
                      }} 
                      style={styles.actionIconBtn}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <Ionicons name="pencil" size={18} color="#3B82F6" />
                    </TouchableOpacity>
                    <TouchableOpacity 
                      onPress={() => confirmRemoveFamilyMember(member)}
                      style={[styles.actionIconBtn, { marginLeft: 8 }]}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <Ionicons name="trash-outline" size={18} color="#EF4444" />
                    </TouchableOpacity>
                  </View>
                ))}

                {/* Add Another Member row when members already exist */}
                <TouchableOpacity 
                  onPress={() => {
                    setAddName('');
                    setAddRelation('Spouse');
                    setAddCustomRelation('');
                    setAddPhone('');
                    setShowAddModal(true);
                  }}
                  style={[styles.settingRow, { borderBottomWidth: 0, justifyContent: 'center' }]}
                  activeOpacity={0.7}
                >
                  <Ionicons name="add-circle-outline" size={18} color="#2563EB" style={{ marginRight: 6 }} />
                  <Text style={{ fontSize: 14, fontWeight: '700', color: '#2563EB' }}>+ Add Family Member</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>

        {/* Support & About */}
        <View style={styles.settingsGroup}>
          <Text style={styles.groupTitle}>{t('settings.supportAndAbout', { defaultValue: 'SUPPORT & ABOUT' })}</Text>
          <View style={styles.cardGroup}>
            <TouchableOpacity style={styles.settingRow} onPress={async () => {
              await SecureStore.deleteItemAsync('hasViewedResidentTour');
              router.push({ pathname: '/resident', params: { startTour: Date.now().toString() } });
            }}>
              <View style={styles.settingRowLeft}>
                <View style={[styles.iconContainer, { backgroundColor: '#F3F4F6' }]}>
                  <Ionicons name="play-circle-outline" size={20} color="#4B5563" />
                </View>
                <Text style={styles.settingText}>{t('settings.appTutorial', { defaultValue: 'App Tutorial' })}</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
            </TouchableOpacity>

            <TouchableOpacity style={styles.settingRow} onPress={() => router.push('/resident/privacy')}>
              <View style={styles.settingRowLeft}>
                <View style={[styles.iconContainer, { backgroundColor: '#F3F4F6' }]}>
                  <Ionicons name="shield-checkmark-outline" size={20} color="#4B5563" />
                </View>
                <Text style={styles.settingText}>{t('settings.privacyPolicy', { defaultValue: 'Privacy Policy' })}</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
            </TouchableOpacity>

            <TouchableOpacity style={styles.settingRow} onPress={() => router.push('/resident/about')}>
              <View style={styles.settingRowLeft}>
                <View style={[styles.iconContainer, { backgroundColor: '#F3F4F6' }]}>
                  <Ionicons name="information-circle-outline" size={20} color="#4B5563" />
                </View>
                <Text style={styles.settingText}>{t('settings.aboutUs', { defaultValue: 'About Us' })}</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
            </TouchableOpacity>

            <TouchableOpacity style={styles.settingRow} onPress={() => router.push('/resident/support')}>
              <View style={styles.settingRowLeft}>
                <View style={[styles.iconContainer, { backgroundColor: '#FEF3C7' }]}>
                  <Ionicons name="help-buoy-outline" size={20} color="#D97706" />
                </View>
                <Text style={styles.settingText}>{t('settings.helpSupport', { defaultValue: 'Help & Support' })}</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
            </TouchableOpacity>

            <TouchableOpacity style={[styles.settingRow, { borderBottomWidth: 0 }]} onPress={() => Linking.openURL('https://www.slerwa.in')}>
              <View style={styles.settingRowLeft}>
                <View style={[styles.iconContainer, { backgroundColor: '#DBEAFE' }]}>
                  <Ionicons name="globe-outline" size={20} color="#2563EB" />
                </View>
                <Text style={[styles.settingText, { flexShrink: 1 }]} numberOfLines={2}>
                  {t('settings.knowRwa', { defaultValue: 'Know more about RWA (www.slerwa.in)' })}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Account */}
        <View style={styles.settingsGroup}>
          <Text style={styles.groupTitle}>{t('settings.account') || 'ACCOUNT'}</Text>
          <View style={styles.cardGroup}>
            <TouchableOpacity style={[styles.settingRow, { borderBottomWidth: 0 }]} onPress={handleLogout}>
              <View style={styles.settingRowLeft}>
                <View style={[styles.iconContainer, { backgroundColor: '#FEE2E2' }]}>
                  <Ionicons name="log-out-outline" size={20} color="#DC2626" />
                </View>
                <Text style={[styles.settingText, { color: '#DC2626', fontWeight: '600' }]}>{t('settings.logout') || 'Logout'}</Text>
              </View>
            </TouchableOpacity>
          </View>
        </View>

      </ScrollView>

      {/* Add Family Member Modal */}
      {showAddModal && (
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: '#EFF6FF', justifyContent: 'center', alignItems: 'center', marginRight: 10 }}>
                  <Ionicons name="person-add" size={18} color="#2563EB" />
                </View>
                <Text style={styles.modalTitle}>Add Family Member</Text>
              </View>
              <TouchableOpacity onPress={() => setShowAddModal(false)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <Ionicons name="close" size={22} color="#64748B" />
              </TouchableOpacity>
            </View>

            <Text style={styles.modalSubtitle}>
              They will be able to log in with this phone number to access services for your house.
            </Text>

            <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 380 }}>
              {/* Full Name */}
              <Text style={styles.fieldLabel}>Full Name</Text>
              <View style={styles.inputBox}>
                <Ionicons name="person-outline" size={18} color="#94A3B8" style={{ marginRight: 8 }} />
                <TextInput
                  style={styles.textInput}
                  placeholder="e.g. Priya Sharma"
                  placeholderTextColor="#94A3B8"
                  value={addName}
                  onChangeText={setAddName}
                />
              </View>

              {/* Relation */}
              <Text style={styles.fieldLabel}>Relation</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
                {RELATIONS.map(rel => (
                  <TouchableOpacity
                    key={rel}
                    onPress={() => setAddRelation(rel)}
                    style={[styles.relationChip, addRelation === rel && styles.relationChipActive]}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.relationChipText, addRelation === rel && styles.relationChipTextActive]}>{rel}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              {addRelation === 'Other' && (
                <View style={[styles.inputBox, { marginBottom: 14 }]}>
                  <Ionicons name="people-outline" size={18} color="#94A3B8" style={{ marginRight: 8 }} />
                  <TextInput
                    style={styles.textInput}
                    placeholder="Specify Relation (e.g. Cousin, Grandparent)"
                    placeholderTextColor="#94A3B8"
                    value={addCustomRelation}
                    onChangeText={setAddCustomRelation}
                  />
                </View>
              )}

              {/* Phone Number */}
              <Text style={styles.fieldLabel}>Phone Number</Text>
              <View style={styles.inputBox}>
                <Ionicons name="call-outline" size={18} color="#94A3B8" style={{ marginRight: 6 }} />
                <Text style={{ fontSize: 15, color: '#1E293B', fontWeight: '600', marginRight: 6 }}>+91</Text>
                <TextInput
                  style={styles.textInput}
                  placeholder="10-digit mobile number"
                  placeholderTextColor="#94A3B8"
                  keyboardType="phone-pad"
                  maxLength={10}
                  value={addPhone}
                  onChangeText={setAddPhone}
                />
              </View>
            </ScrollView>

            <View style={styles.modalBtnRow}>
              <TouchableOpacity onPress={() => setShowAddModal(false)} style={styles.cancelBtn}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={handleAddFamilyMember} style={styles.submitBtn} disabled={submittingAdd}>
                {submittingAdd ? (
                  <ActivityIndicator size="small" color="#FFF" />
                ) : (
                  <Text style={styles.submitBtnText}>Add Member</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}

      {/* Edit Family Member Modal */}
      {editingFamily && (
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: '#EFF6FF', justifyContent: 'center', alignItems: 'center', marginRight: 10 }}>
                  <Ionicons name="pencil" size={18} color="#2563EB" />
                </View>
                <Text style={styles.modalTitle}>Edit Family Member</Text>
              </View>
              <TouchableOpacity onPress={() => setEditingFamily(null)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <Ionicons name="close" size={22} color="#64748B" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 380 }}>
              {/* Full Name */}
              <Text style={styles.fieldLabel}>Full Name</Text>
              <View style={styles.inputBox}>
                <Ionicons name="person-outline" size={18} color="#94A3B8" style={{ marginRight: 8 }} />
                <TextInput
                  style={styles.textInput}
                  placeholder="Name"
                  placeholderTextColor="#94A3B8"
                  value={editName}
                  onChangeText={setEditName}
                />
              </View>

              {/* Relation */}
              <Text style={styles.fieldLabel}>Relation</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
                {RELATIONS.map(rel => (
                  <TouchableOpacity
                    key={rel}
                    onPress={() => setEditRelation(rel)}
                    style={[styles.relationChip, editRelation === rel && styles.relationChipActive]}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.relationChipText, editRelation === rel && styles.relationChipTextActive]}>{rel}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              {editRelation === 'Other' && (
                <View style={[styles.inputBox, { marginBottom: 14 }]}>
                  <Ionicons name="people-outline" size={18} color="#94A3B8" style={{ marginRight: 8 }} />
                  <TextInput
                    style={styles.textInput}
                    placeholder="Specify Relation"
                    placeholderTextColor="#94A3B8"
                    value={editCustomRelation}
                    onChangeText={setEditCustomRelation}
                  />
                </View>
              )}

              {/* Phone Number */}
              <Text style={styles.fieldLabel}>Phone Number</Text>
              <View style={styles.inputBox}>
                <Ionicons name="call-outline" size={18} color="#94A3B8" style={{ marginRight: 6 }} />
                <Text style={{ fontSize: 15, color: '#1E293B', fontWeight: '600', marginRight: 6 }}>+91</Text>
                <TextInput
                  style={styles.textInput}
                  placeholder="10-digit mobile number"
                  placeholderTextColor="#94A3B8"
                  keyboardType="phone-pad"
                  maxLength={10}
                  value={editPhone}
                  onChangeText={setEditPhone}
                />
              </View>
            </ScrollView>

            <View style={styles.modalBtnRow}>
              <TouchableOpacity onPress={() => setEditingFamily(null)} style={styles.cancelBtn}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={saveFamilyMember} style={styles.submitBtn} disabled={submittingEdit}>
                {submittingEdit ? (
                  <ActivityIndicator size="small" color="#FFF" />
                ) : (
                  <Text style={styles.submitBtnText}>Save Changes</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#F3F4F6' },
  profileCard: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    backgroundColor: '#FFFFFF', 
    padding: 20, 
    borderRadius: 20, 
    marginBottom: 24,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2
  },
  avatarBox: { width: 64, height: 64, borderRadius: 32, backgroundColor: '#EFF6FF', justifyContent: 'center', alignItems: 'center', marginRight: 16 },
  profileInfo: { flex: 1 },
  profileName: { fontSize: 20, fontWeight: '700', color: '#111827', marginBottom: 4 },
  profileEmail: { fontSize: 14, color: '#6B7280' },
  settingsGroup: { marginBottom: 24 },
  groupTitle: { fontSize: 13, fontWeight: '700', color: '#6B7280', letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 8, marginLeft: 16 },
  cardGroup: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 1
  },
  settingRow: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'space-between', 
    paddingVertical: 16, 
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6'
  },
  settingRowLeft: { flexDirection: 'row', alignItems: 'center', flex: 1, paddingRight: 12 },
  iconContainer: { width: 36, height: 36, borderRadius: 10, justifyContent: 'center', alignItems: 'center', marginRight: 14 },
  settingText: { fontSize: 16, fontWeight: '500', color: '#1F2937', flex: 1 }, 
  changeBtn: { backgroundColor: '#1D4ED8', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20 },
  changeBtnText: { color: 'white', fontWeight: '600', fontSize: 13 },
  addMemberBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#BFDBFE'
  },
  addMemberBtnText: {
    color: '#1D4ED8',
    fontSize: 12,
    fontWeight: '700'
  },
  primaryAddBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2563EB',
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 12
  },
  primaryAddBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700'
  },
  familyAvatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#EFF6FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14
  },
  relationBadge: {
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#DBEAFE'
  },
  relationBadgeText: {
    color: '#2563EB',
    fontSize: 11,
    fontWeight: '600'
  },
  actionIconBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#F8FAFC',
    justifyContent: 'center',
    alignItems: 'center'
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 999,
    padding: 16
  },
  modalCard: {
    backgroundColor: '#FFFFFF',
    width: '100%',
    maxWidth: 420,
    borderRadius: 20,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0F172A'
  },
  modalSubtitle: {
    fontSize: 13,
    color: '#64748B',
    marginBottom: 16,
    lineHeight: 18
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 6
  },
  inputBox: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 46,
    backgroundColor: '#F8FAFC',
    marginBottom: 14
  },
  textInput: {
    flex: 1,
    fontSize: 15,
    color: '#0F172A'
  },
  relationChip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: '#F1F5F9',
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0'
  },
  relationChipActive: {
    backgroundColor: '#2563EB',
    borderColor: '#2563EB'
  },
  relationChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#475569'
  },
  relationChipTextActive: {
    color: '#FFFFFF'
  },
  modalBtnRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
    marginTop: 18,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9'
  },
  cancelBtn: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8
  },
  cancelBtnText: {
    color: '#64748B',
    fontWeight: '600',
    fontSize: 14
  },
  submitBtn: {
    backgroundColor: '#2563EB',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 10,
    minWidth: 110,
    alignItems: 'center',
    justifyContent: 'center'
  },
  submitBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14
  }
});
