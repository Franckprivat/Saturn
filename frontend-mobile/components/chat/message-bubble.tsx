import { memo } from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Avatar } from '@/components/avatar';
import { Colors, Radius } from '@/constants/theme';
import { displayName, formatTime } from '@/lib/format';
import { mediaUrl } from '@/lib/media';
import type { ChatMessage } from '@/lib/types';

interface Props {
  message: ChatMessage;
  myId?: string;
  /** Afficher le nom et l'avatar de l'auteur (groupes et salons) */
  showSender: boolean;
  /** Premier message d'une série du même auteur */
  firstOfGroup: boolean;
  onLongPress: (m: ChatMessage) => void;
  onToggleReaction: (m: ChatMessage, emoji: string) => void;
  onOpenImage: (url: string) => void;
}

/** ✓ envoyé · ✓✓ gris distribué · ✓✓ couleur lu */
function Ticks({ message, myId }: { message: ChatMessage; myId?: string }) {
  const read = message.readBy?.some((r) => r.userId !== myId);
  const delivered = read || message.deliveredTo?.some((r) => r.userId !== myId);
  return (
    <Ionicons
      name={delivered ? 'checkmark-done' : 'checkmark'}
      size={15}
      color={read ? '#BFE3FF' : 'rgba(255,255,255,0.75)'}
    />
  );
}

function groupReactions(message: ChatMessage, myId?: string) {
  const map = new Map<string, { count: number; mine: boolean }>();
  for (const r of message.reactions ?? []) {
    const entry = map.get(r.emoji) ?? { count: 0, mine: false };
    entry.count++;
    if (r.userId === myId) entry.mine = true;
    map.set(r.emoji, entry);
  }
  return [...map.entries()];
}

