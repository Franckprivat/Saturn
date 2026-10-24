# Saturn — application mobile

Application iOS / Android de Saturn, construite avec **Expo** (SDK 58, expo-router).
Elle parle au même backend NestJS que le site : authentification better-auth,
API REST et temps réel Socket.IO.

## Écrans

| Onglet | Contenu |
|---|---|
| **Discussions** | Liste des DM et groupes (aperçu, non-lus, en ligne, « écrit… »), création de groupe |
| **Chat** | Messages en temps réel, réponses, réactions, modification / suppression, photos, accusés ✓ / ✓✓, chargement de l'historique |
| **Amis** | Liste (en ligne / vu à…), demandes reçues et envoyées, recherche et ajout, retirer / bloquer |
| **Communautés** | Liste, invitations reçues, rejoindre par lien ou code, créer ; salons textuels d'une communauté et membres |
| **Profil** | Photo, pseudo, bio, déconnexion |

Pas encore sur mobile : salons vocaux (LiveKit), appels, notifications push.

## Lancer en développement

1. Démarrer le backend (voir le README à la racine) sur le port 3001.
2. Installer et lancer l'app :

   ```bash
   cd frontend-mobile
   npm install
   npm start          # puis scanner le QR code avec Expo Go
   ```

Sans configuration, l'app vise `http://<IP de ta machine>:3001`, déduite de
l'adresse du serveur Expo : le téléphone doit être sur le même réseau Wi-Fi
que l'ordinateur. Pour viser un autre serveur, crée `frontend-mobile/.env` :

```bash
# Origine du serveur : auth (/api/auth), Socket.IO, fichiers /uploads
EXPO_PUBLIC_SERVER_URL=https://saturn.example.com
# Base des routes NestJS : derrière Nginx c'est <origine>/api
EXPO_PUBLIC_API_URL=https://saturn.example.com/api
```

`npm run web` ouvre aussi l'app dans le navigateur (pratique pour développer) :
ajoute alors `http://localhost:8081` à `ALLOWED_ORIGINS` côté backend.

## Authentification

Le backend active le plugin `@better-auth/expo`. L'app stocke le cookie de
session dans le stockage sécurisé du téléphone (`expo-secure-store`) et le
renvoie elle-même à chaque requête REST et à la connexion Socket.IO.
Le schéma de l'app (`saturn://`, variable `MOBILE_APP_SCHEME` côté backend)
est une origine de confiance ; hors production, Expo Go (`exp://`) l'est aussi.

## Structure

```
app/                 écrans (expo-router)
  (tabs)/            Discussions, Amis, Communautés, Profil
  chat/[id].tsx      conversation (DM, groupe ou salon)
  community/[id].tsx salons et membres d'une communauté
  login.tsx, signup.tsx, new-group.tsx
components/          avatar, boutons, champs, bulles de message
hooks/use-realtime.ts  pont Socket.IO → stores
lib/                 config, client better-auth, API REST, socket, formats
store/               stores Zustand (discussions, présence, profil)
```

## Vérifications

```bash
npm run typecheck
npm run lint
```
