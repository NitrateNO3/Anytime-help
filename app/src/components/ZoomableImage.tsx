import React, { useEffect } from 'react';
import { StyleProp, StyleSheet, View, ViewStyle, LayoutChangeEvent } from 'react-native';
import {
  GestureDetector,
  GestureHandlerRootView,
  usePanGesture,
  usePinchGesture,
  useSimultaneousGestures,
  useExclusiveGestures,
  useTapGesture,
} from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

const MIN_SCALE = 1;
const MAX_SCALE = 5;
const DOUBLE_TAP_SCALE = 2.5;

type Props = {
  uri: string;
  /** Style of the area the image fits into (defaults to filling the parent). */
  style?: StyleProp<ViewStyle>;
};

/**
 * Full-screen image with pinch-to-zoom, drag-to-pan while zoomed and
 * double-tap to zoom in / reset. Wraps itself in a GestureHandlerRootView
 * because gestures inside a React Native <Modal> need their own root on Android.
 */
export default function ZoomableImage({ uri, style }: Props) {
  const width = useSharedValue(0);
  const height = useSharedValue(0);

  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);
  const tx = useSharedValue(0);
  const ty = useSharedValue(0);
  const savedTx = useSharedValue(0);
  const savedTy = useSharedValue(0);

  // Reset zoom whenever a different image is opened.
  useEffect(() => {
    scale.value = 1;
    savedScale.value = 1;
    tx.value = 0;
    ty.value = 0;
    savedTx.value = 0;
    savedTy.value = 0;
  }, [uri]);

  const clampAndSettle = () => {
    'worklet';
    const s = Math.min(Math.max(scale.value, MIN_SCALE), MAX_SCALE);
    const maxX = (width.value * (s - 1)) / 2;
    const maxY = (height.value * (s - 1)) / 2;
    const nx = Math.min(Math.max(tx.value, -maxX), maxX);
    const ny = Math.min(Math.max(ty.value, -maxY), maxY);
    scale.value = withTiming(s);
    tx.value = withTiming(nx);
    ty.value = withTiming(ny);
    savedScale.value = s;
    savedTx.value = nx;
    savedTy.value = ny;
  };

  const pinch = usePinchGesture({
    onUpdate: (e) => {
      'worklet';
      scale.value = Math.min(Math.max(savedScale.value * e.scale, 0.8), MAX_SCALE * 1.2);
    },
    onDeactivate: () => {
      'worklet';
      clampAndSettle();
    },
  });

  const pan = usePanGesture({
    onUpdate: (e) => {
      'worklet';
      if (savedScale.value <= 1 && scale.value <= 1) return;
      tx.value = savedTx.value + e.translationX;
      ty.value = savedTy.value + e.translationY;
    },
    onDeactivate: () => {
      'worklet';
      clampAndSettle();
    },
  });

  const doubleTap = useTapGesture({
    numberOfTaps: 2,
    onDeactivate: (e) => {
      'worklet';
      if (e.canceled) return;
      if (savedScale.value > 1) {
        scale.value = withTiming(1);
        tx.value = withTiming(0);
        ty.value = withTiming(0);
        savedScale.value = 1;
        savedTx.value = 0;
        savedTy.value = 0;
      } else {
        // Zoom towards the tapped point.
        const s = DOUBLE_TAP_SCALE;
        const maxX = (width.value * (s - 1)) / 2;
        const maxY = (height.value * (s - 1)) / 2;
        const nx = Math.min(Math.max((width.value / 2 - e.x) * (s - 1), -maxX), maxX);
        const ny = Math.min(Math.max((height.value / 2 - e.y) * (s - 1), -maxY), maxY);
        scale.value = withTiming(s);
        tx.value = withTiming(nx);
        ty.value = withTiming(ny);
        savedScale.value = s;
        savedTx.value = nx;
        savedTy.value = ny;
      }
    },
  });

  const gesture = useExclusiveGestures(doubleTap, useSimultaneousGestures(pinch, pan));

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: tx.value }, { translateY: ty.value }, { scale: scale.value }],
  }));

  const onLayout = (e: LayoutChangeEvent) => {
    width.value = e.nativeEvent.layout.width;
    height.value = e.nativeEvent.layout.height;
  };

  return (
    <GestureHandlerRootView style={[styles.root, style]}>
      <GestureDetector gesture={gesture}>
        <View style={styles.fill} onLayout={onLayout} collapsable={false}>
          <Animated.Image source={{ uri }} style={[styles.fill, animatedStyle]} resizeMode="contain" />
        </View>
      </GestureDetector>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: { width: '100%', height: '100%', overflow: 'hidden' },
  fill: { width: '100%', height: '100%' },
});
