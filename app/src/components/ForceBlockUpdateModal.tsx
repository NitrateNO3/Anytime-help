import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Platform,
  ActivityIndicator,
  BackHandler,
  KeyboardAvoidingView,
  useWindowDimensions
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as SecureStore from 'expo-secure-store';
import axios from 'axios';
import Toast from 'react-native-toast-message';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const API_URL = 'https://anytime-help.onrender.com/api';

export const VALID_PHASES = ['Sushant Lok 2', 'Sushant Lok 3'] as const;

export const PHASE_BLOCKS: Record<string, string[]> = {
  'Sushant Lok 2': ['C', 'D', 'E', 'F', 'G'],
  'Sushant Lok 3': ['A', 'B', 'B1', 'C', 'D', 'E', 'F', 'G', 'H']
};

/**
 * Checks whether a user account has legacy/grouped block data and requires updating to individual block.
 */
export function isProfileBlockUpdateRequired(user: any): boolean {
  if (!user || (user.role !== 'Resident' && user.role !== 'Member')) return false;

  const phase = (user.phase || '').trim();
  const address = (user.address || '').trim();
  const block = (user.block || '').trim();

  // 1. If phase is missing or not a standard individual phase
  if (!phase || !VALID_PHASES.includes(phase as any)) {
    return true;
  }

  // 2. Check for legacy group indicators in phase (e.g. 'C,D,E', 'Option 1', dashes)
  if (phase.includes(',') || phase.toLowerCase().includes('option') || phase.includes(' - ')) {
    return true;
  }

  // 3. Check for legacy group indicators in address
  if (
    address.includes('C,D,E') ||
    address.includes('F,G') ||
    address.toLowerCase().includes('option 1') ||
    address.toLowerCase().includes('option 2')
  ) {
    return true;
  }

  const validBlocks = PHASE_BLOCKS[phase] || [];

  // 4. If explicit user.block is set and valid
  if (block && validBlocks.includes(block)) {
    return false;
  }

  // 5. If block field is missing, check if address contains an exact single block in the new format
  const blockMatch = address.match(/Block\s+([A-H0-9]+)\b/i);
  if (blockMatch && blockMatch[1]) {
    const extractedBlock = blockMatch[1].toUpperCase();
    if (validBlocks.includes(extractedBlock)) {
      return false;
    }
  }

  // If none of the valid single-block criteria are met, user needs to update
  return true;
}

interface ForceBlockUpdateModalProps {
  visible: boolean;
  userData: any;
  onSuccess: (updatedUser: any) => void;
}

