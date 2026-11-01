import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  TextInput,
  FlatList,
  StyleSheet,
  SafeAreaView,
  Dimensions,
  Platform,
  KeyboardAvoidingView
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface PickerOption {
  label: string;
  value: string;
  sublabel?: string;
  extra?: any;
}

interface LocationPickerModalProps {
  visible: boolean;
  title: string;
  placeholder?: string;
  options: PickerOption[];
  selectedValue?: string;
  onSelect: (option: PickerOption) => void;
  onClose: () => void;
  iconName?: keyof typeof Ionicons.glyphMap;
}

const { height } = Dimensions.get('window');

export default function LocationPickerModal({
  visible,
  title,
  placeholder = 'Search...',
  options = [],
  selectedValue,
  onSelect,
  onClose,
  iconName = 'location-outline'
}: LocationPickerModalProps) {
  const [search, setSearch] = useState('');

  const filteredOptions = useMemo(() => {
    if (!search.trim()) return options;
    const s = search.toLowerCase().trim();
    return options.filter(opt => 
      opt.label.toLowerCase().includes(s) || 
      (opt.sublabel && opt.sublabel.toLowerCase().includes(s))
    );
  }, [options, search]);

  const handleSelect = (option: PickerOption) => {
    onSelect(option);
    setSearch('');
    onClose();
  };

  const handleClose = () => {
    setSearch('');
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={handleClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.modalOverlay}
      >
        <TouchableOpacity
          activeOpacity={1}
          style={styles.backdrop}
          onPress={handleClose}
        />
        
        <SafeAreaView style={styles.sheetContainer}>
          <View style={styles.sheetContent}>
            {/* Grabber handle */}
            <View style={styles.handleBar} />

            {/* Header */}
            <View style={styles.headerRow}>
              <View style={styles.headerTitleWrap}>
                <View style={styles.iconCircle}>
                  <Ionicons name={iconName} size={20} color="#2563EB" />
                </View>
                <Text style={styles.headerTitle}>{title}</Text>
              </View>

              <TouchableOpacity
                onPress={handleClose}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                style={styles.closeBtn}
              >
                <Ionicons name="close" size={20} color="#64748B" />
              </TouchableOpacity>
            </View>

            {/* Search Input */}
            <View style={styles.searchBox}>
              <Ionicons name="search" size={18} color="#94A3B8" style={{ marginRight: 8 }} />
              <TextInput
                style={styles.searchInput}
                placeholder={placeholder}
                placeholderTextColor="#94A3B8"
                value={search}
                onChangeText={setSearch}
                autoCorrect={false}
                clearButtonMode="while-editing"
              />
              {search ? (
                <TouchableOpacity onPress={() => setSearch('')}>
                  <Ionicons name="close-circle" size={16} color="#94A3B8" />
                </TouchableOpacity>
              ) : null}
            </View>

            {/* Options List */}
            <FlatList
              data={filteredOptions}
              keyExtractor={(item, index) => item.value + '_' + index}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingBottom: 24 }}
              ListEmptyComponent={
                <View style={styles.emptyContainer}>
                  <Ionicons name="alert-circle-outline" size={36} color="#CBD5E1" />
                  <Text style={styles.emptyTitle}>No options found</Text>
                  <Text style={styles.emptySubtitle}>Try searching with a different keyword</Text>
                </View>
              }
              renderItem={({ item }) => {
                const isSelected = selectedValue === item.value;
                return (
                  <TouchableOpacity
                    style={[styles.optionItem, isSelected && styles.optionItemSelected]}
                    onPress={() => handleSelect(item)}
                    activeOpacity={0.7}
                  >
                    <View style={styles.optionTextWrap}>
                      <Text style={[styles.optionLabel, isSelected && styles.optionLabelSelected]}>
                        {item.label}
                      </Text>
                      {item.sublabel ? (
                        <Text style={styles.optionSublabel}>{item.sublabel}</Text>
                      ) : null}
                    </View>

                    {isSelected ? (
                      <Ionicons name="checkmark-circle" size={22} color="#2563EB" />
                    ) : (
                      <Ionicons name="chevron-forward" size={18} color="#CBD5E1" />
                    )}
                  </TouchableOpacity>
                );
              }}
            />
          </View>
        </SafeAreaView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(15, 23, 42, 0.5)'
  },
  backdrop: {
    ...StyleSheet.absoluteFill
  },
  sheetContainer: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: height * 0.8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 20
  },
  sheetContent: {
    paddingHorizontal: 20,
    paddingTop: 10,
    height: '100%'
  },
  handleBar: {
    width: 44,
    height: 5,
    borderRadius: 3,
    backgroundColor: '#E2E8F0',
    alignSelf: 'center',
    marginBottom: 12
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16
  },
  headerTitleWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10
  },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center'
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0F172A'
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center'
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: Platform.OS === 'ios' ? 10 : 6,
    marginBottom: 16
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: '#0F172A'
  },
  optionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderRadius: 12,
    marginBottom: 6,
    backgroundColor: '#FFFFFF'
  },
  optionItemSelected: {
    backgroundColor: '#EFF6FF'
  },
  optionTextWrap: {
    flex: 1,
    paddingRight: 10
  },
  optionLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1E293B'
  },
  optionLabelSelected: {
    color: '#2563EB',
    fontWeight: '700'
  },
  optionSublabel: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#64748B',
    marginTop: 8
  },
  emptySubtitle: {
    fontSize: 13,
    color: '#94A3B8',
    marginTop: 4
  }
});
