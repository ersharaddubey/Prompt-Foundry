import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Image,
  Alert,
  ActivityIndicator,
  Switch,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import api from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { COLORS } from '../../constants/config';

export default function TravelUploadScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useAuth();

  const [image, setImage] = useState(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [locationName, setLocationName] = useState('');
  const [city, setCity] = useState('');
  const [country, setCountry] = useState('');
  const [category, setCategory] = useState('');
  const [tags, setTags] = useState('');
  const [visibility, setVisibility] = useState('public');
  const [ownership, setOwnership] = useState(false);
  const [categories, setCategories] = useState([]);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (!user) {
      Alert.alert('Login required', 'Please login to upload travel memories.', [
        { text: 'OK', onPress: () => router.replace('/login') },
      ]);
    }
    api.get('/travel-memories/categories').then((r) => setCategories(r.data || [])).catch(() => {});
  }, [user]);

  const pick = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Gallery access required.');
      return;
    }
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.9,
      allowsEditing: true,
    });
    if (res.canceled || !res.assets?.[0]) return;
    const a = res.assets[0];
    setImage({
      uri: a.uri,
      name: a.fileName || `travel-${Date.now()}.jpg`,
      type: a.mimeType || 'image/jpeg',
    });
  };

  const submit = async () => {
    if (!user) return;
    if (!image) return Alert.alert('Image required', 'Please select a photograph.');
    if (!title.trim()) return Alert.alert('Title required');
    if (!locationName.trim() || !country.trim()) {
      return Alert.alert('Location required', 'Location name and country are required.');
    }
    if (!category) return Alert.alert('Category required');
    if (!ownership) {
      return Alert.alert(
        'Ownership confirmation',
        'You must confirm that you own this photograph and have the right to share it.'
      );
    }

    setUploading(true);
    try {
      const form = new FormData();
      form.append('image', {
        uri: image.uri,
        name: image.name,
        type: image.type,
      });
      form.append('title', title.trim());
      form.append('description', description.trim());
      form.append('locationName', locationName.trim());
      form.append('city', city.trim());
      form.append('country', country.trim());
      form.append('category', category);
      form.append('tags', tags);
      form.append('visibility', visibility);
      form.append('ownershipConfirmed', 'true');

      const { data } = await api.post('/travel-memories', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 60000,
      });

      Alert.alert(
        'Uploaded',
        data.message || 'Your travel memory is pending moderation.',
        [{ text: 'OK', onPress: () => router.back() }]
      );
    } catch (e) {
      Alert.alert('Upload failed', e.response?.data?.message || e.message);
    } finally {
      setUploading(false);
    }
  };

  return (
    <ScrollView
      style={[styles.container, { paddingTop: insets.top + 8 }]}
      contentContainerStyle={{ paddingBottom: 40, paddingHorizontal: 16 }}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.h1}>Upload Travel Memory</Text>
        <View style={{ width: 24 }} />
      </View>

      <TouchableOpacity style={styles.imageBox} onPress={pick} activeOpacity={0.8}>
        {image ? (
          <Image source={{ uri: image.uri }} style={styles.preview} />
        ) : (
          <View style={styles.placeholder}>
            <Ionicons name="image-outline" size={40} color={COLORS.muted} />
            <Text style={styles.placeholderText}>Tap to select photo (JPG / PNG / WebP)</Text>
          </View>
        )}
      </TouchableOpacity>

      <Text style={styles.label}>Title *</Text>
      <TextInput
        style={styles.input}
        value={title}
        onChangeText={setTitle}
        placeholder="e.g. Sunrise at Ganga Ghat"
        placeholderTextColor={COLORS.muted}
        maxLength={120}
      />

      <Text style={styles.label}>Story / Description</Text>
      <TextInput
        style={[styles.input, styles.area]}
        value={description}
        onChangeText={setDescription}
        placeholder="What makes this moment special?"
        placeholderTextColor={COLORS.muted}
        multiline
        maxLength={2000}
      />

      <Text style={styles.label}>Location name *</Text>
      <TextInput
        style={styles.input}
        value={locationName}
        onChangeText={setLocationName}
        placeholder="e.g. Dashashwamedh Ghat"
        placeholderTextColor={COLORS.muted}
      />

      <View style={styles.row}>
        <View style={{ flex: 1 }}>
          <Text style={styles.label}>City</Text>
          <TextInput
            style={styles.input}
            value={city}
            onChangeText={setCity}
            placeholder="Varanasi"
            placeholderTextColor={COLORS.muted}
          />
        </View>
        <View style={{ width: 12 }} />
        <View style={{ flex: 1 }}>
          <Text style={styles.label}>Country *</Text>
          <TextInput
            style={styles.input}
            value={country}
            onChangeText={setCountry}
            placeholder="India"
            placeholderTextColor={COLORS.muted}
          />
        </View>
      </View>

      <Text style={styles.label}>Category *</Text>
      <View style={styles.catWrap}>
        {categories.map((c) => (
          <TouchableOpacity
            key={c}
            style={[styles.cat, category === c && styles.catActive]}
            onPress={() => setCategory(c)}
          >
            <Text style={[styles.catText, category === c && styles.catTextActive]}>{c}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={styles.label}>Tags (comma separated)</Text>
      <TextInput
        style={styles.input}
        value={tags}
        onChangeText={setTags}
        placeholder="ghat, sunrise, holy, river"
        placeholderTextColor={COLORS.muted}
      />

      <View style={styles.switchRow}>
        <Text style={styles.label}>Public visibility</Text>
        <Switch
          value={visibility === 'public'}
          onValueChange={(v) => setVisibility(v ? 'public' : 'private')}
          trackColor={{ true: COLORS.primary, false: COLORS.border }}
        />
      </View>

      <TouchableOpacity
        style={styles.ownRow}
        onPress={() => setOwnership(!ownership)}
        activeOpacity={0.8}
      >
        <Ionicons
          name={ownership ? 'checkbox' : 'square-outline'}
          size={22}
          color={ownership ? COLORS.primary : COLORS.muted}
        />
        <Text style={styles.ownText}>
          I confirm this is my own photograph (or I have rights to share it). I understand
          commercial rights are not automatically granted to others.
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.submit, uploading && { opacity: 0.6 }]}
        onPress={submit}
        disabled={uploading}
      >
        {uploading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <>
            <Ionicons name="cloud-upload" size={20} color="#fff" />
            <Text style={styles.submitText}>Upload for review</Text>
          </>
        )}
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  h1: { color: COLORS.text, fontSize: 18, fontWeight: '700' },
  imageBox: {
    height: 220,
    borderRadius: 16,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    overflow: 'hidden',
    marginBottom: 16,
  },
  preview: { width: '100%', height: '100%' },
  placeholder: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8 },
  placeholderText: { color: COLORS.muted, fontSize: 13 },
  label: { color: COLORS.muted, fontSize: 13, marginBottom: 6, marginTop: 8 },
  input: {
    backgroundColor: COLORS.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    color: COLORS.text,
    paddingHorizontal: 14,
    paddingVertical: Platform.OS === 'ios' ? 12 : 10,
    fontSize: 15,
  },
  area: { minHeight: 90, textAlignVertical: 'top' },
  row: { flexDirection: 'row' },
  catWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 },
  cat: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  catActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  catText: { color: COLORS.muted, fontSize: 12 },
  catTextActive: { color: '#fff', fontWeight: '600' },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 12,
  },
  ownRow: { flexDirection: 'row', gap: 10, marginTop: 16, alignItems: 'flex-start' },
  ownText: { flex: 1, color: COLORS.muted, fontSize: 13, lineHeight: 18 },
  submit: {
    marginTop: 24,
    backgroundColor: COLORS.primary,
    borderRadius: 14,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  submitText: { color: '#fff', fontWeight: '700', fontSize: 16 },
});
