import { Test, TestingModule } from '@nestjs/testing';
import { MessagesService } from './messages.service';
import { mockPrismaProvider } from '../../test/mock-providers';

describe('MessagesService', () => {
  let service: MessagesService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [MessagesService, mockPrismaProvider],
    }).compile();

    service = module.get<MessagesService>(MessagesService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
