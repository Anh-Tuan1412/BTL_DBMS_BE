// Repair an accidental UTF-8 -> latin1 -> UTF-8 import. Dry run by default.
// Run with Node 24: node --env-file=.env scripts/repair-encoding.cjs [--apply]
const mysql = require('mysql2/promise');
const latin = new TextDecoder('windows-1252');
const utf8 = new TextDecoder('utf-8', { fatal: true });
const reverse = new Map(Array.from({ length: 256 }, (_, byte) => [latin.decode(Uint8Array.of(byte)), byte]));

function repairText(value) {
  const chars = [...value];
  if (chars.some(char => !reverse.has(char))) return null;
  try {
    const result = utf8.decode(Uint8Array.from(chars.map(char => reverse.get(char))));
    return result !== value ? result : null;
  } catch { return null; }
}

async function main() {
  const apply = process.argv.includes('--apply');
  const db = await mysql.createConnection({
    host: process.env.DB_HOST || '127.0.0.1', port: Number(process.env.DB_PORT || 3307),
    user: process.env.DB_USERNAME || process.env.DB_USER || 'movie_user', password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME || 'movie_ticket_db', charset: 'utf8mb4',
  });
  let changed = 0;
  try {
    const [columns] = await db.execute(`SELECT c.TABLE_NAME AS t, c.COLUMN_NAME AS c,
      (SELECT k.COLUMN_NAME FROM information_schema.KEY_COLUMN_USAGE k
       WHERE k.TABLE_SCHEMA=c.TABLE_SCHEMA AND k.TABLE_NAME=c.TABLE_NAME AND k.CONSTRAINT_NAME='PRIMARY' LIMIT 1) AS pk
      FROM information_schema.COLUMNS c WHERE c.TABLE_SCHEMA=DATABASE()
      AND c.DATA_TYPE IN ('char','varchar','text','mediumtext','longtext','tinytext')`);
    await db.beginTransaction();
    for (const {t, c, pk} of columns) {
      if (!pk) continue;
      const [rows] = await db.query(`SELECT ${mysql.escapeId(pk)} AS id, ${mysql.escapeId(c)} AS value FROM ${mysql.escapeId(t)} WHERE ${mysql.escapeId(c)} IS NOT NULL`);
      for (const row of rows) {
        const fixed = repairText(row.value);
        if (fixed === null) continue;
        console.log(JSON.stringify({table: t, id: row.id, column: c, action: apply ? 'repair' : 'would-repair'}));
        changed++;
        if (!apply) continue;
        if (t === 'genres' && c === 'genre_name') {
          const [duplicates] = await db.execute('SELECT genre_id FROM genres WHERE genre_name=? AND genre_id<>?', [fixed, row.id]);
          // Keep the original ID referenced by fixtures; merge later duplicate
          // genre rows without dropping any movie-to-genre relationship.
          for (const duplicate of duplicates) {
            await db.execute('INSERT IGNORE INTO movie_genres(movie_id, genre_id) SELECT movie_id, ? FROM movie_genres WHERE genre_id=?', [row.id, duplicate.genre_id]);
            await db.execute('DELETE FROM movie_genres WHERE genre_id=?', [duplicate.genre_id]);
            await db.execute('DELETE FROM genres WHERE genre_id=?', [duplicate.genre_id]);
          }
        }
        await db.execute(`UPDATE ${mysql.escapeId(t)} SET ${mysql.escapeId(c)}=? WHERE ${mysql.escapeId(pk)}=? AND BINARY ${mysql.escapeId(c)}=BINARY ?`, [fixed, row.id, row.value]);
      }
    }
    if (apply) await db.commit(); else await db.rollback();
    console.log(JSON.stringify({mode: apply ? 'applied' : 'dry-run', changed}));
  } catch (error) {
    await db.rollback();
    throw error;
  } finally { await db.end(); }
}

module.exports = {repairText};
if (require.main === module) main().catch(error => { console.error(error.message); process.exit(1); });
