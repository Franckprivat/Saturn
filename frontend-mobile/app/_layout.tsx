import { useEffect } from 'react';
import { DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';

import { Colors } from '@/constants/theme';
import { api, setUnauthorizedHandler } from '@/lib/api';
import { authClient } from '@/lib/auth-client';
import type { Profile } from '@/lib/types';
import { useRealtime } from '@/hooks/use-realtime';
import { useSessionStore } from '@/store/session';

SplashScreen.preventAutoHideAsync().catch(() => {});

const navTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    primary: Colors.primary,
    background: Colors.bg,
    card: Colors.surface,
    text: Colors.text,
    border: Colors.border,
    notification: Colors.primary,
  },
};

/** Effets liés à la session : temps réel et profil complet. */
function SessionEffects({ userId }: { userId: string }) {
  useRealtime(userId);
  useEffect(() => {
    api<Profile>('/users/me')
      .then((p) => useSessionStore.getState().setProfile(p))
      .catch(() => {});
  }, [userId]);
  return null;
}

export default function RootLayout() {
  const { data: session, isPending } = authClient.useSession();
  const userId = session?.user?.id;

  useEffect(() => {
    if (!isPending) SplashScreen.hideAsync().catch(() => {});
  }, [isPending]);

  // 401 du backend : on relit la session ; si elle a expiré, retour au login
  useEffect(() => {
    let last = 0;
    setUnauthorizedHandler(() => {
      if (Date.now() - last < 5000) return;
      last = Date.now();
      authClient.$store.notify('$sessionSignal');
    });
    return () => setUnauthorizedHandler(null);
  }, []);

  if (isPending) return null;
  const signedIn = !!userId;

  return (
    <ThemeProvider value={navTheme}>
      <Stack
        screenOptions={{
          headerTintColor: Colors.primary,
          headerTitleStyle: { color: Colors.text, fontWeight: '700' },
          headerStyle: { backgroundColor: Colors.surface },
          headerShadowVisible: false,
          headerBackButtonDisplayMode: 'minimal',
          contentStyle: { backgroundColor: Colors.bg },
        }}
      >
        <Stack.Protected guard={signedIn}>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="chat/[id]" options={{ title: '' }} />
          <Stack.Screen name="community/[id]" options={{ title: '' }} />
          <Stack.Screen name="new-group" options={{ title: 'Nouveau groupe', presentation: 'modal' }} />
        </Stack.Protected>
        <Stack.Protected guard={!signedIn}>
          <Stack.Screen name="login" options={{ headerShown: false }} />
          <Stack.Screen name="signup" options={{ title: 'Créer un compte' }} />
        </Stack.Protected>
      </Stack>
      {userId && <SessionEffects userId={userId} />}
      <StatusBar style="dark" />
    </ThemeProvider>
  );
}
