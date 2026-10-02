import { PrismaService } from '../src/prisma/prisma.service';

export const mockPrismaProvider = {
  provide: PrismaService,
  useValue: {},
};
