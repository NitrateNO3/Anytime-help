import axios from 'axios';
import * as SecureStore from 'expo-secure-store';

// Attach the logged-in user's token to every request to our backend.
//
// The backend decides which area (society) a request belongs to from this
// token. Many screens fetch "public" lists (categories, banners, ...) without
// passing the token themselves; without it those requests are not scoped to
// the user's area and return data from every area. Requests that already set
// x-auth-token are left untouched.
const API_HOST = 'anytime-help.onrender.com';

axios.interceptors.request.use(async (config) => {
  try {
    const url = `${config.baseURL || ''}${config.url || ''}`;
    if (!url.includes(API_HOST)) return config;

    const headers: any = config.headers || {};
    const existing = typeof headers.get === 'function' ? headers.get('x-auth-token') : headers['x-auth-token'];
    if (existing) return config;

    const token = await SecureStore.getItemAsync('userToken');
    if (token) {
      if (typeof headers.set === 'function') headers.set('x-auth-token', token);
      else headers['x-auth-token'] = token;
      config.headers = headers;
    }
  } catch (_) {
    // Never block a request because the token could not be read
  }
  return config;
});
