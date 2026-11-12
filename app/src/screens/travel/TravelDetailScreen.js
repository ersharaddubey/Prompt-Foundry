import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Share,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import api from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { COLORS } from '../../constants/config';


export default function TravelDetailScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { id } = useLocalSearchParams();
  const { user } = useAuth();

  const [memory, setMemory] = useState(null);
  const [loading, setLoading] = useState(true);
  const [liking, setLiking] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    try {
      setLoading(true);
      const { data } = await api.get(`/travel-memories/${id}`);
      setMemory(data);
    } catch (e) {
      Alert.alert('Error', e.response?.data?.message || e.message);
      router.back();
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (id) load();
  }, [id]);

  const toggleLike = async () => {
    if (!user) return Alert.alert('Login required');
    setLiking(true);
    try {
      const { data } = await api.post(`/travel-memories/${id}/like`);
      setMemory((m) => ({
        ...m,
        likedByMe: data.liked,
        likeCount: data.likeCount,
      }));
    } catch (e) {
      Alert.alert('Error', e.response?.data?.message || e.message);
    } finally {
      setLiking(false);
    }
  };

  const toggleSave = async () => {
    if (!user) return Alert.alert('Login required');
    setSaving(true);
    try {
      const { data } = await api.post(`/travel-memories/${id}/save`);
      setMemory((m) => ({ ...m, savedByMe: data.saved }));
    } catch (e) {
      Alert.alert('Error', e.response?.data?.message || e.message);
    } finally {
      setSaving(false);
    }
  };

  const createWithAI = () => {
    if (!memory) return;
    // Navigate to generate with inspiration reference
    router.push({
      pathname: '/(tabs)/generate',
      params: {
        inspirationId: String(memory._id),
        inspirationUrl: memory.imageUrl,
        inspirationTitle: memory.title,
        inspirationCreator: memory.creator?.username || memory.creator?.name || '',
        inspirationLocation: [memory.locationName, memory.city, memory.country].filter(Boolean).join(', '),
        prompt: `Inspired by a real photo of ${memory.locationName}. Create a new artistic scene...`,
      },
    });
  };

  const report = () => {
    if (!user) return Alert.alert('Login required');
    Alert.alert('Report this photo', 'Select a reason', [
      { text: 'Copyright / not their photo', onPress: () => sendReport('copyright') },
      { text: 'Inappropriate', onPress: () => sendReport('inappropriate') },
      { text: 'Spam', onPress: () => sendReport('spam') },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const sendReport = async (reason) => {
    try {
      await api.post(`/travel-memories/${id}/report`, { reason });
      Alert.alert('Thanks', 'Report submitted for review.');
    } catch (e) {
      Alert.alert('Error', e.response?.data?.message || e.message);
    }
  };

  const shareMem = async () => {
    try {
      await Share.share({
        message: `Travel Memory: ${memory?.title} – ${memory?.locationName}\nInspired on PromptFoundry`,
      });
    } catch (_) {}
  };

  if (loading || !memory) {
    return (
      <View style={[styles.center, { paddingTop: insets.top }]}>
        <ActivityIndicator color={COLORS.primary} size="large" />
      </View>
    );
  }

  const creatorName = memory.creator?.username || memory.creator?.name || 'creator';

  return (
    <ScrollView
      style={[styles.container, { paddingTop: insets.top }]}
      contentContainerStyle={{ paddingBottom: 40 }}
    >
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => router.back()} style={styles.iconBtn}>
          <Ionicons name="arrow-back" size={22} color={COLORS.text} />
        </TouchableOpacity>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <TouchableOpacity onPress={shareMem} style={styles.iconBtn}>
            <Ionicons name="share-outline" size={22} color={COLORS.text} />
          </TouchableOpacity>
          <TouchableOpacity onPress={report} style={styles.iconBtn}>
            <Ionicons name="flag-outline" size={22} color={COLORS.text} />
          </TouchableOpacity>
        </View>
      </View>

      <Image source={{ uri: memory.imageUrl }} style={styles.hero} resizeMode="cover" />

      <View style={styles.body}>
        <Text style={styles.title}>{memory.title}</Text>
        {!!memory.externalLink && (
          <TouchableOpacity
            style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8 }}
            onPress={() => Linking.openURL(memory.externalLink).catch(() => Alert.alert('Could not open link'))}
          >
            <Ionicons name="link-outline" size={16} color={COLORS.primary} />
            <Text style={{ color: COLORS.primary, fontSize: 14 }}>Open link</Text>
          </TouchableOpacity>
        )}
        <Text style={styles.loc}>
          📍 {[memory.locationName, memory.city, memory.country].filter(Boolean).join(', ')}
        </Text>
        <Text style={styles.cat}>{memory.category}</Text>

        {!!memory.description && <Text style={styles.desc}>{memory.description}</Text>}

        <TouchableOpacity
          style={styles.creatorRow}
          onPress={() => router.push(`/travel/creator/${memory.creator?.id || memory.user?._id}`)}
        >
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{(creatorName || 'C')[0]?.toUpperCase()}</Text>
          </View>
          <View>
            <Text style={styles.creatorName}>@{creatorName}</Text>
            <Text style={styles.creatorMeta}>
              {memory.aiCreationCount || 0} AI creations · {memory.likeCount || 0} likes
            </Text>
          </View>
        </TouchableOpacity>

        <View style={styles.actions}>
          <TouchableOpacity style={styles.actionBtn} onPress={toggleLike} disabled={liking}>
            <Ionicons
              name={memory.likedByMe ? 'heart' : 'heart-outline'}
              size={22}
              color={memory.likedByMe ? '#ef4444' : COLORS.text}
            />
            <Text style={styles.actionText}>{memory.likeCount || 0}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionBtn} onPress={toggleSave} disabled={saving}>
            <Ionicons
              name={memory.savedByMe ? 'bookmark' : 'bookmark-outline'}
              size={22}
              color={COLORS.text}
            />
            <Text style={styles.actionText}>Save</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={styles.aiBtn} onPress={createWithAI}>
          <Ionicons name="sparkles" size={20} color="#fff" />
          <Text style={styles.aiBtnText}>Create with AI</Text>
        </TouchableOpacity>

      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  center: { flex: 1, backgroundColor: COLORS.bg, alignItems: 'center', justifyContent: 'center' },
  topBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingTop: 8,
  },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  hero: { width: '100%', height: 360, backgroundColor: '#222' },
  body: { padding: 16 },
  title: { color: COLORS.text, fontSize: 22, fontWeight: '700' },
  loc: { color: COLORS.muted, marginTop: 6, fontSize: 14 },
  cat: {
    alignSelf: 'flex-start',
    marginTop: 8,
    backgroundColor: COLORS.card,
    color: COLORS.primary,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
    overflow: 'hidden',
    fontSize: 12,
    fontWeight: '600',
  },
  desc: { color: COLORS.text, marginTop: 14, lineHeight: 22, fontSize: 15 },
  creatorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 18,
    padding: 12,
    backgroundColor: COLORS.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: '#fff', fontWeight: '700', fontSize: 18 },
  creatorName: { color: COLORS.text, fontWeight: '600' },
  creatorMeta: { color: COLORS.muted, fontSize: 12, marginTop: 2 },
  actions: { flexDirection: 'row', gap: 16, marginTop: 16 },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: COLORS.card,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  actionText: { color: COLORS.text, fontWeight: '600' },
  aiBtn: {
    marginTop: 20,
    backgroundColor: COLORS.primary,
    borderRadius: 14,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  aiBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  supportTitle: { color: COLORS.text, fontWeight: '700', marginTop: 28, marginBottom: 10 },
  supportRow: { flexDirection: 'row', gap: 10 },
  supportBtn: {
    flex: 1,
    backgroundColor: COLORS.card,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  supportCustom: { borderColor: COLORS.primary },
  supportBtnText: { color: COLORS.text, fontWeight: '600' },
  supportNote: { color: COLORS.muted, fontSize: 11, marginTop: 10, lineHeight: 16 },
});
