import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputInstance,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useHeaderHeight } from 'expo-router/react-navigation';
import * as Clipboard from 'expo-clipboard';
import * as ImagePicker from 'expo-image-picker';
import { Image } from 'expo-image';
import Ionicons from '@expo/vector-icons/Ionicons';

import { Avatar } from '@/components/avatar';
import { MessageActions } from '@/components/chat/message-actions';
import { MessageBubble } from '@/components/chat/message-bubble';
import { EmptyState } from '@/components/ui';
import { Colors, Radius } from '@/constants/theme';
import { api, uploadFile } from '@/lib/api';
import { authClient } from '@/lib/auth-client';
import {
  conversationTitle,
  displayName,
  formatDayLabel,
  formatLastSeen,
  isSameDay,
  otherParticipant,
} from '@/lib/format';
import { emitWithAck, getSocket } from '@/lib/socket';
import type { ChatMessage, ChatUser, Conversation, MessagesPage } from '@/lib/types';
import { openedChannels } from '@/hooks/use-realtime';
import { useChatStore } from '@/store/chat';
import { usePresenceStore } from '@/store/presence';

type Row = { kind: 'message'; message: ChatMessage; first: boolean } | { kind: 'day'; id: string; label: string };

const EMPTY: ChatMessage[] = [];

