import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import * as Localization from 'expo-localization';
import AsyncStorage from '@react-native-async-storage/async-storage';

import en from './locales/en.json';
import hi from './locales/hi.json';

const resources = {
  en: { translation: en },
  hi: { translation: hi },
};

const locales = Localization.getLocales();
const deviceLanguage = (locales && locales.length > 0) ? locales[0].languageCode || 'en' : 'en';

i18n
  .use(initReactI18next)
  .init({
    resources,
    lng: deviceLanguage,
    fallbackLng: 'en',
    interpolation: {
      escapeValue: false, // react already safes from xss
    },
  });

// Load the saved language from AsyncStorage asynchronously
AsyncStorage.getItem('user-language').then((savedLanguage) => {
  if (savedLanguage) {
    i18n.changeLanguage(savedLanguage);
  }
}).catch(err => console.log('Error loading language', err));

export default i18n;
