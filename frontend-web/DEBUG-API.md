# Guide de débogage API

## Problème : Erreur 404 lors de la connexion/inscription

### Vérifications à faire :

1. **Comment accédez-vous au frontend ?**
   - ✅ **Correct** : `http://localhost` (port 80, via nginx)
   - ❌ **Problème** : `http://localhost:3000` (port 3000, accès direct)

2. **Si vous accédez via le port 3000 directement :**
   - Le frontend essaie d'accéder à `/api/auth/login`
   - Mais Next.js n'a pas de route `/api`, donc 404
   - **Solution** : Accédez via `http://localhost` (port 80) au lieu de `http://localhost:3000`

3. **Vérifier les logs dans la console du navigateur (F12) :**
   - Ouvrez la console et regardez les logs
   - Vous devriez voir : `API URL configurée: /api` ou `API URL configurée: http://localhost:3001`
   - Vérifiez l'URL complète de la requête dans l'onglet Network

4. **Vérifier que le backend fonctionne :**
   ```bash
   # Tester directement le backend
   curl http://localhost:3001/health
   # Devrait retourner : {"status":"ok"}
   ```

5. **Vérifier que nginx fonctionne :**
   ```bash
   # Tester via nginx
   curl http://localhost/api/health
   # Devrait retourner : {"status":"ok"}
   ```

### Solutions selon votre cas :

#### Cas 1 : Vous accédez via `http://localhost` (port 80)
- Le frontend devrait utiliser `/api` automatiquement
- Vérifiez que nginx fonctionne : `docker-compose ps`
- Vérifiez les logs nginx : `docker-compose logs nginx`

#### Cas 2 : Vous accédez via `http://localhost:3000` (port 3000)
- Le frontend devrait détecter et utiliser `http://localhost:3001` directement
- Si ça ne fonctionne pas, vérifiez que le backend est bien démarré sur le port 3001
- **Recommandation** : Utilisez `http://localhost` (port 80) à la place

#### Cas 3 : Vous êtes dans Docker
- Assurez-vous que tous les services sont démarrés : `docker-compose ps`
- Vérifiez les logs : `docker-compose logs backend frontend-web nginx`
- Accédez via `http://localhost` (port 80) et non `http://localhost:3000`

### Configuration actuelle :

- **Docker Compose** : `NEXT_PUBLIC_API_URL: /api`
- **Nginx** : Route `/api/*` vers `backend:3000`
- **Backend** : Routes `/auth/login` et `/auth/signup` disponibles

### Test rapide :

1. Ouvrez la console du navigateur (F12)
2. Allez sur la page login ou signup
3. Regardez les logs dans la console
4. Essayez de vous connecter
5. Regardez l'onglet Network pour voir l'URL exacte de la requête
