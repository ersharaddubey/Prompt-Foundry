import React, { useState, useEffect, useCallback, memo } from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  ActivityIndicator,
  Dimensions,
  RefreshControl,
  FlatList,
  ScrollView,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import api from '../api/client';
import { COLORS } from '../constants/config';
import { useAuth } from '../context/AuthContext';

const { width } = Dimensions.get('window');
const GAP = 10;
const PAD = 16;
const CARD_W = (width - PAD * 2 - GAP) / 2;

const PromptCard = memo(function PromptCard({ item, onPress }) {
  if (!item || !item._id) return null;
  return (
    <TouchableOpacity style={styles.card} activeOpacity={0.85} onPress={onPress}>
      <Image source={{ uri: item.imageUrl }} style={styles.cardImg} resizeMode="cover" />
      <View style={styles.cardInfo}>
        <Text style={styles.cardTitle} numberOfLines={2}>
          {item.title || 'Untitled'}
        </Text>
        <Text style={styles.cardMeta}>
          {item.likes || 0} likes · {item.uses || 0} uses
        </Text>
      </View>
    </TouchableOpacity>
  );
});

export default function HomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();

  const [prompts, setPrompts] = useState([]);
  const [categories, setCategories] = useState(['All']);
  const [category, setCategory] = useState('All');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const bottomPad = 70 + Math.max(insets.bottom, Platform.OS === 'android' ? 12 : 0);

  const fetchCategories = async () => {
    try {
      const { data } = await api.get('/categories');
      const names = (Array.isArray(data) ? data : [])
        .map((c) => (c && c.name ? String(c.name) : null))
        .filter(Boolean);
      setCategories(['All', ...Array.from(new Set(names))]);
    } catch (_) {}
  };

  const fetchPrompts = useCallback(
    async (p = 1, reset = false) => {
      try {
        if (reset) {
          setLoading(true);
          setError('');
        } else {
          setLoadingMore(true);
        }
        const { data } = await api.get('/prompts', {
          params: {
            category: category === 'All' ? undefined : category,
            search: search.trim() || undefined,
            page: p,
            limit: 20,
          },
        });
        const list = data && Array.isArray(data.prompts) ? data.prompts : [];
        if (reset || p === 1) {
          setPrompts(list);
        } else {
          setPrompts((prev) => {
            const seen = new Set(prev.map((x) => String(x._id)));
            return prev.concat(
              list.filter((x) => x && x._id && !seen.has(String(x._id)))
            );
          });
        }
        setHasMore(p < (data.pages || 1));
        setPage(p);
      } catch (e) {
        setError(e.message || 'Failed to load');
      } finally {
        setLoading(false);
        setLoadingMore(false);
        setRefreshing(false);
      }
    },
    [category, search]
  );

  useEffect(() => {
    fetchCategories();
  }, []);

  useEffect(() => {
    fetchPrompts(1, true);
  }, [category]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchPrompts(1, true);
  }, [fetchPrompts]);

  const onSearch = () => fetchPrompts(1, true);

  const loadMore = useCallback(() => {
    if (!loadingMore && hasMore && !loading) {
      fetchPrompts(page + 1, false);
    }
  }, [loadingMore, hasMore, loading, page, fetchPrompts]);

  const renderCard = useCallback(
    ({ item }) => (
      <PromptCard
        item={item}
        onPress={() => {
          if (item?._id) router.push('/detail/' + item._id);
        }}
      />
    ),
    [router]
  );

  const keyExtractor = useCallback(
    (item, index) => (item && item._id ? String(item._id) : 'idx-' + index),
    []
  );

  const ListHeader = (
    <View>
      <View style={styles.header}>
        <Text style={styles.logo}>Prompt Foundry</Text>
        {user ? (
          <TouchableOpacity
            style={styles.avatar}
            onPress={() => router.push('/profile')}
          >
            <Text style={styles.avatarText}>
              {(user.name || 'U').charAt(0).toUpperCase()}
            </Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={styles.loginBtn}
            onPress={() => router.push('/login')}
          >
            <Text style={styles.loginBtnText}>Login</Text>
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.searchBox}>
        <Ionicons name="search" size={18} color={COLORS.muted} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search prompts..."
          placeholderTextColor={COLORS.muted}
          value={search}
          onChangeText={setSearch}
          onSubmitEditing={onSearch}
          returnKeyType="search"
        />
        {search.length > 0 && (
          <TouchableOpacity
            onPress={() => {
              setSearch('');
              setTimeout(() => fetchPrompts(1, true), 50);
            }}
          >
            <Ionicons name="close-circle" size={18} color={COLORS.muted} />
          </TouchableOpacity>
        )}
      </View>

      {/* Categories — ScrollView (not FlatList) to avoid nested VirtualizedList warning */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.catList}
        contentContainerStyle={styles.catContent}
        keyboardShouldPersistTaps="handled"
      >
        {categories.map((item, idx) => (
          <TouchableOpacity
            key={'cat-' + idx + '-' + item}
            onPress={() => setCategory(item)}
            style={[styles.catChip, category === item && styles.catChipActive]}
            activeOpacity={0.7}
          >
            <Text
              style={[styles.catText, category === item && styles.catTextActive]}
              numberOfLines={1}
            >
              {item}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <FlatList
        data={prompts}
        keyExtractor={keyExtractor}
        numColumns={2}
        columnWrapperStyle={styles.row}
        contentContainerStyle={[styles.grid, { paddingBottom: bottomPad }]}
        ListHeaderComponent={ListHeader}
        renderItem={renderCard}
        onEndReached={loadMore}
        onEndReachedThreshold={0.5}
        removeClippedSubviews={Platform.OS === 'android'}
        maxToRenderPerBatch={8}
        windowSize={7}
        initialNumToRender={6}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={COLORS.primary}
            colors={[COLORS.primary]}
          />
        }
        ListEmptyComponent={
          loading ? (
            <ActivityIndicator
              color={COLORS.primary}
              style={{ marginTop: 40 }}
              size="large"
            />
          ) : (
            <View style={styles.emptyWrap}>
              <Text style={styles.empty}>{error || 'No prompts found'}</Text>
              <TouchableOpacity style={styles.retryBtn} onPress={onRefresh}>
                <Text style={styles.retryText}>Retry</Text>
              </TouchableOpacity>
            </View>
          )
        }
        ListFooterComponent={
          loadingMore ? (
            <ActivityIndicator
              color={COLORS.primary}
              style={{ marginVertical: 16 }}
            />
          ) : null
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: PAD,
    paddingVertical: 12,
  },
  logo: {
    fontSize: 22,
    fontWeight: '800',
    color: COLORS.text,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 15,
  },
  loginBtn: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
  },
  loginBtnText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 13,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: PAD,
    marginBottom: 12,
    backgroundColor: COLORS.card,
    borderRadius: 24,
    paddingHorizontal: 14,
    height: 44,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    color: COLORS.text,
    fontSize: 14,
    paddingVertical: 0,
  },
  catList: {
    marginBottom: 12,
    flexGrow: 0,
  },
  catContent: {
    paddingHorizontal: PAD,
    alignItems: 'center',
  },
  catChip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 22,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginRight: 8,
    minHeight: 40,
    justifyContent: 'center',
  },
  catChipActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  catText: {
    color: '#D1D5DB',
    fontSize: 14,
    fontWeight: '500',
    lineHeight: 20,
  },
  catTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  grid: {
    paddingHorizontal: PAD,
  },
  row: {
    justifyContent: 'space-between',
  },
  card: {
    width: CARD_W,
    backgroundColor: COLORS.card,
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: GAP,
  },
  cardImg: {
    width: '100%',
    height: CARD_W * 1.3,
    backgroundColor: '#222',
  },
  cardInfo: {
    padding: 8,
  },
  cardTitle: {
    color: COLORS.text,
    fontSize: 12,
    fontWeight: '600',
  },
  cardMeta: {
    color: COLORS.muted,
    fontSize: 10,
    marginTop: 2,
  },
  emptyWrap: {
    alignItems: 'center',
    padding: 24,
    marginTop: 40,
  },
  empty: {
    textAlign: 'center',
    color: COLORS.muted,
    lineHeight: 22,
    marginBottom: 16,
  },
  retryBtn: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
  },
  retryText: {
    color: '#fff',
    fontWeight: '600',
  },
});
