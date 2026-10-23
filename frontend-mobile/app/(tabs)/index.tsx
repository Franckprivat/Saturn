import { useCallback, useMemo, useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Avatar } from '@/components/avatar';
import { Badge, Button, EmptyState, Loading } from '@/components/ui';
import { Colors, Radius } from '@/constants/theme';
import { authClient } from '@/lib/auth-client';
import { conversationTitle, formatListDate, messagePreview, otherParticipant } from '@/lib/format';
import type { Conversation } from '@/lib/types';
import { loadConversations } from '@/hooks/use-realtime';
import { useChatStore } from '@/store/chat';
import { usePresenceStore } from '@/store/presence';

function ConversationRow({ conv, myId }: { conv: Conversation; myId?: string }) {
  const unread = useChatStore((s) => s.unread[conv.id] ?? 0);
  const typing = useChatStore((s) => (s.typing[conv.id]?.length ?? 0) > 0);
  const other = conv.type === 'DM' ? otherParticipant(conv, myId) : undefined;
  const online = usePresenceStore((s) => (other ? !!s.online[other.id] : false));
  const last = conv.messages?.[0];
  const title = conversationTitle(conv, myId);

  return (
    <Pressable
      onPress={() => router.push({ pathname: '/chat/[id]', params: { id: conv.id } })}
      style={({ pressed }) => [styles.row, pressed && { backgroundColor: Colors.hover }]}
    >
      {other ? (
        <Avatar user={other} online={online} size={52} />
      ) : (
        <Avatar name={title} image={conv.image} size={52} />
      )}
      <View style={styles.rowBody}>
        <View style={styles.rowTop}>
          <Text style={styles.rowTitle} numberOfLines={1}>
            {conv.type === 'GROUP' && <Ionicons name="people" size={14} color={Colors.muted} />}{' '}
            {title}
          </Text>
          <Text style={[styles.rowDate, unread > 0 && { color: Colors.primary, fontWeight: '700' }]}>
            {formatListDate(last?.createdAt ?? conv.lastMessageAt ?? conv.createdAt)}
          </Text>
        </View>
        <View style={styles.rowTop}>
          <Text
            style={[styles.rowPreview, unread > 0 && { color: Colors.text, fontWeight: '600' }, typing && styles.typing]}
            numberOfLines={1}
          >
            {typing ? 'écrit…' : messagePreview(last, myId)}
          </Text>
          <Badge count={unread} />
        </View>
      </View>
    </Pressable>
  );
}

export default function ConversationsScreen() {
  const { data: session } = authClient.useSession();
  const myId = session?.user?.id;
  const conversations = useChatStore((s) => s.conversations);
  const loaded = useChatStore((s) => s.loaded);
  const [query, setQuery] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return conversations;
    return conversations.filter((c) => conversationTitle(c, myId).toLowerCase().includes(q));
  }, [conversations, query, myId]);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    await loadConversations().catch(() => {});
    setRefreshing(false);
  }, []);

  return (
    <View style={{ flex: 1 }}>
      {!loaded ? (
        <Loading />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(c) => c.id}
          renderItem={({ item }) => <ConversationRow conv={item} myId={myId} />}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={Colors.primary} />}
          contentContainerStyle={filtered.length ? undefined : { flexGrow: 1 }}
          ListHeaderComponent={
            <View style={styles.header}>
              <View style={styles.search}>
                <Ionicons name="search" size={18} color={Colors.faint} />
                <TextInput
                  value={query}
                  onChangeText={setQuery}
                  placeholder="Rechercher une discussion"
                  placeholderTextColor={Colors.faint}
                  style={styles.searchInput}
                  clearButtonMode="while-editing"
                />
              </View>
              <Pressable onPress={() => router.push('/new-group')} style={styles.newGroup} accessibilityLabel="Nouveau groupe">
                <Ionicons name="people-outline" size={20} color={Colors.primary} />
                <Ionicons name="add" size={14} color={Colors.primary} style={{ marginLeft: -4 }} />
              </Pressable>
            </View>
          }
          ListEmptyComponent={
            query ? (
              <EmptyState icon="search" title="Aucun résultat" />
            ) : (
              <EmptyState
                icon="chatbubbles-outline"
                title="Aucune discussion"
                text="Ajoute des amis puis démarre une discussion depuis l'onglet Amis."
                action={
                  <Button title="Trouver des amis" small onPress={() => router.push('/friends')} style={{ marginTop: 8 }} />
                }
              />
            )
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', gap: 10, padding: 12, paddingBottom: 6 },
  search: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.sidebar,
    borderRadius: Radius.md,
    paddingHorizontal: 12,
    height: 42,
  },
  searchInput: { flex: 1, fontSize: 15, color: Colors.text },
  newGroup: {
    width: 42,
    height: 42,
    borderRadius: Radius.md,
    backgroundColor: Colors.primarySoft,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 10 },
  rowBody: { flex: 1, gap: 4, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: Colors.border, paddingBottom: 10 },
  rowTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  rowTitle: { flex: 1, fontSize: 16, fontWeight: '700', color: Colors.text },
  rowDate: { fontSize: 12, color: Colors.faint },
  rowPreview: { flex: 1, fontSize: 14, color: Colors.muted },
  typing: { color: Colors.primary, fontStyle: 'italic' },
});
