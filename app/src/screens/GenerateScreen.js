import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Image,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';
import { COLORS } from '../constants/config';

const RATIOS = [
  { id: '1:1', label: '1:1' },
  { id: '3:4', label: '3:4' },
  { id: '4:3', label: '4:3' },
  { id: '9:16', label: '9:16' },
  { id: '16:9', label: '16:9' },
];

export default function GenerateScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const params = useLocalSearchParams();
  const { user, updateUser } = useAuth();

  const [prompt, setPrompt] = useState('');
  const [ratio, setRatio] = useState('3:4');
  const [generating, setGenerating] = useState(false);
  const [result, setResult] = useState(null);
  const [fromCache, setFromCache] = useState(false);
  const [error, setError] = useState('');
  // User's own image for reference / style
  const [localImage, setLocalImage] = useState(null); // { uri, name, type }

  useEffect(() => {
    if (params?.prompt) {
      setPrompt(String(params.prompt));
    }
  }, [params?.prompt]);

  const credits = (user?.credits || 0) + (user?.dailyCredits || 0);
  const bottomPad = 70 + Math.max(insets.bottom, Platform.OS === 'android' ? 12 : 0);

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Gallery access required to upload your image.');
      return;
    }
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.85,
      allowsEditing: true,
    });
    if (res.canceled || !res.assets?.[0]) return;
    const asset = res.assets[0];
    const name = asset.fileName || `photo-${Date.now()}.jpg`;
    const type = asset.mimeType || 'image/jpeg';
    setLocalImage({ uri: asset.uri, name, type });
  };

  const takePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Camera access required.');
      return;
    }
    const res = await ImagePicker.launchCameraAsync({
      quality: 0.85,
      allowsEditing: true,
    });
    if (res.canceled || !res.assets?.[0]) return;
    const asset = res.assets[0];
    setLocalImage({
      uri: asset.uri,
      name: asset.fileName || `camera-${Date.now()}.jpg`,
      type: asset.mimeType || 'image/jpeg',
    });
  };

  const clearImage = () => setLocalImage(null);

  const handleGenerate = async () => {
    if (!prompt.trim()) {
      setError('Please enter a prompt — describe the image you want');
      return;
    }
    if (!user) {
      router.push('/login');
      return;
    }
    if (credits < 2) {
      Alert.alert('Not enough credits', 'Buy a plan to generate images.', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Pricing', onPress: () => router.push('/(tabs)/pricing') },
      ]);
      return;
    }

    setGenerating(true);
    setError('');
    setResult(null);
    setFromCache(false);

    try {
      const form = new FormData();
      form.append('prompt', prompt.trim());
      form.append('model', 'flux');
      form.append('ratio', ratio);
      form.append('amount', '2');

      // User ki apni image attach (reference / style)
      if (localImage?.uri) {
        form.append('image', {
          uri: localImage.uri,
          name: localImage.name,
          type: localImage.type,
        });
      }

      const { data } = await api.post('/generate', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 120000,
      });

      if (data.imageUrl) {
        setResult(data.imageUrl);
        setFromCache(!!data.fromCache);
        const c = data.credits;
        if (c && (c.credits != null || c.dailyCredits != null)) {
          await updateUser({
            credits: c.credits ?? user.credits,
            dailyCredits: c.dailyCredits ?? user.dailyCredits,
          });
        } else if (data.credits != null || data.dailyCredits != null) {
          await updateUser({
            credits: data.credits ?? user.credits,
            dailyCredits: data.dailyCredits ?? user.dailyCredits,
          });
        }
      } else {
        setError(data.message || 'Generation failed');
      }
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Generation failed');
    } finally {
      setGenerating(false);
    }
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Text style={styles.title}>Generate</Text>
        <View style={styles.creditBadge}>
          <Ionicons name="flash" size={14} color={COLORS.primary} />
          <Text style={styles.creditText}>{credits} credits</Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: bottomPad }}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.hint}>
          Apni image banao — prompt likho, chahe to apni photo upload karo (reference).
        </Text>

        {/* ===== YOUR IMAGE UPLOAD ===== */}
        <Text style={styles.label}>Your image (optional)</Text>
        {!localImage ? (
          <View style={styles.uploadRow}>
            <TouchableOpacity style={styles.uploadBtn} onPress={pickImage}>
              <Ionicons name="images-outline" size={22} color={COLORS.primary} />
              <Text style={styles.uploadBtnText}>Gallery</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.uploadBtn} onPress={takePhoto}>
              <Ionicons name="camera-outline" size={22} color={COLORS.primary} />
              <Text style={styles.uploadBtnText}>Camera</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.previewWrap}>
            <Image source={{ uri: localImage.uri }} style={styles.previewImg} />
            <TouchableOpacity style={styles.removeImg} onPress={clearImage}>
              <Ionicons name="close-circle" size={28} color="#fff" />
            </TouchableOpacity>
            <Text style={styles.previewLabel}>Your photo will be used as reference</Text>
          </View>
        )}

        {/* ===== PROMPT ===== */}
        <Text style={styles.label}>Prompt</Text>
        <TextInput
          style={styles.input}
          multiline
          numberOfLines={5}
          placeholder="Describe the image YOU want to create..."
          placeholderTextColor={COLORS.muted}
          value={prompt}
          onChangeText={setPrompt}
          textAlignVertical="top"
        />
        {!!params?.prompt && (
          <TouchableOpacity onPress={() => setPrompt('')} style={{ marginBottom: 8 }}>
            <Text style={styles.clearPrompt}>Clear prompt (naya likho)</Text>
          </TouchableOpacity>
        )}

        {/* ===== RATIO ===== */}
        <Text style={styles.label}>Aspect ratio</Text>
        <View style={styles.ratioRow}>
          {RATIOS.map((r) => (
            <TouchableOpacity
              key={r.id}
              style={[styles.ratioChip, ratio === r.id && styles.ratioActive]}
              onPress={() => setRatio(r.id)}
            >
              <Text style={[styles.ratioText, ratio === r.id && styles.ratioTextActive]}>
                {r.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {!!error && (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        <TouchableOpacity
          style={[styles.genBtn, generating && { opacity: 0.7 }]}
          onPress={handleGenerate}
          disabled={generating}
        >
          {generating ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Ionicons name="sparkles" size={18} color="#fff" />
              <Text style={styles.genBtnText}>
                {localImage ? 'Generate with my image · 2 credits' : 'Generate my image · 2 credits'}
              </Text>
            </>
          )}
        </TouchableOpacity>

        {!user && (
          <TouchableOpacity onPress={() => router.push('/login')}>
            <Text style={styles.loginHint}>Login required to generate</Text>
          </TouchableOpacity>
        )}

        {result ? (
          <View style={styles.resultWrap}>
            <Text style={styles.resultTitle}>Your generated image</Text>
            {fromCache ? (
              <Text style={styles.cacheTag}>From cache · no credits used</Text>
            ) : null}
            <Image source={{ uri: result }} style={styles.resultImg} resizeMode="contain" />
          </View>
        ) : null}
      </ScrollView>
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
    paddingVertical: 12,
  },
  title: { fontSize: 22, fontWeight: '800', color: COLORS.text },
  creditBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: COLORS.card,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  creditText: { color: COLORS.text, fontSize: 12, fontWeight: '600' },
  hint: {
    color: COLORS.muted,
    fontSize: 13,
    lineHeight: 20,
    marginBottom: 16,
  },
  label: {
    color: COLORS.muted,
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 8,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  uploadRow: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  uploadBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderStyle: 'dashed',
    borderRadius: 14,
    paddingVertical: 18,
  },
  uploadBtnText: { color: COLORS.text, fontWeight: '600', fontSize: 14 },
  previewWrap: {
    marginBottom: 16,
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.card,
  },
  previewImg: { width: '100%', height: 200 },
  removeImg: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 14,
  },
  previewLabel: {
    color: COLORS.muted,
    fontSize: 12,
    padding: 10,
    textAlign: 'center',
  },
  input: {
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 14,
    padding: 14,
    color: COLORS.text,
    fontSize: 15,
    minHeight: 120,
    marginBottom: 8,
  },
  clearPrompt: { color: COLORS.primary, fontSize: 13, fontWeight: '600' },
  ratioRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  ratioChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  ratioActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  ratioText: { color: COLORS.muted, fontSize: 13, fontWeight: '600' },
  ratioTextActive: { color: '#fff' },
  errorBox: {
    backgroundColor: 'rgba(239,68,68,0.12)',
    borderColor: 'rgba(239,68,68,0.35)',
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
  },
  errorText: { color: COLORS.danger, fontSize: 13 },
  genBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: COLORS.primary,
    borderRadius: 14,
    paddingVertical: 16,
    marginBottom: 12,
  },
  genBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  loginHint: {
    textAlign: 'center',
    color: COLORS.primary,
    marginBottom: 16,
    fontSize: 13,
  },
  resultWrap: { marginTop: 8 },
  resultTitle: {
    color: COLORS.text,
    fontWeight: '700',
    fontSize: 16,
    marginBottom: 8,
  },
  cacheTag: { color: COLORS.success, fontSize: 12, marginBottom: 8 },
  resultImg: {
    width: '100%',
    height: 360,
    borderRadius: 14,
    backgroundColor: COLORS.card,
  },
});
