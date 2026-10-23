import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';

/** Route accessible sans session (santé, page d'accueil de l'API…). */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
