// @ts-ignore
import { initializeApp, getApp, getApps } from 'firebase/app';
// @ts-ignore
import { initializeAuth, getReactNativePersistence } from 'firebase/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';

export const firebaseConfig = {
  apiKey: "AIzaSyAk-Qps3Lzl1nHe1FAeam6COSAqHKYw7Ts",
  authDomain: "anytime-help-360c3.firebaseapp.com",
  projectId: "anytime-help-360c3",
  storageBucket: "anytime-help-360c3.firebasestorage.app",
  messagingSenderId: "1042641251436",
  appId: "1:1042641251436:web:82fd7a3072daa678bcbc49",
  measurementId: "G-D2YHGBMW06"
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
