import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, FlatList, Pressable, RefreshControl, StyleSheet, Text, TextInput, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Avatar } from '@/components/avatar';
import { Button, EmptyState, Segmented } from '@/components/ui';
import { Colors, Radius } from '@/constants/theme';
import { api } from '@/lib/api';
import { authClient } from '@/lib/auth-client';
import { displayName, formatLastSeen } from '@/lib/format';
import type { ChatUser, Conversation, Friendship } from '@/lib/types';
import { loadConversations, refreshFriendRequests } from '@/hooks/use-realtime';
import { usePresenceStore } from '@/store/presence';

type Tab = 'friends' | 'requests' | 'add';

function UserRow({ user, subtitle, right, onPress }: { user: ChatUser; subtitle?: string; right?: React.ReactNode; onPress?: () => void }) {
  const online = usePresenceStore((s) => !!s.online[user.id]);
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      style={({ pressed }) => [styles.row, pressed && onPress && { backgroundColor: Colors.hover }]}
    >
      <Avatar user={user} size={46} online={online} />
      <View style={{ flex: 1 }}>
        <Text style={styles.name} numberOfLines={1}>
          {displayName(user)}
        </Text>
        {!!subtitle && (
          <Text style={styles.sub} numberOfLines={1}>
            {subtitle}
          </Text>
        )}
      </View>
      {right}
    </Pressable>
  );
}

