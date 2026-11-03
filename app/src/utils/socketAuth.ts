import * as SecureStore from 'expo-secure-store';

// Socket.io options that identify the logged-in user, so the backend puts the
// socket in its area's room and only sends that area's live events.
// socket.io-client calls `auth` on every (re)connect, so the token can be read
// asynchronously without changing how each screen opens its socket:
//   io(SOCKET_URL, { ...socketAuth, transports: [...] })
export const socketAuth = {
  auth: (cb: (data: object) => void) => {
    SecureStore.getItemAsync('userToken')
      .then((token) => cb(token ? { token } : {}))
      .catch(() => cb({}));
  },
};
