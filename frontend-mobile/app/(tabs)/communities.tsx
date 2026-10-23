import { useCallback, useState } from 'react';
import { Alert, FlatList, Modal, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Avatar } from '@/components/avatar';
import { Button, EmptyState, ErrorText, Loading, TextField } from '@/components/ui';
import { Colors, Radius } from '@/constants/theme';
import { api } from '@/lib/api';
import { displayName } from '@/lib/format';
import type { ChatUser, CommunitySummary } from '@/lib/types';

interface Invite {
  id: string;
  inviter: ChatUser;
  community: { id: string; name: string; image?: string | null; _count?: { members: number } };
}

const ROLE_LABELS: Record<string, string> = {
  OWNER: 'Propriétaire',
  ADMIN: 'Admin',
  MODERATOR: 'Modérateur',
  MEMBER: 'Membre',
};

/** Accepte un lien complet (https://…/communities/join/abc) ou le code seul. */
function extractToken(input: string): string {
  const trimmed = input.trim();
  const match = trimmed.match(/join\/([^/?#\s]+)/);
  return match ? match[1] : trimmed.split(/[/?#]/).filter(Boolean).pop() || '';
}

export default function CommunitiesScreen() {
  const [communities, setCommunities] = useState<CommunitySummary[] | null>(null);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [sheet, setSheet] = useState<'join' | 'create' | null>(null);
  const [value, setValue] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    try {
      const [c, i] = await Promise.all([
        api<CommunitySummary[]>('/communities'),
        api<Invite[]>('/community-invitations/me').catch(() => []),
      ]);
      setCommunities(c);
      setInvites(i);
    } catch {
      setCommunities((prev) => prev ?? []);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const openSheet = (kind: 'join' | 'create') => {
    setValue('');
    setError('');
    setSheet(kind);
  };

  const submit = async () => {
    setError('');
    if (!value.trim()) {
      setError(sheet === 'join' ? "Colle le lien ou le code d'invitation." : 'Donne un nom à ta communauté.');
      return;
    }
    setSubmitting(true);
    try {
      if (sheet === 'join') {
        const res = await api<{ id: string; name: string; joined?: boolean; requested?: boolean }>(
          `/community-invitations/link/${encodeURIComponent(extractToken(value))}/join`,
          { body: {} },
        );
        setSheet(null);
        await load();
        if (res.requested) {
          Alert.alert('Demande envoyée', `Les modérateurs de « ${res.name} » vont examiner ta demande.`);
        } else {
          router.push({ pathname: '/community/[id]', params: { id: res.id } });
        }
      } else {
        const created = await api<{ id: string }>('/communities', { body: { name: value.trim() } });
        setSheet(null);
        await load();
        router.push({ pathname: '/community/[id]', params: { id: created.id } });
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  const respond = async (invite: Invite, accept: boolean) => {
    try {
      await api(`/community-invitations/${invite.id}/${accept ? 'accept' : 'decline'}`, { method: 'POST' });
      await load();
      if (accept) router.push({ pathname: '/community/[id]', params: { id: invite.community.id } });
    } catch (e) {
      Alert.alert('Oups', (e as Error).message);
    }
  };

  if (!communities) return <Loading />;

  return (
    <View style={{ flex: 1 }}>
      <FlatList
        data={communities}
        keyExtractor={(c) => c.id}
        contentContainerStyle={{ flexGrow: 1, paddingBottom: 24 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={async () => {
              setRefreshing(true);
              await load();
              setRefreshing(false);
            }}
            tintColor={Colors.primary}
          />
        }
        ListHeaderComponent={
          <View style={{ padding: 12, gap: 12 }}>
            <View style={styles.actions}>
              <Button title="Rejoindre" icon="enter-outline" variant="secondary" style={{ flex: 1 }} onPress={() => openSheet('join')} />
              <Button title="Créer" icon="add" style={{ flex: 1 }} onPress={() => openSheet('create')} />
            </View>
            {invites.map((inv) => (
              <View key={inv.id} style={styles.invite}>
                <Avatar name={inv.community.name} image={inv.community.image} size={44} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.name} numberOfLines={1}>
                    {inv.community.name}
                  </Text>
                  <Text style={styles.sub} numberOfLines={1}>
                    Invitation de {displayName(inv.inviter)}
                  </Text>
                </View>
                <Button title="Rejoindre" small onPress={() => respond(inv, true)} />
                <Pressable hitSlop={8} onPress={() => respond(inv, false)}>
                  <Ionicons name="close" size={20} color={Colors.muted} />
                </Pressable>
              </View>
            ))}
          </View>
        }
        renderItem={({ item }) => (
          <Pressable
            onPress={() => router.push({ pathname: '/community/[id]', params: { id: item.id } })}
            style={({ pressed }) => [styles.card, pressed && { backgroundColor: Colors.hover }]}
          >
            <Avatar name={item.name} image={item.image} size={52} />
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={styles.name} numberOfLines={1}>
                {item.name}
              </Text>
              {!!item.description && (
                <Text style={styles.sub} numberOfLines={1}>
                  {item.description}
                </Text>
              )}
              <Text style={styles.meta}>
                {item.memberCount} membre{item.memberCount > 1 ? 's' : ''} · {ROLE_LABELS[item.myRole] ?? item.myRole}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={Colors.faint} />
          </Pressable>
        )}
        ListEmptyComponent={
          <EmptyState
            icon="planet-outline"
            title="Aucune communauté"
            text="Rejoins une communauté avec un lien d'invitation, ou crée la tienne."
          />
        }
      />

      <Modal visible={!!sheet} transparent animationType="slide" onRequestClose={() => setSheet(null)}>
        <Pressable style={styles.backdrop} onPress={() => setSheet(null)}>
          <Pressable style={styles.sheet} onPress={() => {}}>
            <Text style={styles.sheetTitle}>{sheet === 'join' ? 'Rejoindre une communauté' : 'Créer une communauté'}</Text>
            <TextField
              label={sheet === 'join' ? "Lien ou code d'invitation" : 'Nom de la communauté'}
              value={value}
              onChangeText={setValue}
              placeholder={sheet === 'join' ? 'https://…/communities/join/…' : 'Ma communauté'}
              autoCapitalize={sheet === 'join' ? 'none' : 'sentences'}
              autoCorrect={sheet !== 'join'}
              autoFocus
              maxLength={sheet === 'join' ? 300 : 100}
              onSubmitEditing={submit}
            />
            <ErrorText>{error}</ErrorText>
            <Button title={sheet === 'join' ? 'Rejoindre' : 'Créer'} loading={submitting} onPress={submit} />
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  actions: { flexDirection: 'row', gap: 10 },
  invite: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    borderRadius: Radius.lg,
    backgroundColor: Colors.primarySoft,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginHorizontal: 12,
    marginBottom: 8,
    padding: 12,
    borderRadius: Radius.lg,
    backgroundColor: Colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border2,
  },
  name: { fontSize: 16, fontWeight: '700', color: Colors.text },
  sub: { fontSize: 13, color: Colors.muted },
  meta: { fontSize: 12, color: Colors.faint },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
    padding: 20,
    paddingBottom: 40,
    gap: 14,
  },
  sheetTitle: { fontSize: 18, fontWeight: '800', color: Colors.text },
});
