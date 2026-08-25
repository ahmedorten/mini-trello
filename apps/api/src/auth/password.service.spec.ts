import { Test, TestingModule } from '@nestjs/testing';
import { PasswordService } from './password.service';

describe('PasswordService', () => {
  let service: PasswordService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [PasswordService],
    }).compile();

    service = module.get<PasswordService>(PasswordService);
  });

  describe('hash', () => {
    it('returns a scrypt digest with exactly 6 $-separated segments', async () => {
      const digest = await service.hash('correct horse battery staple');
      const segments = digest.split('$');

      expect(segments).toHaveLength(6);
      expect(segments[0]).toBe('scrypt');
    });

    it('returns different digests for the same input (random salt)', async () => {
      const a = await service.hash('same-password');
      const b = await service.hash('same-password');

      expect(a).not.toBe(b);
    });

    it('resolves without throwing for a 12-character password (maxmem regression)', async () => {
      await expect(service.hash('twelvechars!')).resolves.toEqual(expect.any(String));
    });
  });

  describe('verify', () => {
    it('returns true for a matching password', async () => {
      const digest = await service.hash('correct horse battery staple');

      await expect(service.verify('correct horse battery staple', digest)).resolves.toBe(true);
    });

    it('returns false for a wrong password', async () => {
      const digest = await service.hash('correct horse battery staple');

      await expect(service.verify('wrong password', digest)).resolves.toBe(false);
    });

    it('returns true for a 200-character password with no truncation', async () => {
      const longPassword = 'a'.repeat(200);
      const digest = await service.hash(longPassword);

      await expect(service.verify(longPassword, digest)).resolves.toBe(true);
    });

    it('returns true for a unicode password', async () => {
      const password = 'كلمة السر ١٢٣';
      const digest = await service.hash(password);

      await expect(service.verify(password, digest)).resolves.toBe(true);
    });

    it('returns true when the password is supplied in NFD vs NFC form', async () => {
      const nfc = 'café'.normalize('NFC');
      const nfd = 'café'.normalize('NFD');
      const digest = await service.hash(nfc);

      await expect(service.verify(nfd, digest)).resolves.toBe(true);
    });

    it.each([
      ['empty string', ''],
      ['garbage', 'garbage'],
      ['too few segments', 'scrypt$1$2$3'],
      ['bcrypt-shaped digest', '$2b$12$abcdefghijklmnopqrstuv'],
    ])('returns false, and does not reject, for %s', async (_label, stored) => {
      await expect(service.verify('anything', stored)).resolves.toBe(false);
    });

    it('returns false for a digest whose hash segment is truncated by one character', async () => {
      const digest = await service.hash('correct horse battery staple');
      const parts = digest.split('$');
      const hashB64 = parts[5];
      // Drop a character from the middle, not the tail: the tail may be
      // base64 '=' padding, whose removal still decodes to the same bytes.
      const mid = Math.floor(hashB64.length / 2);
      parts[5] = hashB64.slice(0, mid) + hashB64.slice(mid + 1);
      const truncated = parts.join('$');

      await expect(service.verify('correct horse battery staple', truncated)).resolves.toBe(false);
    });
  });
});
