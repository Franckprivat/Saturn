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

describe('UsersService.updateUser', () => {
  const update = jest.fn().mockResolvedValue({});
  const service = new UsersService({ user: { update } } as any);

  beforeEach(() => update.mockClear());

  it('ignore les champs hors liste blanche (email, emailVerified, id…)', async () => {
    await service.updateUser('u1', {
      nickname: '  Franck  ',
      email: 'pirate@example.com',
      emailVerified: true,
      id: 'autre',
    } as any);
    expect(update.mock.calls[0][0].data).toEqual({ nickname: 'Franck' });
  });

  it("refuse un lien social qui n'est pas en http(s)", async () => {
    await expect(
      service.updateUser('u1', {
        socialLinks: { github: 'javascript:alert(1)' },
      }),
    ).rejects.toThrow();
    expect(update).not.toHaveBeenCalled();
  });
});
