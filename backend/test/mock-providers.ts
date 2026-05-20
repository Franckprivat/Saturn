import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../src/prisma/prisma.service';

export const mockPrismaProvider = {
  provide: PrismaService,
  useValue: {},
};

export const mockJwtProvider = {
  provide: JwtService,
  useValue: {
    sign: jest.fn(),
    verify: jest.fn(),
  },
};
