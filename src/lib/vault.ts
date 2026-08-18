import sodium from 'libsodium-wrappers-sumo';
import type { AppState } from './types';

function bytesToBase64(bytes: Uint8Array) {
  return sodium.to_base64(bytes, sodium.base64_variants.ORIGINAL);
}

function base64ToBytes(value: string) {
  return sodium.from_base64(value, sodium.base64_variants.ORIGINAL);
}

async function deriveKey(password: string, salt: Uint8Array) {
  await sodium.ready;
  return sodium.crypto_pwhash(
    sodium.crypto_secretbox_KEYBYTES,
    password,
    salt,
    sodium.crypto_pwhash_OPSLIMIT_INTERACTIVE,
    sodium.crypto_pwhash_MEMLIMIT_INTERACTIVE,
    sodium.crypto_pwhash_ALG_ARGON2ID13,
  );
}

/** Encrypts the classroom with a key derived from the teacher's password. */
export async function encryptVault(password: string, value: AppState) {
  await sodium.ready;
  const salt = sodium.randombytes_buf(sodium.crypto_pwhash_SALTBYTES);
  const nonce = sodium.randombytes_buf(sodium.crypto_secretbox_NONCEBYTES);
  const key = await deriveKey(password, salt);
  const cipher = sodium.crypto_secretbox_easy(JSON.stringify(value), nonce, key);
  return JSON.stringify({ version: 1, salt: bytesToBase64(salt), nonce: bytesToBase64(nonce), cipher: bytesToBase64(cipher) });
}

export async function decryptVault(password: string, stored: string): Promise<AppState> {
  await sodium.ready;
  const box = JSON.parse(stored) as { salt: string; nonce: string; cipher: string };
  const key = await deriveKey(password, base64ToBytes(box.salt));
  const clear = sodium.crypto_secretbox_open_easy(base64ToBytes(box.cipher), base64ToBytes(box.nonce), key, 'text');
  return JSON.parse(clear) as AppState;
}
