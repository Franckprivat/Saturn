import { useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View, type TextInputInstance } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { Link } from 'expo-router';
import { Colors } from '@/constants/theme';
import { Button, ErrorText, TextField } from '@/components/ui';
import { authClient } from '@/lib/auth-client';
import { api } from '@/lib/api';
import { SERVER_URL } from '@/lib/config';

type DemoInfo = { enabled: boolean; email?: string; password?: string };

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState<'form' | 'demo' | null>(null);
  const [error, setError] = useState('');
  const [demo, setDemo] = useState<DemoInfo | null>(null);
  const passwordRef = useRef<TextInputInstance>(null);

  useEffect(() => {
    api<DemoInfo>('/demo')
      .then(setDemo)
      .catch(() => {});
  }, []);

  const signIn = async (creds: { email: string; password: string }, kind: 'form' | 'demo') => {
    setError('');
    if (!creds.email.trim() || !creds.password) {
      setError('Renseigne ton e-mail et ton mot de passe.');
      return;
    }
    setLoading(kind);
    try {
      const { error: authError } = await authClient.signIn.email({
        email: creds.email.trim(),
        password: creds.password,
      });
      // Succès : la session change et la navigation bascule vers l'app
      if (authError) setError(authError.message || 'E-mail ou mot de passe incorrect.');
    } catch {
      setError('Serveur injoignable. Vérifie ta connexion.');
    } finally {
      setLoading(null);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
          <View style={styles.brand}>
            <View style={styles.logoWrap}>
              <Image source={require('@/assets/images/logo.png')} style={styles.logo} tintColor={Colors.white} />
            </View>
            <Text style={styles.title}>Saturn</Text>
            <Text style={styles.subtitle}>Content de te revoir 👋</Text>
          </View>

          <View style={styles.form}>
            <TextField
              label="E-mail"
              value={email}
              onChangeText={setEmail}
              placeholder="toi@exemple.com"
              autoCapitalize="none"
              autoComplete="email"
              keyboardType="email-address"
              textContentType="emailAddress"
              returnKeyType="next"
              onSubmitEditing={() => passwordRef.current?.focus()}
            />
            <TextField
              ref={passwordRef}
              label="Mot de passe"
              value={password}
              onChangeText={setPassword}
              placeholder="••••••••"
              secureTextEntry
              autoComplete="password"
              textContentType="password"
              returnKeyType="go"
              onSubmitEditing={() => signIn({ email, password }, 'form')}
            />
            <ErrorText>{error}</ErrorText>
            <Button title="Se connecter" loading={loading === 'form'} onPress={() => signIn({ email, password }, 'form')} />

            {demo?.enabled && demo.email && demo.password && (
              <View style={{ gap: 6 }}>
                <Button
                  title="Essayer le compte démo"
                  variant="secondary"
                  loading={loading === 'demo'}
                  onPress={() => signIn({ email: demo.email!, password: demo.password! }, 'demo')}
                />
                <Text style={styles.hint}>Sans inscription · {demo.email}</Text>
              </View>
            )}
          </View>

          <Text style={styles.footer}>
            Pas encore de compte ?{' '}
            <Link href="/signup" style={styles.link}>
              Créer un compte
            </Link>
          </Text>
          <Text style={styles.server}>{SERVER_URL}</Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bg },
  container: { flexGrow: 1, justifyContent: 'center', padding: 24, gap: 28 },
  brand: { alignItems: 'center', gap: 8 },
  logoWrap: {
    width: 84,
    height: 84,
    borderRadius: 24,
    backgroundColor: Colors.text,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  logo: { width: 84, height: 84 },
  title: { fontSize: 32, fontWeight: '800', color: Colors.text, letterSpacing: -0.5 },
  subtitle: { fontSize: 16, color: Colors.muted },
  form: { gap: 14 },
  hint: { textAlign: 'center', fontSize: 12, color: Colors.faint },
  footer: { textAlign: 'center', color: Colors.muted, fontSize: 15 },
  link: { color: Colors.primary, fontWeight: '700' },
  server: { textAlign: 'center', color: Colors.faint, fontSize: 11 },
});
