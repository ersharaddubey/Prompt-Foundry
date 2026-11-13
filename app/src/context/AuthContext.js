import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { Modal, View, Text, TouchableOpacity, ActivityIndicator, StyleSheet } from 'react-native';
import { WebView } from 'react-native-webview';
import { PUTER_BRIDGE_URL, PUTER_WORKER_URL, COLORS } from '../constants/config';
import * as SecureStore from 'expo-secure-store';
import api from '../api/client';
import { registerForPushNotificationsAsync } from '../utils/push';

const AuthContext = createContext(null);

// Puter's sign-in opens a popup (window.open) and the popup answers through
// window.opener.postMessage. A React Native WebView supports neither, so the page
// hangs on Puter's login screen. These two scripts emulate both ends natively.
// Plain mobile Chrome UA (without the "; wv" WebView marker) so Puter's login page treats it as a normal browser.
const POPUP_USER_AGENT = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36';

const MAIN_PATCH_JS = `
(function () {
  if (window.__pfPopupPatched) return;
  window.__pfPopupPatched = true;
  function send(type, url) {
    window.ReactNativeWebView.postMessage(JSON.stringify({ type: type, url: url }));
  }
  window.open = function (url) {
    var current = url ? String(url) : '';
    var stub = {
      closed: false,
      focus: function () {},
      blur: function () {},
      postMessage: function () {},
      close: function () {
        stub.closed = true;
        send('popup-close');
      }
    };
    var loc = {
      replace: function (u) { current = String(u); send('popup-open', current); },
      assign: function (u) { current = String(u); send('popup-open', current); },
      toString: function () { return current; }
    };
    Object.defineProperty(loc, 'href', {
      get: function () { return current; },
      set: function (u) { current = String(u); send('popup-open', current); }
    });
    Object.defineProperty(stub, 'location', {
      get: function () { return loc; },
      set: function (u) { current = String(u); send('popup-open', current); }
    });
    window.__pfStub = stub;
    if (current) send('popup-open', current);
    return stub;
  };
  window.__pfPopupMessage = function (data, origin) {
    window.dispatchEvent(new MessageEvent('message', { data: data, origin: origin || 'https://puter.com' }));
  };
})();
true;
`;

