import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { type UploadApiResponse, v2 as cloudinary } from 'cloudinary';
import { EnvironmentVariables } from '../../config/env.validation.js';

export const AVATAR_STORAGE_DISABLED =
  'L’envoi d’avatar n’est pas configuré sur ce serveur (CLOUDINARY_URL manquante)';

const FOLDER = 'devmirror/avatars';
/** Avatars affichés au plus en 128 px : 256 px couvrent les écrans haute densité. */
const SIZE = 256;

/**
 * Stockage des avatars sur Cloudinary : un fichier par utilisateur (son id), recadré en carré
 * sur le visage, converti en WebP. L'URL renvoyée contient un numéro de version : elle change
 * à chaque envoi, donc navigateurs et CDN ne gardent pas l'ancienne image.
 */
@Injectable()
export class AvatarStorage {
  readonly enabled: boolean;

  constructor(config: ConfigService<EnvironmentVariables, true>) {
    const url = config.get('CLOUDINARY_URL', { infer: true });
    this.enabled = !!url;
    if (url) {
      // cloudinary://clé:secret@nom-du-cloud
      const { username, password, hostname } = new URL(url);
      cloudinary.config({
        cloud_name: hostname,
        api_key: decodeURIComponent(username),
        api_secret: decodeURIComponent(password),
        secure: true,
      });
    }
  }

  async upload(userId: string, image: Buffer): Promise<string> {
    this.assertEnabled();
    const result = await new Promise<UploadApiResponse>((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        {
          folder: FOLDER,
          public_id: userId,
          overwrite: true,
          invalidate: true,
          resource_type: 'image',
          format: 'webp',
          transformation: [{ width: SIZE, height: SIZE, crop: 'fill', gravity: 'face' }],
        },
        (error, response) => (error || !response ? reject(error) : resolve(response)),
      );
      stream.end(image);
    });
    return result.secure_url;
  }

  async remove(userId: string): Promise<void> {
    this.assertEnabled();
    await cloudinary.uploader.destroy(`${FOLDER}/${userId}`, { invalidate: true });
  }

  private assertEnabled(): void {
    if (!this.enabled) throw new ServiceUnavailableException(AVATAR_STORAGE_DISABLED);
  }
}
