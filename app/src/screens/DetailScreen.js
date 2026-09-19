import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Image,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Dimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { useRouter, useLocalSearchParams } from 'expo-router';
import api from '../api/client';
import { COLORS } from '../constants/config';
import { useAuth } from '../context/AuthContext';

const { width } = Dimensions.get('window');

export default function DetailScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user, updateUser } = useAuth();
  const [prompt, setPrompt] = useState(null);
  const [related, setRelated] = useState([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  const favIds = new Set(
    (user?.favorites || []).map((f) => (typeof f === 'string' ? f : f?._id)).filter(Boolean)
  );
  const isFav = prompt ? favIds.has(String(prompt._id)) : false;

  useEffect(() => {
    (async () => {
      try {
        const { data } = await api.get(`/prompts/${id}`);
        setPrompt(data);
        const rel = await api.get('/prompts', {
          params: { category: data.category, limit: 6 },
        });
        setRelated(
          (rel.data.prompts || []).filter((p) => p._id !== data._id).slice(0, 4)
        );
      } catch (e) {
        Alert.alert('Error', 'Could not load prompt');
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  const handleCopy = async () => {
    if (!prompt?.promptText) return;
    await Clipboard.setStringAsync(prompt.promptText);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const goGenerate = () => {
    router.push({
      pathname: '/(tabs)/generate',
      params: { prompt: prompt?.promptText || '' },
    });
  };

  const handleFavorite = async () => {
    if (!user) {
      router.push('/login');
      return;
    }
    try {
      const { data } = await api.post(`/user/favorites/${prompt._id}`);
      await updateUser({ favorites: data.favorites || data });
    } catch (e) {
      Alert.alert('Error', e.message || 'Failed');
    }
  };

  if (loading) {
    return (
      <View style={[styles.center, { paddingTop: insets.top }]}>
        <ActivityIndicator color={COLORS.primary} size="large" />
      </View>
    );
  }

  if (!prompt) {
    return (
      <View style={[styles.center, { paddingTop: insets.top }]}>
        <Text style={{ color: COLORS.muted }}>Not found</Text>
        <TouchableOpacity onPress={() => router.back()} style={{ marginTop: 16 }}>
          <Text style={{ color: COLORS.primary }}>Go back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const bottomPad = 24 + Math.max(insets.bottom, 8);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => router.back()} style={styles.iconBtn}>
          <Ionicons name="arrow-back" size={22} color={COLORS.text} />
        </TouchableOpacity>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <TouchableOpacity onPress={handleFavorite} style={styles.iconBtn}>
            <Ionicons
              name={isFav ? 'heart' : 'heart-outline'}
              size={20}
              color={isFav ? '#ec4899' : COLORS.text}
            />
          </TouchableOpacity>
          <TouchableOpacity onPress={handleCopy} style={styles.iconBtn}>
            <Ionicons name="copy-outline" size={20} color={COLORS.text} />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={{ paddingBottom: bottomPad }}
        showsVerticalScrollIndicator={false}
      >
        <Image
          source={{ uri: prompt.imageUrl }}
          style={styles.hero}
          resizeMode="cover"
        />

        <View style={styles.body}>
          <View style={styles.row}>
            <View style={{ flex: 1 }}>
              <Text style={styles.author}>{prompt.author?.name || 'Community'}</Text>
              <Text style={styles.username}>
                {prompt.author?.username || '@community'}
              </Text>
            </View>
            {!!prompt.category && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{prompt.category}</Text>
              </View>
            )}
          </View>

          <Text style={styles.title}>{prompt.title}</Text>

          <View style={styles.actions}>
            <TouchableOpacity style={styles.actionBtn} onPress={handleCopy}>
              <Ionicons
                name={copied ? 'checkmark-circle' : 'copy-outline'}
                size={16}
                color={copied ? COLORS.success : COLORS.text}
              />
              <Text style={styles.actionText}>
                {copied ? 'Copied!' : 'Copy Prompt'}
              </Text>
            </TouchableOpacity>
            <Text style={styles.uses}>{prompt.uses || 0} uses</Text>
          </View>

          {/* Prompt text - high contrast so always readable */}
          <View style={styles.promptBox}>
            <Text style={styles.promptLabel}>PROMPT</Text>
            <Text style={styles.promptText} selectable>
              {prompt.promptText}
            </Text>
          </View>

          <View style={styles.ctaRow}>
            <TouchableOpacity style={styles.ctaPrimary} onPress={goGenerate}>
              <Ionicons name="sparkles" size={18} color="#000" />
              <Text style={styles.ctaPrimaryText}>Use prompt → Generate</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.ctaSecondary}
              onPress={() => router.push('/(tabs)/pricing')}
            >
              <Ionicons name="card-outline" size={18} color={COLORS.text} />
              <Text style={styles.ctaSecondaryText}>Buy Credits</Text>
            </TouchableOpacity>
          </View>

          {related.length > 0 && (
            <>
              <Text style={styles.sectionTitle}>Related</Text>
              <View style={styles.relatedGrid}>
                {related.map((item) => (
                  <TouchableOpacity
                    key={item._id}
                    style={styles.relatedCard}
                    onPress={() => router.push('/detail/' + item._id)}
                  >
                    <Image
                      source={{ uri: item.imageUrl }}
                      style={styles.relatedImg}
                    />
                    <Text style={styles.relatedTitle} numberOfLines={2}>
                      {item.title}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  center: {
    flex: 1,
    backgroundColor: COLORS.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    zIndex: 10,
  },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.card,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  hero: {
    width: width,
    height: Math.min(width * 1.15, 480),
    backgroundColor: COLORS.card,
  },
  body: { padding: 16 },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  author: { color: COLORS.text, fontWeight: '600', fontSize: 15 },
  username: { color: COLORS.muted, fontSize: 12, marginTop: 2 },
  badge: {
    backgroundColor: COLORS.card,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  badgeText: { color: COLORS.muted, fontSize: 11 },
  title: {
    color: COLORS.text,
    fontSize: 20,
    fontWeight: '700',
    marginTop: 14,
    marginBottom: 12,
    lineHeight: 26,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: COLORS.card,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  actionText: { color: COLORS.text, fontSize: 13 },
  uses: { color: COLORS.muted, fontSize: 12, marginLeft: 'auto' },
  promptBox: {
    backgroundColor: '#1e1e26',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 16,
  },
  promptLabel: {
    color: COLORS.muted,
    fontSize: 11,
    letterSpacing: 1,
    marginBottom: 10,
    fontWeight: '700',
  },
  // High contrast white text so prompt is always readable
  promptText: {
    color: '#F3F4F6',
    fontSize: 15,
    lineHeight: 24,
  },
  ctaRow: { flexDirection: 'row', gap: 10, marginBottom: 24 },
  ctaPrimary: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#fff',
    paddingVertical: 14,
    borderRadius: 14,
  },
  ctaPrimaryText: { color: '#000', fontWeight: '700', fontSize: 14 },
  ctaSecondary: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: COLORS.card,
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  ctaSecondaryText: { color: COLORS.text, fontWeight: '600', fontSize: 14 },
  sectionTitle: {
    color: COLORS.text,
    fontWeight: '600',
    fontSize: 15,
    marginBottom: 12,
  },
  relatedGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  relatedCard: {
    width: '47%',
    backgroundColor: COLORS.card,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  relatedImg: { width: '100%', height: 140 },
  relatedTitle: { color: COLORS.text, fontSize: 11, padding: 8 },
});
