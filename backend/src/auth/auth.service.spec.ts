import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { mockJwtProvider, mockPrismaProvider } from '../../test/mock-providers';

describe('AuthService', () => {
  let service: AuthService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [AuthService, mockPrismaProvider, mockJwtProvider],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
