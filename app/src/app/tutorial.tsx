import React, { useState, useRef } from 'react';
import { View, Text, StyleSheet, Dimensions, ScrollView, TouchableOpacity, SafeAreaView, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

const { width, height } = Dimensions.get('window');

const SLIDES = [
  {
    id: '1',
    title: 'Welcome to Anytime Help',
    description: 'Your ultimate community management app. Everything you need to manage your society, right in your pocket.',
    icon: 'home',
    colors: ['#4F46E5', '#3B82F6']
  },
  {
    id: '2',
    title: 'Lodge Complaints',
    description: 'Face an issue? Lodge complaints seamlessly and track their resolution status in real-time.',
    icon: 'document-text',
    colors: ['#059669', '#10B981']
  },
  {
    id: '3',
    title: 'Stay Updated',
    description: 'Never miss out! Get instant announcements and important broadcasts directly from the admin.',
    icon: 'megaphone',
    colors: ['#D97706', '#F59E0B']
  },
  {
    id: '4',
    title: 'Community Directory',
    description: 'Connect with other residents easily and securely through our integrated society directory.',
    icon: 'people',
    colors: ['#7C3AED', '#8B5CF6']
  }
];

export default function Tutorial() {
  const router = useRouter();
  const [currentIndex, setCurrentIndex] = useState(0);
  const scrollRef = useRef<ScrollView>(null);

  const completeTutorial = async () => {
    await SecureStore.setItemAsync('hasViewedTutorial', 'true');
    router.replace('/login' as any);
  };

  const handleNext = () => {
    if (currentIndex < SLIDES.length - 1) {
      scrollRef.current?.scrollTo({ x: (currentIndex + 1) * width, animated: true });
    } else {
      completeTutorial();
    }
  };

  const onScroll = (event: any) => {
    const offsetX = event.nativeEvent.contentOffset.x;
    const index = Math.round(offsetX / width);
    if (index !== currentIndex && index >= 0 && index < SLIDES.length) {
      setCurrentIndex(index);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={onScroll}
        scrollEventThrottle={16}
        bounces={false}
      >
        {SLIDES.map((slide, index) => (
          <View key={slide.id} style={styles.slide}>
            <View style={styles.iconContainer}>
              <LinearGradient
                colors={slide.colors as any}
                style={styles.iconCircle}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              >
                <Ionicons name={slide.icon as any} size={80} color="#FFFFFF" />
              </LinearGradient>
            </View>
            <View style={styles.textContainer}>
              <Text style={styles.title}>{slide.title}</Text>
              <Text style={styles.description}>{slide.description}</Text>
            </View>
          </View>
        ))}
      </ScrollView>

      {/* Pagination & Controls */}
      <View style={styles.footer}>
        <View style={styles.pagination}>
          {SLIDES.map((_, index) => (
            <View
              key={index}
              style={[
                styles.dot,
                currentIndex === index ? styles.activeDot : styles.inactiveDot
              ]}
            />
          ))}
        </View>

        <View style={styles.controls}>
          <TouchableOpacity 
            style={styles.skipButton} 
            onPress={completeTutorial}
          >
            <Text style={styles.skipText}>Skip</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.nextButton, { backgroundColor: SLIDES[currentIndex].colors[0] }]} 
            onPress={handleNext}
            activeOpacity={0.8}
          >
            <Text style={styles.nextText}>
              {currentIndex === SLIDES.length - 1 ? 'Get Started' : 'Next'}
            </Text>
            {currentIndex !== SLIDES.length - 1 && (
              <Ionicons name="arrow-forward" size={20} color="#FFFFFF" style={{ marginLeft: 8 }} />
            )}
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  slide: {
    width,
    alignItems: 'center',
    paddingTop: height * 0.15,
  },
  iconContainer: {
    width: 200,
    height: 200,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 50,
  },
  iconCircle: {
    width: 160,
    height: 160,
    borderRadius: 80,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 10,
  },
  textContainer: {
    paddingHorizontal: 40,
    alignItems: 'center',
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 16,
    textAlign: 'center',
    letterSpacing: -0.5,
  },
  description: {
    fontSize: 16,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 24,
  },
  footer: {
    position: 'absolute',
    bottom: Platform.OS === 'ios' ? 40 : 24,
    left: 0,
    right: 0,
    paddingHorizontal: 24,
  },
  pagination: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 32,
  },
  dot: {
    height: 8,
    borderRadius: 4,
    marginHorizontal: 4,
  },
  activeDot: {
    width: 24,
    backgroundColor: '#3B82F6',
  },
  inactiveDot: {
    width: 8,
    backgroundColor: '#E2E8F0',
  },
  controls: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  skipButton: {
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  skipText: {
    fontSize: 16,
    color: '#64748B',
    fontWeight: '600',
  },
  nextButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  nextText: {
    fontSize: 16,
    color: '#FFFFFF',
    fontWeight: '700',
  }
});
