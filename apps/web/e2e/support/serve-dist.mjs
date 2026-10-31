// Sert le build de production (dist/web/browser) comme Vercel : fichiers statiques, et
// index.html pour toute autre route (application monopage). Utilisé par playwright.config.ts.
import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer, request as httpRequest } from 'node:http';
import { extname, join, normalize, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '../../dist/web/browser');
const port = Number(process.env.PORT ?? 4300);
const types = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.webmanifest': 'application/manifest+json',
};

if (!existsSync(join(root, 'index.html'))) {
  console.error(`Build introuvable dans ${root} : lancez d'abord « pnpm build ».`);
  process.exit(1);
}

// Comme la réécriture de vercel.json : /api/* part vers l'API (même origine, donc le cookie
// httpOnly du refresh token, en SameSite=Strict, fonctionne comme en production).
const apiProxy = process.env.API_PROXY ? new URL(process.env.API_PROXY) : null;

function proxyToApi(request, response) {
  const upstream = httpRequest(
    {
      hostname: apiProxy.hostname,
      port: apiProxy.port,
      path: request.url,
      method: request.method,
      headers: { ...request.headers, host: apiProxy.host },
    },
    (reply) => {
      response.writeHead(reply.statusCode ?? 502, reply.headers);
      reply.pipe(response);
    },
  );
  upstream.on('error', () => {
    response.writeHead(502, { 'Content-Type': 'application/json' });
    response.end(JSON.stringify({ statusCode: 502, message: 'API injoignable' }));
  });
  request.pipe(upstream);
}

createServer((request, response) => {
  const path = decodeURIComponent(new URL(request.url ?? '/', 'http://localhost').pathname);
  if (apiProxy && path.startsWith('/api/')) return proxyToApi(request, response);
  let file = normalize(join(root, path));
  if (!file.startsWith(root) || !existsSync(file) || statSync(file).isDirectory()) {
    file = join(root, 'index.html');
  }
  response.writeHead(200, { 'Content-Type': types[extname(file)] ?? 'application/octet-stream' });
  createReadStream(file).pipe(response);
}).listen(port, () => console.log(`DevMirror (build) sur http://localhost:${port}`));
