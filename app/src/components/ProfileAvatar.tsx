import React, { useRef, useState } from 'react';
import { View, TouchableOpacity, StyleProp, ViewStyle } from 'react-native';
import { Image } from 'expo-image';
import ProfilePhotoViewer, { AvatarOrigin } from './ProfilePhotoViewer';

type Props = {
  uri?: string | null;
  size: number;
  // Name shown in the viewer header
  name?: string;
  // Shown when there is no photo (initials, an icon...)
  fallback?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  // Tap with no photo (e.g. open the photo picker). With a photo, tap opens the viewer.
  onPressEmpty?: () => void;
  // Adds a pencil to the viewer header
  onEdit?: () => void;
  // Overlays drawn on top of the circle (e.g. an upload spinner)
  children?: React.ReactNode;
};

// Round profile photo. Tapping it opens the photo full screen with a
// WhatsApp-style grow-from-avatar animation.
export default function ProfileAvatar({ uri, size, name, fallback, style, onPressEmpty, onEdit, children }: Props) {
  const ref = useRef<React.ComponentRef<typeof View>>(null);
  const [open, setOpen] = useState(false);
  const [origin, setOrigin] = useState<AvatarOrigin | null>(null);

  const onPress = () => {
    if (!uri) {
      onPressEmpty?.();
      return;
    }
    const node = ref.current;
    if (!node) {
      setOrigin(null);
      setOpen(true);
      return;
    }
    node.measureInWindow((x: number, y: number, w: number) => {
      setOrigin(w ? { x, y, size: w } : null);
      setOpen(true);
    });
  };

  const disabled = !uri && !onPressEmpty;

  return (
    <>
      <TouchableOpacity activeOpacity={0.85} onPress={onPress} disabled={disabled}>
        <View
          ref={ref}
          collapsable={false}
          style={[
            { width: size, height: size, borderRadius: size / 2, overflow: 'hidden', justifyContent: 'center', alignItems: 'center' },
            style,
          ]}
        >
          {uri ? (
            <Image source={{ uri }} style={{ width: size, height: size }} contentFit="cover" transition={150} cachePolicy="memory-disk" />
          ) : (
            fallback
          )}
          {children}
        </View>
      </TouchableOpacity>
      {!!uri && (
        <ProfilePhotoViewer
          visible={open}
          uri={uri}
          title={name}
          origin={origin}
          onEdit={onEdit}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}
