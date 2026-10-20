/**
 * Exporte le document OpenAPI sans démarrer le serveur ni toucher la base :
 *   node dist/openapi.js <fichier de sortie>
 * Le mode `preview` de Nest construit le graphe des modules sans instancier les services.
 * Lancé sur le code compilé (et non via tsx) pour garder les métadonnées des décorateurs,
 * dont Swagger a besoin pour décrire les corps de requête.
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

// Valeurs factices : la validation d'environnement s'exécute au chargement d'AppModule.
process.env.DATABASE_URL ??= 'postgresql://openapi:openapi@localhost:5432/openapi';
process.env.JWT_ACCESS_SECRET ??= 'openapi-export-only-not-a-real-secret-000';

const { NestFactory } = await import('@nestjs/core');
const { AppModule } = await import('./app.module.js');
const { API_PREFIX, createOpenApiDocument } = await import('./app.setup.js');

const output = resolve(process.argv[2] ?? 'openapi.json');
const app = await NestFactory.create(AppModule, { preview: true, logger: false });
app.setGlobalPrefix(API_PREFIX);

const document = createOpenApiDocument(app);
await mkdir(dirname(output), { recursive: true });
await writeFile(output, `${JSON.stringify(document, null, 2)}\n`);
await app.close();
console.log(`OpenAPI écrit dans ${output} (${Object.keys(document.paths).length} routes)`);
