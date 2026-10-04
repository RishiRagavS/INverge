// Local preview WITHOUT Cloudflare: serves /public and runs the real Worker against an in-memory SQLite (Node 22.5+).
// Run: node scripts/preview.mjs   → http://localhost:8788   (data resets on restart)
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { makeDB } from '../test/d1shim.mjs';
import worker from '../src/index.js';

const PORT = Number(process.env.PORT) || 8788;
const root = new URL('../public/', import.meta.url).pathname;
const env = { DB: makeDB(['schema.sql', ...(process.env.NO_SEED ? [] : ['seed.sql'])]), ADMIN_EMAILS: process.env.ADMIN_EMAILS || '', ALLOW_DEMO_ADMIN: 'true', PBKDF2_ITERATIONS: '15000', RESEND_API_KEY: process.env.RESEND_API_KEY, EMAIL_FROM: process.env.EMAIL_FROM };
const SEC = Object.fromEntries((await readFile(new URL('../public/_headers', import.meta.url), 'utf8')).split('\n').slice(1).map((l) => l.trim()).filter(Boolean).map((l) => [l.slice(0, l.indexOf(':')).toLowerCase(), l.slice(l.indexOf(':') + 1).trim()]));
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon', '.json': 'application/json' };

http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);
    if (url.pathname.startsWith('/api/')) {
      const chunks = []; for await (const c of req) chunks.push(c);
      const r = await worker.fetch(new Request(url, { method: req.method, headers: req.headers, body: ['GET', 'HEAD'].includes(req.method) ? undefined : Buffer.concat(chunks) }), env);
      const headers = {}; r.headers.forEach((v, k) => { if (k !== 'set-cookie') headers[k] = v; });
      const cookies = r.headers.getSetCookie?.() || []; if (cookies.length) headers['set-cookie'] = cookies;
      res.writeHead(r.status, headers); return res.end(Buffer.from(await r.arrayBuffer()));
    }
    const file = join(root, normalize(url.pathname === '/' ? 'index.html' : url.pathname).replace(/^(\.\.[/\\])+/, ''));
    if (!file.startsWith(root)) throw new Error('bad path');
    const data = await readFile(file);
    res.writeHead(200, { ...SEC, 'content-type': MIME[extname(file)] || 'application/octet-stream' }); res.end(data);
  } catch (e) { res.writeHead(e.code === 'ENOENT' ? 404 : 500); res.end('Not found'); }
}).listen(PORT, () => console.log(`INverge preview → http://localhost:${PORT}  (demo password: see demo-password.txt, e.g. alpha.founder@inverge.test)`));
