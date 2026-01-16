import { Controller, Get } from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@Controller('users')
export class UsersController {
  // Exemple de route protégée - nécessite un token JWT valide
  @Get('me')
  getProfile(@CurrentUser() user: any) {
    return user;
  }
}
