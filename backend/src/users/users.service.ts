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
    throw new BadRequestException('URL image invalide : /uploads/… ou http(s) uniquement');
  }
  return trimmed;
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

  updateUser(id: string, data: {
    nickname?: string;
    bio?: string;
    socialLinks?: Record<string, string>;
    avatarColor?: string;
    image?: string | null;
    chatWallpaper?: string | null;
  }) {
    // Sanitiser les champs texte
    const nickname = data.nickname?.trim().slice(0, 50) || undefined;
    const bio = data.bio?.trim().slice(0, 300) || undefined;
    const image = 'image' in data ? validateImageUrl(data.image) : undefined;
    // Fond d'écran : soit un preset (`preset:<slug>`), soit une image uploadée (`url:<https://...>`)
    let chatWallpaper: string | null | undefined = undefined;
    if ('chatWallpaper' in data) {
      const w = data.chatWallpaper;
      if (w === null || w === '') chatWallpaper = null;
      else if (/^preset:[a-z0-9-]{1,50}$/i.test(w!)) chatWallpaper = w;
      else if (w!.startsWith('url:')) chatWallpaper = `url:${validateImageUrl(w!.slice(4))}`;
      else throw new BadRequestException('Fond d\'écran invalide');
    }

    return this.prisma.user.update({
      where: { id },
      data: { ...data, nickname, bio, image, chatWallpaper },
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
