import 'react-native-gesture-handler';
import 'react-native-reanimated';
import { Stack } from 'expo-router';
import Toast from 'react-native-toast-message';
import '../i18n';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

// Catch any errors thrown by the Layout component or its children.
// This guarantees the app won't just crash/close abruptly if there's a JS error.
export { ErrorBoundary } from 'expo-router';

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <Stack screenOptions={{ headerShown: false }} />
      <Toast />
    </GestureHandlerRootView>
  );
}