export default function FriendsScreen() {
  const { data: session } = authClient.useSession();
  const myId = session?.user?.id;
  const onlineMap = usePresenceStore((s) => s.online);
  const lastSeen = usePresenceStore((s) => s.lastSeen);
  const [tab, setTab] = useState<Tab>('friends');
  const [friends, setFriends] = useState<ChatUser[]>([]);
  const [requests, setRequests] = useState<Friendship[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<ChatUser[]>([]);
  const [searching, setSearching] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [f, r] = await Promise.all([api<ChatUser[]>('/friends'), api<Friendship[]>('/friends/requests')]);
      setFriends(f);
      setRequests(r);
      if (myId) void refreshFriendRequests(myId);
    } catch {
      /* hors ligne */
    }
  }, [myId]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  // Recherche avec un léger délai pendant la frappe
  useEffect(() => {
    const q = query.trim();
    if (!q) {
      setResults([]);
      return;
    }
    setSearching(true);
    const t = setTimeout(() => {
      api<ChatUser[]>(`/friends/search?q=${encodeURIComponent(q)}`)
        .then(setResults)
        .catch(() => setResults([]))
        .finally(() => setSearching(false));
    }, 350);
    return () => clearTimeout(t);
  }, [query]);

  const incoming = useMemo(
    () => requests.filter((r) => r.status === 'PENDING' && r.addresseeId === myId),
    [requests, myId],
  );
  const outgoing = useMemo(
    () => requests.filter((r) => r.status === 'PENDING' && r.requesterId === myId),
    [requests, myId],
  );
  const sortedFriends = useMemo(
    () =>
      [...friends].sort(
        (a, b) => Number(!!onlineMap[b.id]) - Number(!!onlineMap[a.id]) || displayName(a).localeCompare(displayName(b)),
      ),
    [friends, onlineMap],
  );

  const relation = (userId: string): 'friend' | 'sent' | 'received' | null => {
    if (friends.some((f) => f.id === userId)) return 'friend';
    if (outgoing.some((r) => r.addresseeId === userId)) return 'sent';
    if (incoming.some((r) => r.requesterId === userId)) return 'received';
    return null;
  };

  const run = async (key: string, fn: () => Promise<unknown>) => {
    setBusy(key);
    try {
      await fn();
      await load();
    } catch (e) {
      Alert.alert('Oups', (e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const openDm = (user: ChatUser) =>
    run(`dm-${user.id}`, async () => {
      const conv = await api<Conversation>('/conversations/dm', { body: { userId: user.id } });
      await loadConversations().catch(() => {});
      router.push({ pathname: '/chat/[id]', params: { id: conv.id } });
    });

  const confirmRemove = (user: ChatUser) =>
    Alert.alert(displayName(user), undefined, [
      { text: 'Envoyer un message', onPress: () => openDm(user) },
      {
        text: 'Retirer des amis',
        style: 'destructive',
        onPress: () => run(`rm-${user.id}`, () => api(`/friends/${user.id}`, { method: 'DELETE' })),
      },
      {
        text: 'Bloquer',
        style: 'destructive',
        onPress: () => run(`block-${user.id}`, () => api(`/friends/block/${user.id}`, { method: 'POST' })),
      },
      { text: 'Annuler', style: 'cancel' },
    ]);

  const refresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const header = (
    <View style={styles.header}>
      <Segmented
        value={tab}
        onChange={setTab}
        options={[
          { value: 'friends', label: 'Amis' },
          { value: 'requests', label: 'Demandes', badge: incoming.length },
          { value: 'add', label: 'Ajouter' },
        ]}
      />
      {tab === 'add' && (
        <View style={styles.search}>
          <Ionicons name="search" size={18} color={Colors.faint} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Pseudo ou adresse e-mail exacte"
            placeholderTextColor={Colors.faint}
            style={styles.searchInput}
            autoCapitalize="none"
            autoCorrect={false}
            autoFocus
          />
        </View>
      )}
    </View>
  );

  const refreshControl = <RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={Colors.primary} />;

  if (tab === 'friends') {
    return (
      <FlatList
        data={sortedFriends}
        keyExtractor={(u) => u.id}
        ListHeaderComponent={header}
        refreshControl={refreshControl}
        contentContainerStyle={{ flexGrow: 1 }}
        renderItem={({ item }) => (
          <UserRow
            user={item}
            subtitle={onlineMap[item.id] ? 'en ligne' : formatLastSeen(lastSeen[item.id] ?? item.lastSeenAt)}
            onPress={() => openDm(item)}
            right={
              <Pressable hitSlop={10} onPress={() => confirmRemove(item)}>
                <Ionicons name="ellipsis-horizontal" size={20} color={Colors.muted} />
              </Pressable>
            }
          />
        )}
        ListEmptyComponent={
          <EmptyState
            icon="people-outline"
            title="Pas encore d'amis"
            text="Recherche quelqu'un par son pseudo pour lui envoyer une demande."
            action={<Button title="Ajouter un ami" small onPress={() => setTab('add')} style={{ marginTop: 8 }} />}
          />
        }
      />
    );
  }

  if (tab === 'requests') {
    const data = [
      ...incoming.map((r) => ({ r, kind: 'in' as const })),
      ...outgoing.map((r) => ({ r, kind: 'out' as const })),
    ];
    return (
      <FlatList
        data={data}
        keyExtractor={(d) => d.r.id}
        ListHeaderComponent={header}
        refreshControl={refreshControl}
        contentContainerStyle={{ flexGrow: 1 }}
        renderItem={({ item: { r, kind } }) =>
          kind === 'in' ? (
            <UserRow
              user={r.requester}
              subtitle="Veut t'ajouter en ami"
              right={
                <View style={styles.actions}>
                  <Button
                    title="Accepter"
                    small
                    loading={busy === `acc-${r.id}`}
                    onPress={() => run(`acc-${r.id}`, () => api(`/friends/requests/${r.id}/accept`, { method: 'POST' }))}
                  />
                  <Pressable
                    hitSlop={8}
                    style={styles.decline}
                    onPress={() => run(`dec-${r.id}`, () => api(`/friends/requests/${r.id}/decline`, { method: 'POST' }))}
                  >
                    <Ionicons name="close" size={18} color={Colors.muted} />
                  </Pressable>
                </View>
              }
            />
          ) : (
            <UserRow user={r.addressee} subtitle="Demande envoyée · en attente" />
          )
        }
        ListEmptyComponent={<EmptyState icon="mail-open-outline" title="Aucune demande en attente" />}
      />
    );
  }

  return (
    <FlatList
      data={results}
      keyExtractor={(u) => u.id}
      ListHeaderComponent={header}
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={{ flexGrow: 1 }}
      renderItem={({ item }) => {
        const rel = relation(item.id);
        return (
          <UserRow
            user={item}
            subtitle={item.bio || undefined}
            right={
              rel === 'friend' ? (
                <Button title="Message" small variant="secondary" onPress={() => openDm(item)} />
              ) : rel === 'sent' ? (
                <Text style={styles.pending}>Envoyée</Text>
              ) : (
                <Button
                  title={rel === 'received' ? 'Accepter' : 'Ajouter'}
                  icon="person-add-outline"
                  small
                  loading={busy === `add-${item.id}`}
                  onPress={() =>
                    run(`add-${item.id}`, () => api('/friends/requests', { body: { addresseeId: item.id } }))
                  }
                />
              )
            }
          />
        );
      }}
      ListEmptyComponent={
        query.trim() && !searching ? (
          <EmptyState icon="search" title="Aucun utilisateur trouvé" text="Vérifie l'orthographe du pseudo." />
        ) : (
          <EmptyState icon="person-add-outline" title="Trouve tes amis" text="Tape un pseudo ou une adresse e-mail." />
        )
      }
    />
  );
}

const styles = StyleSheet.create({
  header: { padding: 12, gap: 12 },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border2,
    paddingHorizontal: 12,
    height: 46,
  },
  searchInput: { flex: 1, fontSize: 15, color: Colors.text },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 10 },
  name: { fontSize: 16, fontWeight: '700', color: Colors.text },
  sub: { fontSize: 13, color: Colors.muted, marginTop: 1 },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  decline: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.sidebar,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pending: { fontSize: 13, color: Colors.faint, fontWeight: '600' },
});
