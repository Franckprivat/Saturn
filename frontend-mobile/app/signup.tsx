import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Colors } from '@/constants/theme';
import { Button, EmptyState, ErrorText, TextField } from '@/components/ui';
import { authClient } from '@/lib/auth-client';

export default function SignupScreen() {
  const [nickname, setNickname] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [checkEmail, setCheckEmail] = useState(false);

  const submit = async () => {
    setError('');
    if (!nickname.trim() || !email.trim() || !password) {
      setError('Tous les champs sont obligatoires.');
      return;
    }
    if (password.length < 8) {
      setError('Le mot de passe doit faire au moins 8 caractères.');
      return;
    }
    if (password !== confirm) {
      setError('Les mots de passe ne correspondent pas.');
      return;
    }
    setLoading(true);
    try {
      const { data, error: authError } = await authClient.signUp.email({
        email: email.trim(),
        password,
        name: nickname.trim(),
        nickname: nickname.trim(),
      });
      if (authError) {
        setError(authError.message || "Erreur lors de l'inscription.");
        return;
      }
      // Vérification d'e-mail activée côté serveur : pas de session tout de suite
      if (!data?.token) setCheckEmail(true);
    } catch {
      setError('Serveur injoignable. Vérifie ta connexion.');
    } finally {
      setLoading(false);
    }
  };

  if (checkEmail) {
    return (
      <EmptyState
        icon="mail-unread-outline"
        title="Vérifie ta boîte mail"
        text={`Un lien de confirmation a été envoyé à ${email.trim()}. Clique dessus puis reviens te connecter.`}
        action={<Button title="Retour à la connexion" onPress={() => router.back()} style={{ marginTop: 12 }} />}
      />
    );
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <Ionicons name="planet-outline" size={36} color={Colors.primary} />
          <Text style={styles.title}>Rejoins Saturn</Text>
          <Text style={styles.subtitle}>Discute avec tes amis et tes communautés.</Text>
        </View>
        <TextField label="Pseudo" value={nickname} onChangeText={setNickname} placeholder="Ton pseudo" maxLength={50} />
        <TextField
          label="E-mail"
          value={email}
          onChangeText={setEmail}
          placeholder="toi@exemple.com"
          autoCapitalize="none"
          autoComplete="email"
          keyboardType="email-address"
        />
        <TextField
          label="Mot de passe"
          value={password}
          onChangeText={setPassword}
          placeholder="8 caractères minimum"
          secureTextEntry
          autoComplete="new-password"
          textContentType="newPassword"
        />
        <TextField
          label="Confirmer le mot de passe"
          value={confirm}
          onChangeText={setConfirm}
          placeholder="••••••••"
          secureTextEntry
          onSubmitEditing={submit}
        />
        <ErrorText>{error}</ErrorText>
        <Button title="Créer mon compte" loading={loading} onPress={submit} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 24, gap: 14 },
  header: { alignItems: 'center', gap: 6, marginBottom: 10 },
  title: { fontSize: 24, fontWeight: '800', color: Colors.text },
  subtitle: { fontSize: 15, color: Colors.muted, textAlign: 'center' },
});
