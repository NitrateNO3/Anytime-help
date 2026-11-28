import React, { useEffect } from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet, useWindowDimensions, Platform, StatusBar } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { GestureDetector, GestureHandlerRootView, usePanGesture } from 'react-native-gesture-handler';
import Animated, {
  Easing, interpolate, Extrapolation, runOnJS, useAnimatedStyle, useSharedValue, withSpring, withTiming,
} from 'react-native-reanimated';

export type AvatarOrigin = { x: number; y: number; size: number };

type Props = {
  visible: boolean;
  uri?: string | null;
  title?: string;
  // Where the small avatar sits on screen, so the photo grows out of it and shrinks back into it
  origin?: AvatarOrigin | null;
  onClose: () => void;
  // Shows a pencil in the header (e.g. to change the photo)
  onEdit?: () => void;
};

const OPEN_MS = 280;
const CLOSE_MS = 230;
const DISMISS_DISTANCE = 110;
const DISMISS_VELOCITY = 900;

// WhatsApp-style profile photo viewer: the photo expands from the tapped avatar
// to a full-width square on a black background, and drag up/down or back closes
// it with the photo flying back into the avatar.
export default function ProfilePhotoViewer({ visible, uri, title, origin, onClose, onEdit }: Props) {
  const { width: W, height: H } = useWindowDimensions();
  const progress = useSharedValue(0);
  const dragY = useSharedValue(0);
  const closing = useSharedValue(false);

  // Fallback origin: a small circle in the middle of the screen
  const o = origin && origin.size > 0 ? origin : { x: W / 2 - 30, y: H / 2 - 30, size: 60 };
  const target = { x: 0, y: (H - W) / 2, size: W };

  useEffect(() => {
    if (visible) {
      closing.value = false;
      dragY.value = 0;
      progress.value = 0;
      progress.value = withTiming(1, { duration: OPEN_MS, easing: Easing.out(Easing.cubic) });
    }
  }, [visible]);

  const finishClose = () => onClose();

  const close = (afterClose?: () => void) => {
    if (closing.value) return;
    closing.value = true;
    dragY.value = withTiming(0, { duration: CLOSE_MS, easing: Easing.inOut(Easing.cubic) });
    progress.value = withTiming(0, { duration: CLOSE_MS, easing: Easing.inOut(Easing.cubic) }, (done) => {
      if (done) {
        runOnJS(finishClose)();
        if (afterClose) runOnJS(afterClose)();
      }
    });
  };

  const pan = usePanGesture({
    activeOffsetY: [-12, 12],
    failOffsetX: [-24, 24],
    onUpdate: (e) => {
      'worklet';
      if (closing.value) return;
      dragY.value = e.translationY;
    },
    onDeactivate: (e) => {
      'worklet';
      if (closing.value) return;
      if (Math.abs(e.translationY) > DISMISS_DISTANCE || Math.abs(e.velocityY) > DISMISS_VELOCITY) {
        runOnJS(close)();
      } else {
        dragY.value = withSpring(0, { damping: 18, stiffness: 220 });
      }
    },
    onFinalize: (e) => {
      'worklet';
      // Gesture cancelled (e.g. interrupted): put the photo back
      if (e.canceled && !closing.value) dragY.value = withSpring(0, { damping: 18, stiffness: 220 });
    },
  });

  const backdropStyle = useAnimatedStyle(() => {
    const dragFade = interpolate(Math.abs(dragY.value), [0, 300], [1, 0.25], Extrapolation.CLAMP);
    return { opacity: progress.value * dragFade };
  });

  const photoStyle = useAnimatedStyle(() => {
    const p = progress.value;
    const size = interpolate(p, [0, 1], [o.size, target.size]);
    const dragScale = interpolate(Math.abs(dragY.value), [0, 400], [1, 0.82], Extrapolation.CLAMP);
    return {
      left: interpolate(p, [0, 1], [o.x, target.x]),
      top: interpolate(p, [0, 1], [o.y, target.y]),
      width: size,
      height: size,
      borderRadius: interpolate(p, [0, 1], [o.size / 2, 0]),
      transform: [{ translateY: dragY.value }, { scale: dragScale }],
    };
  });

  const chromeStyle = useAnimatedStyle(() => {
    const dragFade = interpolate(Math.abs(dragY.value), [0, 80], [1, 0], Extrapolation.CLAMP);
    return { opacity: interpolate(progress.value, [0.6, 1], [0, 1], Extrapolation.CLAMP) * dragFade };
  });

  if (!uri) return null;

  const topPad = Platform.OS === 'android' ? (StatusBar.currentHeight || 24) + 6 : 50;

  return (
    <Modal visible={visible} transparent animationType="none" statusBarTranslucent onRequestClose={() => close()}>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <StatusBar barStyle="light-content" />
        <GestureDetector gesture={pan}>
          <View style={StyleSheet.absoluteFill} collapsable={false}>
            <Animated.View style={[StyleSheet.absoluteFill, styles.backdrop, backdropStyle]} />
            <Animated.View style={[styles.photo, photoStyle]}>
              <Image source={{ uri }} style={StyleSheet.absoluteFill} contentFit="cover" cachePolicy="memory-disk" />
            </Animated.View>
          </View>
        </GestureDetector>

        <Animated.View style={[styles.header, { paddingTop: topPad }, chromeStyle]}>
          <TouchableOpacity onPress={() => close()} style={styles.iconBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
          </TouchableOpacity>
          <Text style={styles.title} numberOfLines={1}>{title || 'Profile photo'}</Text>
          {onEdit ? (
            <TouchableOpacity onPress={() => close(onEdit)} style={styles.iconBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Ionicons name="pencil" size={21} color="#FFFFFF" />
            </TouchableOpacity>
          ) : (
            <View style={styles.iconBtn} />
          )}
        </Animated.View>
      </GestureHandlerRootView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { backgroundColor: '#000000' },
  photo: { position: 'absolute', overflow: 'hidden', backgroundColor: '#111827' },
  header: {
    position: 'absolute', top: 0, left: 0, right: 0, flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 12, paddingBottom: 12, backgroundColor: 'rgba(0,0,0,0.35)',
  },
  iconBtn: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
  title: { flex: 1, color: '#FFFFFF', fontSize: 18, fontWeight: '600', marginLeft: 8 },
});
