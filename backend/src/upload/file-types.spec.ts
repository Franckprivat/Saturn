import {
  ALLOWED_TYPES,
  baseMime,
  isInlineMedia,
  matchesSignature,
} from './file-types';

describe('file-types', () => {
  it('refuse le HTML, même annoncé comme texte', () => {
    expect(ALLOWED_TYPES['text/html']).toBeUndefined();
    expect(
      matchesSignature(
        'text/plain',
        Buffer.from('<html><script>alert(1)</script>'),
      ),
    ).toBe(false);
    expect(
      matchesSignature('text/plain', Buffer.from('  <svg onload=alert(1)>')),
    ).toBe(false);
  });

  it('refuse un fichier dont le contenu ne correspond pas au type annoncé', () => {
    expect(matchesSignature('image/png', Buffer.from('<html></html>'))).toBe(
      false,
    );
    expect(matchesSignature('application/pdf', Buffer.from('GIF89a'))).toBe(
      false,
    );
  });

  it('accepte les signatures réelles', () => {
    expect(
      matchesSignature(
        'image/png',
        Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0]),
      ),
    ).toBe(true);
    expect(
      matchesSignature('image/jpeg', Buffer.from([0xff, 0xd8, 0xff, 0xe0])),
    ).toBe(true);
    expect(
      matchesSignature('image/webp', Buffer.from('RIFF\0\0\0\0WEBPVP8 ')),
    ).toBe(true);
    expect(
      matchesSignature(
        'audio/webm;codecs=opus',
        Buffer.from([0x1a, 0x45, 0xdf, 0xa3, 1]),
      ),
    ).toBe(true);
    expect(matchesSignature('application/pdf', Buffer.from('%PDF-1.7'))).toBe(
      true,
    );
    expect(
      matchesSignature('text/plain', Buffer.from('Bonjour tout le monde')),
    ).toBe(true);
  });

  it('normalise le type MIME et ne sert en ligne que les médias', () => {
    expect(baseMime('Audio/WebM; codecs=opus')).toBe('audio/webm');
    expect(isInlineMedia('.png')).toBe(true);
    expect(isInlineMedia('.pdf')).toBe(false);
    expect(isInlineMedia('.html')).toBe(false);
  });
});
