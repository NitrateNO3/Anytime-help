import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, StatusBar, BackHandler, Platform, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as SecureStore from 'expo-secure-store';
import { useRouter, useFocusEffect } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { LinearGradient } from 'expo-linear-gradient';
import axios from 'axios';
import { io } from 'socket.io-client';

const API_URL = 'https://anytime-help.onrender.com/api';

export default function ResidentHome() {
  const router = useRouter();
  const { t } = useTranslation();
  const [user, setUser] = useState<any>(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  useFocusEffect(
    React.useCallback(() => {
      SecureStore.getItemAsync('userData').then((data) => {
        if (data) setUser(JSON.parse(data));
      });

      const fetchUnreadCount = async () => {
        try {
          const token = await SecureStore.getItemAsync('userToken');
          if (token) {
            const res = await axios.get(`${API_URL}/announcements`, {
              headers: { 'x-auth-token': token }
            });
            const announcements = res.data || [];
            const lastCountStr = await SecureStore.getItemAsync('last_announcements_count');
            const lastCount = lastCountStr ? parseInt(lastCountStr, 10) : 0;
            if (announcements.length > lastCount) {
              setUnreadCount(announcements.length - lastCount);
            } else {
              setUnreadCount(0);
            }
          }
        } catch (e) {
          console.log('Error fetching unread count:', e);
        }
      };
      fetchUnreadCount();

      const socket = io(API_URL.replace('/api', ''), { transports: ['websocket', 'polling'] });
      socket.on('announcement_changed', () => {
        fetchUnreadCount();
      });

      const onBackPress = () => {
        BackHandler.exitApp();
        return true;
      };
      const subscription = BackHandler.addEventListener('hardwareBackPress', onBackPress);
      
      return () => {
        subscription.remove();
        socket.disconnect();
      };
    }, [])
  );

  const onRefresh = React.useCallback(async () => {
    setRefreshing(true);
    try {
      const token = await SecureStore.getItemAsync('userToken');
      if (token) {
        const res = await axios.get(`${API_URL}/announcements`, {
          headers: { 'x-auth-token': token }
        });
        const announcements = res.data || [];
        const lastCountStr = await SecureStore.getItemAsync('last_announcements_count');
        const lastCount = lastCountStr ? parseInt(lastCountStr, 10) : 0;
        if (announcements.length > lastCount) {
          setUnreadCount(announcements.length - lastCount);
        } else {
          setUnreadCount(0);
        }
      }
    } catch (e) {
      console.log('Error refreshing:', e);
    } finally {
      setRefreshing(false);
    }
  }, []);

  return (
    <SafeAreaView style={styles.safeArea} edges={['left', 'right']}>
      <StatusBar barStyle="light-content" backgroundColor="#0F172A" translucent={true} />

      {/* Curved Premium Header Section */}
      <View style={styles.headerWrapper}>
        <LinearGradient
          colors={['#0F172A', '#1E1B4B']}
          style={styles.headerGradient}
        >
          <View style={styles.headerContent}>
            <View style={styles.greetingRow}>
              <View style={{ flex: 1, paddingRight: 14 }}>
                <Text style={styles.greetingText}>
                  {t('resident.hello').replace(',', '')} {user?.name ? user.name.split(' ')[0] : 'Member'} 👋
                </Text>
                
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10 }}>
                  <LinearGradient 
                    colors={['#F59E0B', '#D97706']} 
                    start={{ x: 0, y: 0 }} 
                    end={{ x: 1, y: 1 }}
                    style={{ 
                      flexDirection: 'row', 
                      alignItems: 'center', 
                      paddingHorizontal: 12, 
                      paddingVertical: 5, 
                      borderRadius: 20, 
                      shadowColor: '#F59E0B', 
                      shadowOffset: { width: 0, height: 4 }, 
                      shadowOpacity: 0.3, 
                      shadowRadius: 6,
                      elevation: 6
                    }}
                  >
                    <Ionicons name="star" size={12} color="#FFFFFF" style={{ marginRight: 4 }} />
                    <Text style={{ color: '#FFFFFF', fontSize: 12, fontWeight: '800', letterSpacing: 0.5 }}>
                      MEMBER ID: {user?.member_id ? user.member_id : 'PENDING'}
                    </Text>
                  </LinearGradient>
                </View>

                <Text style={styles.exploreText} numberOfLines={1} adjustsFontSizeToFit>
                  {t('resident.societyName')}
                </Text>
              </View>
              <TouchableOpacity 
                style={[styles.avatarContainer, { shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.3, shadowRadius: 10, elevation: 8, borderWidth: 2, borderColor: 'rgba(255,255,255,0.15)' }]} 
                onPress={() => router.push('/member/settings' as any)}
                activeOpacity={0.8}
              >
                <Ionicons name="person" size={24} color="#1E1B4B" />
              </TouchableOpacity>
            </View>
          </View>
        </LinearGradient>
      </View>

      {/* Centered 2x2 Grid Dashboard */}
      <ScrollView 
        style={styles.bodyScroll}
        contentContainerStyle={styles.gridContentContainer}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#1D4ED8']} />
        }
      >
        <View style={styles.dashboardGrid}>
          {/* Card 1: Lodge Grievance */}
          <TouchableOpacity 
            style={styles.gridCard}
            onPress={() => router.push('/member/raise' as any)}
            activeOpacity={0.8}
          >
            <View style={[styles.gridIconCircle, { backgroundColor: '#DBEAFE' }]}>
              <Ionicons name="add-circle" size={30} color="#2563EB" />
            </View>
            <Text style={styles.gridCardTitle}>Raise Complaint</Text>
            <Text style={styles.gridCardSub}>{t('resident.lodgeGrievanceSub')}</Text>
          </TouchableOpacity>

          {/* Card 2: All Complaints */}
          {(!user?.permissions || user?.permissions?.includes('All Complaints')) && (
            <TouchableOpacity 
              style={styles.gridCard}
              onPress={() => router.push('/member/my-complaints' as any)}
              activeOpacity={0.8}
            >
              <View style={[styles.gridIconCircle, { backgroundColor: '#FEF3C7' }]}>
                <Ionicons name="list" size={30} color="#D97706" />
              </View>
              <Text style={styles.gridCardTitle}>All Complaints</Text>
              <Text style={styles.gridCardSub}>{t('resident.myComplaintsSub')}</Text>
            </TouchableOpacity>
          )}

          {/* Card 3: Announcements */}
          {(!user?.permissions || user?.permissions?.includes('Announcements')) && (
            <TouchableOpacity 
              style={styles.gridCard}
              onPress={() => router.push('/member/announcements' as any)}
              activeOpacity={0.8}
            >
              <View style={[styles.gridIconCircle, { backgroundColor: '#DBEAFE' }]}>
                <Ionicons name="notifications" size={30} color="#2563EB" />
                {unreadCount > 0 && (
                  <View style={styles.badgeContainer}>
                    <Text style={styles.badgeText}>{unreadCount}</Text>
                  </View>
                )}
              </View>
              <Text style={styles.gridCardTitle}>{t('resident.announcements')}</Text>
              <Text style={styles.gridCardSub}>{t('resident.announcementsSub')}</Text>
            </TouchableOpacity>
          )}

          {/* Card 4: Directory */}
          {(!user?.permissions || user?.permissions?.includes('Directory')) && (
            <TouchableOpacity 
              style={styles.gridCard}
              onPress={() => router.push('/member/search' as any)}
              activeOpacity={0.8}
            >
              <View style={[styles.gridIconCircle, { backgroundColor: '#EDE9FE' }]}>
                <Ionicons name="people" size={30} color="#7C3AED" />
              </View>
              <Text style={styles.gridCardTitle}>{t('resident.directory')}</Text>
              <Text style={styles.gridCardSub}>{t('resident.directorySub')}</Text>
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#F8FAFC' },
  headerWrapper: {
    borderBottomLeftRadius: 40,
    borderBottomRightRadius: 40,
    overflow: 'hidden',
    backgroundColor: '#1D4ED8',
    elevation: 8,
    shadowColor: '#1E3A8A',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
  },
  headerGradient: {
    paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight ? StatusBar.currentHeight + 16 : 38) : 52,
    paddingBottom: 36,
    paddingHorizontal: 24,
    minHeight: 230,
    justifyContent: 'center',
  },
  headerContent: {
    justifyContent: 'center',
  },
  greetingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  greetingText: {
    fontSize: 17,
    color: '#BFDBFE',
    marginBottom: 6,
    fontWeight: '500',
    letterSpacing: 0.2,
  },
  exploreText: {
    fontSize: 26,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -0.3,
  },
  avatarContainer: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 5,
  },
  bodyScroll: {
    flex: 1,
  },
  gridContentContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingVertical: 20,
  },
  dashboardGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  gridCard: {
    width: '48%',
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    paddingVertical: 22,
    paddingHorizontal: 16,
    marginBottom: 16,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.06,
    shadowRadius: 14,
    elevation: 3,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  gridIconCircle: {
    width: 62,
    height: 62,
    borderRadius: 31,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 14,
  },
  badgeContainer: {
    position: 'absolute',
    top: -2,
    right: -2,
    backgroundColor: '#EF4444',
    borderRadius: 12,
    minWidth: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 6,
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: 'bold',
  },
  gridCardTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
    textAlign: 'center',
    marginBottom: 4,
  },
  gridCardSub: {
    fontSize: 12,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 16,
  },
});
