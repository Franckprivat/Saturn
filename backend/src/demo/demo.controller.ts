import { Controller, Get } from '@nestjs/common';
import { getDemoConfig } from './demo.config';

@Controller('demo')
export class DemoController {
  // Public : le front affiche le bouton « Essayer la démo » seulement si actif.
  // Les identifiants sont publics par nature (compte partagé).
  @Get()
  status() {
    const { enabled, email, password } = getDemoConfig();
    return enabled ? { enabled, email, password } : { enabled };
  }
}
