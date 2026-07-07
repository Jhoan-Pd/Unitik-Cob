import { decryptSecret, encryptSecret } from './crypto.util';

describe('crypto.util (AES-256-GCM — Política 2)', () => {
  beforeAll(() => {
    process.env.DEVICE_SECRET_KEY = 'a'.repeat(64);
  });

  it('round-trips a device password and never stores it in plaintext', () => {
    const encrypted = encryptSecret('mikrotik-secret-2026');
    expect(encrypted).not.toContain('mikrotik-secret-2026');
    expect(encrypted.split('.')).toHaveLength(3);
    expect(decryptSecret(encrypted)).toBe('mikrotik-secret-2026');
  });

  it('produces different ciphertexts for the same input (random IV)', () => {
    expect(encryptSecret('same')).not.toBe(encryptSecret('same'));
  });

  it('rejects tampered ciphertexts (GCM auth tag)', () => {
    const encrypted = encryptSecret('secret');
    const [iv, tag, data] = encrypted.split('.');
    const tampered = [iv, tag, data.replace(/^./, data[0] === '0' ? '1' : '0')].join('.');
    expect(() => decryptSecret(tampered)).toThrow();
  });

  it('rejects when the key is missing or malformed', () => {
    const original = process.env.DEVICE_SECRET_KEY;
    process.env.DEVICE_SECRET_KEY = 'short';
    expect(() => encryptSecret('x')).toThrow('DEVICE_SECRET_KEY');
    process.env.DEVICE_SECRET_KEY = original;
  });
});
