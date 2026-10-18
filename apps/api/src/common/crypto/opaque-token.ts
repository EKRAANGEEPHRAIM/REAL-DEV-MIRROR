import { createHash, randomBytes } from 'node:crypto';

/** Jeton aléatoire de 256 bits, encodé en base64url (43 caractères, sûr dans une URL). */
export function generateOpaqueToken(): string {
  return randomBytes(32).toString('base64url');
}

/**
 * Empreinte stockée en base à la place du jeton : une fuite de la base ne permet pas
 * de le rejouer. SHA-256 suffit (pas bcrypt) car le jeton a 256 bits d'entropie,
 * contrairement à un mot de passe.
 */
export function hashOpaqueToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}
