import { base32Decode, base32Encode, generateTotpSecret, verifyTotp } from './totp';

// RFC 6238 Appendix B: ASCII secret "12345678901234567890", SHA-1.
const RFC_SECRET = base32Encode(Buffer.from('12345678901234567890'));

describe('TOTP (RFC 6238)', () => {
  it('encodes the RFC secret to the expected base32', () => {
    expect(RFC_SECRET).toBe('GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ');
  });

  it('round-trips base32', () => {
    const raw = Buffer.from([0, 1, 2, 250, 251, 252, 253, 254, 255]);
    expect(base32Decode(base32Encode(raw)).equals(raw)).toBe(true);
  });

  it.each([
    [59, '287082'], // RFC value 94287082 truncated to 6 digits
    [1111111109, '081804'],
    [1234567890, '005924'],
    [2000000000, '279037'],
  ])('accepts the RFC code at T=%i', (t, code) => {
    expect(verifyTotp(RFC_SECRET, code, t * 1000)).toBe(true);
  });

  it('tolerates one step of clock drift but not two', () => {
    expect(verifyTotp(RFC_SECRET, '287082', (59 + 30) * 1000)).toBe(true);
    expect(verifyTotp(RFC_SECRET, '287082', (59 + 90) * 1000)).toBe(false);
  });

  it('rejects malformed codes', () => {
    expect(verifyTotp(RFC_SECRET, '28708', 59_000)).toBe(false);
    expect(verifyTotp(RFC_SECRET, 'abcdef', 59_000)).toBe(false);
  });

  it('generates 160-bit secrets', () => {
    expect(base32Decode(generateTotpSecret())).toHaveLength(20);
  });
});
