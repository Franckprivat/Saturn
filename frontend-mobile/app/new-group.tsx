import { useEffect, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Avatar } from '@/components/avatar';
import { Button, EmptyState, ErrorText, Loading, TextField } from '@/components/ui';
import { Colors } from '@/constants/theme';
import { api } from '@/lib/api';
import { displayName } from '@/lib/format';
import type { ChatUser, Conversation } from '@/lib/types';
import { loadConversations } from '@/hooks/use-realtime';

/** Création d'un groupe parmi ses amis (POST /conversations/group). */
export default function NewGroupScreen() {
  const [friends, setFriends] = useState<ChatUser[] | null>(null);
  const [name, setName] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [error, setError] = useState('');
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    api<ChatUser[]>('/friends')
      .then(setFriends)
      .catch(() => setFriends([]));
  }, []);

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const create = async () => {
    setError('');
    if (!name.trim()) return setError('Donne un nom au groupe.');
    if (!selected.size) return setError('Choisis au moins un ami.');
    setCreating(true);
    try {
      const conv = await api<Conversation>('/conversations/group', {
        body: { name: name.trim(), memberIds: [...selected] },
      });
      await loadConversations().catch(() => {});
      router.replace({ pathname: '/chat/[id]', params: { id: conv.id } });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setCreating(false);
    }
  };

  if (!friends) return <Loading />;

  return (
    <View style={{ flex: 1 }}>
      <FlatList
        data={friends}
        keyExtractor={(u) => u.id}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ flexGrow: 1 }}
        ListHeaderComponent={
          <View style={styles.header}>
            <TextField label="Nom du groupe" value={name} onChangeText={setName} placeholder="Les copains" maxLength={100} />
            <Text style={styles.label}>Membres ({selected.size})</Text>
          </View>
        }
        renderItem={({ item }) => {
          const on = selected.has(item.id);
          return (
            <Pressable onPress={() => toggle(item.id)} style={({ pressed }) => [styles.row, pressed && { backgroundColor: Colors.hover }]}>
              <Avatar user={item} size={42} />
              <Text style={styles.name} numberOfLines={1}>
                {displayName(item)}
              </Text>
              <Ionicons name={on ? 'checkmark-circle' : 'ellipse-outline'} size={24} color={on ? Colors.primary : Colors.faint} />
            </Pressable>
          );
        }}
        ListEmptyComponent={
          <EmptyState icon="people-outline" title="Aucun ami" text="Ajoute des amis pour créer un groupe avec eux." />
        }
      />
      <View style={styles.footer}>
        <ErrorText>{error}</ErrorText>
        <Button title="Créer le groupe" onPress={create} loading={creating} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { padding: 16, gap: 14 },
  label: { fontSize: 13, fontWeight: '600', color: Colors.muted },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 10 },
  name: { flex: 1, fontSize: 16, color: Colors.text, fontWeight: '600' },
  footer: {
    padding: 16,
    paddingBottom: 32,
    gap: 8,
    backgroundColor: Colors.surface,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.border,
  },
});
