import 'dotenv/config';
import { PrismaNeon } from '@prisma/adapter-neon';
import { DEMO_EMAIL } from '../common/demo/demo-account.js';
import { PrismaClient } from '../generated/prisma/client.js';
import { PasswordService } from '../modules/auth/password.service.js';
import { seedDemoAccount } from './demo-seed.js';

/**
 * Recrée le compte de démo sur la base de DATABASE_URL :
 *   pnpm --filter @devmirror/api seed:demo -- --confirm
 * Mot de passe : DEMO_PASSWORD, sinon celui par défaut (public, affiché sur la page de
 * connexion). Sans --confirm, la commande affiche seulement la base visée.
 */
const DEFAULT_DEMO_PASSWORD = 'DemoDevMirror2026';

async function main(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL?.trim().replace(/^(['"])(.*)\1$/, '$2');
  if (!databaseUrl) throw new Error('DATABASE_URL manquante');
  // Hôte seulement : jamais l'URL complète, qui contient le mot de passe de la base.
  const host = new URL(databaseUrl).hostname;
  console.log(`Base visée : ${host}`);
  if (!process.argv.includes('--confirm')) {
    console.log(`Rien n'a été modifié. Relancer avec --confirm pour recréer ${DEMO_EMAIL}.`);
    return;
  }

  const prisma = new PrismaClient({ adapter: new PrismaNeon({ connectionString: databaseUrl }) });
  try {
    const started = Date.now();
    const summary = await seedDemoAccount(prisma, new PasswordService(), {
      email: DEMO_EMAIL,
      password: process.env.DEMO_PASSWORD || DEFAULT_DEMO_PASSWORD,
    });
    console.log(
      `Compte ${DEMO_EMAIL} recréé en ${((Date.now() - started) / 1000).toFixed(1)} s : ` +
        `${summary.projects} projets, ${summary.tasks} tâches, ${summary.goals} objectifs, ` +
        `${summary.notes} notes, ${summary.tags} tags, ${summary.activity} activités.`,
    );
  } finally {
    await prisma.$disconnect();
  }
}

await main();
