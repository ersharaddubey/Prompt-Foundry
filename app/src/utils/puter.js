import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import { PUTER_WORKER_URL, PUTER_BRIDGE_URL } from '../constants/config';

WebBrowser.maybeCompleteAuthSession();
const REDIRECT_URI = 'somyalaya://puter-auth';

function buildBridgeUrl(mode, extra = {}) {
  if (!PUTER_WORKER_URL || !/^https:\/\//i.test(PUTER_WORKER_URL)) {
    throw new Error('Puter Worker URL is not configured. Set EXPO_PUBLIC_PUTER_WORKER_URL before building the app.');
  }
  const query = new URLSearchParams({ mode, worker: PUTER_WORKER_URL, ...extra });
  return `${PUTER_BRIDGE_URL}?${query.toString()}`;
}

async function openBridge(mode, extra) {
  const url = buildBridgeUrl(mode, extra);
  const result = await WebBrowser.openAuthSessionAsync(url, REDIRECT_URI, {
    showTitle: false,
    enableBarCollapsing: true,
    toolbarColor: '#0f0f12',
    secondaryToolbarColor: '#1a1a1f',
  });
  if (result.type !== 'success' || !result.url) {
    throw new Error('Puter authorization was cancelled or did not return to Prompt Foundry. Please try again.');
  }
  const parsed = Linking.parse(result.url);
  return parsed.queryParams || {};
}

export async function signInWithPuter() {
  const result = await openBridge('login');
  if (!result.code) throw new Error('Secure sign-in code was not returned by Puter.');
  return result.code;
}

export async function generateWithPuter(prompt, ratio, inputImageUrl = '') {
  const result = await openBridge('generate', { prompt, ratio, ...(inputImageUrl ? { inputImageUrl } : {}) });
  if (!result.imageUrl || !result.storagePath) throw new Error('Puter did not return the generated image.');
  return {
    imageUrl: String(result.imageUrl),
    storagePath: String(result.storagePath),
    model: String(result.model || 'puter-user-pays'),
  };
}
