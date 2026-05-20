import { Test, TestingModule } from '@nestjs/testing';
import { ChatGateway } from './chat.gateway';
import { MessagesService } from '../messages/messages.service';
import { mockJwtProvider, mockPrismaProvider } from '../../test/mock-providers';

describe('ChatGateway', () => {
  let gateway: ChatGateway;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ChatGateway,
        mockJwtProvider,
        mockPrismaProvider,
        { provide: MessagesService, useValue: {} },
      ],
    }).compile();

    gateway = module.get<ChatGateway>(ChatGateway);
  });

  it('should be defined', () => {
    expect(gateway).toBeDefined();
  });
});
