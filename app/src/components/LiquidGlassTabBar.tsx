import React, { useEffect, useRef, useState, type RefObject, type ComponentRef } from 'react';
import { View, Text, StyleSheet, Platform, Pressable, LayoutChangeEvent } from 'react-native';
import { useRouter, usePathname } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { walkthroughable, CopilotStep } from 'react-native-copilot';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withSequence,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { useChatUnread } from '../utils/chatUnread';

const WalkthroughableView = walkthroughable(View);

interface TabDefinition {
  name: string;
  label: string;
  activeIcon: any;
  inactiveIcon: any;
}

const TABS: TabDefinition[] = [
  { name: 'index', label: 'Home', activeIcon: 'home', inactiveIcon: 'home-outline' },
  { name: 'chats', label: 'Chat', activeIcon: 'chatbubble-ellipses', inactiveIcon: 'chatbubble-ellipses-outline' },
  { name: 'community', label: 'Community', activeIcon: 'people', inactiveIcon: 'people-outline' },
  { name: 'settings', label: 'Profile', activeIcon: 'person', inactiveIcon: 'person-outline' },
];

const BAR_HEIGHT = 66;
const BAR_PADDING = 6;
const ACTIVE = '#2563EB';
const INACTIVE = '#475569';

// Spring used for the bubble travelling between tabs: a little underdamped so it
// overshoots and settles like a water drop.
const MOVE_SPRING = { damping: 15, stiffness: 170, mass: 0.9 };
const SETTLE_SPRING = { damping: 9, stiffness: 220, mass: 0.6 };

function TabIcon({ tab, focused, unread }: { tab: TabDefinition; focused: boolean; unread: number }) {
  const scale = useSharedValue(focused ? 1 : 0.92);
  const lift = useSharedValue(0);

  useEffect(() => {
    if (focused) {
      // Pop up slightly, then drop back into the bubble.
      scale.value = withSequence(withTiming(1.22, { duration: 140 }), withSpring(1, SETTLE_SPRING));
      lift.value = withSequence(withTiming(-3, { duration: 140 }), withSpring(0, SETTLE_SPRING));
    } else {
      scale.value = withSpring(0.92, SETTLE_SPRING);
      lift.value = withSpring(0, SETTLE_SPRING);
    }
  }, [focused]);

  const iconStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: lift.value }, { scale: scale.value }],
  }));

  return (
    <>
      <Animated.View style={[styles.iconWrap, iconStyle]}>
        <Ionicons name={focused ? tab.activeIcon : tab.inactiveIcon} size={22} color={focused ? ACTIVE : INACTIVE} />
        {tab.name === 'chats' && unread > 0 && (
          <View style={styles.unreadDot}>
            <Text style={styles.unreadDotText}>{unread > 99 ? '99+' : unread}</Text>
          </View>
        )}
      </Animated.View>
      <Text style={[styles.tabLabel, focused && styles.tabLabelActive]} numberOfLines={1}>
        {tab.label}
      </Text>
    </>
  );
}

