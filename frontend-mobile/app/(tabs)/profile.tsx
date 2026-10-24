import { useEffect, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Avatar } from '@/components/avatar';
import { Button, Loading, TextField } from '@/components/ui';
import { Colors, Radius } from '@/constants/theme';
import { api, uploadFile } from '@/lib/api';
import { authClient } from '@/lib/auth-client';
import { SERVER_URL } from '@/lib/config';
import type { Profile } from '@/lib/types';
import { disconnectSocket } from '@/lib/socket';
import { useChatStore } from '@/store/chat';
import { usePresenceStore } from '@/store/presence';
import { useSessionStore } from '@/store/session';

export default function ProfileScreen() {
  const profile = useSessionStore((s) => s.profile);
  const setProfile = useSessionStore((s) => s.setProfile);

  useEffect(() => {
    if (!profile) api<Profile>('/users/me').then(setProfile).catch(() => {});
  }, [profile, setProfile]);

  if (!profile) return <Loading />;
  // Formulaire initialisé une fois par compte avec les valeurs du profil
  return <ProfileForm key={profile.id} profile={profile} />;
}

function ProfileForm({ profile }: { profile: Profile }) {
  const setProfile = useSessionStore((s) => s.setProfile);
  const [nickname, setNickname] = useState(profile.nickname ?? '');
  const [bio, setBio] = useState(profile.bio ?? '');
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  const dirty = nickname.trim() !== (profile.nickname ?? '') || bio.trim() !== (profile.bio ?? '');

  const save = async () => {
    if (!nickname.trim()) {
      Alert.alert('Pseudo requis', 'Ton pseudo ne peut pas être vide.');
      return;
    }
    setSaving(true);
    try {
      const updated = await api<Profile>('/users/me', {
        method: 'PATCH',
        body: { nickname: nickname.trim(), bio: bio.trim() },
      });
      setProfile({ ...profile, ...updated });
    } catch (e) {
      Alert.alert('Enregistrement impossible', (e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const changePhoto = async () => {
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
    });
    if (res.canceled || !res.assets[0]) return;
    const asset = res.assets[0];
    setUploading(true);
    try {
      const type = asset.mimeType || 'image/jpeg';
      const uploaded = await uploadFile({ uri: asset.uri, name: asset.fileName || 'avatar.jpg', type });
      const updated = await api<Profile>('/users/me', { method: 'PATCH', body: { image: uploaded.url } });
      setProfile({ ...profile, ...updated });
    } catch (e) {
      Alert.alert('Photo non modifiée', (e as Error).message);
    } finally {
      setUploading(false);
    }
  };

  const signOut = () =>
    Alert.alert('Se déconnecter ?', undefined, [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Se déconnecter',
        style: 'destructive',
        onPress: async () => {
          setSigningOut(true);
          disconnectSocket();
          try {
            await authClient.signOut();
          } finally {
            useChatStore.getState().reset();
            usePresenceStore.getState().reset();
            setProfile(null);
          }
        },
      },
    ]);

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <View style={styles.hero}>
          <Pressable onPress={changePhoto} disabled={uploading} accessibilityLabel="Changer la photo de profil">
            <Avatar user={profile} size={96} />
            <View style={styles.cameraBadge}>
              <Ionicons name={uploading ? 'hourglass-outline' : 'camera'} size={16} color="#fff" />
            </View>
          </Pressable>
          <Text style={styles.name}>{profile.nickname}</Text>
          <Text style={styles.email}>{profile.email}</Text>
        </View>

        <View style={styles.card}>
          <TextField label="Pseudo" value={nickname} onChangeText={setNickname} maxLength={50} />
          <TextField
            label="Bio"
            value={bio}
            onChangeText={setBio}
            maxLength={300}
            multiline
            placeholder="Quelques mots sur toi"
            style={{ minHeight: 80, paddingTop: 12, textAlignVertical: 'top' }}
          />
          <Button title="Enregistrer" onPress={save} loading={saving} disabled={!dirty} />
        </View>

        <Button title="Se déconnecter" icon="log-out-outline" variant="danger" onPress={signOut} loading={signingOut} />
        <Text style={styles.server}>Serveur : {SERVER_URL}</Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, gap: 16 },
  hero: { alignItems: 'center', gap: 4, paddingVertical: 12 },
  cameraBadge: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: Colors.bg,
  },
  name: { fontSize: 22, fontWeight: '800', color: Colors.text, marginTop: 8 },
  email: { fontSize: 14, color: Colors.muted },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    padding: 16,
    gap: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border2,
  },
  server: { textAlign: 'center', fontSize: 11, color: Colors.faint },
});
