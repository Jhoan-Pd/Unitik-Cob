import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

/**
 * AES-256-GCM for device credentials at rest (Network access control policy,
 * ISO/IEC 38500 — Responsibility). Format: iv.tag.ciphertext (hex, dot-joined).
 * Key: DEVICE_SECRET_KEY env var, 64 hex chars (32 bytes).
 */

function loadKey(): Buffer {
  const hex = process.env.DEVICE_SECRET_KEY ?? '';
  if (!/^[0-9a-fA-F]{64}$/.test(hex)) {
    throw new Error('DEVICE_SECRET_KEY debe ser una clave hex de 64 caracteres (32 bytes)');
  }
  return Buffer.from(hex, 'hex');
}

export function encryptSecret(plaintext: string): string {
  const key = loadKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  return [iv.toString('hex'), cipher.getAuthTag().toString('hex'), ciphertext.toString('hex')].join(
    '.',
  );
}

export function decryptSecret(payload: string): string {
  const key = loadKey();
  const [ivHex, tagHex, dataHex] = payload.split('.');
  if (!ivHex || !tagHex || !dataHex) {
    throw new Error('Credencial cifrada con formato inválido');
  }
  const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(ivHex, 'hex'));
  decipher.setAuthTag(Buffer.from(tagHex, 'hex'));
  return Buffer.concat([decipher.update(Buffer.from(dataHex, 'hex')), decipher.final()]).toString(
    'utf8',
  );
}
