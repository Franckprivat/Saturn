import { useCallback, useState } from 'react';
import { Alert, Pressable, RefreshControl, ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import { router, Stack, useFocusEffect, useLocalSearchParams } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Avatar } from '@/components/avatar';
import { EmptyState, Loading } from '@/components/ui';
import { Colors, Radius } from '@/constants/theme';
import { api } from '@/lib/api';
import { authClient } from '@/lib/auth-client';
import { displayName } from '@/lib/format';
import type { Channel, CommunityDetail } from '@/lib/types';
import { usePresenceStore } from '@/store/presence';

function ChannelRow({ channel }: { channel: Channel }) {
  const voice = channel.type === 'VOICE';
  return (
    <Pressable
      onPress={() => {
        if (voice) {
          Alert.alert('Salon vocal', "Les salons vocaux arrivent bientôt sur l'application mobile.");
          return;
        }
        if (!channel.conversationId) return;
        router.push({
          pathname: '/chat/[id]',
          params: { id: channel.conversationId, title: channel.name, channel: '1' },
        });
      }}
      style={({ pressed }) => [styles.channel, pressed && { backgroundColor: Colors.hover }]}
    >
      <Ionicons name={voice ? 'volume-medium-outline' : 'chatbox-ellipses-outline'} size={20} color={voice ? Colors.faint : Colors.muted} />
      <Text style={[styles.channelName, voice && { color: Colors.faint }]} numberOfLines={1}>
        {channel.name}
      </Text>
      {voice ? <Text style={styles.soon}>bientôt</Text> : <Ionicons name="chevron-forward" size={16} color={Colors.faint} />}
    </Pressable>
  );
}

export default function CommunityScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [community, setCommunity] = useState<CommunityDetail | null>(null);
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const presence = usePresenceStore((s) => s.online);
  const { data: session } = authClient.useSession();
  const myId = session?.user?.id;
  const isOnline = (userId: string) => userId === myId || !!presence[userId];

  const load = useCallback(async () => {
    try {
      setCommunity(await api<CommunityDetail>(`/communities/${id}`));
      setError('');
    } catch (e) {
      setError((e as Error).message);
    }
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const leave = () =>
    Alert.alert('Quitter la communauté ?', community?.name, [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Quitter',
        style: 'destructive',
        onPress: async () => {
          try {
            await api(`/communities/${id}/leave`, { method: 'POST' });
            router.back();
          } catch (e) {
            Alert.alert('Oups', (e as Error).message);
          }
        },
      },
    ]);

  if (error && !community) {
    return <EmptyState icon="alert-circle-outline" title="Communauté indisponible" text={error} />;
  }
  if (!community) return <Loading />;

  const sections = [
    ...(community.channels.length ? [{ id: 'none', name: 'Salons', channels: community.channels }] : []),
    ...community.categories,
  ];
  const onlineMembers = community.members.filter((m) => isOnline(m.user.id));

  return (
    <>
      <Stack.Screen
        options={{
          title: community.name,
          headerRight: () => (
            <View style={{ flexDirection: 'row', gap: 18 }}>
              {community.inviteToken && (
                <Pressable
                  hitSlop={10}
                  onPress={() => Share.share({ message: `Rejoins « ${community.name} » sur Saturn avec ce code : ${community.inviteToken}` })}
                  accessibilityLabel="Inviter"
                >
                  <Ionicons name="person-add-outline" size={22} color={Colors.primary} />
                </Pressable>
              )}
              {community.myRole !== 'OWNER' && (
                <Pressable hitSlop={10} onPress={leave} accessibilityLabel="Quitter">
                  <Ionicons name="exit-outline" size={22} color={Colors.error} />
                </Pressable>
              )}
            </View>
          ),
        }}
      />
      <ScrollView
        contentContainerStyle={{ paddingBottom: 32 }}
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
      >
        <View style={styles.hero}>
          <Avatar name={community.name} image={community.image} size={72} />
          <Text style={styles.title}>{community.name}</Text>
          {!!community.description && <Text style={styles.description}>{community.description}</Text>}
          <Text style={styles.meta}>
            {community.members.length} membre{community.members.length > 1 ? 's' : ''} · {onlineMembers.length} en ligne
          </Text>
        </View>

        {sections.map((section) => (
          <View key={section.id} style={styles.section}>
            <Text style={styles.sectionTitle}>{section.name.toUpperCase()}</Text>
            <View style={styles.card}>
              {section.channels.length ? (
                section.channels.map((c) => <ChannelRow key={c.id} channel={c} />)
              ) : (
                <Text style={styles.emptyChannels}>Aucun salon</Text>
              )}
            </View>
          </View>
        ))}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>MEMBRES</Text>
          <View style={styles.card}>
            {community.members.slice(0, 50).map((m) => (
              <View key={m.id} style={styles.member}>
                <Avatar user={m.user} size={34} online={isOnline(m.user.id)} />
                <Text style={styles.memberName} numberOfLines={1}>
                  {displayName(m.user)}
                </Text>
                {m.role !== 'MEMBER' && <Text style={styles.role}>{m.role === 'OWNER' ? '👑' : m.role === 'ADMIN' ? 'Admin' : 'Modo'}</Text>}
              </View>
            ))}
          </View>
        </View>
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  hero: { alignItems: 'center', padding: 20, gap: 6 },
  title: { fontSize: 22, fontWeight: '800', color: Colors.text, textAlign: 'center' },
  description: { fontSize: 14, color: Colors.muted, textAlign: 'center' },
  meta: { fontSize: 13, color: Colors.faint },
  section: { paddingHorizontal: 12, marginTop: 12, gap: 6 },
  sectionTitle: { fontSize: 12, fontWeight: '700', color: Colors.faint, letterSpacing: 0.5, marginLeft: 6 },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border2,
    overflow: 'hidden',
  },
  channel: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 13 },
  channelName: { flex: 1, fontSize: 15, fontWeight: '600', color: Colors.text },
  soon: { fontSize: 11, color: Colors.faint, fontStyle: 'italic' },
  emptyChannels: { padding: 14, color: Colors.faint },
  member: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingVertical: 8 },
  memberName: { flex: 1, fontSize: 15, color: Colors.text },
  role: { fontSize: 12, color: Colors.primary, fontWeight: '700' },
});
