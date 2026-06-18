import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

function validateImageUrl(url: string | null | undefined): string | null {
  if (url === null || url === undefined || url === '') return null;
  if (url.length > 2048) throw new BadRequestException('URL image trop longue');
  // Interdit : javascript:, data:, vbscript:, file:
  if (/^(javascript|data|vbscript|file):/i.test(url.trim())) {
    throw new BadRequestException('URL image invalide');
  }
  // Doit commencer par http:// ou https://
  if (!/^https?:\/\//i.test(url.trim())) {
    throw new BadRequestException('URL image invalide : seuls http et https sont acceptés');
  }
  return url.trim();
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
  }) {
    // Sanitiser les champs texte
    const nickname = data.nickname?.trim().slice(0, 50) || undefined;
    const bio = data.bio?.trim().slice(0, 300) || undefined;
    const image = 'image' in data ? validateImageUrl(data.image) : undefined;

    return this.prisma.user.update({
      where: { id },
      data: { ...data, nickname, bio, image },
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
      },
    });
  }
}
