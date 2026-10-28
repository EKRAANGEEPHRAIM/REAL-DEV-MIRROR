/** Poids maximal d'un avatar envoyé (cahier des charges : 2 Mo). */
export const MAX_AVATAR_BYTES = 2 * 1024 * 1024;

export const AVATAR_TOO_LARGE = 'L’image dépasse 2 Mo';
export const AVATAR_INVALID_TYPE = 'Format d’image non pris en charge (JPEG, PNG, WebP ou GIF)';
export const AVATAR_MISSING = 'Aucune image reçue (champ « avatar »)';

export type ImageType = 'jpeg' | 'png' | 'webp' | 'gif';

/** Ce que l'API lit du fichier reçu par multer (stockage en mémoire). */
export interface UploadedImage {
  buffer: Buffer;
  size: number;
}

/**
 * Type réel d'une image d'après ses premiers octets (« nombre magique ») : le type MIME
 * annoncé par le navigateur se falsifie trivialement, pas le contenu du fichier.
 */
export function detectImageType(buffer: Uint8Array): ImageType | null {
  const startsWith = (bytes: number[], offset = 0) =>
    bytes.every((byte, i) => buffer[offset + i] === byte);
  const ascii = (text: string) => Array.from(text, (char) => char.charCodeAt(0));

  if (startsWith([0xff, 0xd8, 0xff])) return 'jpeg';
  if (startsWith([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return 'png';
  if (startsWith(ascii('RIFF')) && startsWith(ascii('WEBP'), 8)) return 'webp';
  if (startsWith(ascii('GIF87a')) || startsWith(ascii('GIF89a'))) return 'gif';
  return null;
}
