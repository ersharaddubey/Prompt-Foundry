import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { Modal, View, Text, TouchableOpacity, ActivityIndicator, StyleSheet } from 'react-native';
import { WebView } from 'react-native-webview';
import { PUTER_BRIDGE_URL, PUTER_WORKER_URL, COLORS } from '../constants/config';
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
  const [puterBridge, setPuterBridge] = useState(null);
  const bridgeResolver = useRef(null);

  const openPuterBridge = (mode, extra = {}) => new Promise((resolve, reject) => {
    if (!PUTER_WORKER_URL || !/^https:\/\//i.test(PUTER_WORKER_URL)) {
      reject(new Error('Puter Worker URL is not configured. Set EXPO_PUBLIC_PUTER_WORKER_URL and rebuild the app.'));
      return;
    }
    if (bridgeResolver.current) bridgeResolver.current.reject(new Error('Puter request was replaced.'));
    bridgeResolver.current = { resolve, reject };
    const query = new URLSearchParams({ mode, worker: PUTER_WORKER_URL, ...extra });
    setPuterBridge(`${PUTER_BRIDGE_URL}?${query.toString()}`);
  });

  const handlePuterBridgeMessage = (event) => {
    let message;
    try { message = JSON.parse(event.nativeEvent.data); } catch { return; }
    const resolver = bridgeResolver.current;
    if (!resolver) return;
    bridgeResolver.current = null;
    setPuterBridge(null);
    if (message.type === 'success') resolver.resolve(message.data || {});
    else resolver.reject(new Error(message.message || 'Puter request failed.'));
  };

  const closePuterBridge = () => {
    const resolver = bridgeResolver.current;
    bridgeResolver.current = null;
    setPuterBridge(null);
    if (resolver) resolver.reject(new Error('Puter authorization was cancelled.'));
  };

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

  const puterLogin = async () => {
    const result = await openPuterBridge('login');
    const code = result.code;
    const { data } = await api.post('/auth/puter/exchange', { code });
    await saveUser(data);
    return data;
  };

  const generateWithPuter = async (prompt, ratio, referenceImage = null) => {
    if (!user) throw new Error('Please sign in with Puter first.');
    let inputImageUrl = '';
    if (referenceImage?.uri && /^https:\/\//i.test(referenceImage.uri)) {
      inputImageUrl = referenceImage.uri;
    } else if (referenceImage?.uri) {
      const form = new FormData();
      form.append('image', { uri: referenceImage.uri, name: referenceImage.name || 'reference.jpg', type: referenceImage.type || 'image/jpeg' });
      const uploaded = await api.post('/generate/puter-reference-upload', form, {
        headers: { 'Content-Type': 'multipart/form-data' }, timeout: 60000,
      });
      inputImageUrl = uploaded.data.imageUrl;
    }
    const generated = await openPuterBridge('generate', { prompt, ratio, ...(inputImageUrl ? { inputImageUrl } : {}) });
    const { data } = await api.post('/generate/puter-record', {
      prompt, ratio, imageUrl: generated.imageUrl, storagePath: generated.storagePath,
    }, { timeout: 30000 });
    return data;
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

  const deleteAccount = async () => {
    await api.delete('/auth/account');
    setUser(null);
    await SecureStore.deleteItemAsync('user');
    await SecureStore.deleteItemAsync('token');
    await SecureStore.deleteItemAsync('pushToken');
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        login,
        register,
        puterLogin,
        generateWithPuter,
        logout,
        updateUser,
        deleteAccount,
        isLoggedIn: !!user,
      }}
    >
      {children}
      <Modal visible={!!puterBridge} animationType="slide" presentationStyle="fullScreen" onRequestClose={closePuterBridge}>
        <View style={bridgeStyles.container}>
          <View style={bridgeStyles.header}>
            <Text style={bridgeStyles.title}>Prompt Foundry · Secure Puter</Text>
            <TouchableOpacity onPress={closePuterBridge}><Text style={bridgeStyles.close}>Close</Text></TouchableOpacity>
          </View>
          {puterBridge ? <WebView source={{ uri: puterBridge }} onMessage={handlePuterBridgeMessage} javaScriptEnabled domStorageEnabled sharedCookiesEnabled thirdPartyCookiesEnabled startInLoadingState renderLoading={() => <View style={bridgeStyles.loading}><ActivityIndicator color={COLORS.primary} /><Text style={bridgeStyles.loadingText}>Connecting securely to Puter…</Text></View>} onError={() => { const r = bridgeResolver.current; bridgeResolver.current = null; setPuterBridge(null); if (r) r.reject(new Error('Could not load the secure Puter bridge. Check your internet connection and Worker URL.')); }} /> : null}
        </View>
      </Modal>
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);

const bridgeStyles = StyleSheet.create({ container: { flex: 1, backgroundColor: '#0f0f12' }, header: { height: 56, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#1a1a1f', borderBottomWidth: 1, borderBottomColor: '#2a2a32' }, title: { color: '#fff', fontWeight: '700' }, close: { color: '#c4b5fd', fontWeight: '600' }, loading: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#0f0f12' }, loadingText: { color: '#9ca3af', marginTop: 12 } });