const POPUP_PATCH_JS = `
(function () {
  var opener = {
    closed: false,
    postMessage: function (data) {
      window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'opener-message', data: data }));
    }
  };
  try { Object.defineProperty(window, 'opener', { value: opener, configurable: true }); }
  catch (e) { try { window.opener = opener; } catch (e2) {} }
  window.close = function () {
    window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'popup-close' }));
  };
})();
true;
`;

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
  const mainWebViewRef = useRef(null);
  const [popupUrl, setPopupUrl] = useState(null);
  const [popupError, setPopupError] = useState('');
  const [mainError, setMainError] = useState('');

  const closePopup = () => {
    setPopupUrl(null);
    mainWebViewRef.current?.injectJavaScript('if (window.__pfStub) window.__pfStub.closed = true; true;');
  };

  const handlePopupMessage = (event) => {
    let message;
    try { message = JSON.parse(event.nativeEvent.data); } catch (e) { return; }
    if (message.type === 'opener-message') {
      // Forward the popup's result (e.g. puter token) into the main page as if it came from window.opener.
      mainWebViewRef.current?.injectJavaScript(
        `window.__pfPopupMessage(${JSON.stringify(message.data)}, 'https://puter.com'); true;`
      );
    } else if (message.type === 'popup-close') {
      setTimeout(closePopup, 300);
    }
  };

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
    console.log('[PUTER DEBUG] BRIDGE MESSAGE:', event.nativeEvent.data);
    let message;
    try {
      message = JSON.parse(event.nativeEvent.data);
    } catch (error) {
      console.log('[PUTER DEBUG] INVALID MESSAGE:', error.message);
      return;
    }
    if (message.type === 'popup-open') {
      setPopupUrl(message.url);
      return;
    }
    if (message.type === 'popup-close') {
      closePopup();
      return;
    }
    if (message.type !== 'success' && message.type !== 'error') return;
    const resolver = bridgeResolver.current;
    if (!resolver) {
      console.log('[PUTER DEBUG] NO ACTIVE RESOLVER');
      return;
    }
    bridgeResolver.current = null;
    setPuterBridge(null);
    setPopupUrl(null);
    if (message.type === 'success') {
      console.log('[PUTER DEBUG] BRIDGE SUCCESS');
      resolver.resolve(message.data || {});
    } else {
      console.log('[PUTER DEBUG] BRIDGE FAILURE:', message.message);
      resolver.reject(new Error(message.message || 'Puter request failed.'));
    }
  };

  const closePuterBridge = () => {
    const resolver = bridgeResolver.current;
    bridgeResolver.current = null;
    setPuterBridge(null);
    setPopupUrl(null);
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
          <Text style={bridgeStyles.debug} numberOfLines={2}>{puterBridge ? puterBridge.split('?')[0] : ''}</Text>
          {mainError ? <Text style={bridgeStyles.error}>{mainError}</Text> : null}
          {puterBridge ? <WebView ref={mainWebViewRef} source={{ uri: puterBridge }}
            style={{ flex: 1, backgroundColor: '#0f0f12' }}
            setSupportMultipleWindows={false}
            javaScriptCanOpenWindowsAutomatically={true}
            injectedJavaScriptBeforeContentLoaded={MAIN_PATCH_JS}
            onMessage={handlePuterBridgeMessage} javaScriptEnabled domStorageEnabled sharedCookiesEnabled thirdPartyCookiesEnabled startInLoadingState renderLoading={() => <View style={bridgeStyles.loading}><ActivityIndicator color={COLORS.primary} /><Text style={bridgeStyles.loadingText}>Connecting securely to Puter…</Text></View>} onOpenWindow={({ nativeEvent }) => {
            console.log('[PUTER] POPUP REQUESTED:', nativeEvent.targetUrl);
          }}
          onLoadStart={({ nativeEvent }) => { setMainError(''); console.log('[PUTER] LOAD START:', nativeEvent.url); }}
          onLoadEnd={({ nativeEvent }) => console.log('[PUTER] LOAD END:', nativeEvent.url)}
          onLoadProgress={({ nativeEvent }) => console.log('[PUTER] LOAD PROGRESS:', nativeEvent.progress)}
          onHttpError={({ nativeEvent }) => { console.log('[PUTER] HTTP ERROR:', nativeEvent.statusCode, nativeEvent.url); setMainError('HTTP ' + nativeEvent.statusCode + ' - ' + nativeEvent.url); }}
          onError={({ nativeEvent }) => {
            console.log('[PUTER] WEBVIEW ERROR:', nativeEvent.description, nativeEvent.url);
            const r = bridgeResolver.current;
            bridgeResolver.current = null;
            setPuterBridge(null);
            if (r) r.reject(new Error('Could not load the secure Puter bridge: ' + nativeEvent.description));
          }}
          onRenderProcessGone={({ nativeEvent }) => console.log('[PUTER] RENDER PROCESS GONE:', nativeEvent)} /> : null}
          {popupUrl ? (
            <View style={bridgeStyles.popup}>
              <View style={bridgeStyles.header}>
                <Text style={bridgeStyles.title}>Puter Sign-in</Text>
                <TouchableOpacity onPress={closePopup}><Text style={bridgeStyles.close}>Cancel</Text></TouchableOpacity>
              </View>
              <Text style={bridgeStyles.debug} numberOfLines={2}>{popupUrl}</Text>
              {popupError ? <Text style={bridgeStyles.error}>{popupError}</Text> : null}
              <WebView
                style={{ flex: 1, backgroundColor: '#ffffff' }}
                source={{ uri: popupUrl }}
                userAgent={POPUP_USER_AGENT}
                injectedJavaScriptBeforeContentLoaded={POPUP_PATCH_JS}
                onMessage={handlePopupMessage}
                javaScriptEnabled domStorageEnabled sharedCookiesEnabled thirdPartyCookiesEnabled
                setSupportMultipleWindows={false}
                javaScriptCanOpenWindowsAutomatically={true}
                mixedContentMode="always"
                originWhitelist={['*']}
                startInLoadingState
                renderLoading={() => <View style={bridgeStyles.loading}><ActivityIndicator color={COLORS.primary} /></View>}
                onLoadStart={({ nativeEvent }) => { setPopupError(''); console.log('[PUTER] POPUP LOAD START:', nativeEvent.url); }}
                onLoadEnd={({ nativeEvent }) => console.log('[PUTER] POPUP LOAD END:', nativeEvent.url)}
                onHttpError={({ nativeEvent }) => { console.log('[PUTER] POPUP HTTP ERROR:', nativeEvent.statusCode, nativeEvent.url); setPopupError('HTTP ' + nativeEvent.statusCode); }}
                onError={({ nativeEvent }) => { console.log('[PUTER] POPUP ERROR:', nativeEvent.description); setPopupError(nativeEvent.description || 'Load error'); }}
              />
            </View>
          ) : null}
        </View>
      </Modal>
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);

const bridgeStyles = StyleSheet.create({ debug: { color: '#71717a', fontSize: 10, paddingHorizontal: 12, paddingVertical: 4 }, error: { color: '#fca5a5', fontSize: 12, paddingHorizontal: 12, paddingBottom: 4 }, popup: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: '#0f0f12' }, container: { flex: 1, backgroundColor: '#0f0f12' }, header: { height: 56, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#1a1a1f', borderBottomWidth: 1, borderBottomColor: '#2a2a32' }, title: { color: '#fff', fontWeight: '700' }, close: { color: '#c4b5fd', fontWeight: '600' }, loading: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#0f0f12' }, loadingText: { color: '#9ca3af', marginTop: 12 } });
