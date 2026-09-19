import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';
import { COLORS } from '../constants/config';

const PLANS = [
  { id: 'starter', name: 'Starter', price: 999, credits: 4000, color: '#6b7280' },
  { id: 'plus', name: 'Plus', price: 2499, credits: 12000, color: '#06b6d4' },
  { id: 'pro', name: 'Pro', price: 3999, credits: 24000, color: '#c026d3', popular: true },
  { id: 'wonder', name: 'Wonder', price: 14999, credits: 106000, color: '#eab308', best: true },
];

export default function PricingScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user, updateUser } = useAuth();
  const [code, setCode] = useState('');
  const [msg, setMsg] = useState('');
  const [loading, setLoading] = useState(false);
  const [paying, setPaying] = useState(false);

  const redeem = async () => {
    if (!user) {
      router.push('/login');
      return;
    }
    if (!code.trim()) return;
    setLoading(true);
    setMsg('');
    try {
      const { data } = await api.post('/promo/redeem', { code: code.trim() });
      await updateUser({
        credits: data.credits,
        dailyCredits: data.dailyCredits,
      });
      setMsg(data.message || 'Promo applied');
      setCode('');
    } catch (err) {
      setMsg(err.response?.data?.message || 'Invalid code');
    } finally {
      setLoading(false);
    }
  };

  const selectPlan = async (plan) => {
    if (!user) {
      router.push('/login');
      return;
    }

    setPaying(true);
    try {
      const { data } = await api.post('/payment/create-order', {
        planId: plan.id,
      });

      if (!data.linkUrl) {
        throw new Error(data.message || 'No payment link URL');
      }

      // Official Cashfree payment link (opens real checkout page)
      await WebBrowser.openBrowserAsync(data.linkUrl);

      Alert.alert(
        'Payment status',
        'Agar payment successful ho gaya to Verify dabao. Credits add ho jayenge.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Verify & Add Credits',
            onPress: async () => {
              try {
                const v = await api.post('/payment/verify', {
                  orderId: data.orderId,
                });
                await updateUser({ credits: v.data.credits });
                Alert.alert('Success', v.data.message || 'Credits added');
              } catch (e) {
                Alert.alert(
                  'Not confirmed',
                  e.response?.data?.message ||
                    'Payment abhi confirm nahi hua. Thodi der baad Verify try karo.'
                );
              }
            },
          },
        ]
      );
    } catch (e) {
      // console.log removed for production
      Alert.alert(
        'Payment error',
        e.response?.data?.message || e.message || 'Order create failed'
      );
    } finally {
      setPaying(false);
    }
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={22} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.topTitle}>Pricing</Text>
        <View style={{ width: 22 }} />
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 100 }}>
        <Text style={styles.heading}>Choose your plan</Text>
        <Text style={styles.sub}>Cashfree se secure payment · Credits instantly</Text>

        <View style={styles.promoBox}>
          <Text style={styles.promoLabel}>Have a promo code?</Text>
          <View style={styles.promoRow}>
            <TextInput
              style={styles.promoInput}
              placeholder="ENTER CODE"
              placeholderTextColor={COLORS.muted}
              autoCapitalize="characters"
              value={code}
              onChangeText={setCode}
            />
            <TouchableOpacity
              style={styles.promoBtn}
              onPress={redeem}
              disabled={loading}
            >
              <Text style={styles.promoBtnText}>
                {loading ? '...' : 'Apply'}
              </Text>
            </TouchableOpacity>
          </View>
          {!!msg && (
            <Text
              style={{
                marginTop: 8,
                color: String(msg).toLowerCase().includes('success') ||
                String(msg).toLowerCase().includes('applied')
                  ? COLORS.success
                  : COLORS.danger,
                fontSize: 13,
              }}
            >
              {msg}
            </Text>
          )}
          {user && (
            <Text style={styles.balance}>
              Balance:{' '}
              <Text style={{ color: COLORS.text }}>{user.credits || 0}</Text>{' '}
              credits
            </Text>
          )}
        </View>

        {paying && (
          <View style={styles.payingBox}>
            <ActivityIndicator color={COLORS.primary} />
            <Text style={styles.payingText}>Opening Cashfree...</Text>
          </View>
        )}

        {PLANS.map((plan) => (
          <TouchableOpacity
            key={plan.id}
            style={[styles.plan, { borderColor: plan.color + '66' }]}
            onPress={() => selectPlan(plan)}
            disabled={paying}
          >
            {plan.popular && (
              <View style={[styles.tag, { backgroundColor: plan.color + '33' }]}>
                <Text style={[styles.tagText, { color: plan.color }]}>
                  POPULAR
                </Text>
              </View>
            )}
            {plan.best && (
              <View style={[styles.tag, { backgroundColor: plan.color + '33' }]}>
                <Text style={[styles.tagText, { color: plan.color }]}>
                  BEST VALUE
                </Text>
              </View>
            )}
            <Text style={styles.planName}>{plan.name}</Text>
            <Text style={styles.planPrice}>
              ₹{plan.price}
              <Text style={styles.planMo}> one-time</Text>
            </Text>
            <Text style={styles.planCredits}>
              {plan.credits.toLocaleString()} credits
            </Text>
            <View style={[styles.planBtn, { backgroundColor: plan.color }]}>
              <Text
                style={[
                  styles.planBtnText,
                  plan.best && { color: '#000' },
                ]}
              >
                Pay with Cashfree
              </Text>
            </View>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  topTitle: { color: COLORS.text, fontSize: 17, fontWeight: '600' },
  heading: {
    color: COLORS.text,
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 6,
  },
  sub: { color: COLORS.muted, marginBottom: 20 },
  promoBox: {
    backgroundColor: COLORS.card,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 20,
  },
  promoLabel: { color: COLORS.muted, fontSize: 13, marginBottom: 10 },
  promoRow: { flexDirection: 'row' },
  promoInput: {
    flex: 1,
    backgroundColor: COLORS.bg,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: COLORS.text,
    borderWidth: 1,
    borderColor: COLORS.border,
    letterSpacing: 1,
    marginRight: 8,
  },
  promoBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: 12,
    paddingHorizontal: 18,
    justifyContent: 'center',
  },
  promoBtnText: { color: '#fff', fontWeight: '700' },
  balance: { color: COLORS.muted, fontSize: 12, marginTop: 10 },
  payingBox: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    gap: 10,
  },
  payingText: { color: COLORS.muted, marginLeft: 10 },
  plan: {
    backgroundColor: COLORS.card,
    borderRadius: 16,
    padding: 18,
    borderWidth: 1.5,
    marginBottom: 14,
  },
  tag: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 8,
    marginBottom: 10,
  },
  tagText: { fontSize: 10, fontWeight: '800', letterSpacing: 0.5 },
  planName: { color: COLORS.text, fontSize: 18, fontWeight: '700' },
  planPrice: {
    color: COLORS.text,
    fontSize: 28,
    fontWeight: '800',
    marginTop: 6,
  },
  planMo: { fontSize: 14, fontWeight: '400', color: COLORS.muted },
  planCredits: {
    color: COLORS.primary,
    fontWeight: '600',
    marginTop: 6,
    marginBottom: 14,
  },
  planBtn: {
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  planBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
});
