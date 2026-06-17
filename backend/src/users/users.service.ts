import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

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
    image?: string;
  }) {
    return this.prisma.user.update({
      where: { id },
      data,
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
