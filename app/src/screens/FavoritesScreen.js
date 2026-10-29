import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  Alert,
  TouchableOpacity,
  Image,
  RefreshControl,
  Dimensions,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';
import { COLORS } from '../constants/config';

const { width } = Dimensions.get('window');
const CARD_W = (width - 42) / 2;

export default function FavoritesScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [prompts, setPrompts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!user) {
      setLoading(false);
      setPrompts([]);
      return;
    }
    try {
      const { data } = await api.get('/user/favorites');
      setPrompts(Array.isArray(data) ? data : []);
    } catch (e) {
      setPrompts([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      load();
    }, [load])
  );

  const clearAll = () => {
    Alert.alert('Delete all favorites?', 'Saare favorites hat jayenge.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete All',
        style: 'destructive',
        onPress: async () => {
          try {
            await api.delete('/user/favorites');
            setPrompts([]);
          } catch (e) {
            Alert.alert('Error', e?.response?.data?.message || 'Delete all failed');
          }
        },
      },
    ]);
  };

  const bottomPad = 70 + Math.max(insets.bottom, 10);

  if (!user) {
    return (
      <View style={[styles.container, { paddingTop: insets.top + 40, alignItems: 'center' }]}>
        <Ionicons name="heart-outline" size={56} color={COLORS.muted} />
        <Text style={styles.emptyTitle}>Login to see favorites</Text>
        <TouchableOpacity style={styles.btn} onPress={() => router.push('/login')}>
          <Text style={styles.btnText}>Log In</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.headerRow}>
        <Text style={styles.header}>Favorites</Text>
        {prompts.length > 0 && (
          <TouchableOpacity onPress={clearAll} style={styles.deleteAll}>
            <Ionicons name="trash-outline" size={16} color="#f87171" />
            <Text style={styles.deleteAllText}>Delete All</Text>
          </TouchableOpacity>
        )}
      </View>
      {loading ? (
        <ActivityIndicator color={COLORS.primary} style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={prompts}
          keyExtractor={(item) => String(item._id)}
          numColumns={2}
          columnWrapperStyle={{ justifyContent: 'space-between', paddingHorizontal: 16 }}
          contentContainerStyle={{ paddingBottom: bottomPad }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                load();
              }}
              tintColor={COLORS.primary}
            />
          }
          ListEmptyComponent={
            <View style={{ alignItems: 'center', marginTop: 48 }}>
              <Ionicons name="heart-dislike-outline" size={48} color={COLORS.muted} />
              <Text style={styles.empty}>No favorites yet</Text>
            </View>
          }
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.card}
              onPress={() => router.push('/detail/' + item._id)}
              activeOpacity={0.85}
            >
              <Image source={{ uri: item.imageUrl }} style={styles.img} />
              <Text style={styles.cardTitle} numberOfLines={2}>
                {item.title}
              </Text>
            </TouchableOpacity>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  header: {
    fontSize: 22,
    fontWeight: '800',
    color: COLORS.text,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingRight: 16 },
  deleteAll: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10, backgroundColor: 'rgba(248,113,113,0.12)' },
  deleteAllText: { color: '#f87171', fontSize: 12, fontWeight: '700' },
  card: {
    width: CARD_W,
    backgroundColor: COLORS.card,
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 12,
  },
  img: { width: '100%', height: CARD_W * 1.25, backgroundColor: COLORS.card },
  cardTitle: {
    color: COLORS.text,
    fontSize: 12,
    fontWeight: '600',
    padding: 8,
  },
  empty: { color: COLORS.muted, marginTop: 12 },
  emptyTitle: { color: COLORS.text, fontSize: 16, marginTop: 16, marginBottom: 16 },
  btn: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
  },
  btnText: { color: '#fff', fontWeight: '700' },
});
