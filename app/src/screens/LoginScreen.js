import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { COLORS } from '../constants/config';

export default function LoginScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { puterLogin } = useAuth();
  const [loading, setLoading] = useState(false);

  const handlePuterLogin = async () => {
    setLoading(true);
    try {
      await puterLogin();
      router.replace('/(tabs)');
    } catch (err) {
      Alert.alert('Sign-in failed', err.response?.data?.message || err.message || 'Could not sign in with Puter.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top + 20 }]}>
      <TouchableOpacity onPress={() => router.back()} style={styles.back}>
        <Text style={styles.backText}>← Back</Text>
      </TouchableOpacity>
      <View style={styles.logo}><Text style={styles.logoText}>PF</Text></View>
      <Text style={styles.title}>Welcome to Prompt Foundry</Text>
      <Text style={styles.sub}>Use one Puter account to sign in and create AI images. No separate Prompt Foundry password is required.</Text>
      <TouchableOpacity style={[styles.btn, loading && { opacity: 0.65 }]} onPress={handlePuterLogin} disabled={loading}>
        {loading ? <ActivityIndicator color="#fff" /> : <Ionicons name="log-in-outline" size={21} color="#fff" />}
        <Text style={styles.btnText}>{loading ? 'Connecting securely…' : 'Continue with Puter'}</Text>
      </TouchableOpacity>
      <Text style={styles.foot}>Puter may ask you to authorize Prompt Foundry once. Your AI usage and generated-image storage belong to your Puter account.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg, paddingHorizontal: 24 },
  back: { marginBottom: 34 }, backText: { color: COLORS.muted, fontSize: 15 },
  logo: { width: 68, height: 68, borderRadius: 20, backgroundColor: COLORS.primary, alignItems: 'center', justifyContent: 'center', marginBottom: 24 },
  logoText: { color: '#fff', fontSize: 27, fontWeight: '800' },
  title: { color: COLORS.text, fontSize: 27, fontWeight: '800', marginBottom: 10 },
  sub: { color: COLORS.muted, fontSize: 15, lineHeight: 23, marginBottom: 28 },
  btn: { backgroundColor: COLORS.primary, borderRadius: 14, paddingVertical: 16, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 10 },
  btnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  foot: { color: COLORS.muted, fontSize: 12, lineHeight: 19, textAlign: 'center', marginTop: 24 },
});
