import React from 'react';
import { Image } from 'react-native';
import useImageRatio from '../utils/useImageRatio';

// Announcement poster shown at its real shape (full width, never cropped)
export default function AnnouncementImage({ uri }: { uri: string }) {
  const ratio = useImageRatio(uri, 4 / 3, 0.6, 3.5);
  return (
    <Image
      source={{ uri }}
      style={{ width: '100%', aspectRatio: ratio, borderRadius: 12, marginTop: 12, backgroundColor: '#E2E8F0' }}
      resizeMode="contain"
    />
  );
}