export default function ForceBlockUpdateModal({
  visible,
  userData,
  onSuccess
}: ForceBlockUpdateModalProps) {
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();

  const [phase, setPhase] = useState<string>('Sushant Lok 2');
  const [block, setBlock] = useState<string>('');
  const [houseNo, setHouseNo] = useState<string>('');
  const [propertyType, setPropertyType] = useState<string>('Owned');
  const [loading, setLoading] = useState<boolean>(false);
  const [errorText, setErrorText] = useState<string>('');

  // Initialize or pre-fill existing info whenever modal opens or userData changes
  useEffect(() => {
    if (!userData) return;
    setErrorText('');

    // Detect initial Phase
    const userPhase = (userData.phase || '').trim();
    if (userPhase.includes('Sushant Lok 3') || (userData.address || '').includes('Sushant Lok 3')) {
      setPhase('Sushant Lok 3');
    } else {
      setPhase('Sushant Lok 2');
    }

    // Detect initial House No
    if (userData.house_no) {
      setHouseNo(userData.house_no);
    } else if (userData.address) {
      const houseMatch =
        userData.address.match(/House\/Flat:\s*([^,]+)/i) ||
        userData.address.match(/(?:House|Flat|H\.No|Plot)\s*[:#\-]?\s*([A-Za-z0-9\/-]+)/i) ||
        userData.address.match(/^([A-Za-z0-9\/-]+),/);
      if (houseMatch && houseMatch[1]) {
        setHouseNo(houseMatch[1].trim());
      }
    }

    // Detect initial Block (only if single valid block)
    const validBlocks = PHASE_BLOCKS[userPhase] || PHASE_BLOCKS['Sushant Lok 2'];
    if (userData.block && validBlocks.includes(userData.block)) {
      setBlock(userData.block);
    } else if (userData.address) {
      const match = userData.address.match(/Block\s+([A-H0-9]+)\b/i);
      if (match && match[1] && validBlocks.includes(match[1].toUpperCase())) {
        setBlock(match[1].toUpperCase());
      } else {
        setBlock('');
      }
    } else {
      setBlock('');
    }

    // Detect Property Type
    if (userData.property_type) {
      setPropertyType(userData.property_type);
    } else if (userData.address && userData.address.includes('(Rented)')) {
      setPropertyType('Rented');
    } else {
      setPropertyType('Owned');
    }
  }, [userData, visible]);

  // Handle hardware back button on Android to prevent bypassing the update
  useEffect(() => {
    if (!visible) return;

    const onBackPress = () => {
      setErrorText('Please confirm your Block and Flat details to continue.');
      Toast.show({
        type: 'info',
        text1: 'Action Required',
        text2: 'Please confirm your Block and Flat details to continue.'
      });
      return true; // Prevent dismiss
    };

    const backHandler = BackHandler.addEventListener('hardwareBackPress', onBackPress);
    return () => backHandler.remove();
  }, [visible]);

  const handlePhaseChange = (selectedPhase: string) => {
    setPhase(selectedPhase);
    setErrorText('');
    // If current block is not in the new phase, reset block
    const availableBlocks = PHASE_BLOCKS[selectedPhase] || [];
    if (!availableBlocks.includes(block)) {
      setBlock('');
    }
  };

  const handleSave = async () => {
    if (!phase) {
      setErrorText('Please select your Phase.');
      return;
    }

    if (!block) {
      setErrorText('Please select your exact Block.');
      return;
    }

    if (!houseNo.trim()) {
      setErrorText('Please enter your House / Flat number.');
      return;
    }

    setErrorText('');
    setLoading(true);
    try {
      const token = await SecureStore.getItemAsync('userToken');
      if (!token) {
        setErrorText('Session Expired. Please log in again.');
        setLoading(false);
        return;
      }

      // Generate standard address format
      const combinedAddress = `House/Flat: ${houseNo.trim()}, ${phase}, Block ${block}, (${propertyType})`;

      const payload = {
        phase,
        block,
        house_no: houseNo.trim(),
        property_type: propertyType,
        address: combinedAddress
      };

      const res = await axios.put(`${API_URL}/users/me`, payload, {
        headers: { 'x-auth-token': token }
      });

      const updatedUser = res.data?.user || { ...userData, ...payload };

      // Update local storage
      const storedUser = await SecureStore.getItemAsync('userData');
      const parsed = storedUser ? JSON.parse(storedUser) : {};
      const mergedUser = { ...parsed, ...updatedUser };
      await SecureStore.setItemAsync('userData', JSON.stringify(mergedUser));

      Toast.show({
        type: 'success',
        text1: 'Profile Updated',
        text2: 'Your Block and address details have been successfully updated!'
      });

      onSuccess(mergedUser);
    } catch (err: any) {
      console.log('Update block error:', err.response?.data || err.message);
      const msg =
        err.response?.data?.message ||
        err.response?.data?.msg ||
        err.message ||
        'Could not update details. Please try again.';
      setErrorText(msg);
    } finally {
      setLoading(false);
    }
  };

  const currentBlocks = PHASE_BLOCKS[phase] || [];

  // Calculate safe paddings that guarantee the card is never covered by the Android system navigation bar
  const topPadding = Math.max(insets.top, Platform.OS === 'android' ? 24 : 12) + 8;
  const bottomPadding = Math.max(insets.bottom, Platform.OS === 'android' ? 24 : 12) + 8;
  const maxCardHeight = Math.min(windowHeight - topPadding - bottomPadding, 640);

  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent>
      <View
        style={[
          styles.overlay,
          {
            paddingTop: topPadding,
            paddingBottom: bottomPadding
          }
        ]}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.keyboardContainer}
        >
          <View style={[styles.card, { maxHeight: maxCardHeight }]}>
            {/* Header / Notice Banner - Compact & Modern */}
            <View style={styles.header}>
              <View style={styles.headerRow}>
                <View style={styles.iconCircle}>
                  <Ionicons name="location-sharp" size={20} color="#2563EB" />
                </View>
                <View style={styles.headerTextCol}>
                  <View style={styles.badge}>
                    <Ionicons name="shield-checkmark" size={11} color="#D97706" />
                    <Text style={styles.badgeText}>ACTION REQUIRED</Text>
                  </View>
                  <Text style={styles.title}>Update Block Details</Text>
                </View>
              </View>
              <Text style={styles.subtitle}>
                Confirm your exact Block and House number so maintenance staff can reach your premises promptly.
              </Text>
            </View>

            {/* Scrollable Form Body */}
            <ScrollView
              style={styles.body}
              contentContainerStyle={styles.bodyContent}
              showsVerticalScrollIndicator={true}
              keyboardShouldPersistTaps="handled"
            >
              {/* Section 1: Phase */}
              <View style={styles.section}>
                <Text style={styles.sectionLabel}>
                  1. Select Phase <Text style={styles.required}>*</Text>
                </Text>
                <View style={styles.phaseRow}>
                  {VALID_PHASES.map((p) => {
                    const isSelected = phase === p;
                    return (
                      <TouchableOpacity
                        key={p}
                        style={[styles.phaseChip, isSelected && styles.phaseChipActive]}
                        onPress={() => handlePhaseChange(p)}
                        activeOpacity={0.7}
                      >
                        <Ionicons
                          name={isSelected ? 'radio-button-on' : 'radio-button-off'}
                          size={18}
                          color={isSelected ? '#2563EB' : '#94A3B8'}
                          style={{ marginRight: 6 }}
                        />
                        <Text style={[styles.phaseChipText, isSelected && styles.phaseChipTextActive]}>
                          {p}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              {/* Section 2: Block */}
              <View style={styles.section}>
                <View style={styles.blockLabelRow}>
                  <Text style={styles.sectionLabel}>
                    2. Select Block <Text style={styles.required}>*</Text>
                  </Text>
                  <Text style={styles.captionText}>Individual Block</Text>
                </View>
                <View style={styles.blocksGrid}>
                  {currentBlocks.map((b) => {
                    const isSelected = block === b;
                    return (
                      <TouchableOpacity
                        key={b}
                        style={[styles.blockBox, isSelected && styles.blockBoxActive]}
                        onPress={() => {
                          setBlock(b);
                          if (errorText) setErrorText('');
                        }}
                        activeOpacity={0.7}
                      >
                        <Text style={[styles.blockBoxText, isSelected && styles.blockBoxTextActive]}>
                          {b}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              {/* Section 3: House / Flat Number */}
              <View style={styles.section}>
                <Text style={styles.sectionLabel}>
                  3. House / Flat Number <Text style={styles.required}>*</Text>
                </Text>
                <View style={styles.inputContainer}>
                  <Ionicons name="home-outline" size={18} color="#64748B" style={styles.inputIcon} />
                  <TextInput
                    style={styles.textInput}
                    placeholder="e.g. 104, B-12, Flat 302"
                    placeholderTextColor="#94A3B8"
                    value={houseNo}
                    onChangeText={(val) => {
                      setHouseNo(val);
                      if (errorText) setErrorText('');
                    }}
                    returnKeyType="done"
                    onSubmitEditing={handleSave}
                  />
                </View>
              </View>

              {/* Section 4: Property Type */}
              <View style={styles.section}>
                <Text style={styles.sectionLabel}>4. Property Type</Text>
                <View style={styles.propertyRow}>
                  {['Owned', 'Rented'].map((type) => {
                    const isSelected = propertyType === type;
                    return (
                      <TouchableOpacity
                        key={type}
                        style={[styles.propertyChip, isSelected && styles.propertyChipActive]}
                        onPress={() => setPropertyType(type)}
                        activeOpacity={0.7}
                      >
                        <Ionicons
                          name={type === 'Owned' ? 'key-outline' : 'business-outline'}
                          size={16}
                          color={isSelected ? '#2563EB' : '#64748B'}
                          style={{ marginRight: 6 }}
                        />
                        <Text style={[styles.propertyChipText, isSelected && styles.propertyChipTextActive]}>
                          {type}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              {/* Address Preview Box */}
              <View style={styles.previewBox}>
                <Text style={styles.previewLabel}>NEW ADDRESS PREVIEW</Text>
                <Text style={styles.previewText}>
                  {houseNo.trim() ? `House/Flat: ${houseNo.trim()}, ` : ''}
                  {phase}, Block {block || '___'} ({propertyType})
                </Text>
              </View>
            </ScrollView>

            {/* Footer with Error Banner & Pinned CTA */}
            <View style={styles.footer}>
              {errorText ? (
                <View style={styles.errorBox}>
                  <Ionicons name="alert-circle" size={16} color="#DC2626" style={{ marginRight: 6 }} />
                  <Text style={styles.errorBoxText}>{errorText}</Text>
                </View>
              ) : null}

              <TouchableOpacity
                style={[styles.submitButton, loading && styles.submitButtonDisabled]}
                onPress={handleSave}
                disabled={loading}
                activeOpacity={0.8}
              >
                {loading ? (
                  <View style={styles.btnContent}>
                    <ActivityIndicator color="#FFFFFF" size="small" />
                    <Text style={[styles.submitButtonText, { marginLeft: 8 }]}>Updating details...</Text>
                  </View>
                ) : (
                  <View style={styles.btnContent}>
                    <Text style={styles.submitButtonText}>Update & Continue</Text>
                    <Ionicons name="arrow-forward" size={18} color="#FFFFFF" style={{ marginLeft: 6 }} />
                  </View>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 16
  },
  keyboardContainer: {
    width: '100%',
    maxWidth: 420,
    justifyContent: 'center',
    alignItems: 'center'
  },
  card: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 15
  },
  header: {
    flexShrink: 0,
    paddingTop: 16,
    paddingHorizontal: 18,
    paddingBottom: 12,
    backgroundColor: '#F8FAFC',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9'
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8
  },
  iconCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#EFF6FF',
    borderWidth: 1.5,
    borderColor: '#BFDBFE',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12
  },
  headerTextCol: {
    flex: 1,
    justifyContent: 'center'
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    alignSelf: 'flex-start',
    marginBottom: 3
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#B45309',
    marginLeft: 4,
    letterSpacing: 0.5
  },
  title: {
    fontSize: 17,
    fontWeight: '800',
    color: '#0F172A'
  },
  subtitle: {
    fontSize: 12,
    color: '#64748B',
    lineHeight: 16
  },
  body: {
    flex: 1,
    flexShrink: 1
  },
  bodyContent: {
    paddingHorizontal: 18,
    paddingTop: 14,
    paddingBottom: 16
  },
  section: {
    marginBottom: 16
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#334155',
    marginBottom: 8
  },
  required: {
    color: '#EF4444'
  },
  blockLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8
  },
  captionText: {
    fontSize: 11,
    color: '#94A3B8',
    fontWeight: '500'
  },
  phaseRow: {
    flexDirection: 'row',
    gap: 10
  },
  phaseChip: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderRadius: 12,
    backgroundColor: '#F8FAFC',
    borderWidth: 1.5,
    borderColor: '#E2E8F0'
  },
  phaseChipActive: {
    backgroundColor: '#EFF6FF',
    borderColor: '#2563EB'
  },
  phaseChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#475569'
  },
  phaseChipTextActive: {
    color: '#2563EB',
    fontWeight: '700'
  },
  blocksGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8
  },
  blockBox: {
    width: 46,
    height: 42,
    borderRadius: 10,
    backgroundColor: '#F8FAFC',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    justifyContent: 'center',
    alignItems: 'center'
  },
  blockBoxActive: {
    backgroundColor: '#2563EB',
    borderColor: '#2563EB'
  },
  blockBoxText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#334155'
  },
  blockBoxTextActive: {
    color: '#FFFFFF'
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 46
  },
  inputIcon: {
    marginRight: 8
  },
  textInput: {
    flex: 1,
    fontSize: 14,
    color: '#0F172A',
    fontWeight: '500',
    height: '100%'
  },
  propertyRow: {
    flexDirection: 'row',
    gap: 10
  },
  propertyChip: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: '#F8FAFC',
    borderWidth: 1.5,
    borderColor: '#E2E8F0'
  },
  propertyChipActive: {
    backgroundColor: '#EFF6FF',
    borderColor: '#2563EB'
  },
  propertyChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748B'
  },
  propertyChipTextActive: {
    color: '#2563EB',
    fontWeight: '700'
  },
  previewBox: {
    backgroundColor: '#F1F5F9',
    borderRadius: 12,
    padding: 12,
    marginTop: 2,
    marginBottom: 4,
    borderLeftWidth: 3,
    borderLeftColor: '#2563EB'
  },
  previewLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#64748B',
    letterSpacing: 0.5,
    marginBottom: 3
  },
  previewText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#0F172A'
  },
  footer: {
    flexShrink: 0,
    paddingHorizontal: 18,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9'
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginBottom: 10
  },
  errorBoxText: {
    flex: 1,
    fontSize: 12,
    color: '#DC2626',
    fontWeight: '600'
  },
  submitButton: {
    backgroundColor: '#2563EB',
    height: 48,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#2563EB',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4
  },
  submitButtonDisabled: {
    backgroundColor: '#94A3B8'
  },
  btnContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center'
  },
  submitButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700'
  }
});
