import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Colors, Radius } from '@/constants/theme';
import type { ChatMessage } from '@/lib/types';

export const QUICK_REACTIONS = ['👍', '❤️', '😂', '😮', '😢', '🙏'];

type Action = 'reply' | 'copy' | 'edit' | 'delete';

interface Props {
  message: ChatMessage | null;
  myId?: string;
  mine: boolean;
  onClose: () => void;
  onReact: (emoji: string) => void;
  onAction: (action: Action) => void;
}

/** Menu d'un message (appui long) : réactions rapides puis actions. */
export function MessageActions({ message, myId, mine, onClose, onReact, onAction }: Props) {
  const insets = useSafeAreaInsets();
  const items: { action: Action; label: string; icon: keyof typeof Ionicons.glyphMap; danger?: boolean }[] = [
    { action: 'reply', label: 'Répondre', icon: 'arrow-undo-outline' },
  ];
  if (message?.content) items.push({ action: 'copy', label: 'Copier le texte', icon: 'copy-outline' });
  if (mine && message?.content) items.push({ action: 'edit', label: 'Modifier', icon: 'create-outline' });
  if (mine) items.push({ action: 'delete', label: 'Supprimer', icon: 'trash-outline', danger: true });

  return (
    <Modal visible={!!message} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={[styles.sheet, { paddingBottom: insets.bottom + 12 }]} onPress={() => {}}>
          <View style={styles.reactions}>
            {QUICK_REACTIONS.map((e) => {
              const reacted = message?.reactions?.some((r) => r.emoji === e && r.userId === myId);
              return (
                <Pressable key={e} onPress={() => onReact(e)} style={[styles.emoji, reacted && styles.emojiActive]}>
                  <Text style={{ fontSize: 26 }}>{e}</Text>
                </Pressable>
              );
            })}
          </View>
          {items.map((it) => (
            <Pressable
              key={it.action}
              onPress={() => onAction(it.action)}
              style={({ pressed }) => [styles.item, pressed && { backgroundColor: Colors.hover }]}
            >
              <Ionicons name={it.icon} size={21} color={it.danger ? Colors.error : Colors.text} />
              <Text style={[styles.itemText, it.danger && { color: Colors.error }]}>{it.label}</Text>
            </Pressable>
          ))}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
    paddingTop: 16,
    paddingHorizontal: 12,
  },
  reactions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    backgroundColor: Colors.sidebar,
    borderRadius: Radius.xl,
    paddingVertical: 8,
    marginBottom: 8,
  },
  emoji: { padding: 6, borderRadius: 20 },
  emojiActive: { backgroundColor: Colors.primarySoft },
  item: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 14, paddingHorizontal: 12, borderRadius: Radius.md },
  itemText: { fontSize: 16, color: Colors.text },
});
