import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

function validateImageUrl(url: string | null | undefined): string | null {
  if (url === null || url === undefined || url === '') return null;
  if (url.length > 2048) throw new BadRequestException('URL image trop longue');
  const trimmed = url.trim();
  // Interdit : javascript:, data:, vbscript:, file:
  if (/^(javascript|data|vbscript|file):/i.test(trimmed)) {
    throw new BadRequestException('URL image invalide');
  }
  // Accepté : upload interne (relatif) ou URL http(s) absolue (DiceBear, R2…)
  if (/^\/uploads\/[\w.\-]+$/.test(trimmed)) return trimmed;
  if (!/^https?:\/\//i.test(trimmed)) {
    throw new BadRequestException(
      'URL image invalide : /uploads/… ou http(s) uniquement',
    );
  }
  return trimmed;
}

/** Liens sociaux : quelques entrées, en http(s) uniquement (sinon `javascript:` cliquable). */
function validateSocialLinks(links: unknown): Record<string, string> {
  if (!links || typeof links !== 'object' || Array.isArray(links)) {
    throw new BadRequestException('Liens sociaux invalides');
  }
  const entries = Object.entries(links as Record<string, unknown>);
  if (entries.length > 10)
    throw new BadRequestException('10 liens sociaux maximum');
  const clean: Record<string, string> = {};
  for (const [key, value] of entries) {
    if (!/^[a-z0-9_-]{1,30}$/i.test(key))
      throw new BadRequestException('Lien social invalide');
    const url = typeof value === 'string' ? value.trim() : '';
    if (!url) continue;
    if (url.length > 300 || !/^https?:\/\//i.test(url)) {
      throw new BadRequestException(
        'Les liens sociaux doivent commencer par http(s)://',
      );
    }
    clean[key] = url;
  }
  return clean;
}

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  findById(id: string) {
    return this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        name: true,
        nickname: true,
        firstName: true,
        lastName: true,
        bio: true,
        socialLinks: true,
        avatarColor: true,
        image: true,
        chatWallpaper: true,
        createdAt: true,
      },
    });
  }

  /** Profil public d'un utilisateur (vu par les autres — pas d'email ni de préférences). */
  findPublicById(id: string) {
    return this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        nickname: true,
        bio: true,
        socialLinks: true,
        avatarColor: true,
        image: true,
        lastSeenAt: true,
        createdAt: true,
      },
    });
  }

  async updateUser(
    id: string,
    data: {
      nickname?: string;
      bio?: string;
      socialLinks?: Record<string, string>;
      avatarColor?: string;
      image?: string | null;
      chatWallpaper?: string | null;
    },
  ) {
    // Liste blanche explicite : le corps de la requête n'est jamais passé tel quel
    // à Prisma (sinon email, emailVerified, id… seraient modifiables).
    const update: {
      nickname?: string;
      bio?: string;
      socialLinks?: Record<string, string>;
      avatarColor?: string | null;
      image?: string | null;
      chatWallpaper?: string | null;
    } = {};
    if (typeof data.nickname === 'string' && data.nickname.trim()) {
      update.nickname = data.nickname.trim().slice(0, 50);
    }
    if (typeof data.bio === 'string')
      update.bio = data.bio.trim().slice(0, 300);
    if ('socialLinks' in data)
      update.socialLinks = validateSocialLinks(data.socialLinks);
    if ('avatarColor' in data) {
      const color = data.avatarColor;
      if (color === null || color === '') update.avatarColor = null;
      else if (
        typeof color === 'string' &&
        /^[\w\s#\[\]\/:.-]{1,100}$/.test(color)
      )
        update.avatarColor = color;
      else throw new BadRequestException("Couleur d'avatar invalide");
    }
    if ('image' in data) update.image = validateImageUrl(data.image);
    // Fond d'écran : soit un preset (`preset:<slug>`), soit une image uploadée (`url:<https://...>`)
    if ('chatWallpaper' in data) {
      const w = data.chatWallpaper;
      if (w === null || w === '') update.chatWallpaper = null;
      else if (typeof w === 'string' && /^preset:[a-z0-9-]{1,50}$/i.test(w))
        update.chatWallpaper = w;
      else if (typeof w === 'string' && w.startsWith('url:'))
        update.chatWallpaper = `url:${validateImageUrl(w.slice(4))}`;
      else throw new BadRequestException("Fond d'écran invalide");
    }

    return this.prisma.user.update({
      where: { id },
      data: update,
      select: {
        id: true,
        email: true,
        name: true,
        nickname: true,
        firstName: true,
        lastName: true,
        bio: true,
        socialLinks: true,
        avatarColor: true,
        image: true,
        chatWallpaper: true,
      },
    });
  }
}
