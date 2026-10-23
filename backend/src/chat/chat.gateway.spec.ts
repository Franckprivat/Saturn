import { Test, TestingModule } from '@nestjs/testing';
import { ChatGateway } from './chat.gateway';
import { MessagesService } from '../messages/messages.service';
import { PushService } from '../push/push.service';
import { mockPrismaProvider } from '../../test/mock-providers';

describe('ChatGateway', () => {
  let gateway: ChatGateway;
  const push = { sendToUsers: jest.fn().mockResolvedValue(undefined) };

  beforeEach(async () => {
    push.sendToUsers.mockClear();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ChatGateway,
        mockPrismaProvider,
        { provide: MessagesService, useValue: {} },
        { provide: PushService, useValue: push },
      ],
    }).compile();

    gateway = module.get<ChatGateway>(ChatGateway);
  });

  it('should be defined', () => {
    expect(gateway).toBeDefined();
  });

  it('notify : cloche pour les connectés, push pour les autres', async () => {
    const emit = jest.fn();
    const except = jest.fn(() => ({ emit }));
    const to = jest.fn(() => ({ emit, except }));
    // Seule « alice » a un socket connecté
    const fetchSockets = jest
      .fn()
      .mockResolvedValue([{ data: { user: { id: 'alice' } } }]);
    gateway.server = {
      to,
      in: jest.fn(() => ({ fetchSockets })),
    } as unknown as ChatGateway['server'];

    await gateway.notify(
      ['alice', 'bob'],
      { type: 'message', title: 'Carl', body: 'salut', href: '/chat' },
      { except: 'conv-1', tag: 'conv-1' },
    );

    expect(to).toHaveBeenCalledWith(['user:alice', 'user:bob']);
    expect(except).toHaveBeenCalledWith('conv-1');
    expect(emit).toHaveBeenCalledWith(
      'notification',
      expect.objectContaining({ title: 'Carl', body: 'salut' }),
    );
    expect(push.sendToUsers).toHaveBeenCalledWith(['bob'], {
      title: 'Carl',
      body: 'salut',
      href: '/chat',
      image: undefined,
      tag: 'conv-1',
    });
  });
});
