import { canSeeMessage, visibleTo } from './messages.service';

describe('visibilité des chuchotements', () => {
  const whisper = { isWhisper: true, senderId: 'alice', whisperTo: ['bob'] };

  it("n'est visible que par l'auteur et les destinataires", () => {
    expect(canSeeMessage(whisper, 'alice')).toBe(true);
    expect(canSeeMessage(whisper, 'bob')).toBe(true);
    expect(canSeeMessage(whisper, 'eve')).toBe(false);
  });

  it('un message normal est visible par tous les participants', () => {
    expect(
      canSeeMessage(
        { isWhisper: false, senderId: 'alice', whisperTo: [] },
        'eve',
      ),
    ).toBe(true);
  });

  it('le filtre Prisma exclut les chuchotements des autres', () => {
    expect(visibleTo('eve')).toEqual({
      OR: [
        { isWhisper: false },
        { senderId: 'eve' },
        { whisperTo: { has: 'eve' } },
      ],
    });
  });
});