export default function LiquidGlassTabBar({
  insets,
  basePath,
  hiddenRoutes = [],
  blurTarget,
}: {
  insets: any;
  basePath: '/resident' | '/member';
  /** Screens (route names under basePath) where the bar is hidden. */
  hiddenRoutes?: string[];
  /** Ref to the BlurTargetView wrapping the screens; Android blurs this as the background. */
  blurTarget: RefObject<ComponentRef<typeof View> | null>;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const chatUnread = useChatUnread();
  const [barWidth, setBarWidth] = useState(0);

  const onRoute = (name: string) => pathname === `${basePath}/${name}` || !!pathname?.startsWith(`${basePath}/${name}/`);
  const isHidden = hiddenRoutes.some(onRoute);

  const isTabFocused = (name: string) =>
    name === 'index'
      ? pathname === basePath || pathname === `${basePath}/` || pathname === `${basePath}/index`
      : onRoute(name);

  const activeIndex = TABS.findIndex((t) => isTabFocused(t.name));
  const tabWidth = barWidth > 0 ? (barWidth - BAR_PADDING * 2) / TABS.length : 0;

  // Bubble geometry
  const translateX = useSharedValue(0);
  const stretchX = useSharedValue(1);
  const squashY = useSharedValue(1);
  const bubbleOpacity = useSharedValue(0);
  const pressScale = useSharedValue(1);
  const prevIndex = useRef<number>(-1);

  useEffect(() => {
    if (!tabWidth) return;
    if (activeIndex < 0) {
      bubbleOpacity.value = withTiming(0, { duration: 160 });
      return;
    }
    const target = BAR_PADDING + activeIndex * tabWidth;
    const from = prevIndex.current;

    if (from < 0) {
      // First layout (or coming back from a non-tab screen): appear in place.
      translateX.value = target;
      bubbleOpacity.value = withTiming(1, { duration: 180 });
    } else if (from !== activeIndex) {
      const distance = Math.abs(activeIndex - from);
      // The further it travels, the more the drop stretches.
      const stretch = Math.min(1 + 0.22 * distance, 1.7);
      translateX.value = withSpring(target, MOVE_SPRING);
      stretchX.value = withSequence(
        withTiming(stretch, { duration: 150, easing: Easing.out(Easing.quad) }),
        withSpring(1, SETTLE_SPRING),
      );
      squashY.value = withSequence(
        withTiming(0.82, { duration: 150, easing: Easing.out(Easing.quad) }),
        withSpring(1, SETTLE_SPRING),
      );
      bubbleOpacity.value = withTiming(1, { duration: 120 });
    }
    prevIndex.current = activeIndex;
  }, [activeIndex, tabWidth]);

  const bubbleStyle = useAnimatedStyle(() => ({
    opacity: bubbleOpacity.value,
    transform: [
      { translateX: translateX.value },
      { scaleX: stretchX.value * pressScale.value },
      { scaleY: squashY.value * pressScale.value },
    ],
  }));

  if (isHidden) {
    return null;
  }

  const onLayout = (e: LayoutChangeEvent) => {
    const w = e.nativeEvent.layout.width;
    if (Math.abs(w - barWidth) > 0.5) {
      prevIndex.current = -1;
      setBarWidth(w);
    }
  };

  return (
    <View
      style={[styles.floatingWrapper, { bottom: Platform.OS === 'ios' ? Math.max(insets?.bottom || 0, 16) : 20 }]}
      pointerEvents="box-none"
    >
      <View style={styles.shadowShell}>
        <View style={styles.glass} onLayout={onLayout}>
          {/* Real blur of the screen behind, then a light frosted tint + top sheen */}
          <BlurView
            intensity={Platform.OS === 'ios' ? 55 : 40}
            tint="light"
            blurMethod="dimezisBlurViewSdk31Plus"
            blurTarget={blurTarget}
            style={StyleSheet.absoluteFill}
            pointerEvents="none"
          />
          <LinearGradient
            colors={['rgba(255,255,255,0.55)', 'rgba(248,250,252,0.32)', 'rgba(241,245,249,0.45)']}
            locations={[0, 0.55, 1]}
            style={StyleSheet.absoluteFill}
            pointerEvents="none"
          />
          <LinearGradient
            colors={['rgba(255,255,255,0.95)', 'rgba(255,255,255,0)']}
            style={styles.sheen}
            pointerEvents="none"
          />

          {/* Liquid bubble */}
          {tabWidth > 0 && (
            <Animated.View pointerEvents="none" style={[styles.bubble, { width: tabWidth }, bubbleStyle]}>
              <LinearGradient
                colors={['rgba(255,255,255,0.95)', 'rgba(219,234,254,0.85)', 'rgba(191,219,254,0.7)']}
                locations={[0, 0.5, 1]}
                style={StyleSheet.absoluteFill}
              />
              <LinearGradient
                colors={['rgba(255,255,255,0.9)', 'rgba(255,255,255,0)']}
                style={styles.bubbleSheen}
              />
            </Animated.View>
          )}

          {TABS.map((tab, i) => {
            const focused = i === activeIndex;
            const handlePress = () => {
              router.navigate((tab.name === 'index' ? basePath : `${basePath}/${tab.name}`) as any);
            };

            const button = (
              <Pressable
                onPress={handlePress}
                onPressIn={() => {
                  if (focused) pressScale.value = withSpring(1.08, SETTLE_SPRING);
                }}
                onPressOut={() => {
                  pressScale.value = withSpring(1, SETTLE_SPRING);
                }}
                style={styles.tabItem}
                accessibilityRole="tab"
                accessibilityState={{ selected: focused }}
                accessibilityLabel={tab.label}
              >
                <TabIcon tab={tab} focused={focused} unread={chatUnread.total} />
              </Pressable>
            );

            if (tab.name === 'index') {
              return (
                <CopilotStep
                  key={tab.name}
                  text="यह आपका होम टैब है। यहाँ से आप वापस अपने डैशबोर्ड पर जा सकते हैं।"
                  order={6}
                  name="home_tab"
                >
                  <WalkthroughableView style={styles.tabSlot}>{button}</WalkthroughableView>
                </CopilotStep>
              );
            }

            if (tab.name === 'settings') {
              return (
                <CopilotStep
                  key={tab.name}
                  text="यहाँ से आप अपनी प्रोफ़ाइल और सेटिंग्स मैनेज कर सकते हैं।"
                  order={8}
                  name="profile_tab"
                >
                  <WalkthroughableView style={styles.tabSlot}>{button}</WalkthroughableView>
                </CopilotStep>
              );
            }

            return (
              <View key={tab.name} style={styles.tabSlot}>
                {button}
              </View>
            );
          })}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  floatingWrapper: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    zIndex: 999,
    elevation: 12,
  },
  shadowShell: {
    width: '100%',
    height: BAR_HEIGHT,
    borderRadius: BAR_HEIGHT / 2,
    // iOS blurs whatever is behind the view, so keep the shell clear there.
    // Android needs a background for the elevation shadow; the BlurView covers it.
    backgroundColor: Platform.OS === 'ios' ? 'transparent' : 'rgba(255,255,255,0.6)',
    elevation: 10,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.14,
    shadowRadius: 20,
  },
  glass: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: BAR_PADDING,
    borderRadius: BAR_HEIGHT / 2,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.95)',
  },
  sheen: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: BAR_HEIGHT * 0.45,
  },
  bubble: {
    position: 'absolute',
    left: 0,
    top: BAR_PADDING,
    bottom: BAR_PADDING,
    borderRadius: (BAR_HEIGHT - BAR_PADDING * 2) / 2,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.95)',
  },
  bubbleSheen: {
    position: 'absolute',
    top: 0,
    left: 6,
    right: 6,
    height: '50%',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
  },
  tabSlot: {
    flex: 1,
    height: '100%',
  },
  tabItem: {
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    width: '100%',
  },
  iconWrap: {
    height: 26,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },
  unreadDot: {
    position: 'absolute',
    top: -6,
    right: -14,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 4,
    backgroundColor: '#EF4444',
    borderWidth: 2,
    borderColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  unreadDotText: { color: '#FFFFFF', fontSize: 9.5, fontWeight: '800', includeFontPadding: false },
  tabLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: INACTIVE,
    textAlign: 'center',
  },
  tabLabelActive: {
    color: ACTIVE,
    fontWeight: '700',
  },
});
