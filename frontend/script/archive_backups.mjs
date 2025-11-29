// script/archive_backups.mjs

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ROOT = path.join(__dirname, '..');
const JSON_DIR = path.join(ROOT, 'assets', 'json');
const LOGS_DIR = path.join(ROOT, 'logs');
const ARCHIVE_ROOT = path.join(ROOT, 'archive');

function todayTag() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}${m}${day}`;
}

async function ensureDir(dir) {
  await fs.mkdir(dir, { recursive: true });
}

async function archiveJsonBackups(baseArchive) {
  let moved = 0;
  try {
    const entries = await fs.readdir(JSON_DIR, { withFileTypes: true });
    for (const e of entries) {
      if (!e.isFile()) continue;

      const name = e.name;
      const lower = name.toLowerCase();

      // regola di archivio: tutti i file che nel nome contengono "backup"
      const isBackup =
        lower.includes('backup') ||
        lower.endsWith('.bak.json');

      if (!isBackup) continue;

      const src = path.join(JSON_DIR, name);
      const destDir = path.join(baseArchive, 'assets', 'json');
      const dest = path.join(destDir, name);

      await ensureDir(destDir);
      await fs.rename(src, dest);

      console.log('Archiviato JSON:', path.relative(ROOT, src), '->', path.relative(ROOT, dest));
      moved++;
    }
  } catch (err) {
    console.error('Errore archiviando JSON:', err.message);
  }
  return moved;
}

async function archiveLogs(baseArchive) {
  let moved = 0;
  try {
    const entries = await fs.readdir(LOGS_DIR, { withFileTypes: true });
    if (!entries.length) return 0;

    const destDir = path.join(baseArchive, 'logs');
    await ensureDir(destDir);

    for (const e of entries) {
      if (!e.isFile()) continue;
      const src = path.join(LOGS_DIR, e.name);
      const dest = path.join(destDir, e.name);
      await fs.rename(src, dest);
      console.log('Archiviato log:', path.relative(ROOT, src), '->', path.relative(ROOT, dest));
      moved++;
    }
  } catch (err) {
    if (err.code !== 'ENOENT') {
      console.error('Errore archiviando logs:', err.message);
    }
  }
  return moved;
}

async function run() {
  const tag = todayTag();
  const baseArchive = path.join(ARCHIVE_ROOT, `auto-${tag}`);

  await ensureDir(baseArchive);

  console.log('Archivio destinazione:', path.relative(ROOT, baseArchive));

  const movedJson = await archiveJsonBackups(baseArchive);
  const movedLogs = await archiveLogs(baseArchive);

  console.log('--------------------------');
  console.log('Totale JSON archiviati:', movedJson);
  console.log('Totale log archiviati:', movedLogs);
}

run().catch(err => {
  console.error('Errore generale archivio:', err);
  process.exit(1);
});
