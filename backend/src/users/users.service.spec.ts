import { Test, TestingModule } from '@nestjs/testing';
import { UsersService } from './users.service';
import { mockPrismaProvider } from '../../test/mock-providers';

describe('UsersService', () => {
  let service: UsersService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [UsersService, mockPrismaProvider],
    }).compile();

    service = module.get<UsersService>(UsersService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
