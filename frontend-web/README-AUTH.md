# Configuration de l'authentification

## Configuration

Par défaut, le frontend se connecte au backend sur `http://localhost:3000`.

Pour changer l'URL de l'API, créez un fichier `.env.local` à la racine du projet `frontend-web` :

```
NEXT_PUBLIC_API_URL=http://localhost:3000
```

## Pages disponibles

- `/` - Page principale pour tester l'authentification
- `/login` - Page de connexion
- `/signup` - Page d'inscription

## Utilisation

1. Démarrer le backend :
   ```bash
   cd backend
   npm run start:dev
   ```

2. Démarrer le frontend :
   ```bash
   cd frontend-web
   npm run dev
   ```

3. Tester :
   - Aller sur `http://localhost:3001` (ou le port configuré pour Next.js)
   - Cliquer sur "Signup" pour créer un compte
   - Ou cliquer sur "Login" pour se connecter
   - Une fois connecté, vous pouvez tester la route protégée `/users/me`

## Fonctionnalités

- ✅ Inscription (signup) avec validation
- ✅ Connexion (login) avec validation
- ✅ Stockage du token JWT dans localStorage
- ✅ Protection automatique des routes API
- ✅ Déconnexion
- ✅ Test de route protégée depuis la page principale

## Structure

- `lib/api.ts` - Configuration axios et appels API
- `store/authStore.ts` - Store zustand pour gérer l'état d'authentification
- `components/AuthProvider.tsx` - Provider pour initialiser l'auth au démarrage
- `app/login/page.tsx` - Page de connexion
- `app/signup/page.tsx` - Page d'inscription
- `app/page.tsx` - Page principale de test
