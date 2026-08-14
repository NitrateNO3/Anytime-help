import { Stack } from 'expo-router';
import Toast from 'react-native-toast-message';
import '../i18n';

export default function RootLayout() {
  return (
    <>
      <Stack screenOptions={{ headerShown: false }} />
      <Toast />
    </>
  );
}
