import 'server-only';

import crypto from 'crypto';

export class CryptoKeyError extends Error {}

export function getDataEncryptionKey(): Buffer {
  const key = process.env.DATA_ENCRYPTION_KEY;
  if (!key) {
    throw new CryptoKeyError('Missing DATA_ENCRYPTION_KEY');
  }
  const buf = Buffer.from(key, key.length === 64 ? 'hex' : 'utf8');
  if (buf.length !== 32) {
    throw new CryptoKeyError('DATA_ENCRYPTION_KEY must be 32 bytes (use 64-char hex or 32-byte utf8)');
  }
  return buf;
}

export type CipherBundle = {
  ciphertextB64: string;
  ivB64: string;
  tagB64: string;
};

export function encryptSecret(plaintext: string, key: Buffer): CipherBundle {
  if (typeof plaintext !== 'string') throw new Error('Invalid plaintext');
  if (plaintext.length === 0) throw new Error('Plaintext cannot be empty');
  const iv = crypto.randomBytes(12); // GCM standard
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return {
    ciphertextB64: ciphertext.toString('base64'),
    ivB64: iv.toString('base64'),
    tagB64: tag.toString('base64'),
  };
}

export function decryptSecret(bundle: CipherBundle, key: Buffer): string {
  const iv = Buffer.from(bundle.ivB64, 'base64');
  const ciphertext = Buffer.from(bundle.ciphertextB64, 'base64');
  const tag = Buffer.from(bundle.tagB64, 'base64');
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return plaintext.toString('utf8');
}
