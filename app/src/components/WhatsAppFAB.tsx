import React, { useRef } from 'react';
import {
  Animated,
  PanResponder,
  TouchableOpacity,
  Linking,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface WhatsAppFABProps {
  bottom?: number;
  right?: number;
}

export default function WhatsAppFAB({ bottom = 90, right = 20 }: WhatsAppFABProps) {
  const pan = useRef(new Animated.ValueXY()).current;
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onStartShouldSetPanResponderCapture: () => false,
      onMoveShouldSetPanResponderCapture: () => false,
      onMoveShouldSetPanResponder: (_evt, gestureState) => {
        // Only claim gesture if the user moves enough
        return Math.abs(gestureState.dx) > 5 || Math.abs(gestureState.dy) > 5;
      },
      onPanResponderGrant: () => {
        pan.setOffset({
          x: (pan.x as any)._value || 0,
          y: (pan.y as any)._value || 0,
        });
        pan.setValue({ x: 0, y: 0 });
      },
      onPanResponderMove: Animated.event(
        [null, { dx: pan.x, dy: pan.y }],
        { useNativeDriver: false }
      ),
      onPanResponderRelease: () => {
        pan.flattenOffset();
      },
    })
  ).current;

  const handlePress = () => {
    const msg = 'Hello Anytime Help Support, I need some assistance. Could you please help me?';
    const encodedMsg = encodeURIComponent(msg);
    const url = `whatsapp://send?phone=918882004800&text=${encodedMsg}`;
    Linking.openURL(url).catch(() => {
      Linking.openURL(`https://wa.me/918882004800?text=${encodedMsg}`).catch((err) =>
        console.error('An error occurred opening WhatsApp', err)
      );
    });
  };

  return (
    <Animated.View
      {...panResponder.panHandlers}
      style={[
        styles.fabContainer,
        { bottom, right },
        { transform: [{ translateX: pan.x }, { translateY: pan.y }] },
      ]}
    >
      <TouchableOpacity
        style={styles.fabButton}
        activeOpacity={0.8}
        onPress={handlePress}
      >
        <Ionicons name="logo-whatsapp" size={30} color="#FFFFFF" />
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  fabContainer: {
    position: 'absolute',
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: '#25D366',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#128C7E',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 8,
    zIndex: 99999,
  },
  fabButton: {
    flex: 1,
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
});
