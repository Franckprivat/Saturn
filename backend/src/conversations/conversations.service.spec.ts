import { Test, TestingModule } from '@nestjs/testing';
import { ConversationsService } from './conversations.service';
import { FriendsService } from '../friends/friends.service';
import { mockPrismaProvider } from '../../test/mock-providers';

describe('ConversationsService', () => {
  let service: ConversationsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ConversationsService,
        mockPrismaProvider,
        { provide: FriendsService, useValue: {} },
      ],
    }).compile();

    service = module.get<ConversationsService>(ConversationsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
