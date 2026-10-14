import 'dotenv/config';
import { defineConfig } from 'prisma/config';

/**
 * Neon ne fournit que l'URL poolée (hôte en "-pooler"). Les migrations passent par
 * l'hôte direct, obtenu en retirant "-pooler" ; l'application garde l'URL poolée.
 * `connect_timeout` laisse le temps à une base Neon en veille de redémarrer.
 */
function directUrl(pooledUrl: string | undefined): string {
  if (!pooledUrl) return '';
  const url = new URL(pooledUrl.replace('-pooler.', '.'));
  if (!url.searchParams.has('connect_timeout')) url.searchParams.set('connect_timeout', '15');
  return url.toString();
}

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  datasource: {
    url: directUrl(process.env.DATABASE_URL),
  },
});
