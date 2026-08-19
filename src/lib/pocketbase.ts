import PocketBase, { BaseAuthStore } from 'pocketbase';

// The browser talks to PocketBase directly; there is no backend proxy. In
// production the platform sets this to this project's own subdomain. Locally we
// use 8093 because other projects on this machine already hold 8090-8092.
const backendUrl = import.meta.env.VITE_POCKETBASE_URL || 'http://127.0.0.1:8093';

/**
 * Teacher client. BaseAuthStore keeps the session in memory only, so a refresh
 * always signs the teacher out.
 */
export const pb = new PocketBase(backendUrl, new BaseAuthStore());
pb.autoCancellation(false);

/** Kiosk client, kept separate so a classroom device never shares teacher credentials. */
export const kioskPb = new PocketBase(backendUrl, new BaseAuthStore());

export const kioskSessionKey = 'hallpass.kiosk.session';
export const vaultKeyPrefix = 'hallpass.encrypted.vault.';
export const authKey = 'hallpass.prototype.auth';

export function vaultKey() {
  const teacherId = pb.authStore.record?.id;
  if (!teacherId) throw new Error('Teacher authentication required');
  return `${vaultKeyPrefix}${teacherId}`;
}