export default function ChatScreen() {
  const params = useLocalSearchParams<{ id: string; title?: string; channel?: string }>();
  const id = params.id;
  const isChannel = params.channel === '1';
  const { data: session } = authClient.useSession();
  const myId = session?.user?.id;
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();

  const storeConv = useChatStore((s) => s.conversations.find((c) => c.id === id));
  const [fetchedConv, setFetchedConv] = useState<Conversation | null>(null);
  const conv = storeConv ?? fetchedConv;
  const messages = useChatStore((s) => s.messages[id] ?? EMPTY);
  const pagination = useChatStore((s) => s.pagination[id]);
  const typingIds = useChatStore((s) => s.typing[id]);

  const [loading, setLoading] = useState(!useChatStore.getState().messages[id]);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState('');
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [replyTo, setReplyTo] = useState<ChatMessage | null>(null);
  const [editing, setEditing] = useState<ChatMessage | null>(null);
  const [selected, setSelected] = useState<ChatMessage | null>(null);
  const [viewer, setViewer] = useState<string | null>(null);
  const inputRef = useRef<TextInputInstance>(null);
  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isTyping = useRef(false);

  const other = conv?.type === 'DM' ? otherParticipant(conv, myId) : undefined;
  const online = usePresenceStore((s) => (other ? !!s.online[other.id] : false));
  const lastSeen = usePresenceStore((s) => (other ? s.lastSeen[other.id] : undefined));
  const title = isChannel ? `# ${params.title ?? 'salon'}` : conv ? conversationTitle(conv, myId) : (params.title ?? '');
  const showSender = conv?.type !== 'DM';

  // Utilisateurs connus (pour afficher « X écrit… »)
  const users = useMemo(() => {
    const map = new Map<string, ChatUser>();
    for (const p of conv?.participants ?? []) map.set(p.user.id, p.user);
    for (const m of messages) if (m.sender) map.set(m.sender.id, m.sender);
    return map;
  }, [conv, messages]);

  const typingLabel = useMemo(() => {
    const names = (typingIds ?? []).filter((u) => u !== myId).map((u) => displayName(users.get(u)));
    if (!names.length) return '';
    if (conv?.type === 'DM') return 'écrit…';
    return names.length === 1 ? `${names[0]} écrit…` : `${names.length} personnes écrivent…`;
  }, [typingIds, users, myId, conv?.type]);

  const subtitle = typingLabel
    ? typingLabel
    : other
      ? online
        ? 'en ligne'
        : formatLastSeen(lastSeen ?? other.lastSeenAt)
      : conv?.type === 'GROUP'
        ? `${conv.participants.length} membres`
        : isChannel
          ? 'Salon de communauté'
          : '';

  const markRead = useCallback(() => {
    getSocket()?.emit('mark_read', { conversationId: id });
  }, [id]);

  // Ouverture : conversation courante, room Socket.IO, premiers messages
  useEffect(() => {
    useChatStore.getState().setCurrent(id);
    if (isChannel) openedChannels.add(id);
    getSocket()?.emit('join_conversation', { conversationId: id });
    let cancelled = false;

    api<MessagesPage>(`/conversations/${id}/messages?limit=40`)
      .then((page) => {
        if (cancelled) return;
        useChatStore.getState().setMessages(id, page.messages, { nextCursor: page.nextCursor, hasMore: page.hasMore });
        markRead();
      })
      .catch((e: Error) => !cancelled && setError(e.message))
      .finally(() => !cancelled && setLoading(false));

    if (!isChannel && !useChatStore.getState().conversations.some((c) => c.id === id)) {
      api<Conversation>(`/conversations/${id}`)
        .then((c) => !cancelled && setFetchedConv(c))
        .catch(() => {});
    }

    return () => {
      cancelled = true;
      if (useChatStore.getState().current === id) useChatStore.getState().setCurrent(null);
      if (isChannel) openedChannels.delete(id);
      if (isTyping.current) getSocket()?.emit('typing_stop', { conversationId: id });
    };
  }, [id, isChannel, markRead]);

  // Nouveau message reçu pendant qu'on lit la conversation → lu
  const lastId = messages[messages.length - 1]?.id;
  const lastFromOther = messages[messages.length - 1]?.sender?.id !== myId;
  useEffect(() => {
    if (lastId && lastFromOther && !loading) markRead();
  }, [lastId, lastFromOther, loading, markRead]);

  const loadOlder = async () => {
    if (loadingMore || !pagination?.hasMore || !pagination.nextCursor) return;
    setLoadingMore(true);
    try {
      const page = await api<MessagesPage>(
        `/conversations/${id}/messages?limit=40&cursor=${encodeURIComponent(pagination.nextCursor)}`,
      );
      useChatStore.getState().prependMessages(id, page.messages, { nextCursor: page.nextCursor, hasMore: page.hasMore });
    } catch {
      /* on réessaiera au prochain défilement */
    } finally {
      setLoadingMore(false);
    }
  };

  // Liste inversée : du plus récent au plus ancien, avec séparateurs de jour
  const rows = useMemo<Row[]>(() => {
    const out: Row[] = [];
    for (let i = messages.length - 1; i >= 0; i--) {
      const m = messages[i];
      const prev = messages[i - 1];
      const newDay = !prev || !isSameDay(prev.createdAt, m.createdAt);
      const first =
        newDay ||
        prev.sender?.id !== m.sender?.id ||
        prev.type === 'SYSTEM' ||
        new Date(m.createdAt).getTime() - new Date(prev.createdAt).getTime() > 5 * 60 * 1000;
      out.push({ kind: 'message', message: m, first });
      if (newDay) out.push({ kind: 'day', id: `day-${m.id}`, label: formatDayLabel(m.createdAt) });
    }
    return out;
  }, [messages]);

  const onChangeText = (value: string) => {
    setText(value);
    const socket = getSocket();
    if (!socket || editing) return;
    if (!isTyping.current && value) {
      isTyping.current = true;
      socket.emit('typing_start', { conversationId: id });
    }
    if (typingTimer.current) clearTimeout(typingTimer.current);
    typingTimer.current = setTimeout(() => {
      if (isTyping.current) {
        isTyping.current = false;
        socket.emit('typing_stop', { conversationId: id });
      }
    }, 2500);
  };

  const send = async () => {
    const content = text.trim();
    if (!content || sending) return;
    setSending(true);
    try {
      if (editing) {
        await emitWithAck('edit_message', { messageId: editing.id, content });
        setEditing(null);
      } else {
        const msg = await emitWithAck<ChatMessage>('send_message', {
          conversationId: id,
          content,
          replyToId: replyTo?.id,
        });
        // Le message revient aussi par la room ; addMessage déduplique
        if (msg?.id) useChatStore.getState().addMessage(msg);
        setReplyTo(null);
      }
      setText('');
      if (isTyping.current) {
        isTyping.current = false;
        getSocket()?.emit('typing_stop', { conversationId: id });
      }
    } catch (e) {
      Alert.alert("Message non envoyé", (e as Error).message);
    } finally {
      setSending(false);
    }
  };

  const pickImage = async () => {
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.8,
      allowsEditing: false,
    });
    if (res.canceled || !res.assets[0]) return;
    const asset = res.assets[0];
    setSending(true);
    try {
      const type = asset.mimeType || 'image/jpeg';
      const uploaded = await uploadFile({
        uri: asset.uri,
        name: asset.fileName || `photo.${type.split('/')[1] || 'jpg'}`,
        type,
      });
      const msg = await emitWithAck<ChatMessage>('send_message', {
        conversationId: id,
        content: text.trim() || undefined,
        fileUrl: uploaded.url,
        fileName: uploaded.name,
        fileType: uploaded.type,
        replyToId: replyTo?.id,
      });
      if (msg?.id) useChatStore.getState().addMessage(msg);
      setText('');
      setReplyTo(null);
    } catch (e) {
      Alert.alert('Envoi impossible', (e as Error).message);
    } finally {
      setSending(false);
    }
  };

  const toggleReaction = useCallback((m: ChatMessage, emoji: string) => {
    emitWithAck('add_reaction', { messageId: m.id, emoji }).catch(() => {});
  }, []);

  const onAction = async (action: 'reply' | 'copy' | 'edit' | 'delete') => {
    const m = selected;
    setSelected(null);
    if (!m) return;
    if (action === 'reply') {
      setEditing(null);
      setReplyTo(m);
      inputRef.current?.focus();
    } else if (action === 'copy') {
      await Clipboard.setStringAsync(m.content);
    } else if (action === 'edit') {
      setReplyTo(null);
      setEditing(m);
      setText(m.content);
      inputRef.current?.focus();
    } else if (action === 'delete') {
      Alert.alert('Supprimer le message ?', 'Il sera supprimé pour tout le monde.', [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: () =>
            emitWithAck('delete_message', { messageId: m.id }).catch((e: Error) =>
              Alert.alert('Suppression impossible', e.message),
            ),
        },
      ]);
    }
  };

  const onLongPress = useCallback((m: ChatMessage) => setSelected(m), []);

  return (
    <View style={{ flex: 1, backgroundColor: Colors.bg }}>
      <Stack.Screen
        options={{
          headerTitle: () => (
            <View style={styles.headerTitle}>
              {other ? (
                <Avatar user={other} size={34} online={online} />
              ) : !isChannel && conv ? (
                <Avatar name={title} image={conv.image} size={34} />
              ) : null}
              <View style={{ flexShrink: 1 }}>
                <Text style={styles.headerName} numberOfLines={1}>
                  {title}
                </Text>
                {!!subtitle && (
                  <Text style={[styles.headerSub, (typingLabel || online) && { color: Colors.primary }]} numberOfLines={1}>
                    {subtitle}
                  </Text>
                )}
              </View>
            </View>
          ),
        }}
      />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={headerHeight}
      >
        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator color={Colors.primary} />
          </View>
        ) : error && !messages.length ? (
          <EmptyState icon="alert-circle-outline" title="Impossible de charger les messages" text={error} />
        ) : (
          <FlatList
            data={rows}
            inverted
            keyExtractor={(r) => (r.kind === 'day' ? r.id : r.message.id)}
            renderItem={({ item }) =>
              item.kind === 'day' ? (
                <View style={styles.day}>
                  <Text style={styles.dayText}>{item.label}</Text>
                </View>
              ) : (
                <MessageBubble
                  message={item.message}
                  myId={myId}
                  showSender={showSender}
                  firstOfGroup={item.first}
                  onLongPress={onLongPress}
                  onToggleReaction={toggleReaction}
                  onOpenImage={setViewer}
                />
              )
            }
            onEndReached={loadOlder}
            onEndReachedThreshold={0.3}
            ListFooterComponent={loadingMore ? <ActivityIndicator style={{ margin: 12 }} color={Colors.primary} /> : undefined}
            ListEmptyComponent={
              <View style={[styles.center, { transform: [{ scaleY: -1 }] }]}>
                <Text style={styles.emptyText}>Aucun message pour l&apos;instant. Dis bonjour 👋</Text>
              </View>
            }
            contentContainerStyle={{ paddingVertical: 8, flexGrow: 1 }}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="interactive"
          />
        )}

        {(replyTo || editing) && (
          <View style={styles.contextBar}>
            <Ionicons
              name={editing ? 'create-outline' : 'arrow-undo-outline'}
              size={18}
              color={Colors.primary}
            />
            <View style={{ flex: 1 }}>
              <Text style={styles.contextTitle}>
                {editing ? 'Modifier le message' : `Réponse à ${displayName(replyTo?.sender)}`}
              </Text>
              <Text style={styles.contextText} numberOfLines={1}>
                {(editing ?? replyTo)?.content || '📷 Photo'}
              </Text>
            </View>
            <Pressable
              hitSlop={10}
              onPress={() => {
                if (editing) setText('');
                setEditing(null);
                setReplyTo(null);
              }}
            >
              <Ionicons name="close" size={20} color={Colors.muted} />
            </Pressable>
          </View>
        )}

        <View style={[styles.composer, { paddingBottom: Math.max(insets.bottom, 8) }]}>
          {!editing && (
            <Pressable onPress={pickImage} style={styles.iconButton} disabled={sending} accessibilityLabel="Envoyer une photo">
              <Ionicons name="image-outline" size={24} color={Colors.muted} />
            </Pressable>
          )}
          <TextInput
            ref={inputRef}
            value={text}
            onChangeText={onChangeText}
            placeholder="Message"
            placeholderTextColor={Colors.faint}
            style={styles.input}
            multiline
            maxLength={4000}
          />
          <Pressable
            onPress={send}
            disabled={!text.trim() || sending}
            style={[styles.send, (!text.trim() || sending) && { opacity: 0.45 }]}
            accessibilityLabel="Envoyer"
          >
            {sending ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Ionicons name={editing ? 'checkmark' : 'send'} size={18} color="#fff" />
            )}
          </Pressable>
        </View>
      </KeyboardAvoidingView>

      <MessageActions
        message={selected}
        myId={myId}
        mine={selected?.sender?.id === myId}
        onClose={() => setSelected(null)}
        onReact={(emoji) => {
          if (selected) toggleReaction(selected, emoji);
          setSelected(null);
        }}
        onAction={onAction}
      />

      <Modal visible={!!viewer} transparent animationType="fade" onRequestClose={() => setViewer(null)}>
        <Pressable style={styles.viewer} onPress={() => setViewer(null)}>
          {viewer && <Image source={{ uri: viewer }} style={{ width: '100%', height: '80%' }} contentFit="contain" />}
          <Ionicons name="close" size={30} color="#fff" style={[styles.viewerClose, { top: insets.top + 12 }]} />
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  emptyText: { color: Colors.muted, fontSize: 15, textAlign: 'center' },
  headerTitle: { flexDirection: 'row', alignItems: 'center', gap: 10, maxWidth: 260 },
  headerName: { fontSize: 16, fontWeight: '700', color: Colors.text },
  headerSub: { fontSize: 12, color: Colors.muted },
  day: { alignItems: 'center', marginVertical: 10 },
  dayText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.muted,
    backgroundColor: Colors.surface,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 10,
    overflow: 'hidden',
  },
  contextBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: Colors.surface,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.border2,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  contextTitle: { fontSize: 13, fontWeight: '700', color: Colors.primary },
  contextText: { fontSize: 13, color: Colors.muted },
  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 6,
    paddingHorizontal: 8,
    paddingTop: 8,
    backgroundColor: Colors.surface,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.border,
  },
  iconButton: { width: 40, height: 42, alignItems: 'center', justifyContent: 'center' },
  input: {
    flex: 1,
    minHeight: 42,
    maxHeight: 120,
    backgroundColor: Colors.bg,
    borderRadius: Radius.xl,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 10,
    fontSize: 16,
    color: Colors.text,
  },
  send: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  viewer: { flex: 1, backgroundColor: 'rgba(0,0,0,0.92)', alignItems: 'center', justifyContent: 'center' },
  viewerClose: { position: 'absolute', right: 18 },
});
