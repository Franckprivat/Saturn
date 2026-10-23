import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { avatarColors, mediaUrl } from '@/lib/media';
import { Colors } from '@/constants/theme';

interface Props {
  user?: { nickname?: string | null; email?: string | null; image?: string | null; avatarColor?: string | null } | null;
  /** Nom de repli (groupe, communauté) quand il n'y a pas d'utilisateur */
  name?: string | null;
  image?: string | null;
  size?: number;
  online?: boolean;
}

/** Avatar : image si disponible, sinon initiale sur fond coloré (comme le site). */
export function Avatar({ user, name, image, size = 44, online }: Props) {
  const [failed, setFailed] = useState(false);
  const label = user?.nickname || user?.email || name || '?';
  const initial = label.trim().charAt(0).toUpperCase() || '?';
  const src = !failed ? mediaUrl(image ?? user?.image) : undefined;
  const [c1] = avatarColors(user?.avatarColor);
  const dot = Math.max(10, Math.round(size * 0.28));

  return (
    <View style={{ width: size, height: size }}>
      <View
        style={[
          styles.circle,
          { width: size, height: size, borderRadius: size / 2, backgroundColor: user ? c1 : Colors.secondary },
        ]}
      >
        {src ? (
          <Image
            source={{ uri: src }}
            style={{ width: size, height: size }}
            contentFit="cover"
            transition={150}
            onError={() => setFailed(true)}
          />
        ) : (
          <Text style={[styles.initial, { fontSize: size * 0.4 }]}>{initial}</Text>
        )}
      </View>
      {online !== undefined && (
        <View
          style={[
            styles.dot,
            {
              width: dot,
              height: dot,
              borderRadius: dot / 2,
              backgroundColor: online ? Colors.online : Colors.offline,
            },
          ]}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  circle: { alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  initial: { color: '#fff', fontWeight: '700' },
  dot: { position: 'absolute', right: 0, bottom: 0, borderWidth: 2, borderColor: Colors.surface },
});
