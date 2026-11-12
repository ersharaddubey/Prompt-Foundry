import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ScrollView,
  Platform,
  Modal,
  TextInput,
  Image,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { useAuth } from '../context/AuthContext';
import api from '../api/client';
import { COLORS } from '../constants/config';

export default function ProfileScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user, logout, updateUser, deleteAccount } = useAuth();
  const bottomPad = 70 + Math.max(insets.bottom, Platform.OS === 'android' ? 16 : 8);

  const [editOpen, setEditOpen] = useState(false);
  const [editName, setEditName] = useState('');
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [deleting, setDeleting] = useState(false);

  if (!user) {
    return (
      <View style={[styles.container, { paddingTop: insets.top + 20, paddingHorizontal: 24 }]}>
        <Text style={styles.emptyTitle}>Not logged in</Text>
        <TouchableOpacity
          style={styles.primaryBtn}
          onPress={() => router.push('/login')}
        >
          <Text style={styles.primaryBtnText}>Login</Text>
        </TouchableOpacity>

        <View style={{ width: '100%', marginTop: 28 }}>
          <TouchableOpacity
            style={styles.menuItem}
            onPress={() => router.push('/login')}
          >
            <Ionicons name="card-outline" size={22} color={COLORS.primary} />
            <Text style={styles.menuText}>AI Billing</Text>
            <Ionicons name="chevron-forward" size={18} color={COLORS.muted} />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.menuItem}
            onPress={() => router.push('/favorites')}
          >
            <Ionicons name="heart-outline" size={22} color={COLORS.primary} />
            <Text style={styles.menuText}>Favorites</Text>
            <Ionicons name="chevron-forward" size={18} color={COLORS.muted} />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.menuItem}
            onPress={() => router.push('/travel')}
          >
            <Ionicons name="airplane-outline" size={22} color={COLORS.primary} />
            <Text style={styles.menuText}>Travel</Text>
            <Ionicons name="chevron-forward" size={18} color={COLORS.muted} />
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const openEdit = () => {
    setEditName(user.name || '');
    setEditOpen(true);
  };

  const pickAvatar = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission needed', 'Gallery access is required to set profile photo.');
        return;
      }
      const res = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        quality: 0.85,
        allowsEditing: true,
        aspect: [1, 1],
      });
      if (res.canceled || !res.assets?.[0]) return;

      const a = res.assets[0];
      setUploadingAvatar(true);
      const form = new FormData();
      form.append('avatar', {
        uri: a.uri,
        name: a.fileName || `avatar-${Date.now()}.jpg`,
        type: a.mimeType || 'image/jpeg',
      });
      const { data } = await api.post('/auth/avatar', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 60000,
      });
      await updateUser({
        name: data.name,
        avatar: data.avatar,
        email: data.email,
        credits: data.credits,
        dailyCredits: data.dailyCredits,
      });
      Alert.alert('Updated', 'Profile photo updated.');
    } catch (e) {
      Alert.alert('Upload failed', e.response?.data?.message || e.message || 'Could not update photo');
    } finally {
      setUploadingAvatar(false);
    }
  };

  const saveProfile = async () => {
    const name = editName.trim();
    if (name.length < 2) {
      Alert.alert('Invalid name', 'Name must be at least 2 characters.');
      return;
    }
    setSaving(true);
    try {
      const { data } = await api.patch('/auth/profile', { name });
      await updateUser({
        name: data.name,
        avatar: data.avatar,
        email: data.email,
        credits: data.credits,
        dailyCredits: data.dailyCredits,
      });
      setEditOpen(false);
      Alert.alert('Saved', 'Profile updated.');
    } catch (e) {
      Alert.alert('Error', e.response?.data?.message || e.message || 'Could not save');
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = () => {
    Alert.alert('Logout', 'Kya aap logout karna chahte ho?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Logout',
        style: 'destructive',
        onPress: async () => {
          await logout();
          router.replace('/(tabs)');
        },
      },
    ]);
  };

  const handleDeleteProfile = () => {
    Alert.alert(
      'Delete Profile',
      'Are you sure? Account permanently delete ho jayega.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Yes',
          style: 'destructive',
          onPress: async () => {
            setDeleting(true);
            try {
              await deleteAccount();
              router.replace('/(tabs)');
            } catch (e) {
              Alert.alert(
                'Error',
                e.response?.data?.message || e.message || 'Could not delete account'
              );
            } finally {
              setDeleting(false);
            }
          },
        },
      ]
    );
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.topBar}>
        <Text style={styles.topTitle}>Profile</Text>
      </View>

      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: bottomPad }]}>
        <TouchableOpacity
          style={styles.avatarWrap}
          onPress={pickAvatar}
          disabled={uploadingAvatar}
          activeOpacity={0.85}
        >
          {user.avatar ? (
            <Image source={{ uri: user.avatar }} style={styles.avatarLarge} />
          ) : (
            <View style={styles.avatarLarge}>
              <Text style={styles.avatarLargeText}>
                {(user.name || 'U')[0].toUpperCase()}
              </Text>
            </View>
          )}
          <View style={styles.avatarBadge}>
            {uploadingAvatar ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Ionicons name="camera" size={14} color="#fff" />
            )}
          </View>
        </TouchableOpacity>
        <Text style={styles.avatarHint}>Tap photo to change</Text>

        <Text style={styles.name}>{user.name || 'User'}</Text>
        <Text style={styles.email}>{user.authProvider === 'puter' ? `Puter account · @${user.puterUsername || 'connected'}` : user.email}</Text>

        <View style={styles.statsRow}>
          <View style={[styles.statCard, { flex: 1 }]}>
            <Text style={styles.statValue}>Direct</Text>
            <Text style={styles.statLabel}>Puter AI billing</Text>
          </View>
          <View style={[styles.statCard, { flex: 1 }]}>
            <Text style={styles.statValue}>Your drive</Text>
            <Text style={styles.statLabel}>Puter image storage</Text>
          </View>
        </View>

        <TouchableOpacity style={styles.menuItem} onPress={openEdit}>
          <Ionicons name="create-outline" size={22} color={COLORS.primary} />
          <Text style={styles.menuText}>Edit Profile</Text>
          <Ionicons name="chevron-forward" size={18} color={COLORS.muted} />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.menuItem}
          onPress={() => router.push('/pricing')}
        >
          <Ionicons name="card-outline" size={22} color={COLORS.primary} />
          <Text style={styles.menuText}>AI Billing</Text>
          <Ionicons name="chevron-forward" size={18} color={COLORS.muted} />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.menuItem}
          onPress={() => router.push('/favorites')}
        >
          <Ionicons name="heart-outline" size={22} color={COLORS.primary} />
          <Text style={styles.menuText}>Favorites</Text>
          <Ionicons name="chevron-forward" size={18} color={COLORS.muted} />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.menuItem}
          onPress={() => router.push('/travel')}
        >
          <Ionicons name="airplane-outline" size={22} color={COLORS.primary} />
          <Text style={styles.menuText}>Travel</Text>
          <Ionicons name="chevron-forward" size={18} color={COLORS.muted} />
        </TouchableOpacity>

        <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
          <Ionicons name="log-out-outline" size={20} color={COLORS.danger} />
          <Text style={styles.logoutText}>Logout</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.deleteBtn, deleting && { opacity: 0.6 }]}
          onPress={handleDeleteProfile}
          disabled={deleting}
        >
          {deleting ? (
            <ActivityIndicator color={COLORS.danger} />
          ) : (
            <>
              <Ionicons name="trash-outline" size={20} color={COLORS.danger} />
              <Text style={styles.deleteText}>Delete Profile</Text>
            </>
          )}
        </TouchableOpacity>
      </ScrollView>

      <Modal visible={editOpen} animationType="slide" transparent onRequestClose={() => setEditOpen(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { paddingBottom: Math.max(insets.bottom, 16) }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Edit Profile</Text>
              <TouchableOpacity onPress={() => setEditOpen(false)}>
                <Ionicons name="close" size={24} color={COLORS.muted} />
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={styles.modalAvatarWrap}
              onPress={pickAvatar}
              disabled={uploadingAvatar}
            >
              {user.avatar ? (
                <Image source={{ uri: user.avatar }} style={styles.modalAvatar} />
              ) : (
                <View style={[styles.modalAvatar, { backgroundColor: COLORS.primary, alignItems: 'center', justifyContent: 'center' }]}>
                  <Text style={{ color: '#fff', fontSize: 28, fontWeight: '700' }}>
                    {(editName || user.name || 'U')[0].toUpperCase()}
                  </Text>
                </View>
              )}
              <Text style={styles.changePhotoText}>
                {uploadingAvatar ? 'Uploading…' : 'Change photo'}
              </Text>
            </TouchableOpacity>

            <Text style={styles.inputLabel}>Name</Text>
            <TextInput
              style={styles.input}
              value={editName}
              onChangeText={setEditName}
              placeholder="Your name"
              placeholderTextColor={COLORS.muted}
              autoCapitalize="words"
            />

            {user.authProvider === 'puter' ? (
              <Text style={styles.emailReadonly}>Signed in with Puter · @{user.puterUsername || 'connected'}</Text>
            ) : (
              <><Text style={styles.inputLabel}>Email</Text><Text style={styles.emailReadonly}>{user.email}</Text></>
            )}

            <TouchableOpacity
              style={[styles.saveBtn, saving && { opacity: 0.6 }]}
              onPress={saveProfile}
              disabled={saving}
            >
              {saving ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.saveBtnText}>Save</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  topTitle: {
    color: COLORS.text,
    fontSize: 17,
    fontWeight: '600',
  },
  content: {
    padding: 24,
    alignItems: 'center',
  },
  avatarWrap: {
    position: 'relative',
    marginBottom: 8,
  },
  avatarLarge: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarLargeText: {
    color: '#fff',
    fontSize: 36,
    fontWeight: '700',
  },
  avatarBadge: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: COLORS.primary2 || '#c026d3',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: COLORS.bg,
  },
  avatarHint: {
    color: COLORS.muted,
    fontSize: 12,
    marginBottom: 12,
  },
  name: {
    color: COLORS.text,
    fontSize: 22,
    fontWeight: '700',
  },
  email: {
    color: COLORS.muted,
    fontSize: 14,
    marginTop: 4,
    marginBottom: 24,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 28,
    width: '100%',
  },
  statCard: {
    flex: 1,
    backgroundColor: COLORS.card,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  statValue: {
    color: COLORS.text,
    fontSize: 22,
    fontWeight: '700',
  },
  statLabel: {
    color: COLORS.muted,
    fontSize: 12,
    marginTop: 4,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    backgroundColor: COLORS.card,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: 12,
  },
  menuText: {
    flex: 1,
    color: COLORS.text,
    fontSize: 15,
    fontWeight: '500',
  },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 24,
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.danger + '55',
    width: '100%',
  },
  logoutText: {
    color: COLORS.danger,
    fontSize: 15,
    fontWeight: '600',
  },
  deleteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 12,
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
    backgroundColor: COLORS.danger + '18',
    width: '100%',
  },
  deleteText: {
    color: COLORS.danger,
    fontSize: 15,
    fontWeight: '600',
  },
  emptyTitle: {
    color: COLORS.text,
    fontSize: 18,
    textAlign: 'center',
    marginBottom: 20,
  },
  primaryBtn: {
    backgroundColor: COLORS.primary,
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 12,
    alignSelf: 'center',
  },
  primaryBtnText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 16,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: COLORS.card,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  modalTitle: {
    color: COLORS.text,
    fontSize: 18,
    fontWeight: '700',
  },
  modalAvatarWrap: {
    alignItems: 'center',
    marginBottom: 20,
  },
  modalAvatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    overflow: 'hidden',
  },
  changePhotoText: {
    color: COLORS.primary,
    marginTop: 8,
    fontSize: 14,
    fontWeight: '600',
  },
  inputLabel: {
    color: COLORS.muted,
    fontSize: 12,
    marginBottom: 6,
  },
  input: {
    backgroundColor: COLORS.bg,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: COLORS.text,
    fontSize: 15,
    marginBottom: 14,
  },
  emailReadonly: {
    color: COLORS.text,
    fontSize: 15,
    marginBottom: 20,
    opacity: 0.8,
  },
  saveBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  saveBtnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 16,
  },
});
