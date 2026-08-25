import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { Injectable } from '@nestjs/common';

/**
 * scrypt work factors. N=2^15 with r=8 costs ~33 MB of memory per hash, which
 * is above Node's 32 MB default `maxmem` — hence the explicit 64 MB below.
 * Omitting it makes every hash throw "Invalid scrypt params".
 */
const PARAMS = { N: 32768, r: 8, p: 1, maxmem: 64 * 1024 * 1024 } as const;
const KEY_LENGTH = 64;
const SALT_LENGTH = 16;
const ALGORITHM = 'scrypt';

const scryptAsync = promisify(scrypt) as (
  password: string,
  salt: Buffer,
  keylen: number,
  options: { N: number; r: number; p: number; maxmem: number },
) => Promise<Buffer>;

@Injectable()
export class PasswordService {
  /**
   * Returns a self-describing digest: `scrypt$N$r$p$saltB64$hashB64`.
   * The parameters travel with the hash so raising the work factor later does
   * not invalidate existing passwords.
   */
  async hash(plain: string): Promise<string> {
    const salt = randomBytes(SALT_LENGTH);
    const derived = await scryptAsync(plain.normalize('NFKC'), salt, KEY_LENGTH, PARAMS);

    return [
      ALGORITHM,
      PARAMS.N,
      PARAMS.r,
      PARAMS.p,
      salt.toString('base64'),
      derived.toString('base64'),
    ].join('$');
  }

  /** Constant-time verification. Returns false for any malformed digest. */
  async verify(plain: string, stored: string): Promise<boolean> {
    const parts = stored.split('$');

    if (parts.length !== 6 || parts[0] !== ALGORITHM) {
      return false;
    }

    const [, n, r, p, saltB64, hashB64] = parts;
    const salt = Buffer.from(saltB64, 'base64');
    const expected = Buffer.from(hashB64, 'base64');

    if (salt.length === 0 || expected.length === 0) {
      return false;
    }

    const derived = await scryptAsync(plain.normalize('NFKC'), salt, expected.length, {
      N: Number(n),
      r: Number(r),
      p: Number(p),
      maxmem: PARAMS.maxmem,
    });

    return derived.length === expected.length && timingSafeEqual(derived, expected);
  }
}
