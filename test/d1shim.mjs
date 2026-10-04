// Minimal D1-compatible wrapper over node:sqlite, used only for local testing.
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';

export function makeDB(files = ['schema.sql']) {
  const db = new DatabaseSync(':memory:');
  for (const f of files) db.exec(readFileSync(new URL('../' + f, import.meta.url), 'utf8'));
  const stmt = (sql, args = []) => ({
    bind: (...a) => stmt(sql, a),
    async first() { return db.prepare(sql).get(...args) ?? null; },
    async all() { return { results: db.prepare(sql).all(...args) }; },
    async run() { const r = db.prepare(sql).run(...args); return { meta: { last_row_id: Number(r.lastInsertRowid), changes: Number(r.changes) } }; },
  });
  return { prepare: (sql) => stmt(sql), exec: (s) => db.exec(s), raw: db };
}
