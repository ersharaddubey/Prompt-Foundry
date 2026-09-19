import React, { createContext, useContext, useState, useEffect } from 'react';
import * as SecureStore from 'expo-secure-store';
import api from '../api/client';
import { registerForPushNotificationsAsync } from '../utils/push';

const AuthContext = createContext(null);

// Ask for permission + send the Expo push token to the backend so this
// device can receive admin notifications and Daily Challenge alerts.
// Fire-and-forget: never blocks login, and any failure is just logged.
async function syncPushToken() {
  try {
    const pushToken = await registerForPushNotificationsAsync();
    if (pushToken) {
      await SecureStore.setItemAsync('pushToken', pushToken);
      await api.post('/notifications/register-token', { token: pushToken });
    }
  } catch (e) {
    console.log('Push token sync failed:', e.message);
  }
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const raw = await SecureStore.getItemAsync('user');
        if (raw) {
          setUser(JSON.parse(raw));
          syncPushToken(); // re-sync in case the token rotated since last launch
        }
      } catch (e) {}
      setLoading(false);
    })();
  }, []);

  const saveUser = async (data) => {
    setUser(data);
    await SecureStore.setItemAsync('user', JSON.stringify(data));
    if (data?.token) await SecureStore.setItemAsync('token', data.token);
    syncPushToken();
  };

  const login = async (email, password) => {
    const { data } = await api.post('/auth/login', { email, password });
    await saveUser(data);
    return data;
  };

  const register = async (name, email, password) => {
    const { data } = await api.post('/auth/register', { name, email, password });
    await saveUser(data);
    return data;
  };

  const logout = async () => {
    try {
      const pushToken = await SecureStore.getItemAsync('pushToken');
      if (pushToken) await api.post('/notifications/unregister-token', { token: pushToken });
    } catch (e) {}
    setUser(null);
    await SecureStore.deleteItemAsync('user');
    await SecureStore.deleteItemAsync('token');
    await SecureStore.deleteItemAsync('pushToken');
  };

  const updateUser = async (partial) => {
    setUser((prev) => {
      const next = { ...(prev || {}), ...partial };
      SecureStore.setItemAsync('user', JSON.stringify(next)).catch(() => {});
      return next;
    });
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        login,
        register,
        logout,
        updateUser,
        isLoggedIn: !!user,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
