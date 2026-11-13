import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { Modal, View, Text, TouchableOpacity, ActivityIndicator, StyleSheet } from 'react-native';
import { WebView } from 'react-native-webview';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import { PUTER_BRIDGE_URL, PUTER_WORKER_URL, COLORS } from '../constants/config';
import * as SecureStore from 'expo-secure-store';
import api from '../api/client';
import { registerForPushNotificationsAsync } from '../utils/push';

WebBrowser.maybeCompleteAuthSession();

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
  function log(t) {
    try { window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'popup-log', text: String(t).slice(0, 3000) })); } catch (e) {}
  }
  window.addEventListener('error', function (e) { log('ERR ' + e.message + ' @' + (e.filename || '').split('/').pop() + ':' + e.lineno); });
  window.addEventListener('unhandledrejection', function (e) { log('REJ ' + (e.reason && (e.reason.message || e.reason))); });
  ['error', 'warn'].forEach(function (k) {
    var o = console[k];
    console[k] = function () { log(k + ' ' + Array.prototype.slice.call(arguments).join(' ')); if (o) o.apply(console, arguments); };
  });
  setTimeout(function () {
    var b = document.body;
    var r = b ? b.getBoundingClientRect() : { width: -1, height: -1 };
    log('t+3s body=' + (b ? b.innerHTML.length : -1) + ' vw=' + window.innerWidth + ' vh=' + window.innerHeight + ' bodyRect=' + Math.round(r.width) + 'x' + Math.round(r.height) + ' iframes=' + document.querySelectorAll('iframe').length + ' bg=' + (b ? getComputedStyle(b).backgroundColor : ''));
  }, 3000);
  window.addEventListener('error', function (e) {
    var t = e.target;
    if (t && t !== window && (t.src || t.href)) log('RESOURCE FAIL ' + (t.src || t.href));
  }, true);
  setTimeout(function () {
    var res = [];
    try {
      performance.getEntriesByType('resource').forEach(function (r) {
        if (/gui-cdn|js\.puter|turnstile|challenges/.test(r.name)) {
          res.push(r.name.split('/').slice(2).join('/').slice(0, 40) + ' dur=' + Math.round(r.duration) + ' size=' + r.transferSize + ' st=' + (r.responseStatus || '?'));
        }
      });
    } catch (e) { res.push('perf err ' + e.message); }
    log('DIAG6s readyState=' + document.readyState + ' typeof gui=' + typeof window.gui + ' typeof puter=' + typeof window.puter + ' bodyChildren=' + (document.body ? document.body.children.length : -1) + ' RES: ' + res.join(' | '));
  }, 6000);
  try {
    var _f = window.fetch;
    window.fetch = function (u, o) {
      var name = String(u && u.url ? u.url : u).replace('https://', '').slice(0, 60);
      return _f.apply(this, arguments).then(function (r) { log('FETCH ' + r.status + ' ' + name); return r; },
        function (e) { log('FETCH FAIL ' + name + ' ' + (e && e.message)); throw e; });
    };
    var _o = XMLHttpRequest.prototype.open;
    XMLHttpRequest.prototype.open = function (m, u) {
      var name = String(u).replace('https://', '').slice(0, 60);
      this.addEventListener('loadend', function () { log('XHR ' + this.status + ' ' + name); });
      return _o.apply(this, arguments);
    };
  } catch (e) { log('wrap err ' + e.message); }
  try { localStorage.setItem('__t', '1'); localStorage.removeItem('__t'); log('localStorage OK'); } catch (e) { log('localStorage FAIL ' + e.message); }
  log('opener=' + typeof window.opener + ' parentIsSelf=' + (window.parent === window) + ' cookies=' + navigator.cookieEnabled + ' sw=' + ('serviceWorker' in navigator));
  var opener = {
    closed: false,
    postMessage: function (data) {
      window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'opener-message', data: data }));
    }
  };
  log('opener before=' + typeof window.opener + ' val=' + String(window.opener));
  setTimeout(function () {
    try { Object.defineProperty(window, 'opener', { value: opener, configurable: true }); log('opener defined late'); }
    catch (e) { try { window.opener = opener; } catch (e2) {} }
  }, 2500);
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
  const [popupLog, setPopupLog] = useState('');

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
    } else if (message.type === 'popup-log') {
      console.log('[PUTER POPUP]', message.text);
      setPopupLog((prev) => (prev + '\n' + message.text).slice(-900));
    }
  };

  // Real browser (Chrome Custom Tab) flow: Puter's sign-in popup needs a real window.opener,
  // which an embedded WebView cannot provide. The bridge page redirects back to the app with the result.
  const openPuterBridge = async (mode, extra = {}) => {
    if (!PUTER_WORKER_URL || !/^https:\/\//i.test(PUTER_WORKER_URL)) {
      throw new Error('Puter Worker URL is not configured. Set EXPO_PUBLIC_PUTER_WORKER_URL and rebuild the app.');
    }
    const redirect = Linking.createURL('puter-auth');
    const query = new URLSearchParams({ mode, worker: PUTER_WORKER_URL, redirect, ...extra });
    console.log('[PUTER] REDIRECT URL:', redirect);
    const result = await WebBrowser.openAuthSessionAsync(`${PUTER_BRIDGE_URL}?${query.toString()}`, redirect);
    console.log('[PUTER] AUTH SESSION RESULT:', result.type, result.url || '');
    if (result.type !== 'success' || !result.url) {
      throw new Error('Puter authorization was cancelled or did not return to the app. Please try again.');
    }
    return Linking.parse(result.url).queryParams || {};
  };

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
              {popupLog ? <Text style={bridgeStyles.log} numberOfLines={9}>{popupLog}</Text> : null}
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
                onLoadStart={({ nativeEvent }) => { setPopupError(''); setPopupLog(''); console.log('[PUTER] POPUP LOAD START:', nativeEvent.url); }}
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

const bridgeStyles = StyleSheet.create({ log: { color: '#fcd34d', fontSize: 10, paddingHorizontal: 12, paddingBottom: 4 }, debug: { color: '#71717a', fontSize: 10, paddingHorizontal: 12, paddingVertical: 4 }, error: { color: '#fca5a5', fontSize: 12, paddingHorizontal: 12, paddingBottom: 4 }, popup: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: '#0f0f12' }, container: { flex: 1, backgroundColor: '#0f0f12' }, header: { height: 56, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#1a1a1f', borderBottomWidth: 1, borderBottomColor: '#2a2a32' }, title: { color: '#fff', fontWeight: '700' }, close: { color: '#c4b5fd', fontWeight: '600' }, loading: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#0f0f12' }, loadingText: { color: '#9ca3af', marginTop: 12 } });
