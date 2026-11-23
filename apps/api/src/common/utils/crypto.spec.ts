import { randomBytes } from 'crypto';
import { decrypt, encrypt, generateOpaqueToken, safeEqual, sha256 } from './crypto';

describe('crypto utils', () => {
  const key = randomBytes(32).toString('base64');

  it('encrypts and decrypts (AES-256-GCM)', () => {
    const cipher = encrypt('JBSWY3DPEHPK3PXP', key);
    expect(cipher).not.toContain('JBSWY3DPEHPK3PXP');
    expect(decrypt(cipher, key)).toBe('JBSWY3DPEHPK3PXP');
  });

  it('uses a fresh IV for every encryption', () => {
    expect(encrypt('same', key)).not.toBe(encrypt('same', key));
  });

  it('detects tampering', () => {
    const buf = Buffer.from(encrypt('secret', key), 'base64');
    buf[buf.length - 1] ^= 0xff;
    expect(() => decrypt(buf.toString('base64'), key)).toThrow();
  });

  it('rejects the wrong key', () => {
    expect(() => decrypt(encrypt('secret', key), randomBytes(32).toString('base64'))).toThrow();
  });

  it('hashes deterministically and compares safely', () => {
    expect(sha256('abc')).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
    expect(safeEqual('abc', 'abc')).toBe(true);
    expect(safeEqual('abc', 'abd')).toBe(false);
    expect(safeEqual('abc', 'abcd')).toBe(false);
  });

  it('generates URL-safe unique tokens', () => {
    const t = generateOpaqueToken();
    expect(t).toMatch(/^[A-Za-z0-9_-]{64}$/);
    expect(generateOpaqueToken()).not.toBe(t);
  });
});
