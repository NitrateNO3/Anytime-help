import React, { useState, useEffect, useCallback, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, StatusBar, BackHandler, Platform, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as SecureStore from 'expo-secure-store';
import { useRouter, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { LinearGradient } from 'expo-linear-gradient';
import axios from 'axios';
import { io } from 'socket.io-client';

import { walkthroughable, CopilotStep, useCopilot } from 'react-native-copilot';

const API_URL = 'https://anytime-help.onrender.com/api';

const WalkthroughableTouchableOpacity = walkthroughable(TouchableOpacity);

export default function ResidentHome() {
  const { start } = useCopilot();
  const router = useRouter();
  const { t } = useTranslation();
  const [user, setUser] = useState<any>(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  const { startTour } = useLocalSearchParams();
  const [lastStartTour, setLastStartTour] = useState<string | null>(null);

  useEffect(() => {
    if (startTour && startTour !== lastStartTour) {
      if (start) {
        setLastStartTour(startTour as string);
        setTimeout(() => {
          try {
            start();
            SecureStore.setItemAsync('hasViewedResidentTour', 'true');
          } catch (e) {
            console.log('Copilot start error:', e);
          }
        }, 1000);
      }
    }
  }, [startTour, start, lastStartTour]);

  useFocusEffect(
    useCallback(() => {
      SecureStore.getItemAsync('userData').then((data) => {
        if (data) setUser(JSON.parse(data));
      });

      if (!startTour) {
        SecureStore.getItemAsync('hasViewedResidentTour').then((data) => {
          if (!data && start) {
            // Delay starting slightly so UI has time to mount
            setTimeout(() => {
              try {
                start();
                SecureStore.setItemAsync('hasViewedResidentTour', 'true');
              } catch (e) {
                console.log('Copilot start error:', e);
              }
            }, 1000); // increased delay to 1000ms
          }
        });
      }

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
      <StatusBar barStyle="light-content" backgroundColor="#1D4ED8" translucent={true} />

      {/* Curved Blue Header Section */}
      <View style={styles.headerWrapper}>
        <LinearGradient
          colors={['#1D4ED8', '#1E3A8A']}
          style={styles.headerGradient}
        >
          <View style={styles.headerContent}>
            <View style={styles.greetingRow}>
              <View style={{ flex: 1, paddingRight: 14 }}>
                <Text style={styles.greetingText}>
                  {t('resident.hello').replace(',', '')} {user?.name ? user.name.split(' ')[0] : 'Resident'} 👋
                </Text>
                <Text style={styles.exploreText} numberOfLines={1} adjustsFontSizeToFit>
                  {t('resident.societyName')}
                </Text>
              </View>
              <CopilotStep text="यहाँ से आप अपनी प्रोफ़ाइल, सेटिंग्स मैनेज कर सकते हैं और ट्यूटोरियल देख सकते हैं।" order={5} name="profile_avatar">
                <WalkthroughableTouchableOpacity 
                  style={styles.avatarContainer} 
                  onPress={() => router.push('/resident/settings')}
                  activeOpacity={0.8}
                >
                  <Ionicons name="person" size={24} color="#1D4ED8" />
                </WalkthroughableTouchableOpacity>
              </CopilotStep>
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
          <CopilotStep text="कोई समस्या है? यहाँ से आसानी से अपनी शिकायत दर्ज करें।" order={1} name="lodge_grievance">
            <WalkthroughableTouchableOpacity 
              style={styles.gridCard}
              onPress={() => router.push('/resident/raise')}
              activeOpacity={0.8}
            >
              <View style={[styles.gridIconCircle, { backgroundColor: '#FEE2E2' }]}>
                <Ionicons name="megaphone" size={30} color="#EF4444" />
              </View>
              <Text style={styles.gridCardTitle}>{t('resident.lodgeGrievance')}</Text>
              <Text style={styles.gridCardSub}>{t('resident.lodgeGrievanceSub')}</Text>
            </WalkthroughableTouchableOpacity>
          </CopilotStep>

          {/* Card 2: My Complaints */}
          <CopilotStep text="अपनी दर्ज की गई शिकायतों की स्थिति (status) लाइव ट्रैक करें।" order={2} name="my_complaints">
            <WalkthroughableTouchableOpacity 
              style={styles.gridCard}
              onPress={() => router.push('/resident/my-complaints')}
              activeOpacity={0.8}
            >
              <View style={[styles.gridIconCircle, { backgroundColor: '#D1FAE5' }]}>
                <Ionicons name="list" size={30} color="#10B981" />
              </View>
              <Text style={styles.gridCardTitle}>{t('resident.myComplaints')}</Text>
              <Text style={styles.gridCardSub}>{t('resident.myComplaintsSub')}</Text>
            </WalkthroughableTouchableOpacity>
          </CopilotStep>

          {/* Card 3: Announcements */}
          <CopilotStep text="एडमिन से सीधे ज़रूरी घोषणाएँ और सूचनाएँ तुरंत प्राप्त करें।" order={3} name="announcements">
            <WalkthroughableTouchableOpacity 
              style={styles.gridCard}
              onPress={() => router.push('/resident/announcements')}
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
            </WalkthroughableTouchableOpacity>
          </CopilotStep>

          {/* Card 4: Directory */}
          <CopilotStep text="हमारी सोसाइटी डायरेक्टरी के ज़रिए अन्य निवासियों से आसानी से जुड़ें।" order={4} name="directory">
            <WalkthroughableTouchableOpacity 
              style={styles.gridCard}
              onPress={() => router.push('/resident/search')}
              activeOpacity={0.8}
            >
              <View style={[styles.gridIconCircle, { backgroundColor: '#EDE9FE' }]}>
                <Ionicons name="people" size={30} color="#7C3AED" />
              </View>
              <Text style={styles.gridCardTitle}>{t('resident.directory')}</Text>
              <Text style={styles.gridCardSub}>{t('resident.directorySub')}</Text>
            </WalkthroughableTouchableOpacity>
          </CopilotStep>
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
