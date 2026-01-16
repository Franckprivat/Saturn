# Documentation d'Authentification

## Configuration

Assurez-vous d'avoir une variable d'environnement `JWT_SECRET` définie. Vous pouvez créer un fichier `.env` à la racine du backend :

```
JWT_SECRET=votre_secret_jwt_tres_securise
PORT=3000
```

## Endpoints

### POST /auth/signup

Créer un nouveau compte utilisateur.

**Body:**
```json
{
  "email": "user@example.com",
  "nickname": "username",
  "password": "password123"
}
```

**Réponse (201):**
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "nickname": "username",
    "createdAt": "2024-01-01T00:00:00.000Z"
  }
}
```

### POST /auth/login

Se connecter avec un compte existant.

**Body:**
```json
{
  "email": "user@example.com",
  "password": "password123"
}
```

**Réponse (200):**
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "nickname": "username",
    "createdAt": "2024-01-01T00:00:00.000Z"
  }
}
```

## Protection des Routes

Par défaut, toutes les routes sont protégées par le JWT Guard. Pour accéder à une route protégée, vous devez inclure le token JWT dans l'en-tête de la requête :

```
Authorization: Bearer <votre_token_jwt>
```

### Routes Publiques

Pour marquer une route comme publique (accessible sans authentification), utilisez le décorateur `@Public()` :

```typescript
import { Public } from './auth/jwt/jwt.guard';

@Controller('auth')
export class AuthController {
  @Public()
  @Post('login')
  async login() {
    // Cette route est accessible sans token JWT
  }
}
```

### Routes Protégées

Par défaut, toutes les routes sont protégées. Pour récupérer l'utilisateur actuel dans une route protégée, utilisez le décorateur `@CurrentUser()` :

```typescript
import { Controller, Get } from '@nestjs/common';
import { CurrentUser } from './auth/decorators/current-user.decorator';

@Controller('users')
export class UsersController {
  @Get('me')
  getProfile(@CurrentUser() user: any) {
    // user contient les informations de l'utilisateur authentifié
    return user;
  }
}
```

## Exemple d'utilisation avec cURL

### Inscription
```bash
curl -X POST http://localhost:3000/auth/signup \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "nickname": "username",
    "password": "password123"
  }'
```

### Connexion
```bash
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "password123"
  }'
```

### Accès à une route protégée
```bash
curl -X GET http://localhost:3000/users/me \
  -H "Authorization: Bearer <votre_token_jwt>"
```

## Validation

Les DTOs utilisent `class-validator` pour valider les données :

- **email**: Doit être une adresse email valide
- **nickname**: Doit être une chaîne d'au moins 3 caractères
- **password**: Doit être une chaîne d'au moins 6 caractères

## Sécurité

- Les mots de passe sont hashés avec bcrypt (10 rounds)
- Les tokens JWT expirent après 7 jours
- Les routes sont protégées par défaut
- La validation des données est activée globalement