export const MessageBubble = memo(function MessageBubble({
  message: m,
  myId,
  showSender,
  firstOfGroup,
  onLongPress,
  onToggleReaction,
  onOpenImage,
}: Props) {
  if (m.type === 'SYSTEM') {
    return (
      <View style={styles.system}>
        <Text style={styles.systemText}>
          <Text style={{ fontWeight: '700' }}>{displayName(m.sender)}</Text> {m.content}
        </Text>
      </View>
    );
  }

  const mine = m.sender?.id === myId;
  const deleted = !!m.deletedAt;
  const image = !deleted && m.fileType?.startsWith('image/') ? mediaUrl(m.fileUrl) : undefined;
  const file = !deleted && m.fileUrl && !image ? mediaUrl(m.fileUrl) : undefined;
  const reactions = groupReactions(m, myId);
  const fg = mine ? Colors.white : Colors.text;
  const subtle = mine ? 'rgba(255,255,255,0.75)' : Colors.faint;

  return (
    <View style={[styles.line, mine ? styles.lineMine : styles.lineOther, firstOfGroup && { marginTop: 8 }]}>
      {showSender && !mine && (
        <View style={styles.avatarSlot}>{firstOfGroup && <Avatar user={m.sender} size={30} />}</View>
      )}
      <View style={{ maxWidth: '80%', alignItems: mine ? 'flex-end' : 'flex-start' }}>
        <Pressable
          onLongPress={() => !deleted && onLongPress(m)}
          delayLongPress={300}
          style={[
            styles.bubble,
            mine ? styles.bubbleMine : styles.bubbleOther,
            m.isWhisper && styles.whisper,
            image && !m.content && { padding: 4 },
          ]}
        >
          {showSender && !mine && firstOfGroup && <Text style={styles.sender}>{displayName(m.sender)}</Text>}
          {m.isWhisper && (
            <Text style={[styles.meta, { color: subtle, marginBottom: 2 }]}>🤫 Chuchotement</Text>
          )}
          {m.replyTo && !deleted && (
            <View style={[styles.reply, mine && { backgroundColor: 'rgba(255,255,255,0.18)', borderLeftColor: '#fff' }]}>
              <Text style={[styles.replyName, mine && { color: '#fff' }]} numberOfLines={1}>
                {displayName(m.replyTo.sender)}
              </Text>
              <Text style={[styles.replyText, { color: mine ? 'rgba(255,255,255,0.85)' : Colors.muted }]} numberOfLines={2}>
                {m.replyTo.deletedAt
                  ? 'Message supprimé'
                  : m.replyTo.content || (m.replyTo.fileType?.startsWith('image/') ? '📷 Photo' : '📎 Fichier')}
              </Text>
            </View>
          )}
          {image && (
            <Pressable onPress={() => onOpenImage(image)} onLongPress={() => onLongPress(m)}>
              <Image source={{ uri: image }} style={styles.image} contentFit="cover" transition={150} />
            </Pressable>
          )}
          {file && (
            <Pressable onPress={() => Linking.openURL(file)} style={styles.file}>
              <Ionicons
                name={m.fileType?.startsWith('audio/') ? 'mic' : 'document-attach'}
                size={22}
                color={fg}
              />
              <Text style={[styles.text, { color: fg, flexShrink: 1 }]} numberOfLines={1}>
                {m.fileType?.startsWith('audio/') ? 'Message vocal' : m.fileName || 'Fichier'}
              </Text>
            </Pressable>
          )}
          {deleted ? (
            <Text style={[styles.text, styles.deleted, { color: subtle }]}>Message supprimé</Text>
          ) : m.content ? (
            <Text style={[styles.text, { color: fg }, image && { paddingHorizontal: 6, paddingTop: 4 }]}>{m.content}</Text>
          ) : null}
          <View style={[styles.footer, image && !m.content && styles.footerOnImage]}>
            {m.editedAt && !deleted && <Text style={[styles.meta, { color: subtle }]}>modifié</Text>}
            <Text style={[styles.meta, { color: image && !m.content ? '#fff' : subtle }]}>{formatTime(m.createdAt)}</Text>
            {mine && !deleted && <Ticks message={m} myId={myId} />}
          </View>
        </Pressable>
        {reactions.length > 0 && (
          <View style={styles.reactions}>
            {reactions.map(([emoji, { count, mine: reacted }]) => (
              <Pressable
                key={emoji}
                onPress={() => onToggleReaction(m, emoji)}
                style={[styles.reaction, reacted && styles.reactionMine]}
              >
                <Text style={{ fontSize: 13 }}>{emoji}</Text>
                {count > 1 && <Text style={styles.reactionCount}>{count}</Text>}
              </Pressable>
            ))}
          </View>
        )}
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  line: { flexDirection: 'row', paddingHorizontal: 10, marginTop: 2, alignItems: 'flex-end' },
  lineMine: { justifyContent: 'flex-end' },
  lineOther: { justifyContent: 'flex-start' },
  avatarSlot: { width: 30, marginRight: 6 },
  bubble: { borderRadius: Radius.lg, paddingHorizontal: 12, paddingVertical: 7 },
  bubbleMine: { backgroundColor: Colors.bubbleMine, borderBottomRightRadius: 4 },
  bubbleOther: {
    backgroundColor: Colors.bubbleOther,
    borderBottomLeftRadius: 4,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border2,
  },
  whisper: { borderStyle: 'dashed', borderWidth: 1, borderColor: Colors.secondary },
  sender: { fontSize: 13, fontWeight: '700', color: Colors.primary, marginBottom: 2 },
  text: { fontSize: 16, lineHeight: 21 },
  deleted: { fontStyle: 'italic' },
  footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 4, marginTop: 2 },
  footerOnImage: {
    position: 'absolute',
    right: 10,
    bottom: 8,
    backgroundColor: 'rgba(0,0,0,0.35)',
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  meta: { fontSize: 11 },
  reply: {
    borderLeftWidth: 3,
    borderLeftColor: Colors.primary,
    backgroundColor: Colors.primarySoft,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginBottom: 4,
  },
  replyName: { fontSize: 12, fontWeight: '700', color: Colors.primary },
  replyText: { fontSize: 13 },
  image: { width: 230, height: 230, borderRadius: Radius.md, backgroundColor: Colors.active },
  file: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 4 },
  reactions: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: -4, paddingHorizontal: 6 },
  reaction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: Colors.surface,
    borderRadius: 12,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: Colors.border2,
  },
  reactionMine: { borderColor: Colors.primary, backgroundColor: Colors.primarySoft },
  reactionCount: { fontSize: 12, color: Colors.muted, fontWeight: '600' },
  system: { alignItems: 'center', marginVertical: 8, paddingHorizontal: 24 },
  systemText: {
    fontSize: 12,
    color: Colors.muted,
    backgroundColor: Colors.sidebar,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
    overflow: 'hidden',
    textAlign: 'center',
  },
});
