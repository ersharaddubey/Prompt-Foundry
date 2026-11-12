import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Image,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Dimensions,
  RefreshControl,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import api from '../../api/client';
import { COLORS } from '../../constants/config';

const { width } = Dimensions.get('window');
const COLS = 2;
const GAP = 10;
const CARD_W = (width - 16 * 2 - GAP) / COLS;

export default function TravelExploreScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [cities, setCities] = useState([]);
  const [selectedCity, setSelectedCity] = useState(null);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [q, setQ] = useState('');
  const [error, setError] = useState('');

  const loadCities = useCallback(async () => {
    try {
      setError('');
      setLoading(true);
      const { data } = await api.get('/travel-memories/cities');
      setCities(data.cities || []);
    } catch (e) {
      setError(e.response?.data?.message || e.message || 'Failed to load cities');
      setCities([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  const loadCityItems = useCallback(
    async (cityName, pageNum = 1, append = false) => {
      try {
        if (pageNum === 1) setLoading(true);
        setError('');
        const params = { page: pageNum, limit: 24, city: cityName };
        if (q.trim()) params.q = q.trim();
        const { data } = await api.get('/travel-memories', { params });
        const list = data.items || [];
        setItems((prev) => (append ? [...prev, ...list] : list));
        setPage(data.page || pageNum);
        setPages(data.pages || 1);
      } catch (e) {
        setError(e.response?.data?.message || e.message || 'Failed to load');
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [q]
  );

  useEffect(() => {
    loadCities();
  }, [loadCities]);

  const onRefresh = () => {
    setRefreshing(true);
    if (selectedCity) {
      loadCityItems(selectedCity.city, 1, false);
    } else {
      loadCities();
    }
  };

  const openCity = (cityRow) => {
    setSelectedCity(cityRow);
    setItems([]);
    setPage(1);
    setQ('');
    loadCityItems(cityRow.city, 1, false);
  };

  const backToCities = () => {
    setSelectedCity(null);
    setItems([]);
    setQ('');
    loadCities();
  };

  const onEnd = () => {
    if (selectedCity && page < pages && !loading) {
      loadCityItems(selectedCity.city, page + 1, true);
    }
  };

  const searchInCity = () => {
    if (selectedCity) loadCityItems(selectedCity.city, 1, false);
  };

  const filteredCities = q.trim()
    ? cities.filter(
        (c) =>
          c.city?.toLowerCase().includes(q.trim().toLowerCase()) ||
          c.country?.toLowerCase().includes(q.trim().toLowerCase())
      )
    : cities;

  const renderCity = ({ item }) => (
    <TouchableOpacity style={styles.card} activeOpacity={0.9} onPress={() => openCity(item)}>
      {item.coverImage ? (
        <Image source={{ uri: item.coverImage }} style={styles.cardImg} resizeMode="cover" />
      ) : (
        <View style={[styles.cardImg, styles.cardImgPlaceholder]}>
          <Ionicons name="image-outline" size={32} color={COLORS.muted} />
        </View>
      )}
      <View style={styles.cardBody}>
        <Text style={styles.cardTitle} numberOfLines={1}>
          {item.city}
        </Text>
        <Text style={styles.cardLoc} numberOfLines={1}>
          {item.country || '—'} · {item.count} photo{item.count === 1 ? '' : 's'}
        </Text>
      </View>
    </TouchableOpacity>
  );

  const renderLocation = ({ item }) => (
    <TouchableOpacity
      style={styles.card}
      activeOpacity={0.9}
      onPress={() => router.push(`/travel/${item._id}`)}
    >
      <Image source={{ uri: item.imageUrl }} style={styles.cardImg} resizeMode="cover" />
      <View style={styles.cardBody}>
        <Text style={styles.cardTitle} numberOfLines={1}>
          {item.locationName || item.title}
        </Text>
        <Text style={styles.cardLoc} numberOfLines={1}>
          📍 {item.locationName}
          {item.city ? `, ${item.city}` : ''}
        </Text>
        <View style={styles.cardMeta}>
          <Text style={styles.metaText}>
            @{item.creator?.username || item.creator?.name || 'creator'}
          </Text>
          <View style={styles.metaRight}>
            <Ionicons name="heart" size={12} color={COLORS.muted} />
            <Text style={styles.metaText}>{item.likeCount || 0}</Text>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top + 8 }]}>
      <View style={styles.header}>
        {selectedCity ? (
          <TouchableOpacity style={styles.backRow} onPress={backToCities}>
            <Ionicons name="chevron-back" size={22} color={COLORS.text} />
            <Text style={styles.h1} numberOfLines={1}>
              {selectedCity.city}
            </Text>
          </TouchableOpacity>
        ) : (
          <Text style={styles.h1}>Travel Memories</Text>
        )}
        <TouchableOpacity
          style={styles.uploadBtn}
          onPress={() => router.push('/travel/upload')}
        >
          <Ionicons name="cloud-upload-outline" size={20} color="#fff" />
          <Text style={styles.uploadBtnText}>Upload</Text>
        </TouchableOpacity>
      </View>

      {!selectedCity && (
        <Text style={styles.hint}>
          Select a city to see all location photos from that place.
        </Text>
      )}

      <View style={styles.searchRow}>
        <Ionicons name="search" size={18} color={COLORS.muted} />
        <TextInput
          style={styles.searchInput}
          placeholder={selectedCity ? 'Search locations…' : 'Search city…'}
          placeholderTextColor={COLORS.muted}
          value={q}
          onChangeText={setQ}
          onSubmitEditing={selectedCity ? searchInCity : undefined}
          returnKeyType="search"
        />
        {!!q && (
          <TouchableOpacity
            onPress={() => {
              setQ('');
              if (selectedCity) setTimeout(() => loadCityItems(selectedCity.city, 1, false), 0);
            }}
          >
            <Ionicons name="close-circle" size={18} color={COLORS.muted} />
          </TouchableOpacity>
        )}
      </View>

      {loading && (selectedCity ? items.length === 0 : cities.length === 0) ? (
        <ActivityIndicator color={COLORS.primary} style={{ marginTop: 40 }} />
      ) : error ? (
        <Text style={styles.error}>{error}</Text>
      ) : selectedCity ? (
        <FlatList
          data={items}
          keyExtractor={(item) => String(item._id)}
          numColumns={COLS}
          columnWrapperStyle={{ gap: GAP, paddingHorizontal: 16 }}
          contentContainerStyle={{ paddingBottom: 100, gap: GAP }}
          renderItem={renderLocation}
          onEndReached={onEnd}
          onEndReachedThreshold={0.4}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />
          }
          ListEmptyComponent={
            <Text style={styles.empty}>No photos in this city yet. Upload one!</Text>
          }
        />
      ) : (
        <FlatList
          data={filteredCities}
          keyExtractor={(item, i) => `${item.city}-${item.country}-${i}`}
          numColumns={COLS}
          columnWrapperStyle={{ gap: GAP, paddingHorizontal: 16 }}
          contentContainerStyle={{ paddingBottom: 100, gap: GAP }}
          renderItem={renderCity}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />
          }
          ListEmptyComponent={
            <View style={{ alignItems: 'center', marginTop: 40, paddingHorizontal: 24 }}>
              <Ionicons name="airplane-outline" size={48} color={COLORS.muted} />
              <Text style={styles.empty}>
                No cities yet. Upload a travel memory to get started!
              </Text>
              <TouchableOpacity
                style={[styles.uploadBtn, { marginTop: 16 }]}
                onPress={() => router.push('/travel/upload')}
              >
                <Ionicons name="cloud-upload-outline" size={20} color="#fff" />
                <Text style={styles.uploadBtnText}>Upload Travel Memory</Text>
              </TouchableOpacity>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  backRow: { flexDirection: 'row', alignItems: 'center', flex: 1, gap: 4, marginRight: 8 },
  h1: { color: COLORS.text, fontSize: 22, fontWeight: '700', flexShrink: 1 },
  hint: {
    color: COLORS.muted,
    fontSize: 13,
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  uploadBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: COLORS.primary,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
  },
  uploadBtnText: { color: '#fff', fontWeight: '600', fontSize: 13 },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    backgroundColor: COLORS.card,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: Platform.OS === 'ios' ? 10 : 6,
    gap: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 12,
  },
  searchInput: { flex: 1, color: COLORS.text, fontSize: 15 },
  card: {
    width: CARD_W,
    backgroundColor: COLORS.card,
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  cardImg: { width: '100%', height: CARD_W * 1.25, backgroundColor: '#222' },
  cardImgPlaceholder: { alignItems: 'center', justifyContent: 'center' },
  cardBody: { padding: 10 },
  cardTitle: { color: COLORS.text, fontWeight: '600', fontSize: 13 },
  cardLoc: { color: COLORS.muted, fontSize: 11, marginTop: 2 },
  cardMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 6,
  },
  metaRight: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  metaText: { color: COLORS.muted, fontSize: 11 },
  error: { color: COLORS.danger, textAlign: 'center', marginTop: 30, paddingHorizontal: 20 },
  empty: { color: COLORS.muted, textAlign: 'center', marginTop: 16, paddingHorizontal: 24 },
});
