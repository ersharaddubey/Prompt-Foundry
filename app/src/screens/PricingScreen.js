import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Linking } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { COLORS } from '../constants/config';

export default function PricingScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={22} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.topTitle}>AI Billing</Text>
        <View style={{ width: 22 }} />
      </View>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.iconWrap}><Ionicons name="wallet-outline" size={34} color={COLORS.primary} /></View>
        <Text style={styles.heading}>Pay directly through Puter</Text>
        <Text style={styles.sub}>Prompt Foundry does not sell image-generation credits. When you generate an image, Puter uses the allowance on your own account and handles any top-up or overage payment directly.</Text>
        <View style={styles.infoCard}>
          <Text style={styles.cardTitle}>How billing works</Text>
          <View style={styles.point}><Ionicons name="checkmark-circle" size={19} color={COLORS.success} /><Text style={styles.pointText}>Your Puter account is used for AI generation.</Text></View>
          <View style={styles.point}><Ionicons name="checkmark-circle" size={19} color={COLORS.success} /><Text style={styles.pointText}>Your own Puter allowance is used first.</Text></View>
          <View style={styles.point}><Ionicons name="checkmark-circle" size={19} color={COLORS.success} /><Text style={styles.pointText}>If needed, Puter handles billing and top-ups directly.</Text></View>
          <View style={styles.point}><Ionicons name="checkmark-circle" size={19} color={COLORS.success} /><Text style={styles.pointText}>Generated images are saved in your Puter storage.</Text></View>
        </View>
        <TouchableOpacity style={styles.primaryBtn} onPress={() => router.replace('/(tabs)/generate')}>
          <Text style={styles.primaryText}>Create an image</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.linkBtn} onPress={() => Linking.openURL('https://puter.com')}>
          <Text style={styles.linkText}>Manage your Puter account</Text>
          <Ionicons name="open-outline" size={16} color={COLORS.primary} />
        </TouchableOpacity>
        <Text style={styles.foot}>Puter’s own pricing, usage limits and payment rules apply. Prompt Foundry does not receive or control Puter payments.</Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12 },
  topTitle: { color: COLORS.text, fontSize: 17, fontWeight: '600' },
  content: { padding: 22, paddingBottom: 60 },
  iconWrap: { width: 68, height: 68, borderRadius: 20, backgroundColor: COLORS.card, alignItems: 'center', justifyContent: 'center', marginBottom: 20 },
  heading: { color: COLORS.text, fontSize: 25, fontWeight: '800', marginBottom: 10 },
  sub: { color: COLORS.muted, fontSize: 14, lineHeight: 22, marginBottom: 22 },
  infoCard: { backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.border, borderRadius: 16, padding: 16 },
  cardTitle: { color: COLORS.text, fontSize: 16, fontWeight: '700', marginBottom: 14 },
  point: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 13 },
  pointText: { flex: 1, color: COLORS.muted, fontSize: 13, lineHeight: 20 },
  primaryBtn: { backgroundColor: COLORS.primary, borderRadius: 13, padding: 16, alignItems: 'center', marginTop: 22 },
  primaryText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  linkBtn: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 7, marginTop: 18 },
  linkText: { color: COLORS.primary, fontSize: 14, fontWeight: '600' },
  foot: { color: COLORS.muted, fontSize: 11, lineHeight: 17, textAlign: 'center', marginTop: 26 },
});
