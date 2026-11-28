import React, { useState } from 'react';
import { View, TouchableOpacity, ActivityIndicator, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as SecureStore from 'expo-secure-store';
import Toast from 'react-native-toast-message';
import { AppAlert } from './AppAlert';
import ProfileAvatar from './ProfileAvatar';

const API_URL = 'https://api.anytimehelp.co.in';

type Props = {
  photoUrl?: string | null;
  size?: number;
  iconColor?: string;
  // Ionicons name shown when there is no photo
  fallbackIcon?: keyof typeof Ionicons.glyphMap;
  backgroundColor?: string;
  // Name shown in the full-screen viewer header
  name?: string;
  // Called with the new URL (or null when removed) after the server saved it
  onChange?: (url: string | null) => void;
};

// Round avatar with a camera badge. Tapping the photo opens it full screen
// (WhatsApp style, with a pencil to change it); tapping the badge, or the avatar
// when there is no photo, lets the user take a photo, pick one from the
// gallery, or remove the current one. The photo is uploaded
// to the backend and the cached userData in SecureStore is updated.
export default function ProfilePhotoPicker({
  photoUrl, size = 64, iconColor = '#0F172A', fallbackIcon = 'person', backgroundColor = '#EFF6FF', name, onChange,
}: Props) {
  const [uploading, setUploading] = useState(false);

  const saveToStoredUser = async (url: string | null) => {
    try {
      const stored = await SecureStore.getItemAsync('userData');
      if (!stored) return;
      const parsed = JSON.parse(stored);
      if (url) parsed.profile_pic = url;
      else delete parsed.profile_pic;
      await SecureStore.setItemAsync('userData', JSON.stringify(parsed));
    } catch (e) {
      console.log('Could not update stored user photo', e);
    }
  };

  const upload = async (base64: string) => {
    const token = await SecureStore.getItemAsync('userToken');
    if (!token) return;
    setUploading(true);
    try {
      const res = await fetch(`${API_URL}/api/users/me/photo`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'x-auth-token': token },
        body: JSON.stringify({ image: `data:image/jpeg;base64,${base64}` }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.profile_pic) throw new Error(data.message || 'Upload failed');
      await saveToStoredUser(data.profile_pic);
      onChange?.(data.profile_pic);
      Toast.show({ type: 'success', text1: 'Profile photo updated' });
    } catch (e: any) {
      Toast.show({ type: 'error', text1: 'Error', text2: e?.message || 'Could not upload photo' });
    } finally {
      setUploading(false);
    }
  };

  const removePhoto = async () => {
    const token = await SecureStore.getItemAsync('userToken');
    if (!token) return;
    setUploading(true);
    try {
      const res = await fetch(`${API_URL}/api/users/me/photo`, {
        method: 'DELETE',
        headers: { 'x-auth-token': token },
      });
      if (!res.ok) throw new Error('Remove failed');
      await saveToStoredUser(null);
      onChange?.(null);
      Toast.show({ type: 'success', text1: 'Profile photo removed' });
    } catch {
      Toast.show({ type: 'error', text1: 'Error', text2: 'Could not remove photo' });
    } finally {
      setUploading(false);
    }
  };

  const pickerOptions: ImagePicker.ImagePickerOptions = {
    mediaTypes: ['images'],
    allowsEditing: true,
    aspect: [1, 1],
    quality: 0.5,
    base64: true,
  };

  const takePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      AppAlert.alert('Permission Denied', 'Camera permission is required to take a photo.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync(pickerOptions);
    if (!result.canceled && result.assets?.[0]?.base64) upload(result.assets[0].base64);
  };

  const pickFromGallery = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      AppAlert.alert('Permission Denied', 'Gallery permission is required to choose a photo.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync(pickerOptions);
    if (!result.canceled && result.assets?.[0]?.base64) upload(result.assets[0].base64);
  };

  const openOptions = () => {
    if (uploading) return;
    const buttons: { text: string; onPress?: () => void; style?: 'cancel' }[] = [
      { text: 'Take Photo', onPress: takePhoto },
      { text: 'Choose from Gallery', onPress: pickFromGallery },
    ];
    if (photoUrl) buttons.push({ text: 'Remove Photo', onPress: removePhoto });
    buttons.push({ text: 'Cancel', style: 'cancel' });
    AppAlert.alert('Profile Photo', 'Add or change your profile photo', buttons);
  };

  const badge = Math.max(20, Math.round(size * 0.36));

  return (
    <View style={{ width: size, height: size }}>
      <ProfileAvatar
        uri={photoUrl}
        size={size}
        name={name}
        style={{ backgroundColor }}
        fallback={<Ionicons name={fallbackIcon} size={Math.round(size * 0.5)} color={iconColor} />}
        onPressEmpty={openOptions}
        onEdit={openOptions}
      >
        {uploading && (
          <View style={[StyleSheet.absoluteFill, styles.overlay]}>
            <ActivityIndicator color="#FFFFFF" />
          </View>
        )}
      </ProfileAvatar>
      <TouchableOpacity
        onPress={openOptions}
        activeOpacity={0.8}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        style={[styles.badge, { width: badge, height: badge, borderRadius: badge / 2 }]}
      >
        <Ionicons name="camera" size={Math.round(badge * 0.55)} color="#FFFFFF" />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: { backgroundColor: 'rgba(15,23,42,0.45)', justifyContent: 'center', alignItems: 'center' },
  badge: {
    position: 'absolute', right: -2, bottom: -2, backgroundColor: '#2563EB',
    justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: '#FFFFFF',
  },
});
