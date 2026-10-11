// @ts-ignore
import { initializeApp, getApp, getApps } from 'firebase/app';
// @ts-ignore
import { initializeAuth, getReactNativePersistence } from 'firebase/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';

export const firebaseConfig = {
  apiKey: "AIzaSyAkGfTNcsrSYuQu6D6FCp8sVyBEb7a0pV8",
  authDomain: "anytimehelp-a9a46.firebaseapp.com",
  projectId: "anytimehelp-a9a46",
  storageBucket: "anytimehelp-a9a46.firebasestorage.app",
  messagingSenderId: "211437749131",
  appId: "1:211437749131:android:045cdb99e1b164a98b658e"
};

let app;
if (getApps().length === 0) {
  app = initializeApp(firebaseConfig);
} else {
  app = getApp();
}

export const auth = initializeAuth(app, {
  persistence: getReactNativePersistence(AsyncStorage)
});

export default app;
